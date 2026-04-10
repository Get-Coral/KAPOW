const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 4) {
	return Array.from({ length }, () => {
		const index = Math.floor(Math.random() * ROOM_CHARS.length);
		return ROOM_CHARS[index];
	}).join("");
}
