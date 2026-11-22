# HRataion — HR Manager

Bilingual (Arabic / English) human-resources workspace built with React, Vite, TypeScript and Supabase.

## Local setup

1. Install Node.js LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set:
   - `VITE_SUPABASE_URL`: Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase publishable key (or legacy anon key)
5. Run `npm run dev`.

## Production build

- Build command: `npm run build`
- Output directory: `dist`

## Cloudflare Pages

Connect this repository to Cloudflare Pages using the Vite settings above. Add the two environment variables for both Production and Preview environments before deploying.

Never put a Supabase secret/service_role key in a browser application or commit credentials to Git.
