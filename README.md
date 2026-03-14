# KoolMail

A full-stack email management application that gives every user their own personal inbox at a custom domain (e.g. `username@koolname.asia`). Built with Next.js, Convex, and Cloudflare Workers.

## Features

- **Personal inbox** — each registered user gets their own email address
- **Compose & send** — rich text editor with bold, italic, underline, lists, headings, and more
- **Email threading** — conversations are grouped using Message-ID / References headers
- **Attachments** — upload and download file attachments (up to 25 MB per email)
- **Scheduled sending** — write an email now and have it delivered at a future time
- **Spam management** — block senders to keep unwanted mail out of your inbox
- **Folder organization** — Inbox, Sent, Spam, and Scheduled folders
- **Real-time updates** — Convex's live queries keep the UI in sync without polling
- **Authentication** — sign up / sign in with username and password

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | [Convex](https://convex.dev) – database, file storage, scheduler, auth |
| Email ingestion | Cloudflare Workers + Cloudflare Email Routing, postal-mime |
| Email delivery | [Resend](https://resend.com) |
| Icons | Lucide React |

## Architecture

```
Incoming email
  └─> Cloudflare Email Routing
        └─> Cloudflare Worker (parses MIME, uploads attachments)
              └─> Convex HTTP endpoint  ──> Convex database (real-time)
                                                        │
                                              Next.js frontend (reads live)

Outgoing email
  └─> Next.js API route  ──> Resend API  ──> recipient
                         └─> Convex (saved to Sent / Scheduled folder)
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) (or npm / yarn / bun)
- A [Convex](https://convex.dev) account
- A [Resend](https://resend.com) account and API key
- A Cloudflare account with Email Routing enabled (for receiving mail)

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL (HTTP API) |
| `CONVEX_DEPLOYMENT` | Convex deployment name |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex site URL (for HTTP actions) |
| `RESEND_API_KEY` | Resend API key for sending emails |
| `WEBHOOK_SECRET` | Shared secret used by the Cloudflare Worker |
| `AUTH_SECRET` | Secret used to sign Convex auth tokens |

### Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

In a separate terminal, start the Convex development server:

```bash
npx convex dev
```

### Deploy the Cloudflare Worker

```bash
cd cloudflare
npm install
npx wrangler deploy
```

Set the `WEBHOOK_SECRET` and `CONVEX_SITE_URL` secrets in your Cloudflare Worker settings to match the values in your `.env.local`.

## Project Structure

```
├── src/
│   └── app/
│       ├── inbox/page.tsx        # Main email UI
│       ├── api/send-email/       # API route – send via Resend
│       └── api/webhook/email/    # Legacy ingest webhook
├── convex/
│   ├── schema.ts                 # Database schema
│   ├── emails.ts                 # Email queries & mutations
│   ├── http.ts                   # Convex HTTP endpoints
│   └── auth.ts                   # Authentication config
└── cloudflare/
    └── cloudflare-worker.js      # Email ingestion worker
```
