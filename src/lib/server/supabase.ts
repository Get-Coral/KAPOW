import { createClient } from "@supabase/supabase-js";

export function createServerSupabaseClient() {
	const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
	const anonKey =
		process.env.SUPABASE_ANON_KEY ??
		process.env.SUPABASE_PUBLISHABLE_KEY ??
		process.env.SUPABASE_KEY ??
		process.env.VITE_SUPABASE_ANON_KEY ??
		process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
		process.env.VITE_SUPABASE_KEY;

	if (!url || !anonKey) {
		throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or a Supabase anon/publishable key");
	}

	return createClient(url, anonKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});
}
