# Cook's Kitchen

Shared weekly meal planning for the Cook family.

## Architecture

- **Next.js 16 / App Router** — application framework
- **React 19 + TypeScript** — UI and type safety
- **Supabase** — Postgres database, authentication, and Row Level Security
- **Vercel** — intended production hosting
- **Plain CSS design system** — preserves the warm green/cream feel of the original Our Menu MVP

## Current state

The production foundation is in place. The UI currently uses demo data so we can preserve and improve the design before live data is connected.

Included:

- Responsive Monday–Sunday planner
- Recipe-bank shell
- Grocery list generated from the weekly plan
- Shared-household data model
- Supabase browser/server client utilities
- Initial SQL migration with Row Level Security

## Local setup

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add the Supabase project URL and publishable key.
5. Apply the migration in `supabase/migrations/`.
6. Run `npm run dev`.

## Next milestones

1. Connect Supabase and apply the migration.
2. Add email/passwordless authentication and household onboarding.
3. Replace demo data with database queries and server actions.
4. Restore full recipe CRUD and meal-picker behavior from the MVP.
5. Add recipe URL importing.
6. Add AI meal suggestions and ratings / make-again feedback.
7. Deploy to Vercel and make the mobile app installable as a PWA.
