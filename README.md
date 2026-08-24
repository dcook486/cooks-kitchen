# Cook's Kitchen

A shared weekly meal planner and recipe bank for the Cook family.

## Architecture

- **Next.js 16 / App Router** — application framework
- **React 19 + TypeScript** — UI and type safety
- **Supabase** — Postgres database, authentication, and Row Level Security
- **Vercel** — intended production hosting
- **Plain CSS design system** — preserves the warm green/cream feel of the original Our Menu MVP

## Current state

The app is now connected to the live Cook's Kitchen Supabase project.

Working now:

- Email/password sign up and sign in
- Cookie-based Supabase SSR sessions
- First-run household onboarding
- `America/Chicago` household timezone
- Shared recipe bank stored in Supabase
- Add recipes with ingredients, instructions, tags, dietary tags, timing, servings, and source URL
- Recipe search
- Favorite/unfavorite recipes
- Delete recipes
- Row Level Security for household data
- Responsive Cook's Kitchen design

Coming next:

- Save Monday–Sunday meal selections
- Eating out / leftovers slots
- Automatic grocery-list generation from the weekly plan
- Invite a second household member
- Recipe URL importing
- AI meal suggestions

## Local setup

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

The publishable Supabase project URL/key are documented in `.env.example`. No secret/service-role key belongs in the repository.

## Supabase Auth email confirmation

Hosted Supabase projects require email confirmation by default. Because Cook's Kitchen uses server-side/cookie auth, update the **Confirm signup** email template in Supabase before testing new-account confirmation:

1. Open **Supabase → Cook's Kitchen → Authentication → Email Templates → Confirm signup**.
2. Change the confirmation link target to:

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

3. During local testing, set the Supabase **Site URL** to `http://localhost:3000`.
4. When the Vercel deployment exists, change the Site URL to the production domain and keep localhost as an allowed redirect URL for development.

## Database

The schema is versioned in `supabase/migrations/`. The live project currently contains:

- `profiles`
- `households`
- `household_members`
- `recipes`
- `meal_plans`
- `meal_plan_items`
- `grocery_items`

All exposed tables have Row Level Security enabled.
