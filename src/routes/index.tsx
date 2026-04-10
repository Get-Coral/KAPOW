import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DoorOpen, PartyPopper, Radio } from "lucide-react";
import { useState } from "react";
import {
	ComicWordmark,
	HeroFrame,
	JoinCodeInput,
	NeonPanel,
} from "#/components/kapow-ui";
import { formatJoinCode } from "#/lib/utils";
import { createRoom } from "#/server/rooms";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

function LandingPage() {
	const navigate = useNavigate();
	const [joinCode, setJoinCode] = useState("");

	function getCreateRoomErrorMessage(error: unknown) {
		if (error instanceof Error && error.message) {
			return error.message;
		}

		return "Room creation failed. If you just changed .env, restart the dev server. If not, the Supabase tables probably still need to be created.";
	}

	const createRoomMutation = useMutation({
		mutationFn: () => createRoom(),
		onSuccess: ({ code, hostToken }) => {
			navigate({
				to: "/host/$code",
				params: { code },
				search: { token: hostToken },
			});
		},
	});

	function handleJoin() {
		const nextCode = formatJoinCode(joinCode);

		if (!nextCode) {
			return;
		}

		navigate({
			to: "/room/$code",
			params: { code: nextCode },
		});
	}

	return (
		<main className="page-shell">
			<HeroFrame
				eyebrow="Karaoke Command Center"
				title="Spin up a room, scan the code, and let the crowd run the queue."
				subtitle="Kapow is built for party hosts: guests search karaoke tracks, vote the best one up, and the host keeps the night moving from a dedicated control booth."
				aside={<ComicWordmark />}
			/>

			<div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
				<NeonPanel className="p-6">
					<p className="hero-eyebrow">Host Tonight</p>
					<h2 className="section-title">Create a brand new room</h2>
					<p className="section-copy">
						You’ll get a host token, guest link, display view, and QR code in
						one move.
					</p>
					{createRoomMutation.isError ? (
						<div className="mt-5 rounded-2xl border border-[#ff8d6b]/35 bg-[#4a1120]/60 p-4 text-left">
							<p className="text-sm font-bold tracking-[0.16em] uppercase text-[#ffb6a0]">
								Create Room Failed
							</p>
							<p className="mt-2 text-base text-white/85">
								{getCreateRoomErrorMessage(createRoomMutation.error)}
							</p>
						</div>
					) : null}
					<button
						type="button"
						className="kapow-button kapow-button--accent mt-6"
						onClick={() => createRoomMutation.mutate()}
						disabled={createRoomMutation.isPending}
					>
						<PartyPopper size={18} />
						{createRoomMutation.isPending ? "Launching room..." : "Create Room"}
					</button>
				</NeonPanel>

				<NeonPanel className="p-6">
					<p className="hero-eyebrow">Join Existing Room</p>
					<h2 className="section-title">Already got the code?</h2>
					<p className="section-copy">
						Hop in as a guest and start feeding the queue your best karaoke
						pick.
					</p>
					<div className="mt-6">
						<JoinCodeInput
							value={joinCode}
							onChange={(value) => setJoinCode(formatJoinCode(value))}
							onSubmit={handleJoin}
							placeholder="ABCD"
						/>
					</div>
				</NeonPanel>
			</div>

			<div className="mt-6 grid gap-4 md:grid-cols-3">
				{[
					{
						icon: <DoorOpen size={20} />,
						title: "Room-based flow",
						body: "Each party gets its own live queue, host link, and display mode.",
					},
					{
						icon: <Radio size={20} />,
						title: "Realtime reactions",
						body: "Supabase subscriptions keep votes, queue order, and room status synced.",
					},
					{
						icon: <PartyPopper size={20} />,
						title: "Built for a TV",
						body: "The display view goes full comic-book spectacle with now playing focus.",
					},
				].map((feature) => (
					<NeonPanel key={feature.title} className="p-5">
						<div className="mb-4 inline-flex rounded-full bg-[#ffd84d]/15 p-3 text-[#ffd84d]">
							{feature.icon}
						</div>
						<h3 className="text-xl font-bold text-white">{feature.title}</h3>
						<p className="mt-2 text-white/72">{feature.body}</p>
					</NeonPanel>
				))}
			</div>
		</main>
	);
}
