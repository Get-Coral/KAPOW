import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
	return clsx(values);
}

export function sortQueue<
	T extends { status: string; position: number; votes?: number },
>(items: T[]) {
	const rank = {
		playing: 0,
		waiting: 1,
		done: 2,
	} as const;

	return [...items].sort((left, right) => {
		const statusDelta =
			rank[left.status as keyof typeof rank] -
			rank[right.status as keyof typeof rank];

		if (statusDelta !== 0) {
			return statusDelta;
		}

		const positionDelta = left.position - right.position;

		if (positionDelta !== 0) {
			return positionDelta;
		}

		return (right.votes ?? 0) - (left.votes ?? 0);
	});
}

export function formatJoinCode(value: string) {
	return value.trim().toUpperCase();
}

export function buildAbsoluteUrl(pathname: string) {
	if (typeof window === "undefined") {
		return pathname;
	}

	return new URL(pathname, window.location.origin).toString();
}
