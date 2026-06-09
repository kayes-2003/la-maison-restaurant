# 🍽 La Maison Restaurant

A full-stack restaurant ordering app with Stripe payment integration, Supabase backend, and role-based admin panel.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (dark luxury theme)
- **Auth & DB**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Payments**: Stripe (with automatic demo-mode fallback)

## Features

- 🛒 Cart with real-time quantity management
- 💳 Stripe payment flow with graceful demo fallback
- 🔐 Full auth: sign up, sign in, email confirmation, password reset
- 👨‍💼 Admin panel: add/edit/delete menu items with offers
- 📦 Order tracking stored in Supabase

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env` and fill in your own keys:

```bash
cp .env .env.local
```

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (server-side only) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API Keys |

### 3. Set up the database

Paste `supabase/schema.sql` into your Supabase SQL Editor and run it.  
This creates all tables, RLS policies, triggers, and seeds the menu.

### 4. Deploy the Edge Function

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase functions deploy create-payment-intent
```

### 5. Run the app

```bash
npm run dev
```

### 6. Make yourself admin

Sign up with your email, then run in Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'your@email.com';
```

## Payment Modes

The app automatically detects whether Stripe is fully configured:

- **Stripe configured** → real Stripe payment intent is created via the Edge Function
- **Not configured / Edge Function down** → seamless demo mode with a mock card form

## Scripts

```bash
# Manage menu items, users, and orders from the terminal
bash scripts/manage.sh help
```

## Build & Deploy

```bash
npm run build    # TypeScript check + Vite bundle → dist/
```

Deploy the `dist/` folder to Vercel, Netlify, or any static host.
