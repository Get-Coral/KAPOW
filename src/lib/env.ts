declare global {
	interface Window {
		__KAPOW_ENV__?: {
			supabaseUrl: string;
			supabaseAnonKey: string;
		};
	}
}

function readServerEnv(name: string) {
	const value = process.env[name];

	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
}

function readFirstServerEnv(names: string[]) {
	for (const name of names) {
		const value = process.env[name];

		if (value) {
			return value;
		}
	}

	throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}

export function getPublicEnv() {
	if (typeof window === "undefined") {
		return {
			supabaseUrl: readFirstServerEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]),
			supabaseAnonKey: readFirstServerEnv([
				"SUPABASE_ANON_KEY",
				"SUPABASE_PUBLISHABLE_KEY",
				"SUPABASE_KEY",
				"VITE_SUPABASE_ANON_KEY",
				"VITE_SUPABASE_PUBLISHABLE_KEY",
				"VITE_SUPABASE_KEY",
			]),
		};
	}

	const env = window.__KAPOW_ENV__;

	if (!env?.supabaseUrl || !env.supabaseAnonKey) {
		throw new Error("Missing Kapow client environment bootstrap");
	}

	return env;
}

export function getYouTubeApiKey() {
	return readServerEnv("YOUTUBE_API_KEY");
}
