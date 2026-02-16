# Cuz Media Site + CMS

This project now includes:

- The wheel-based frontend (`http://localhost:3000`)
- A backend CMS API (`http://127.0.0.1:8787`)
- An admin UI at `/admin` for full JSON control of all content

## Run locally

1. Install dependencies:
   `npm install`
2. Start the CMS backend (terminal 1):
   `npm run cms:dev`
3. Start the frontend (terminal 2):
   `npm run dev`
4. Open:
   - Site: `http://localhost:3000`
   - Admin: `http://localhost:3000/admin`

## Admin credentials

Set these before running the CMS backend:

- `CMS_ADMIN_USER`
- `CMS_ADMIN_PASS`
- `CMS_TOKEN_SECRET`

Copy `server/.env.example` as a reference for values.

If not set, defaults are used (`admin` / `change-me-now`) which are unsafe for production.

## CMS data storage

The backend stores data in:

- Active CMS document: `server/data/cms.json`
- Default baseline: `server/data/default-cms.json`
- Revision history: `server/data/revisions/*.json`

Every save in admin creates a revision backup automatically.

## Frontend API configuration

By default, Vite proxies `/api/*` to `http://localhost:8787`.

If needed, you can override the API base from frontend with:

- `VITE_CMS_API_BASE`

## Cloudflare R2 media setup

Panel media URLs can be absolute URLs (recommended), or use env-based composition:

- `VITE_MEDIA_BASE_URL` -> public media domain (for example your `*.r2.dev` URL)
- `VITE_MEDIA_PREFIX` -> folder prefix inside bucket (default: `CuzMedia`)

Example:

```bash
VITE_MEDIA_BASE_URL=https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
VITE_MEDIA_PREFIX=CuzMedia
```
