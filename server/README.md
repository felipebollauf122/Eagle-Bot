# EagleBot — Bot Engine Server

Standalone Node.js server that processes Telegram bot interactions.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in values
3. Start Redis: `redis-server`
4. Start dev server: `npm run dev`

## Environment Variables

- `PORT` — Server port (default: 3001)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (NOT anon key)
- `REDIS_URL` — Redis connection URL (default: redis://localhost:6379)
- `BASE_WEBHOOK_URL` — Public URL for this server (e.g., https://your-domain.com)

## Endpoints

- `GET /health` — Health check
- `POST /webhook/:botId` — Telegram webhook receiver
- `POST /api/bots/:botId/register-webhook` — Register Telegram webhook for a bot

## Architecture

The engine receives Telegram updates via webhooks, looks up the lead and active flow,
then executes flow nodes sequentially. Delay nodes schedule future execution via BullMQ.
Input and button nodes pause execution until the user responds.
