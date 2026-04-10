export type RoomStatus = "open" | "closed";
export type QueueStatus = "pending" | "waiting" | "playing" | "done";

export interface RoomRow {
	id: string;
	code: string;
	host_token: string;
	status: RoomStatus;
	created_at: string;
}

export interface QueueRow {
	id: string;
	room_id: string;
	song_id: string;
	song_title: string;
	artist: string;
	thumbnail_url: string;
	submitter_name: string;
	status: QueueStatus;
	position: number;
	created_at: string;
}

export interface VoteRow {
	id: string;
	queue_id: string;
	fingerprint: string;
	voter_name: string | null;
}

export interface SongSearchResult {
	id: string;
	title: string;
	artist: string;
	thumbnail: string;
	embeddable?: boolean;
}

export interface QueueItem extends QueueRow {
	votes: number;
	hasVoted: boolean;
}

export interface SessionStat {
	label: string;
	value: string;
	accent?: string;
}

export interface RoomSnapshot {
	room: Pick<RoomRow, "id" | "code" | "status" | "created_at">;
	queue: QueueItem[];
	pendingQueue: QueueItem[];
	nowPlaying: QueueItem | null;
	nextUp: QueueItem | null;
	stats: SessionStat[];
	viewerFingerprint: string;
	isHost: boolean;
}

export interface CreateRoomResult {
	code: string;
	hostToken: string;
}
