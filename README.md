# KAPOW

[![Discord](https://img.shields.io/discord/[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-ElianCodes-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/ElianCodes)
[![Discord](https://img.shields.io/discord/1495441903297237043?label=Discord&logo=discord&logoColor=white&color=5865F2)](https://discord.gg/M3wzFpGbzp)?label=Discord&logo=discord&logoColor=white&color=5865F2)](https://discord.gg/M3wzFpGbzp)

Comic-book karaoke queue manager. Hosts spin up a room, guests scan a QR code and search for tracks, the crowd votes songs up the queue, and the host runs the night from a dedicated control booth.

## Stack

- **[TanStack Start](https://tanstack.com/start)** — React SSR framework with file-based routing
- **[TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query)** — type-safe routing and server-state management
- **[Supabase](https://supabase.com)** — PostgreSQL database with realtime subscriptions for live queue/vote sync
- **[Tailwind CSS v4](https://tailwindcss.com)** — styling
- **[dnd-kit](https://dndkit.com)** — drag-and-drop queue reordering (host view)
- **YouTube Data API v3** — song search

## How it works

1. Host creates a room → gets a host token, a 6-character join code, and a QR code
2. Guests join via the code or QR → search YouTube for karaoke tracks → add to queue with their name
3. Everyone votes; highest-voted pending song rises to the top
4. Host manages playback from `/host/:code`, drives the TV display at `/display/:code`

## Environment

Create a `.env` file at the project root:

```bash
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_DB_PASSWORD=
YOUTUBE_API_KEY=
```

## Development

```bash
npm install
npm run dev        # starts on http://localhost:3000
```

## Database

Migrations live in `supabase/migrations/` and are the source of truth. `supabase/schema.sql` is kept as a reference snapshot only.

### Local

Requires [Docker](https://www.docker.com) and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm run db:start   # boot local Supabase stack
npm run db:reset   # apply migrations from scratch
npm run db:lint    # lint schema for issues
npm run db:test    # reset + lint in one step
npm run db:stop    # tear down
```

### Remote

```bash
npx supabase link --project-ref <your-project-ref> -p "$SUPABASE_DB_PASSWORD"
npm run db:push:remote
```

### CI

- `.github/workflows/supabase-db.yml` — boots a local Supabase stack on every PR and main push, runs `db reset` + `db lint`
- `.github/workflows/supabase-db-deploy.yml` — pushes migrations to hosted Supabase on merge; requires repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`

## Build

```bash
npm run build
npm run preview
```

## Code quality

```bash
npm run lint       # Biome lint
npm run format     # Biome format
npm run check      # Biome lint + format together
npm test           # Vitest
```

## Routes

| Route | Description |
|---|---|
| `/` | Landing — create or join a room |
| `/room/:code` | Guest view — search songs, add to queue, vote |
| `/host/:code?token=` | Host control booth — manage queue, advance songs |
| `/display/:code` | TV display — now playing, full-screen comic mode |
