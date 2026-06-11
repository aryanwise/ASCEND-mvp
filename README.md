# Ascend — AI Cognitive Partner (MVP)

Next.js 15 PWA. Supabase auth + Postgres + RLS. Groq (llama-3.3-70b-versatile) for all AI.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill all 7 vars.
3. Run the SQL in `supabase-schema.sql` in the Supabase SQL Editor.
4. In Supabase Auth → Providers → Email: turn **Confirm email OFF**, **Allow signups ON**.
5. `npm run dev`

## Deploy
Push to GitHub → Vercel auto-deploys. Set all 7 env vars in Vercel → Settings → Environment Variables.

## VAPID keys (for push)
`npx web-push generate-vapid-keys` → put public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, private in `VAPID_PRIVATE_KEY`.
