# AutoGrow

AI-powered SEO reporting platform for digital marketing agencies. Connects to a client's
Google Search Console, WordPress, GitHub, and Google Sheets, then uses Claude to generate
branded, client-ready SEO performance reports on demand.

## Stack

- **Next.js 16** (App Router) on Vercel
- **PostgreSQL** via Prisma 7 (`@prisma/adapter-pg`)
- **NextAuth.js v5** — Google OAuth + email/password
- **BullMQ + Redis** — async report generation and PDF export, processed by a worker on Railway
- **Claude (Anthropic SDK)** — report content generation
- **Puppeteer** (Railway worker only) — PDF rendering, uploaded to **AWS S3**
- **Tailwind CSS + Radix UI**

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npx prisma generate
npx prisma migrate deploy    # applies prisma/migrations against DATABASE_URL
npm run dev                  # Next.js app
npm run worker               # BullMQ worker (report generation + PDF export), separate terminal
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide: provisioning Postgres/Redis/S3,
configuring Google OAuth, and deploying the Next.js app to Vercel with the worker on Railway.
