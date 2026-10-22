# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server at http://localhost:3000
- `npm run build` — production build (runs TypeScript checking)
- `npm run start` — start production server
- `npm run typecheck` — `tsc --noEmit`
- `docker compose up -d db` — start local MySQL 8 (required for dev)
- `npm run db:migrate` — apply `prisma/migrations` (`prisma migrate deploy`)
- `npm run db:migrate:dev` — create and apply a migration after schema changes
- `npm run db:seed` — reset all data and load demo data
- `npm run db:reset` — reset the MySQL database and seed it (`prisma migrate reset --force`)
- `npm run db:import` — import legacy SQLite data (dry-run by default; `--yes --reset-target` to write)
- `npx prisma studio` — browse data

Demo accounts: `admin/admin123`, `t001/teacher123`, `p001/parent123`.

## Architecture

Single Next.js 14 App Router app. Every page is a server component; mutations are React Server Actions in `src/actions/*`. There is no client-side data fetching except small presentational client components (`Sidebar`, `ConfirmButton`).

### Auth and authorization

- `src/lib/auth.ts` implements password hashing (Node `scrypt`) and a stateless session: JSON payload signed with HMAC-SHA256 stored in the `kg_session` HttpOnly cookie. No NextAuth / external auth. The same payload format is exposed as `signSession` / `verifySession` for the mini program's Bearer tokens.
- `src/lib/guards.ts` is the authorization layer: `requireUser`, `requireAdmin`, `requireStaff`, plus scope helpers. List/getter pages use `requireUser` and filter by role; admin-only pages use `requireAdmin`.
- Scope rules: ADMIN sees everything; TEACHER is limited via `Teacher.classes` (`teacherClassIds`, `teacherCanAccessClass`, `teacherCanAccessStudent`); PARENT is limited via `Student.parentId`.
- Every server action re-checks authorization itself — pages calling them do not make an action safe. Any new action must call `requireAdmin`/`requireStaff`/`requireUser` and validate ownership scope before writing.

### Mini program API (`src/app/api`)

- JSON endpoints live under `src/app/api/**/route.ts` and are consumed by the native WeChat mini program in `miniprogram/`. They are outside `(portal)` and never render pages.
- Every handler wraps its body in `handle(...)` from `src/lib/api.ts`. Except `POST /api/auth/login`, every route calls `requireParent()` (and `requireChild` for child-scoped data); these throw `ApiError` and return JSON 401/403/404 instead of redirecting.
- Bearer auth: `Authorization: Bearer <token>`. `requireApiUser` verifies with `verifySession` and re-reads `User.active` / `role` from the database on every request.
- Response envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`, via `src/lib/json.ts`. Dates are `YYYY-MM-DD`; money is integer cents.
- Shared business logic (login, leave rules, parent fee math) lives in `src/lib/services/*`. Do not call Server Actions from API routes — actions rely on `redirect()` and `FormData`.
- Mini program networking lives in `miniprogram/utils/config.js` and `request.js`. `MODE = "cloud"` uses `wx.cloud.callContainer` (no request domain whitelist); `MODE = "http"` uses `wx.request` for local debugging. New pages must be registered in `miniprogram/app.json`; tabBar pages cannot receive query params, so cross-tab selection goes through `getApp().globalData` (see `selectedChildId`).
- The mini program API only serves parents. ADMIN/TEACHER tokens must receive 403 from `/api/miniapp/*`.
- `GET /api/health` is public and pings the database; it is the Cloud Run health check.

### Data model (`prisma/schema.prisma`)

Core chain: `User` → (optional) `Teacher` → `SchoolClass` → `Student`; parents are `User` rows with `role = PARENT` linked through `Student.parentId` (a teacher account is linked through `Teacher.userId`).

- `Attendance` is unique per `(studentId, date)`; saves use `upsert`.
- `LeaveRequest` carries requester/reviewer user references.
- `Schedule` is a weekly template (`weekday` 1–5, start/end time).
- `FeeItem` is charged per active student; `Payment` records partial payments and is summed against the fee item to derive the balance.
- Money is stored in integer cents (`amountCents`). Convert with `yuanToCents` / `centsToYuan` / `fmtMoney` from `src/lib/format.ts`; never use floats for money.
- Attendance/leave/due dates are `YYYY-MM-DD` strings for timezone-safe comparisons. Use `todayString()` / `monthStartString()` rather than raw `toISOString()` (UTC drift).
- `prisma/seed.js` deletes and recreates all demo data in dependency order. It is destructive; do not run it against real data.
- Database is MySQL 8; schema changes require a new file under `prisma/migrations/` (use `npm run db:migrate:dev`). Long free-text fields use `@db.Text`.
- `prisma/import-sqlite.js` migrates the legacy `prisma/dev.db` into MySQL, preserving IDs and converting epoch-ms DateTimes. It is safe by default (dry-run) and requires `--yes --reset-target` to write.

### Page/action conventions

- Actions read input via `src/lib/forms.ts` helpers, validate, persist, call `revalidatePath`, then `redirect(withSuccess(...))` or `redirect(withError(...))`. Pages read `error`/`success` from `searchParams` and render `<Alert>`.
- Redirects must not be wrapped in `try/catch` (Next uses a thrown redirect).
- Form parsing/validation returns discriminated unions (`{ ok: true, data } | { ok: false, error }`); follow that pattern rather than throwing.
- Pages are dynamic (`export const dynamic = "force-dynamic"`) because data and auth cookies are per-request.
- UI copy is Chinese. Add new labels to `src/lib/constants.ts` instead of hardcoding enum strings in JSX.

### UI

- Layout: `src/app/(portal)/layout.tsx` + `Sidebar`; login lives outside that layout. Role-specific dashboards live in `src/app/(portal)/page.tsx`.
- Styling is a single hand-written design system in `src/app/globals.css` (no Tailwind/UI library). Reuse existing classes (`.card`, `.btn`, `.field`, `.badge`, `.table-wrap`, `.stats-grid`, `.form-grid`, etc.) and keep the Chinese visual style consistent.
- Shared components are in `src/components/`. `ConfirmButton` is the only interactive client primitive; destructive forms wrap a submit button with it.

### Deployment (WeChat Cloud Run)

- `Dockerfile` builds a Node 20 Debian image; `docker/entrypoint.sh` constructs `DATABASE_URL` from `MYSQL_ADDRESS` / `MYSQL_USERNAME` / `MYSQL_PASSWORD` / `MYSQL_DATABASE`, runs `prisma migrate deploy`, then starts Next on port 80.
- The container must run with `TZ=Asia/Shanghai`; `todayString()` and the dashboards depend on the server's local date.
- The mini program runs in `cloud` mode with a real AppID and a linked CloudBase environment; placeholders are in `miniprogram/utils/config.js`.
- Web admin and API share the same container. Full setup and data migration steps are in `docs/deploy-cloud-run.md`.
- Do not run `db:seed` or the SQLite import against production without explicit intent; both can wipe data.

### Environment

`.env` holds `DATABASE_URL` (MySQL) and `AUTH_SECRET`. Local development uses the MySQL from `docker-compose.yml`. Production requires a random `AUTH_SECRET` and HTTPS (session cookies are `Secure` when `NODE_ENV=production`). Cloud Run injects `MYSQL_*` instead of `DATABASE_URL`.
