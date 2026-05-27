# MediaGrab

A social media downloader that grabs videos and images from any platform (YouTube, TikTok, Instagram, Twitter/X, Facebook, Reddit, Vimeo, and more), lets you pick the quality/format, and delivers the result as a ZIP file.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/media-downloader run dev` — run the frontend (port 23454)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- API: Express 5
- Downloader: yt-dlp (system binary, installed via pip)
- Archiving: archiver (ZIP creation)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas (used by server)
- `artifacts/api-server/src/routes/download.ts` — download/zip logic
- `artifacts/media-downloader/src/` — React frontend

## Architecture decisions

- Uses `yt-dlp` (Python) as the downloader engine — supports 1000+ platforms out of the box
- Jobs are tracked in-memory (Map) with auto-cleanup after 30 minutes
- ZIP files are created with `archiver` in a temp directory per job
- Download progress is polled every 1.5s from the frontend
- archiver is loaded via `createRequire` (CJS compatibility with esbuild ESM output)

## Product

- Paste any social media URL → fetch available formats/qualities
- Pick the quality (1080p, 720p, audio-only, etc.)
- Real-time download progress with polling
- Receive the result as a downloadable ZIP file

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- yt-dlp must be installed: `pip install yt-dlp` — it's a Python binary
- ffmpeg is required for merging video+audio streams (pre-installed in the Replit environment)
- archiver must be imported via `createRequire`, not as an ES module default import
- Do NOT call `pnpm dev` at the workspace root — use the workflow runner

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
