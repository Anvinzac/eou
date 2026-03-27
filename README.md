# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

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
