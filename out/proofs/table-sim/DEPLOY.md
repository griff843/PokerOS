# Table Sim — Vercel Deployment Guide

## Prerequisites

- Vercel account linked to your GitHub/GitLab repo
- The repo contains `apps/table-sim/` with the Next.js app

## Environment Variables

Set the following in Vercel → Project Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `COACH_APP_PASSCODE` | *(your chosen passcode)* | Required. Used for login gate. |

## Build Configuration

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `apps/table-sim` |
| Build Command | `cd ../.. && pnpm install && cd apps/table-sim && npx next build` |
| Output Directory | `.next` |
| Install Command | `pnpm install` |
| Node.js Version | 18.x or 20.x |

### Why the build command changes directory

The workspace dependency `@poker-coach/core` lives at `packages/core/`. Vercel needs to install from the monorepo root so pnpm can link workspaces, then build from within `apps/table-sim/`.

## Alternative: Vercel Monorepo Setup

If using Vercel's monorepo support:

1. Set **Root Directory** to `apps/table-sim`
2. Enable **Include files outside Root Directory**
3. Build command: `npx next build`
4. Vercel will detect pnpm from `pnpm-lock.yaml` at root

## Post-Deploy Verification

1. Visit `https://<your-domain>/login`
2. Enter the passcode set in `COACH_APP_PASSCODE`
3. You should be redirected to `/app/session`
4. Configure a 5-drill session → Start
5. Verify board scan prompt appears, cards render, scoring works
6. Complete session → verify summary page and JSON download

## Security Notes

- The passcode is compared server-side in `/api/auth/login`
- Auth cookie is `httpOnly`, `secure` (in production), `sameSite: lax`, 7-day max-age
- All `/app/*` routes are protected by Next.js middleware
- No user data is stored server-side; sessions are client-only (React state)

## Screenshots

The following screenshots should be captured manually after deployment:

| Screenshot | Route | What to capture |
|------------|-------|-----------------|
| `login.png` | `/login` | Passcode input form |
| `play.png` | `/app/play` | Table view with board cards, hero hand, decision overlay |
| `feedback.png` | `/app/play` | Feedback modal after submitting a decision |
| `summary.png` | `/app/summary` | Session summary with stats and download button |
| `zoom-board.png` | `/app/play` | Table view with zoom toggle activated |

## Local Development

```bash
# From monorepo root
pnpm install
pnpm dev:web        # starts Next.js on http://localhost:3030

# Or directly
cd apps/table-sim
npx next dev -p 3030
```
