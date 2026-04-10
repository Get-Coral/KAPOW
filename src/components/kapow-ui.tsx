import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import confetti from "canvas-confetti";
import {
	ArrowLeft,
	Check,
	CheckCircle2,
	Crown,
	GripVertical,
	MicVocal,
	Music2,
	QrCode,
	Search,
	Sparkles,
	Trash2,
	Vote,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { QueueItem, RoomSnapshot, SongSearchResult } from "#/lib/types";
import { cn } from "#/lib/utils";

declare global {
	interface Window {
		YT?: {
			Player: new (
				elementId: string,
				config: {
					videoId: string;
					playerVars?: Record<string, number | string>;
					events?: {
						onReady?: () => void;
						onStateChange?: (event: { data: number }) => void;
						onError?: (event: { data: number }) => void;
					};
				},
			) => {
				loadVideoById: (videoId: string) => void;
				destroy: () => void;
				playVideo: () => void;
			};
			PlayerState: {
				ENDED: number;
			};
		};
		onYouTubeIframeAPIReady?: () => void;
	}
}

let youtubeApiPromise: Promise<void> | undefined;

function loadYouTubeIframeApi() {
	if (typeof window === "undefined") {
		return Promise.resolve();
	}

	if (window.YT?.Player) {
		return Promise.resolve();
	}

	if (!youtubeApiPromise) {
		youtubeApiPromise = new Promise((resolve) => {
			window.onYouTubeIframeAPIReady = () => resolve();
			const script = document.createElement("script");
			script.src = "https://www.youtube.com/iframe_api";
			script.async = true;
			document.head.appendChild(script);
		});
	}

	return youtubeApiPromise;
}

export function ComicWordmark() {
	return (
		<div className="logo-mark">
			<img src="/logo.png" alt="Kapow" className="logo-mark__image" />
		</div>
	);
}

export function NeonPanel({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return <section className={cn("kapow-panel", className)}>{children}</section>;
}

export function HeroFrame({
	eyebrow,
	title,
	subtitle,
	aside,
}: {
	eyebrow: string;
	title: string;
	subtitle: string;
	aside?: React.ReactNode;
}) {
	return (
		<NeonPanel className="relative overflow-hidden p-6 sm:p-8">
			<div className="hero-burst" />
			<div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
				<div className="max-w-3xl">
					<p className="hero-eyebrow">{eyebrow}</p>
					<h1 className="hero-title">{title}</h1>
					<p className="hero-subtitle">{subtitle}</p>
				</div>
				{aside ? <div className="shrink-0">{aside}</div> : null}
			</div>
		</NeonPanel>
	);
}

export function JoinCodeInput({
	value,
	onChange,
	onSubmit,
	placeholder,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	placeholder: string;
}) {
	return (
		<div className="flex gap-3">
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						onSubmit();
					}
				}}
				className="kapow-input flex-1"
				placeholder={placeholder}
				maxLength={6}
			/>
			<button
				type="button"
				className="kapow-button kapow-button--accent"
				onClick={onSubmit}
			>
				Join
			</button>
		</div>
	);
}

export function SearchResults({
	results,
	isLoading,
	disabled,
	onAdd,
}: {
	results: SongSearchResult[];
	isLoading: boolean;
	disabled: boolean;
	onAdd: (song: SongSearchResult) => void;
}) {
	return (
		<div className="space-y-3">
			{isLoading ? (
				<p className="muted-copy">Scanning YouTube for karaoke anthems...</p>
			) : null}
			{results.map((song) => (
				<button
					key={song.id}
					type="button"
					className="search-card"
					onClick={() => onAdd(song)}
					disabled={disabled}
				>
					<img src={song.thumbnail} alt="" className="search-card__image" />
					<span className="min-w-0 flex-1 text-left">
						<strong className="line-clamp-1 block text-lg text-white">
							{song.title}
						</strong>
						<span className="line-clamp-1 block text-sm text-white/75">
							{song.artist}
						</span>
					</span>
					<span className="kapow-chip">
						<Music2 size={16} />
						Add
					</span>
				</button>
			))}
		</div>
	);
}

export function QueueCard({
	item,
	emphasis,
	action,
	footer,
	background,
}: {
	item: QueueItem;
	emphasis?: string;
	action?: React.ReactNode;
	footer?: React.ReactNode;
	background?: boolean;
}) {
	return (
		<article
			className={cn("queue-card", background && "queue-card--backdrop")}
			style={{
				backgroundImage: `linear-gradient(135deg, rgba(12, 11, 34, 0.92), rgba(51, 18, 53, 0.78)), url(${item.thumbnail_url})`,
			}}
		>
			{emphasis ? <span className="queue-card__flag">{emphasis}</span> : null}
			<img src={item.thumbnail_url} alt="" className="queue-card__thumb" />
			<div className="min-w-0 flex-1">
				<h3 className="queue-card__title">{item.song_title}</h3>
				<p className="queue-card__artist">{item.artist}</p>
				<p className="queue-card__meta">Submitted by {item.submitter_name}</p>
				{footer ? <div className="mt-3">{footer}</div> : null}
			</div>
			<div className="queue-card__rail">
				<span className="vote-pill">
					<Vote size={16} />
					{item.votes}
				</span>
				{action}
			</div>
		</article>
	);
}

function SortableQueueRow({
	item,
	children,
}: {
	item: QueueItem;
	children: React.ReactNode;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: item.id,
	});

	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
			}}
			className={cn(isDragging && "opacity-70")}
		>
			<div className="mb-3 flex items-start gap-2">
				<button
					type="button"
					className="drag-handle"
					{...attributes}
					{...listeners}
				>
					<GripVertical size={18} />
				</button>
				<div className="flex-1">{children}</div>
			</div>
		</div>
	);
}

export function HostQueueBoard({
	snapshot,
	onReorder,
	onPlay,
	onDone,
	onRemove,
	onApprove,
}: {
	snapshot: RoomSnapshot;
	onReorder: (ids: string[]) => void;
	onPlay: (queueId: string) => void;
	onDone: (queueId: string) => void;
	onRemove: (queueId: string) => void;
	onApprove: (queueId: string) => void;
}) {
	const waitingAndPlaying = useMemo(
		() => snapshot.queue.filter((item) => item.status !== "done"),
		[snapshot.queue],
	);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;

		if (!over || active.id === over.id) {
			return;
		}

		const oldIndex = waitingAndPlaying.findIndex(
			(item) => item.id === active.id,
		);
		const newIndex = waitingAndPlaying.findIndex((item) => item.id === over.id);

		if (oldIndex < 0 || newIndex < 0) {
			return;
		}

		onReorder(
			arrayMove(waitingAndPlaying, oldIndex, newIndex).map((item) => item.id),
		);
	}

	return (
		<div className="space-y-6">
			{snapshot.pendingQueue.length ? (
				<div>
					<div className="mb-4 flex items-center justify-between">
						<p className="hero-eyebrow !mb-0">Pending Approval</p>
						<span className="vote-pill">{snapshot.pendingQueue.length}</span>
					</div>
					<div className="space-y-3">
						{snapshot.pendingQueue.map((item) => (
							<QueueCard
								key={item.id}
								item={item}
								emphasis="Awaiting Host"
								action={
									<div className="flex flex-col gap-2">
										<button
											type="button"
											className="kapow-button kapow-button--accent"
											onClick={() => onApprove(item.id)}
										>
											<Check size={16} />
											Approve
										</button>
										<button
											type="button"
											className="kapow-button kapow-button--ghost"
											onClick={() => onRemove(item.id)}
										>
											<Trash2 size={16} />
											Reject
										</button>
									</div>
								}
							/>
						))}
					</div>
				</div>
			) : null}

			<div>
				<div className="mb-4 flex items-center justify-between">
					<p className="hero-eyebrow !mb-0">Approved Queue</p>
					<span className="vote-pill">{waitingAndPlaying.length}</span>
				</div>
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={waitingAndPlaying}
						strategy={verticalListSortingStrategy}
					>
						{waitingAndPlaying.map((item) => (
							<SortableQueueRow key={item.id} item={item}>
								<QueueCard
									item={item}
									emphasis={
										item.status === "playing" ? "Now Singing" : "On Deck"
									}
									action={
										<div className="flex flex-col gap-2">
											{item.status === "playing" ? (
												<button
													type="button"
													className="kapow-button kapow-button--accent"
													onClick={() => onDone(item.id)}
												>
													<CheckCircle2 size={16} />
													Finish
												</button>
											) : (
												<button
													type="button"
													className="kapow-button kapow-button--accent"
													onClick={() => onPlay(item.id)}
												>
													<MicVocal size={16} />
													Play
												</button>
											)}
											<button
												type="button"
												className="kapow-button kapow-button--ghost"
												onClick={() => onRemove(item.id)}
											>
												<Trash2 size={16} />
												Remove
											</button>
										</div>
									}
								/>
							</SortableQueueRow>
						))}
					</SortableContext>
				</DndContext>
			</div>
		</div>
	);
}

export function QrCard({ url }: { url: string }) {
	const [imageUrl, setImageUrl] = useState("");

	useEffect(() => {
		let cancelled = false;

		QRCode.toDataURL(url, {
			margin: 1,
			width: 220,
			color: { dark: "#0b0921", light: "#fff7d7" },
		}).then((value) => {
			if (!cancelled) {
				setImageUrl(value);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [url]);

	return (
		<NeonPanel className="p-5">
			<div className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] uppercase text-[#ffe27d]">
				<QrCode size={16} />
				Scan To Join
			</div>
			{imageUrl ? (
				<img
					src={imageUrl}
					alt="Room QR code"
					className="mt-4 w-full rounded-2xl bg-white p-3"
				/>
			) : null}
			<p className="mt-3 break-all text-sm text-white/70">{url}</p>
		</NeonPanel>
	);
}

export function CompactQrCard({ url }: { url: string }) {
	const [imageUrl, setImageUrl] = useState("");

	useEffect(() => {
		let cancelled = false;

		QRCode.toDataURL(url, {
			margin: 1,
			width: 140,
			color: { dark: "#0b0921", light: "#fff7d7" },
		}).then((value) => {
			if (!cancelled) {
				setImageUrl(value);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [url]);

	return (
		<div className="display-qr-card">
			<p className="hero-eyebrow !mb-2">Scan To Join</p>
			{imageUrl ? (
				<img
					src={imageUrl}
					alt="Join room QR code"
					className="display-qr-image"
				/>
			) : null}
			<p className="display-qr-code">{url}</p>
		</div>
	);
}

export function DisplayCelebration({
	trigger,
}: {
	trigger: string | undefined;
}) {
	useEffect(() => {
		if (!trigger) {
			return;
		}

		confetti({
			particleCount: 180,
			spread: 120,
			origin: { y: 0.45 },
			colors: ["#ffd84d", "#ff8d3a", "#4fd5ff", "#f94892"],
		});
	}, [trigger]);

	return null;
}

export function EmptyState({
	title,
	body,
	icon,
	action,
}: {
	title: string;
	body: string;
	icon?: React.ReactNode;
	action?: React.ReactNode;
}) {
	return (
		<NeonPanel className="p-8 text-center">
			<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-[#ffd84d]">
				{icon ?? <Sparkles />}
			</div>
			<h2 className="text-2xl font-bold text-white">{title}</h2>
			<p className="mx-auto mt-3 max-w-xl text-white/70">{body}</p>
			{action ? <div className="mt-6 flex justify-center">{action}</div> : null}
		</NeonPanel>
	);
}

export function BackHomeButton() {
	return (
		<Link to="/" className="kapow-button kapow-button--nav">
			<ArrowLeft size={16} />
			Back Home
		</Link>
	);
}

export function DisplayBoard({
	snapshot,
	onSongEnded,
	onPlaybackBlocked,
	joinUrl,
}: {
	snapshot: RoomSnapshot;
	onSongEnded?: (queueId: string) => void;
	onPlaybackBlocked?: (queueId: string) => void;
	joinUrl?: string;
}) {
	const waitingSongs = snapshot.queue.filter(
		(item) => item.status === "waiting",
	);

	return (
		<div
			className="display-screen"
			style={{
				backgroundImage: snapshot.nowPlaying
					? `linear-gradient(135deg, rgba(8, 7, 28, 0.75), rgba(52, 17, 48, 0.72)), url(${snapshot.nowPlaying.thumbnail_url})`
					: undefined,
			}}
		>
			<DisplayCelebration trigger={snapshot.nowPlaying?.id} />
			<div className="display-header">
				<ComicWordmark />
				<div className="display-header-meta">
					<div className="text-right">
						<p className="hero-eyebrow !mb-2">Now Singing</p>
						<h1 className="display-title-text">
							{snapshot.nowPlaying?.song_title ?? "Queue Building"}
						</h1>
						<p className="display-artist">
							{snapshot.nowPlaying?.artist ?? "Pick the first anthem"}{" "}
							{snapshot.nowPlaying
								? `• ${snapshot.nowPlaying.submitter_name}`
								: ""}
						</p>
					</div>
					{joinUrl ? <CompactQrCard url={joinUrl} /> : null}
				</div>
			</div>

			<div className="display-layout">
				<NeonPanel className="p-5">
					{snapshot.nowPlaying ? (
						<DisplayPlayer
							song={snapshot.nowPlaying}
							onEnded={onSongEnded}
							onPlaybackBlocked={onPlaybackBlocked}
						/>
					) : (
						<div className="display-placeholder">
							<MicVocal size={42} />
							<span>Waiting for the first singer...</span>
						</div>
					)}
				</NeonPanel>

				<div className="space-y-5">
					<NeonPanel className="p-5">
						<div className="mb-4 flex items-center justify-between">
							<p className="hero-eyebrow !mb-0">Session Stats</p>
							<span className="vote-pill">{snapshot.stats.length}</span>
						</div>
						<div className="display-stats-grid">
							{snapshot.stats.map((stat) => (
								<div key={stat.label} className="display-stat-card">
									<p className="display-stat-label">{stat.label}</p>
									<p
										className="display-stat-value"
										style={{ color: stat.accent ?? "#fff8df" }}
									>
										{stat.value}
									</p>
								</div>
							))}
						</div>
					</NeonPanel>

					<NeonPanel className="p-5">
						<p className="hero-eyebrow !mb-2">Next Up</p>
						{snapshot.nextUp ? (
							<QueueCard item={snapshot.nextUp} background />
						) : (
							<p className="text-lg text-white/70">Nobody in the wings yet.</p>
						)}
					</NeonPanel>

					<NeonPanel className="max-h-[32rem] overflow-hidden p-5">
						<div className="mb-4 flex items-center justify-between">
							<p className="hero-eyebrow !mb-0">Waiting Songs</p>
							<span className="vote-pill">{waitingSongs.length}</span>
						</div>
						<div className="queue-scroll space-y-3">
							{waitingSongs.map((item) => (
								<QueueCard key={item.id} item={item} background />
							))}
						</div>
					</NeonPanel>
				</div>
			</div>
		</div>
	);
}

export function DisplayPlayer({
	song,
	onEnded,
	onPlaybackBlocked,
}: {
	song: QueueItem;
	onEnded?: (queueId: string) => void;
	onPlaybackBlocked?: (queueId: string) => void;
}) {
	const playerId = "kapow-display-player";
	const playerRef = useRef<{
		loadVideoById: (videoId: string) => void;
		destroy: () => void;
		playVideo: () => void;
	} | null>(null);
	const handleEnded = useEffectEvent(() => {
		onEnded?.(song.id);
	});
	const handlePlaybackBlocked = useEffectEvent(() => {
		onPlaybackBlocked?.(song.id);
	});

	useEffect(() => {
		let cancelled = false;

		void loadYouTubeIframeApi().then(() => {
			if (cancelled || !window.YT?.Player) {
				return;
			}

			if (!playerRef.current) {
				playerRef.current = new window.YT.Player(playerId, {
					videoId: song.song_id,
					playerVars: {
						autoplay: 1,
						controls: 1,
						modestbranding: 1,
						playsinline: 1,
						rel: 0,
					},
					events: {
						onReady: () => {
							playerRef.current?.playVideo();
						},
						onStateChange: (event) => {
							if (event.data === window.YT?.PlayerState.ENDED) {
								handleEnded();
							}
						},
						onError: (event) => {
							if ([101, 150, 153].includes(event.data)) {
								handlePlaybackBlocked();
							}
						},
					},
				});
				return;
			}

			playerRef.current.loadVideoById(song.song_id);
			playerRef.current.playVideo();
		});

		return () => {
			cancelled = true;
		};
	}, [song.song_id]);

	useEffect(() => {
		return () => {
			playerRef.current?.destroy();
			playerRef.current = null;
		};
	}, []);

	return (
		<div className="display-player-shell">
			<div id={playerId} className="display-player-frame" />
		</div>
	);
}

export function NavTiles({
	code,
	hostToken,
}: {
	code: string;
	hostToken?: string;
}) {
	return (
		<div
			className={cn(
				"grid gap-3",
				hostToken ? "sm:grid-cols-3" : "sm:grid-cols-2",
			)}
		>
			<Link
				to="/room/$code"
				params={{ code }}
				className="kapow-button kapow-button--nav"
			>
				<Music2 size={16} />
				Guest View
			</Link>
			{hostToken ? (
				<Link
					to="/display/$code"
					params={{ code }}
					search={{ token: hostToken }}
					className="kapow-button kapow-button--nav"
				>
					<Sparkles size={16} />
					Display View
				</Link>
			) : null}
			<Link
				to="/host/$code"
				params={{ code }}
				search={hostToken ? { token: hostToken } : undefined}
				className="kapow-button kapow-button--nav"
			>
				<Crown size={16} />
				Host View
			</Link>
		</div>
	);
}

export function SearchField({
	value,
	onChange,
	onSubmit,
	disabled,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled?: boolean;
}) {
	return (
		<div className="flex gap-3">
			<div className="relative flex-1">
				<Search
					className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/60"
					size={18}
				/>
				<input
					value={value}
					onChange={(event) => onChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							onSubmit();
						}
					}}
					placeholder="Pick your anthem..."
					className="kapow-input pl-11"
					disabled={disabled}
				/>
			</div>
			<button
				type="button"
				onClick={onSubmit}
				disabled={disabled}
				className="kapow-button kapow-button--accent"
			>
				Search
			</button>
		</div>
	);
}
