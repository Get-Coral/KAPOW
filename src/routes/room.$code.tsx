import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Lock, MicVocal, SearchCode, Users } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";
import {
	BackHomeButton,
	ComicWordmark,
	EmptyState,
	HeroFrame,
	NeonPanel,
	QueueCard,
	SearchField,
	SearchResults,
} from "#/components/kapow-ui";
import {
	getClientHeaders,
	useRoomLiveQuery,
} from "#/hooks/use-room-live-query";
import { queryKeys } from "#/lib/query";
import { getStoredGuestName, setStoredGuestName } from "#/lib/storage";
import type { SongSearchResult } from "#/lib/types";
import { addSongToQueue, searchYouTube, toggleVote } from "#/server/rooms";

export const Route = createFileRoute("/room/$code")({
	component: GuestRoomPage,
});

function GuestRoomPage() {
	const { code } = Route.useParams();
	const queryClient = useQueryClient();
	const roomQuery = useRoomLiveQuery(code);
	const roomQueryKey = queryKeys.room(code);
	const [guestName, setGuestName] = useState("");
	const [draftGuestName, setDraftGuestName] = useState("");
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<SongSearchResult[]>([]);
	const [submissionNotice, setSubmissionNotice] = useState("");
	const latestSearchRef = useRef("");

	useEffect(() => {
		const storedGuestName = getStoredGuestName();
		setGuestName(storedGuestName);
		setDraftGuestName(storedGuestName);
	}, []);

	const searchMutation = useMutation({
		mutationFn: (value: string) => searchYouTube({ data: { query: value } }),
		onSuccess: (data, value) => {
			if (latestSearchRef.current === value.trim()) {
				setResults(data);
			}
		},
	});
	const addSongMutation = useMutation({
		mutationFn: (song: SongSearchResult) =>
			addSongToQueue({
				data: {
					code,
					songId: song.id,
					songTitle: song.title,
					artist: song.artist,
					thumbnailUrl: song.thumbnail,
					submitterName: guestName,
				},
				headers: getClientHeaders(),
			}),
		onMutate: async (song) => {
			await queryClient.cancelQueries({ queryKey: roomQueryKey });
			const previousSearch = search;
			const previousResults = results;

			setSubmissionNotice(
				`Sending "${song.title}" to the host for approval...`,
			);
			setResults([]);
			setSearch("");

			return {
				previousSearch,
				previousResults,
			};
		},
		onError: (_error, _song, context) => {
			setSubmissionNotice("");
			setSearch(context?.previousSearch ?? "");
			setResults(context?.previousResults ?? []);
		},
		onSuccess: (snapshot) => {
			setSubmissionNotice("Song submitted. It’s waiting for host approval.");
			queryClient.setQueryData(roomQueryKey, snapshot);
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: roomQueryKey });
		},
	});
	const voteMutation = useMutation({
		mutationFn: (queueId: string) =>
			toggleVote({
				data: {
					code,
					queueId,
					voterName: guestName,
				},
				headers: getClientHeaders(),
			}),
		onSuccess: (snapshot) => {
			queryClient.setQueryData(roomQueryKey, snapshot);
		},
	});

	function handleSearch() {
		const nextSearch = search.trim();

		if (!nextSearch) {
			setResults([]);
			return;
		}

		latestSearchRef.current = nextSearch;
		searchMutation.mutate(nextSearch);
	}

	function handleNameLock() {
		const nextName = draftGuestName.trim().slice(0, 32);

		if (!nextName) {
			return;
		}

		startTransition(() => {
			setGuestName(nextName);
			setStoredGuestName(nextName);
		});
	}

	useEffect(() => {
		const nextSearch = search.trim();

		if (!nextSearch) {
			latestSearchRef.current = "";
			setResults([]);
			return;
		}

		const timeoutId = window.setTimeout(() => {
			latestSearchRef.current = nextSearch;
			searchMutation.mutate(nextSearch);
		}, 350);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [search, searchMutation]);

	if (roomQuery.isPending) {
		return (
			<main className="page-shell">
				<EmptyState
					title="Loading room..."
					body="Tuning the speakers and syncing the queue."
					icon={<MicVocal />}
				/>
			</main>
		);
	}

	if (roomQuery.isError || !roomQuery.data) {
		return (
			<main className="page-shell">
				<EmptyState
					title="Room not found"
					body="That code didn’t match an active Kapow room. Double-check the letters and try again."
					icon={<SearchCode />}
					action={<BackHomeButton />}
				/>
			</main>
		);
	}

	const snapshot = roomQuery.data;

	if (snapshot.room.status === "closed") {
		return (
			<main className="page-shell">
				<EmptyState
					title="Room closed"
					body="The host has wrapped the room for now. Hang tight while they reopen or spin up a new one."
					icon={<Lock />}
					action={<BackHomeButton />}
				/>
			</main>
		);
	}

	return (
		<main className="page-shell">
			<HeroFrame
				eyebrow="Guest Console"
				title={`Room ${snapshot.room.code}`}
				subtitle="Search for karaoke-ready tracks, submit your song, and hype up the queue with votes."
				aside={<ComicWordmark />}
			/>

			<div className="guest-layout mt-4 grid gap-4 lg:mt-6 lg:gap-6 lg:grid-cols-[1fr_1.2fr]">
				<div className="space-y-4 lg:space-y-6">
					<NeonPanel className="p-5 sm:p-6">
						<p className="hero-eyebrow">Singer ID</p>
						<h2 className="section-title">
							{guestName ? "Signed in for this session" : "Enter your name"}
						</h2>
						{guestName ? (
							<div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
								<p className="text-sm font-semibold tracking-[0.18em] uppercase text-white/60">
									Singer ID locked
								</p>
								<p className="mt-2 text-2xl font-semibold text-white">
									{guestName}
								</p>
								<p className="mt-2 text-sm text-white/70">
									This name now follows your submissions and votes for this
									session.
								</p>
							</div>
						) : (
							<>
								<input
									value={draftGuestName}
									onChange={(event) => setDraftGuestName(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											handleNameLock();
										}
									}}
									className="kapow-input mt-4"
									placeholder="Alex"
									maxLength={32}
								/>
								<button
									type="button"
									className="kapow-button kapow-button--accent mt-4"
									onClick={handleNameLock}
									disabled={!draftGuestName.trim()}
								>
									Lock In Singer ID
								</button>
							</>
						)}
					</NeonPanel>

					<NeonPanel className="p-5 sm:p-6">
						<p className="hero-eyebrow">Find A Song</p>
						<h2 className="section-title">Search the karaoke vault</h2>
						<div className="mt-4">
							<SearchField
								value={search}
								onChange={setSearch}
								onSubmit={handleSearch}
							/>
						</div>
						{!guestName.trim() ? (
							<p className="mt-4 text-sm text-[#ffd84d]">
								Add your name first so the room knows who to call up.
							</p>
						) : null}
						<div className="mt-5">
							<SearchResults
								results={results}
								isLoading={searchMutation.isPending}
								disabled={!guestName.trim() || addSongMutation.isPending}
								onAdd={(song) => addSongMutation.mutate(song)}
							/>
							{search.trim() &&
							!searchMutation.isPending &&
							results.length === 0 ? (
								<p className="mt-4 text-sm text-white/70">
									No embeddable karaoke videos found for that search. Try a more
									specific song title or artist.
								</p>
							) : null}
							{submissionNotice ? (
								<p className="mt-4 text-sm text-[#ffd84d]">
									{submissionNotice}
								</p>
							) : null}
						</div>
					</NeonPanel>
				</div>

				<NeonPanel className="p-5 sm:p-6">
					<div className="mb-5 flex items-center justify-between">
						<div>
							<p className="hero-eyebrow">Current Queue</p>
							<h2 className="section-title">Crowd-powered lineup</h2>
						</div>
						<span className="vote-pill">
							<Users size={16} />
							{snapshot.queue.length}
						</span>
					</div>

					<div className="space-y-4">
						{snapshot.queue.map((item) => (
							<QueueCard
								key={item.id}
								item={item}
								emphasis={item.status === "playing" ? "On Deck" : undefined}
								action={
									item.status === "waiting" ? (
										<button
											type="button"
											className="kapow-button kapow-button--accent"
											onClick={() => voteMutation.mutate(item.id)}
											disabled={voteMutation.isPending}
										>
											<Heart size={16} />
											{item.hasVoted ? "Unvote" : "Hype This"}
										</button>
									) : null
								}
							/>
						))}
					</div>
				</NeonPanel>
			</div>
		</main>
	);
}
