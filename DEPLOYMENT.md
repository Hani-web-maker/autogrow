# AutoGrow Deployment Guide

## Architecture Overview

- **Next.js App** → Vercel (serverless)
- **PostgreSQL** → Neon, Supabase, or Railway Postgres
- **Redis** → Upstash Redis or Railway Redis
- **Worker** → Railway (separate service)
- **Storage** → AWS S3 or Cloudflare R2

---

## Step 1 — Database (PostgreSQL)

### Option A: Neon (recommended, serverless)
1. Create account at https://neon.tech
2. Create a new project → copy the connection string
3. Run migrations: `DATABASE_URL=<url> npx prisma migrate deploy`

### Option B: Railway Postgres
1. In Railway dashboard → New Service → Database → PostgreSQL
2. Copy `DATABASE_URL` from Variables tab
3. Run: `npx prisma migrate deploy`

---

## Step 2 — Redis

### Option A: Upstash (recommended, serverless)
1. Create account at https://upstash.com
2. Create Redis database → copy `REDIS_URL` (starts with `rediss://`)

### Option B: Railway Redis
1. New Service → Database → Redis → copy connection URL

---

## Step 3 — AWS S3 (PDF Storage)

1. Create S3 bucket with public read disabled
2. Create IAM user with `s3:PutObject`, `s3:GetObject` permissions on the bucket
3. Note: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`

---

## Step 4 — Google OAuth + GSC

1. Go to https://console.cloud.google.com → New Project
2. Enable APIs: **Google Search Console API**, **Google Sheets API**
3. OAuth consent screen → External → add scopes:
   - `https://www.googleapis.com/auth/webmasters.readonly`
4. Credentials → OAuth 2.0 Client ID → Web application
   - Authorized redirect URIs: `https://yourdomain.com/api/integrations/gsc/callback`
5. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

---

## Step 5 — Deploy Next.js to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy from project root
vercel --prod
```

During setup, Vercel will prompt for environment variables. Set all of these:

```
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
DATABASE_URL=<from Step 1>
GOOGLE_CLIENT_ID=<from Step 4>
GOOGLE_CLIENT_SECRET=<from Step 4>
ANTHROPIC_API_KEY=<from https://console.anthropic.com>
REDIS_URL=<from Step 2>
AWS_ACCESS_KEY_ID=<from Step 3>
AWS_SECRET_ACCESS_KEY=<from Step 3>
AWS_REGION=us-east-1
AWS_S3_BUCKET=<your bucket name>
ENCRYPTION_KEY=<generate with: openssl rand -hex 16>
```

---

## Step 6 — Deploy Worker to Railway

1. Go to https://railway.app → New Project → Deploy from GitHub repo
2. Select your repo
3. Railway will detect `railway.toml` and run: `npm run worker`
4. Add **all the same environment variables** from Step 5 in the Railway Variables tab
5. The worker process connects to Redis, listens for BullMQ jobs, and calls the Claude API

---

## Step 7 — Run Database Migrations

After both services are deployed:

```bash
DATABASE_URL=<your-prod-url> npx prisma migrate deploy
```

Or set it in your CI/CD pipeline.

---

## Step 8 — Verify

1. Visit your Vercel URL → should redirect to `/login`
2. Register an account
3. Create a project
4. Connect Google Search Console (OAuth)
5. Generate a report — it should queue, the Railway worker processes it, and the status updates via polling

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_URL` | ✅ | Your app's public URL |
| `NEXTAUTH_SECRET` | ✅ | Random 32-char secret |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `REDIS_URL` | ✅ | Redis connection URL |
| `ENCRYPTION_KEY` | ✅ | 32-char key for token encryption |
| `AWS_ACCESS_KEY_ID` | For PDF export | S3 access key |
| `AWS_SECRET_ACCESS_KEY` | For PDF export | S3 secret key |
| `AWS_REGION` | For PDF export | e.g. `us-east-1` |
| `AWS_S3_BUCKET` | For PDF export | S3 bucket name |

---

## Role-Based Access Control

Users have one of three roles (`User.role`): `admin`, `manager`, `worker`.

| Action | admin | manager | worker |
|---|---|---|---|
| View projects/tasks/reports in their org | ✅ | ✅ | ✅ |
| Create/update tasks, sync integrations | ✅ | ✅ | ✅ |
| Delete a project | ✅ | ✅ | ❌ |
| Create/update/delete prompt templates | ✅ | ✅ | ❌ |

Enforcement lives in `lib/rbac.ts` (`hasRole`) and is applied directly in the relevant API routes.
