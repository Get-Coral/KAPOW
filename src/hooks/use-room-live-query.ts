import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "#/lib/query";
import { getSessionId } from "#/lib/storage";
import { getSupabaseBrowserClient } from "#/lib/supabase";
import { getRoomSnapshot } from "#/server/rooms";

export function getClientHeaders() {
	return {
		"x-kapow-session": getSessionId(),
	};
}

export function useRoomLiveQuery(code: string, hostToken?: string) {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: queryKeys.room(code, hostToken),
		queryFn: () =>
			getRoomSnapshot({
				data: {
					code,
					hostToken,
				},
				headers: getClientHeaders(),
			}),
		refetchOnWindowFocus: false,
	});

	useEffect(() => {
		if (!query.data?.room.id) {
			return;
		}

		const supabase = getSupabaseBrowserClient();
		const roomId = query.data.room.id;
		const queueIds = query.data.queue.map((item) => item.id);
		const channel = supabase.channel(
			`kapow-room-${roomId}-${hostToken ?? "guest"}`,
		);
		const invalidate = () =>
			queryClient.invalidateQueries({
				queryKey: queryKeys.room(code, hostToken),
			});

		channel.on(
			"postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "queue",
				filter: `room_id=eq.${roomId}`,
			},
			invalidate,
		);

		channel.on(
			"postgres_changes",
			{
				event: "*",
				schema: "public",
				table: "rooms",
				filter: `id=eq.${roomId}`,
			},
			invalidate,
		);

		for (const queueId of queueIds) {
			channel.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "votes",
					filter: `queue_id=eq.${queueId}`,
				},
				invalidate,
			);
		}

		channel.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [code, hostToken, query.data?.queue, query.data?.room.id, queryClient]);

	return query;
}
