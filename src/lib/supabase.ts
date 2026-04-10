import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "./env";

let browserClient: ReturnType<typeof createClient> | undefined;

export function getSupabaseBrowserClient() {
	if (browserClient) {
		return browserClient;
	}

	const env = getPublicEnv();

	browserClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
		},
	});

	return browserClient;
}
