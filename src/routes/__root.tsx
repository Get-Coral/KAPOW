import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Kapow",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/logo.png",
			},
			{
				rel: "apple-touch-icon",
				href: "/logo.png",
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
		],
	}),
	component: () => <Outlet />,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const publicEnv =
		typeof window === "undefined"
			? {
					supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
					supabaseAnonKey:
						process.env.SUPABASE_ANON_KEY ??
						process.env.SUPABASE_PUBLISHABLE_KEY ??
						process.env.SUPABASE_KEY ??
						process.env.VITE_SUPABASE_ANON_KEY ??
						process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
						process.env.VITE_SUPABASE_KEY ??
						"",
				}
			: (window.__KAPOW_ENV__ ?? {
					supabaseUrl: "",
					supabaseAnonKey: "",
				});

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="font-sans antialiased selection:bg-[#ffd84d]/30">
				<script>{`window.__KAPOW_ENV__=${JSON.stringify(publicEnv)};`}</script>
				<QueryClientProvider client={router.options.context.queryClient}>
					{children}
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
							TanStackQueryDevtools,
						]}
					/>
					<Scripts />
				</QueryClientProvider>
			</body>
		</html>
	);
}
