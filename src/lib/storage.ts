export const GUEST_NAME_KEY = "kapow.guest-name";
export const SESSION_ID_KEY = "kapow.session-id";

export function getStoredGuestName() {
	if (typeof window === "undefined") {
		return "";
	}

	return window.localStorage.getItem(GUEST_NAME_KEY) ?? "";
}

export function setStoredGuestName(name: string) {
	if (typeof window === "undefined") {
		return;
	}

	window.localStorage.setItem(GUEST_NAME_KEY, name);
}

export function hasStoredGuestName() {
	return Boolean(getStoredGuestName().trim());
}

export function getSessionId() {
	if (typeof window === "undefined") {
		return "";
	}

	const existing = window.localStorage.getItem(SESSION_ID_KEY);

	if (existing) {
		return existing;
	}

	const next = crypto.randomUUID();
	window.localStorage.setItem(SESSION_ID_KEY, next);
	return next;
}
