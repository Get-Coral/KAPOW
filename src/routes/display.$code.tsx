import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { BackHomeButton, DisplayBoard, EmptyState, QrCard } from "#/components/kapow-ui";
import { useRoomLiveQuery } from "#/hooks/use-room-live-query";
import { queryKeys } from "#/lib/query";
import { buildAbsoluteUrl } from "#/lib/utils";
import { advanceQueue } from "#/server/rooms";

export const Route = createFileRoute("/display/$code")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : "",
	}),
	component: DisplayPage,
});

function DisplayPage() {
	const { code } = Route.useParams();
	const { token } = Route.useSearch();
	const queryClient = useQueryClient();
	const roomQuery = useRoomLiveQuery(code, token);
	const advanceQueueMutation = useMutation({
		mutationFn: (finishedQueueId?: string) =>
			advanceQueue({
				data: {
					code,
					finishedQueueId,
				},
			}),
		onSuccess: (snapshot) => {
			queryClient.setQueryData(queryKeys.room(code), snapshot);
		},
	});

	useEffect(() => {
		if (!roomQuery.data || advanceQueueMutation.isPending) {
			return;
		}

		if (!roomQuery.data.nowPlaying && roomQuery.data.nextUp) {
			advanceQueueMutation.mutate(undefined);
		}
	}, [advanceQueueMutation, roomQuery.data]);

	if (!token) {
		return (
			<main className="page-shell">
				<EmptyState
					title="Display access denied"
					body="The projector view is private to the host. Open it from the host controls so the token is included."
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
					title="Loading display..."
					body="Building the big-screen layout for the room."
				/>
			</main>
		);
	}

	if (roomQuery.isError || !roomQuery.data) {
		return (
			<main className="page-shell">
				<EmptyState
					title="Display unavailable"
					body="We couldn’t find that room code, so there isn’t anything to project yet."
					action={<BackHomeButton />}
				/>
			</main>
		);
	}

	if (!roomQuery.data.isHost) {
		return (
			<main className="page-shell">
				<EmptyState
					title="Display access denied"
					body="This display link needs the host token that was generated for the room."
					icon={<ShieldAlert />}
					action={<BackHomeButton />}
				/>
			</main>
		);
	}

	if (roomQuery.data.room.status === "closed") {
		return (
			<main className="page-shell">
				<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
					<EmptyState
						title="Room closed"
						body="The host has closed this Kapow room. Reopen the room to continue the show."
						action={<BackHomeButton />}
					/>
					<QrCard url={buildAbsoluteUrl(`/room/${code}`)} />
				</div>
			</main>
		);
	}

	return (
		<DisplayBoard
			snapshot={roomQuery.data}
			onSongEnded={(queueId) => advanceQueueMutation.mutate(queueId)}
			onPlaybackBlocked={(queueId) => advanceQueueMutation.mutate(queueId)}
			joinUrl={buildAbsoluteUrl(`/room/${code}`)}
		/>
	);
}
