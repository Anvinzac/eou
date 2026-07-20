# EOU — Full-stack MVC

React (Vite) client + Express TypeScript API. Domain logic lives on the server; the client is a thin view layer. Supabase remains the database/auth provider.

## Architecture

```
client/   Views (React) + api/ fetch wrappers
server/
  controllers/   HTTP only
  services/      Business rules (own/rewrite these)
  models/        Supabase data access
  routes/        Route → controller wiring
supabase/        Migrations & seeds
```

## Local setup

```sh
npm i
# Copy .env.example → .env and set SUPABASE_* + QWEN_* (server) and VITE_* (client)
# Prefer SUPABASE_SERVICE_ROLE_KEY on the server so writes bypass RLS safely.
npm run dev   # API :3001 + Vite :8080 (proxies /api)
```

Useful scripts: `npm run server:dev`, `npm run client:dev`, `npm test`, `npm run supabase:start`.

Admin live dashboard (admin role required): `/admin` — Overview, Users, Content, Links, Errors, Status, Settings.  
Apply migration `supabase/migrations/20260720100000_telemetry_tables.sql`, then run backfill from Settings or `npm run backfill -w server`. See [`MAPPING_NOTES.md`](MAPPING_NOTES.md).

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Environment setup

For hosted preview or production, create a local `.env` from `.env.example` or configure the same values in your deployment platform:

```sh
cp .env.example .env
```

Required hosted variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

For local Supabase, use `.env.local` instead so it overrides the hosted values without changing them.

## Local Supabase testing

You can run this app against your own local Supabase instead of the hosted Lovable project.

1. Install Docker Desktop.
2. Start local Supabase:

```sh
npm run supabase:start
```

3. Get the local anon key:

```sh
npm run supabase:status
```

4. Copy `.env.local.example` to `.env.local` and paste the anon key from the status output.
5. Apply the repo migrations to the local database:

```sh
npm run supabase:db:reset
```

6. Start the app:

```sh
npm run dev
```

`src/integrations/supabase/client.ts` accepts either `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`, so local Supabase works without changing the hosted `.env`.

The local reset now also seeds demo data:

- Open sample quiz: `/quiz/10000000-0000-0000-0000-000000000001`
- Invite-only sample quiz: `/quiz/10000000-0000-0000-0000-000000000002?code=LOCAL1`
- Completed couple result: `/couple/MATCH1`
- Waiting couple session: `/couple/WAIT22`

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
