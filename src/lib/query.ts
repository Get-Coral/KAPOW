export const queryKeys = {
	room: (code: string, hostToken?: string) => [
		"room",
		code,
		hostToken ?? "guest",
	],
};
