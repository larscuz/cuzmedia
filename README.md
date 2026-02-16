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

## Production note (static hosting)

If your production host serves only static files (for example Vercel without a running Node API),
`/api/cms` will return `404`.

To keep production updated from admin-edited content:

1. Save changes in local admin (writes `server/data/cms.json`)
2. Run build (`npm run build`)
3. Deploy the build output

The build now exports `server/data/cms.json` to `public/cms.json`, and frontend will fallback
to `/cms.json` when `/api/cms` is unavailable.

## Vercel admin/API routes

This repo now includes serverless API routes under `api/` so `/admin` can authenticate on
`https://www.cuzmedia.no`.

- Public CMS endpoint: `/api/cms`
- Admin login: `/api/admin/login`
- Admin CMS CRUD: `/api/admin/cms`
- Admin revisions/reset: `/api/admin/revisions`, `/api/admin/reset`, `/api/admin/revisions/:id/restore`

Credentials in production are controlled with:

- `CMS_ADMIN_USER`
- `CMS_ADMIN_PASS`
- `CMS_TOKEN_SECRET`
- Optional persistent key path in R2: `CMS_R2_KEY` (default `CuzMedia/cms.json`)
- Optional revision prefix in R2: `CMS_R2_REVISIONS_PREFIX` (default `CuzMedia/cms-revisions`)

## Admin media upload (Cloudflare R2)

Admin now includes `Upload Video` and `Upload Image` buttons per panel.
Uploads are signed server-side and written to unique keys under:

- `CuzMedia/uploads/video/...`
- `CuzMedia/uploads/image/...`

Set these env vars in Vercel project settings:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL` (for example your `https://pub-...r2.dev`)

Optional:

- `R2_UPLOAD_PREFIX` (default `CuzMedia/uploads`)
- `R2_SIGNED_URL_TTL_SECONDS` (default `900`)
- `R2_MAX_VIDEO_BYTES` (default `1073741824`)
- `R2_MAX_IMAGE_BYTES` (default `62914560`)

R2 bucket CORS must allow browser `PUT` from your site origin (`https://www.cuzmedia.no`) and
`Content-Type` header.

## Cloudflare R2 media setup

Panel media URLs can be absolute URLs (recommended), or use env-based composition:

- `VITE_MEDIA_BASE_URL` -> public media domain (for example your `*.r2.dev` URL)
- `VITE_MEDIA_PREFIX` -> folder prefix inside bucket (default: `CuzMedia`)

Example:

```bash
VITE_MEDIA_BASE_URL=https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
VITE_MEDIA_PREFIX=CuzMedia
```
