import { createServerFn } from "@tanstack/react-start";
import { getYouTubeApiKey } from "#/lib/env";
import { generateRoomCode } from "#/lib/server/room-code";
import { getFingerprint } from "#/lib/server/security";
import { createServerSupabaseClient } from "#/lib/server/supabase";
import type {
	CreateRoomResult,
	QueueItem,
	QueueRow,
	RoomSnapshot,
	SessionStat,
	SongSearchResult,
	VoteRow,
} from "#/lib/types";
import { sortQueue } from "#/lib/utils";

function requireString(value: unknown, label: string) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`Invalid ${label}`);
	}

	return value.trim();
}

function normalizeCode(code: string) {
	return code.trim().toUpperCase();
}

function voteMap(votes: VoteRow[]) {
	return votes.reduce<Record<string, number>>((acc, vote) => {
		acc[vote.queue_id] = (acc[vote.queue_id] ?? 0) + 1;
		return acc;
	}, {});
}

function fingerprintAlias(fingerprint: string) {
	return `Guest ${fingerprint.slice(0, 4).toUpperCase()}`;
}

function buildSessionStats(
	queue: QueueItem[],
	votes: VoteRow[],
): SessionStat[] {
	const singerCounts = queue.reduce<Record<string, number>>((acc, item) => {
		acc[item.submitter_name] = (acc[item.submitter_name] ?? 0) + 1;
		return acc;
	}, {});
	const topSingerEntry = Object.entries(singerCounts).sort((left, right) => {
		if (right[1] !== left[1]) {
			return right[1] - left[1];
		}

		return left[0].localeCompare(right[0]);
	})[0];

	const topVotedSong = [...queue].sort((left, right) => {
		if (right.votes !== left.votes) {
			return right.votes - left.votes;
		}

		return left.position - right.position;
	})[0];

	const voterCounts = votes.reduce<Record<string, number>>((acc, vote) => {
		acc[vote.fingerprint] = (acc[vote.fingerprint] ?? 0) + 1;
		return acc;
	}, {});
	const voterNames = votes.reduce<Record<string, string>>((acc, vote) => {
		if (vote.voter_name?.trim()) {
			acc[vote.fingerprint] = vote.voter_name.trim();
		}

		return acc;
	}, {});
	const topVoterEntry = Object.entries(voterCounts).sort((left, right) => {
		if (right[1] !== left[1]) {
			return right[1] - left[1];
		}

		return left[0].localeCompare(right[0]);
	})[0];

	return [
		{
			label: "Top Singer",
			value: topSingerEntry
				? `${topSingerEntry[0]} • ${topSingerEntry[1]} song${topSingerEntry[1] === 1 ? "" : "s"}`
				: "Nobody queued yet",
			accent: "#ffd84d",
		},
		{
			label: "Top Hype Giver",
			value: topVoterEntry
				? `${voterNames[topVoterEntry[0]] ?? fingerprintAlias(topVoterEntry[0])} • ${topVoterEntry[1]} vote${topVoterEntry[1] === 1 ? "" : "s"}`
				: "No votes yet",
			accent: "#4fd5ff",
		},
		{
			label: "Crowd Favorite",
			value: topVotedSong
				? `${topVotedSong.song_title} • ${topVotedSong.votes} hype`
				: "Waiting on the first anthem",
			accent: "#f94892",
		},
		{
			label: "Session Hype",
			value: `${votes.length} total vote${votes.length === 1 ? "" : "s"}`,
			accent: "#ff8d3a",
		},
	];
}

async function getRoomForCode(code: string) {
	const supabase = createServerSupabaseClient();
	const result = await supabase
		.from("rooms")
		.select("id, code, status, host_token, created_at")
		.eq("code", normalizeCode(code))
		.maybeSingle();

	if (result.error) {
		throw new Error(result.error.message);
	}

	if (!result.data) {
		throw new Error("Room not found");
	}

	return result.data;
}

async function loadSnapshot(
	code: string,
	hostToken?: string,
): Promise<RoomSnapshot> {
	const supabase = createServerSupabaseClient();
	const room = await getRoomForCode(code);
	const fingerprint = getFingerprint();
	const queueResult = await supabase
		.from("queue")
		.select(
			"id, room_id, song_id, song_title, artist, thumbnail_url, submitter_name, status, position, created_at",
		)
		.eq("room_id", room.id);

	if (queueResult.error) {
		throw new Error(queueResult.error.message);
	}

	const queueRows = queueResult.data as QueueRow[];
	const queueIds = queueRows.map((item) => item.id);

	let votes: VoteRow[] = [];
	let ownVotes: VoteRow[] = [];

	if (queueIds.length > 0) {
		const [voteResult, ownVoteResult] = await Promise.all([
			supabase
				.from("votes")
				.select("id, queue_id, fingerprint, voter_name")
				.in("queue_id", queueIds),
			supabase
				.from("votes")
				.select("id, queue_id, fingerprint, voter_name")
				.in("queue_id", queueIds)
				.eq("fingerprint", fingerprint),
		]);

		if (voteResult.error) {
			throw new Error(voteResult.error.message);
		}

		if (ownVoteResult.error) {
			throw new Error(ownVoteResult.error.message);
		}

		votes = voteResult.data as VoteRow[];
		ownVotes = ownVoteResult.data as VoteRow[];
	}

	const counts = voteMap(votes);
	const ownVoteIds = new Set(ownVotes.map((vote) => vote.queue_id));
	const allQueue = sortQueue(
		queueRows.map((row) => ({
			...row,
			votes: counts[row.id] ?? 0,
			hasVoted: ownVoteIds.has(row.id),
		})),
	) as QueueItem[];
	const pendingQueue = allQueue.filter((item) => item.status === "pending");
	const approvedQueue = allQueue.filter((item) => item.status !== "pending");
	const visibleQueue = hostToken === room.host_token ? allQueue : approvedQueue;
	const nowPlaying =
		approvedQueue.find((item) => item.status === "playing") ?? null;
	const nextUp =
		approvedQueue.find(
			(item) =>
				item.status === "waiting" &&
				(!nowPlaying || item.position > nowPlaying.position),
		) ??
		approvedQueue.find((item) => item.status === "waiting") ??
		null;

	return {
		room: {
			id: room.id,
			code: room.code,
			status: room.status,
			created_at: room.created_at,
		},
		queue: visibleQueue,
		pendingQueue: hostToken === room.host_token ? pendingQueue : [],
		nowPlaying,
		nextUp,
		stats: buildSessionStats(approvedQueue, votes),
		viewerFingerprint: fingerprint,
		isHost: hostToken === room.host_token,
	};
}

async function ensureHostRoom(code: string, hostToken: string) {
	const room = await getRoomForCode(code);

	if (room.host_token !== hostToken) {
		throw new Error("Invalid host token");
	}

	return room;
}

function getNextWaitingSong(queue: QueueItem[]) {
	return (
		queue
			.filter((item) => item.status === "waiting")
			.sort((left, right) => left.position - right.position)[0] ?? null
	);
}

const CACHE_TTL_HOURS = 1;

async function fetchYouTubeResults(query: string): Promise<SongSearchResult[]> {
	const searchParams = new URLSearchParams({
		key: getYouTubeApiKey(),
		part: "snippet",
		maxResults: "8",
		q: `${query} karaoke`,
		type: "video",
	});

	const response = await fetch(
		`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
	);

	if (!response.ok) {
		throw new Error("YouTube search failed");
	}

	const json = (await response.json()) as {
		items?: Array<{
			id?: { videoId?: string };
			snippet?: {
				title?: string;
				channelTitle?: string;
				thumbnails?: {
					high?: { url?: string };
					medium?: { url?: string };
					default?: { url?: string };
				};
			};
		}>;
	};
	const searchItems = (json.items ?? [])
		.map((item) => {
			const id = item.id?.videoId;
			const title = item.snippet?.title;

			if (!id || !title) {
				return null;
			}

			return {
				id,
				title,
				artist: item.snippet?.channelTitle ?? "Unknown Artist",
				thumbnail:
					item.snippet?.thumbnails?.high?.url ??
					item.snippet?.thumbnails?.medium?.url ??
					item.snippet?.thumbnails?.default?.url ??
					"",
			};
		})
		.filter((item): item is SongSearchResult => Boolean(item));

	if (searchItems.length === 0) {
		return [];
	}

	const detailsParams = new URLSearchParams({
		key: getYouTubeApiKey(),
		part: "status",
		id: searchItems.map((item) => item.id).join(","),
	});
	const detailsResponse = await fetch(
		`https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`,
	);

	if (!detailsResponse.ok) {
		throw new Error("YouTube video details lookup failed");
	}

	const detailsJson = (await detailsResponse.json()) as {
		items?: Array<{
			id?: string;
			status?: { embeddable?: boolean };
		}>;
	};
	const embeddableMap = new Map(
		(detailsJson.items ?? []).map((item) => [
			item.id ?? "",
			item.status?.embeddable,
		]),
	);

	return searchItems
		.map((item) => ({
			...item,
			embeddable: embeddableMap.get(item.id) !== false,
		}))
		.filter((item) => item.embeddable !== false);
}

export const searchYouTube = createServerFn({ method: "GET" })
	.inputValidator((input: { query: string }) => ({
		query: requireString(input.query, "query"),
	}))
	.handler(async ({ data }): Promise<SongSearchResult[]> => {
		const cacheKey = data.query.toLowerCase();
		const supabase = createServerSupabaseClient();
		const cached = await supabase
			.from("search_cache")
			.select("results, created_at")
			.eq("query", cacheKey)
			.maybeSingle();

		if (cached.data) {
			const ageHours =
				(Date.now() - new Date(cached.data.created_at).getTime()) / 3_600_000;

			if (ageHours < CACHE_TTL_HOURS) {
				return cached.data.results as SongSearchResult[];
			}
		}

		const results = await fetchYouTubeResults(data.query);

		await supabase
			.from("search_cache")
			.upsert({ query: cacheKey, results, created_at: new Date().toISOString() });

		return results;
	});

export const createRoom = createServerFn({ method: "POST" }).handler(
	async (): Promise<CreateRoomResult> => {
		const supabase = createServerSupabaseClient();
		let lastErrorMessage = "Unable to create room";

		for (let attempt = 0; attempt < 10; attempt += 1) {
			const code = generateRoomCode();
			const hostToken = crypto.randomUUID();
			const result = await supabase
				.from("rooms")
				.insert({
					code,
					host_token: hostToken,
					status: "open",
				})
				.select("code, host_token")
				.single();

			if (!result.error && result.data) {
				return {
					code: result.data.code,
					hostToken: result.data.host_token,
				};
			}

			if (result.error?.message) {
				lastErrorMessage = result.error.message;
			}
		}

		throw new Error(lastErrorMessage);
	},
);

export const getRoomSnapshot = createServerFn({ method: "GET" })
	.inputValidator((input: { code: string; hostToken?: string }) => ({
		code: requireString(input.code, "room code"),
		hostToken:
			typeof input.hostToken === "string" ? input.hostToken : undefined,
	}))
	.handler(async ({ data }) => loadSnapshot(data.code, data.hostToken));

export const addSongToQueue = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			code: string;
			songId: string;
			songTitle: string;
			artist: string;
			thumbnailUrl: string;
			submitterName: string;
		}) => ({
			code: requireString(input.code, "room code"),
			songId: requireString(input.songId, "song id"),
			songTitle: requireString(input.songTitle, "song title"),
			artist: requireString(input.artist, "artist"),
			thumbnailUrl: requireString(input.thumbnailUrl, "thumbnail"),
			submitterName: requireString(input.submitterName, "submitter name").slice(
				0,
				32,
			),
		}),
	)
	.handler(async ({ data }) => {
		const supabase = createServerSupabaseClient();
		const room = await getRoomForCode(data.code);

		if (room.status !== "open") {
			throw new Error("Room is closed");
		}

		const positionResult = await supabase
			.from("queue")
			.select("position")
			.eq("room_id", room.id)
			.order("position", { ascending: false })
			.limit(1)
			.maybeSingle();

		if (positionResult.error) {
			throw new Error(positionResult.error.message);
		}

		const insertResult = await supabase.from("queue").insert({
			room_id: room.id,
			song_id: data.songId,
			song_title: data.songTitle,
			artist: data.artist,
			thumbnail_url: data.thumbnailUrl,
			submitter_name: data.submitterName,
			status: "pending",
			position: (positionResult.data?.position ?? 0) + 1,
		});

		if (insertResult.error) {
			throw new Error(insertResult.error.message);
		}

		return loadSnapshot(data.code);
	});

export const toggleVote = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { code: string; queueId: string; voterName?: string }) => ({
			code: requireString(input.code, "room code"),
			queueId: requireString(input.queueId, "queue id"),
			voterName:
				typeof input.voterName === "string"
					? input.voterName.trim().slice(0, 32)
					: "",
		}),
	)
	.handler(async ({ data }) => {
		const supabase = createServerSupabaseClient();
		const fingerprint = getFingerprint();
		const existingVote = await supabase
			.from("votes")
			.select("id")
			.eq("queue_id", data.queueId)
			.eq("fingerprint", fingerprint)
			.maybeSingle();

		if (existingVote.error) {
			throw new Error(existingVote.error.message);
		}

		if (existingVote.data?.id) {
			const removeResult = await supabase
				.from("votes")
				.delete()
				.eq("id", existingVote.data.id);

			if (removeResult.error) {
				throw new Error(removeResult.error.message);
			}
		} else {
			const insertResult = await supabase.from("votes").insert({
				queue_id: data.queueId,
				fingerprint,
				voter_name: data.voterName || null,
			});

			if (insertResult.error) {
				throw new Error(insertResult.error.message);
			}
		}

		return loadSnapshot(data.code);
	});

export const setRoomStatus = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			code: string;
			hostToken: string;
			status: "open" | "closed";
		}) => ({
			code: requireString(input.code, "room code"),
			hostToken: requireString(input.hostToken, "host token"),
			status: input.status,
		}),
	)
	.handler(async ({ data }) => {
		const supabase = createServerSupabaseClient();
		const room = await ensureHostRoom(data.code, data.hostToken);
		const result = await supabase
			.from("rooms")
			.update({ status: data.status })
			.eq("id", room.id);

		if (result.error) {
			throw new Error(result.error.message);
		}

		return loadSnapshot(data.code, data.hostToken);
	});

export const setQueueStatus = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			code: string;
			hostToken: string;
			queueId: string;
			status: "playing" | "done";
		}) => ({
			code: requireString(input.code, "room code"),
			hostToken: requireString(input.hostToken, "host token"),
			queueId: requireString(input.queueId, "queue id"),
			status: input.status,
		}),
	)
	.handler(async ({ data }) => {
		const supabase = createServerSupabaseClient();
		const room = await ensureHostRoom(data.code, data.hostToken);

		if (data.status === "playing") {
			const resetResult = await supabase
				.from("queue")
				.update({ status: "waiting" })
				.eq("room_id", room.id)
				.eq("status", "playing");

			if (resetResult.error) {
				throw new Error(resetResult.error.message);
			}
		}

		const result = await supabase
			.from("queue")
			.update({ status: data.status })
			.eq("id", data.queueId)
			.eq("room_id", room.id);

		if (result.error) {
			throw new Error(result.error.message);
		}

		return loadSnapshot(data.code, data.hostToken);
	});

export const removeQueueItem = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { code: string; hostToken: string; queueId: string }) => ({
			code: requireString(input.code, "room code"),
			hostToken: requireString(input.hostToken, "host token"),
			queueId: requireString(input.queueId, "queue id"),
		}),
	)
	.handler(async ({ data }) => {
		const supabase = createServerSupabaseClient();
		const room = await ensureHostRoom(data.code, data.hostToken);
		const voteDelete = await supabase
			.from("votes")
			.delete()
			.eq("queue_id", data.queueId);

		if (voteDelete.error) {
			throw new Error(voteDelete.error.message);
		}

		const result = await supabase
			.from("queue")
			.delete()
			.eq("id", data.queueId)
			.eq("room_id", room.id);

		if (result.error) {
			throw new Error(result.error.message);
		}

		return loadSnapshot(data.code, data.hostToken);
	});

export const reorderQueue = createServerFn({ method: "POST" })
	.inputValidator(
		(input: {
			code: string;
			hostToken: string;
			orderedQueueIds: string[];
		}) => ({
			code: requireString(input.code, "room code"),
			hostToken: requireString(input.hostToken, "host token"),
			orderedQueueIds: input.orderedQueueIds.filter(
				(value): value is string => typeof value === "string",
			),
		}),
	)
	.handler(async ({ data }) => {
		const supabase = createServerSupabaseClient();
		const room = await ensureHostRoom(data.code, data.hostToken);
		const queueResult = await supabase
			.from("queue")
			.select("id, status")
			.eq("room_id", room.id);

		if (queueResult.error) {
			throw new Error(queueResult.error.message);
		}

		const reorderableIds = new Set(
			(queueResult.data ?? [])
				.filter(
					(item) => item.status === "playing" || item.status === "waiting",
				)
				.map((item) => item.id),
		);
		const orderedQueueIds = data.orderedQueueIds.filter((id) =>
			reorderableIds.has(id),
		);

		const updateResults = await Promise.all(
			orderedQueueIds.map((id, index) =>
				supabase
					.from("queue")
					.update({ position: index + 1 })
					.eq("id", id)
					.eq("room_id", room.id),
			),
		);

		for (const result of updateResults) {
			if (result.error) {
				throw new Error(result.error.message);
			}
		}

		return loadSnapshot(data.code, data.hostToken);
	});

export const approveQueueItem = createServerFn({ method: "POST" })
	.inputValidator(
		(input: { code: string; hostToken: string; queueId: string }) => ({
			code: requireString(input.code, "room code"),
			hostToken: requireString(input.hostToken, "host token"),
			queueId: requireString(input.queueId, "queue id"),
		}),
	)
	.handler(async ({ data }) => {
		const supabase = createServerSupabaseClient();
		const room = await ensureHostRoom(data.code, data.hostToken);
		const result = await supabase
			.from("queue")
			.update({ status: "waiting" })
			.eq("id", data.queueId)
			.eq("room_id", room.id)
			.eq("status", "pending");

		if (result.error) {
			throw new Error(result.error.message);
		}

		return loadSnapshot(data.code, data.hostToken);
	});

export const advanceQueue = createServerFn({ method: "POST" })
	.inputValidator((input: { code: string; finishedQueueId?: string }) => ({
		code: requireString(input.code, "room code"),
		finishedQueueId:
			typeof input.finishedQueueId === "string"
				? input.finishedQueueId
				: undefined,
	}))
	.handler(async ({ data }) => {
		const supabase = createServerSupabaseClient();
		const room = await getRoomForCode(data.code);
		const snapshot = await loadSnapshot(data.code);
		const currentPlaying = snapshot.nowPlaying;
		const nextWaiting = getNextWaitingSong(snapshot.queue);

		if (data.finishedQueueId) {
			if (currentPlaying?.id !== data.finishedQueueId) {
				return loadSnapshot(data.code);
			}

			const finishResult = await supabase
				.from("queue")
				.update({ status: "done" })
				.eq("id", data.finishedQueueId)
				.eq("room_id", room.id);

			if (finishResult.error) {
				throw new Error(finishResult.error.message);
			}
		}

		const nextToPlay =
			data.finishedQueueId && nextWaiting?.id === data.finishedQueueId
				? (snapshot.queue.find(
						(item) =>
							item.status === "waiting" && item.id !== data.finishedQueueId,
					) ?? null)
				: nextWaiting;

		if (!currentPlaying || data.finishedQueueId) {
			if (nextToPlay) {
				const startResult = await supabase
					.from("queue")
					.update({ status: "playing" })
					.eq("id", nextToPlay.id)
					.eq("room_id", room.id);

				if (startResult.error) {
					throw new Error(startResult.error.message);
				}
			}
		}

		return loadSnapshot(data.code);
	});
