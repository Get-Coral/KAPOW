import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Lock, MicVocal, SearchCode, Users } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import {
	BackHomeButton,
	ComicWordmark,
	EmptyState,
	HeroFrame,
	NavTiles,
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
	const [guestName, setGuestName] = useState("");
	const [search, setSearch] = useState("");
	const [results, setResults] = useState<SongSearchResult[]>([]);

	useEffect(() => {
		setGuestName(getStoredGuestName());
	}, []);

	const searchMutation = useMutation({
		mutationFn: (value: string) => searchYouTube({ data: { query: value } }),
		onSuccess: (data) => setResults(data),
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
		onSuccess: (snapshot) => {
			setResults([]);
			setSearch("");
			queryClient.setQueryData(queryKeys.room(code), snapshot);
		},
	});
	const voteMutation = useMutation({
		mutationFn: (queueId: string) =>
			toggleVote({
				data: {
					code,
					queueId,
				},
				headers: getClientHeaders(),
			}),
		onSuccess: (snapshot) => {
			queryClient.setQueryData(queryKeys.room(code), snapshot);
		},
	});

	function handleSearch() {
		if (!search.trim()) {
			return;
		}

		searchMutation.mutate(search);
	}

	function handleNameChange(value: string) {
		startTransition(() => {
			setGuestName(value);
			setStoredGuestName(value);
		});
	}

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
				title={`Join Room ${snapshot.room.code}`}
				subtitle="Search for karaoke-ready tracks, submit your song, and hype up the queue with votes."
				aside={<ComicWordmark />}
			/>

			<div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
				<div className="space-y-6">
					<NeonPanel className="p-6">
						<p className="hero-eyebrow">Singer ID</p>
						<h2 className="section-title">Enter your name</h2>
						<input
							value={guestName}
							onChange={(event) => handleNameChange(event.target.value)}
							className="kapow-input mt-4"
							placeholder="Alex"
						/>
					</NeonPanel>

					<NeonPanel className="p-6">
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
						</div>
					</NeonPanel>

					<NavTiles code={code} />
				</div>

				<NeonPanel className="p-6">
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
