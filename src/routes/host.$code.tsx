import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Lock, LockOpen, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import {
	BackHomeButton,
	ComicWordmark,
	EmptyState,
	HeroFrame,
	HostNavTiles,
	HostQueueBoard,
	NeonPanel,
	QrCard,
} from "#/components/kapow-ui";
import { useRoomLiveQuery } from "#/hooks/use-room-live-query";
import { queryKeys } from "#/lib/query";
import type { QueueItem, RoomSnapshot } from "#/lib/types";
import { buildAbsoluteUrl, sortQueue } from "#/lib/utils";
import {
	approveQueueItem,
	type getRoomSnapshot,
	removeQueueItem,
	reorderQueue,
	setQueueStatus,
	setRoomStatus,
} from "#/server/rooms";

export const Route = createFileRoute("/host/$code")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : "",
	}),
	component: HostRoomPage,
});

function reorderHostSnapshot(
	snapshot: RoomSnapshot,
	orderedQueueIds: string[],
) {
	const queueById = new Map(snapshot.queue.map((item) => [item.id, item]));
	const reorderedItems = orderedQueueIds
		.map((id) => queueById.get(id))
		.filter((item): item is QueueItem => Boolean(item));

	if (reorderedItems.length === 0) {
		return snapshot;
	}

	const nextQueue = sortQueue(
		snapshot.queue.map((item) => {
			const reorderedIndex = orderedQueueIds.indexOf(item.id);

			if (reorderedIndex >= 0) {
				return {
					...item,
					position: reorderedIndex + 1,
				};
			}

			if (item.status === "pending") {
				return {
					...item,
					position: reorderedItems.length + item.position,
				};
			}

			return item;
		}),
	) as QueueItem[];
	const pendingQueue = nextQueue.filter((item) => item.status === "pending");
	const nowPlaying =
		nextQueue.find((item) => item.status === "playing") ?? null;
	const nextUp =
		nextQueue.find(
			(item) =>
				item.status === "waiting" &&
				(!nowPlaying || item.position > nowPlaying.position),
		) ??
		nextQueue.find((item) => item.status === "waiting") ??
		null;

	return {
		...snapshot,
		queue: nextQueue,
		pendingQueue,
		nowPlaying,
		nextUp,
	};
}

function HostRoomPage() {
	const { code } = Route.useParams();
	const { token } = Route.useSearch();
	const queryClient = useQueryClient();
	const roomQuery = useRoomLiveQuery(code, token);
	const roomQueryKey = queryKeys.room(code, token);

	const setCache = (snapshot: Awaited<ReturnType<typeof getRoomSnapshot>>) => {
		queryClient.setQueryData(roomQueryKey, snapshot);
	};

	const playMutation = useMutation({
		mutationFn: (queueId: string) =>
			setQueueStatus({
				data: {
					code,
					hostToken: token,
					queueId,
					status: "playing",
				},
			}),
		onSuccess: setCache,
	});
	const doneMutation = useMutation({
		mutationFn: (queueId: string) =>
			setQueueStatus({
				data: {
					code,
					hostToken: token,
					queueId,
					status: "done",
				},
			}),
		onSuccess: setCache,
	});
	const removeMutation = useMutation({
		mutationFn: (queueId: string) =>
			removeQueueItem({
				data: {
					code,
					hostToken: token,
					queueId,
				},
			}),
		onSuccess: setCache,
	});
	const approveMutation = useMutation({
		mutationFn: (queueId: string) =>
			approveQueueItem({
				data: {
					code,
					hostToken: token,
					queueId,
				},
			}),
		onSuccess: setCache,
	});
	const reorderMutation = useMutation({
		mutationFn: (orderedQueueIds: string[]) =>
			reorderQueue({
				data: {
					code,
					hostToken: token,
					orderedQueueIds,
				},
			}),
		onMutate: async (orderedQueueIds) => {
			await queryClient.cancelQueries({ queryKey: roomQueryKey });
			const previousSnapshot =
				queryClient.getQueryData<Awaited<ReturnType<typeof getRoomSnapshot>>>(
					roomQueryKey,
				);

			if (previousSnapshot) {
				queryClient.setQueryData(
					roomQueryKey,
					reorderHostSnapshot(previousSnapshot, orderedQueueIds),
				);
			}

			return { previousSnapshot };
		},
		onError: (_error, _variables, context) => {
			if (context?.previousSnapshot) {
				queryClient.setQueryData(roomQueryKey, context.previousSnapshot);
			}
		},
		onSuccess: setCache,
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: roomQueryKey });
		},
	});
	const statusMutation = useMutation({
		mutationFn: (status: "open" | "closed") =>
			setRoomStatus({
				data: {
					code,
					hostToken: token,
					status,
				},
			}),
		onSuccess: setCache,
	});

	const joinUrl = useMemo(() => buildAbsoluteUrl(`/room/${code}`), [code]);

	if (!token) {
		return (
			<main className="page-shell">
				<EmptyState
					title="Host token required"
					body="Open the host link that was generated when the room was created. It should include the token in the URL."
					icon={<ShieldAlert />}
					action={<BackHomeButton />}
				/>
			</main>
		);
	}

	if (roomQuery.isPending) {
		return (
			<main className="page-shell">
				<EmptyState
					title="Loading host deck..."
					body="Bringing your queue controls online."
				/>
			</main>
		);
	}

	if (roomQuery.isError || !roomQuery.data || !roomQuery.data.isHost) {
		return (
			<main className="page-shell">
				<EmptyState
					title="Host access denied"
					body="That host token doesn’t match this room. Make sure you opened the private host URL."
					icon={<ShieldAlert />}
					action={<BackHomeButton />}
				/>
			</main>
		);
	}

	const snapshot = roomQuery.data;

	return (
		<main className="page-shell">
			<HeroFrame
				eyebrow="Host Control Booth"
				title={`Host Controls: ${snapshot.room.code}`}
				subtitle="Run the queue, choose what starts next, and control whether guests can keep adding songs."
				aside={<ComicWordmark />}
			/>

			<div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
				<div className="space-y-6">
					<NeonPanel className="p-6">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div>
								<p className="hero-eyebrow">Room Status</p>
								<h2 className="section-title">
									{snapshot.room.status === "open"
										? "Open for submissions"
										: "Room closed"}
								</h2>
							</div>
							<button
								type="button"
								className="kapow-button kapow-button--accent"
								onClick={() =>
									statusMutation.mutate(
										snapshot.room.status === "open" ? "closed" : "open",
									)
								}
							>
								{snapshot.room.status === "open" ? (
									<Lock size={16} />
								) : (
									<LockOpen size={16} />
								)}
								{snapshot.room.status === "open" ? "Close Room" : "Reopen Room"}
							</button>
						</div>

						<div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
							<p className="text-sm font-semibold tracking-[0.18em] uppercase text-white/60">
								Host Token
							</p>
							<div className="mt-2 flex items-center gap-3">
								<code className="flex-1 break-all border-0 bg-transparent px-0 text-white/90">
									{token}
								</code>
								<button
									type="button"
									className="kapow-button kapow-button--ghost"
									onClick={() => navigator.clipboard.writeText(token)}
								>
									<Copy size={16} />
									Copy
								</button>
							</div>
						</div>
					</NeonPanel>

					<NeonPanel className="p-6">
						<p className="hero-eyebrow">Manage Queue</p>
						<h2 className="section-title">Drag songs into the perfect order</h2>
						<div className="mt-5">
							<HostQueueBoard
								snapshot={snapshot}
								onReorder={(ids) => reorderMutation.mutate(ids)}
								onPlay={(queueId) => playMutation.mutate(queueId)}
								onDone={(queueId) => doneMutation.mutate(queueId)}
								onRemove={(queueId) => removeMutation.mutate(queueId)}
								onApprove={(queueId) => approveMutation.mutate(queueId)}
							/>
						</div>
					</NeonPanel>
				</div>

				<div className="space-y-6">
					<QrCard url={joinUrl} />
					<HostNavTiles code={code} hostToken={token} />
				</div>
			</div>
		</main>
	);
}
