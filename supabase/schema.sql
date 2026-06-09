-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║   La Maison Restaurant — Full Supabase Schema                           ║
-- ║   Paste this entire file into Supabase SQL Editor and click Run         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Drop old objects (safe re-run) ──────────────────────────────────────────
drop trigger  if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop table    if exists public.payments   cascade;
drop table    if exists public.orders     cascade;
drop table    if exists public.cart_items cascade;
drop table    if exists public.menu_items cascade;
drop table    if exists public.profiles   cascade;

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text        not null,
  role        text        not null default 'customer'
                check (role in ('admin', 'customer')),
  created_at  timestamptz not null default now()
);

create table public.menu_items (
  id            uuid        default uuid_generate_v4() primary key,
  name          text        not null,
  description   text        not null default '',
  price         numeric(10,2) not null check (price >= 0),
  category      text        not null default 'Other',
  image_url     text        not null default '🍽️',
  offer_percent int         not null default 0 check (offer_percent between 0 and 99),
  available     boolean     not null default true,
  created_at    timestamptz not null default now()
);

create table public.cart_items (
  id            uuid        default uuid_generate_v4() primary key,
  user_id       uuid        references auth.users       on delete cascade not null,
  menu_item_id  uuid        references public.menu_items on delete cascade not null,
  quantity      int         not null default 1 check (quantity > 0),
  created_at    timestamptz not null default now(),
  unique (user_id, menu_item_id)
);

create table public.orders (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        references auth.users(id) on delete cascade not null,
  items      jsonb       not null,
  total      numeric(10,2) not null,
  status     text        not null default 'pending'
               check (status in ('pending','paid','failed','cancelled')),
  created_at timestamptz not null default now()
);

create table public.payments (
  id                       uuid        default uuid_generate_v4() primary key,
  user_id                  uuid        references auth.users on delete set null,
  stripe_payment_intent_id text        not null unique,
  amount                   int         not null,
  currency                 text        not null default 'usd',
  status                   text        not null default 'pending'
                             check (status in ('pending','processing','succeeded','failed','canceled')),
  description              text,
  created_at               timestamptz not null default now()
);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.menu_items enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders     enable row level security;
alter table public.payments   enable row level security;

-- Profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Menu items: everyone reads; only admins write
create policy "menu_select_all"   on public.menu_items for select using (true);
create policy "menu_insert_admin" on public.menu_items for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "menu_update_admin" on public.menu_items for update
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "menu_delete_admin" on public.menu_items for delete
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Cart
create policy "cart_own" on public.cart_items for all using (auth.uid() = user_id);

-- Orders
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id);
create policy "orders_insert_own" on public.orders for insert with check (auth.uid() = user_id);
create policy "orders_update_any" on public.orders for update using (true);  -- Edge Function updates status

-- Payments
create policy "payments_own" on public.payments for all using (auth.uid() = user_id);

-- ─── Trigger: auto-create profile row on signup ───────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Seed data ────────────────────────────────────────────────────────────────
insert into public.menu_items (name, description, price, category, image_url, offer_percent, available) values
  ('Margherita Pizza',    'Classic tomato base, fresh mozzarella & basil',       12.99, 'Pizza',   '🍕', 0,  true),
  ('Pepperoni Feast',     'Double pepperoni, extra mozzarella, oregano',          15.99, 'Pizza',   '🍕', 10, true),
  ('BBQ Chicken Burger',  'Smoky BBQ sauce, crispy chicken thigh, coleslaw',      11.50, 'Burgers', '🍔', 0,  true),
  ('Beef Smash Burger',   'Double smash patty, aged cheddar, dill pickles',       13.99, 'Burgers', '🍔', 15, true),
  ('Caesar Salad',        'Romaine, house croutons, shaved parmesan, anchovy',     8.99, 'Salads',  '🥗', 0,  true),
  ('Greek Salad',         'Kalamata olives, creamy feta, cucumber, ripe tomato',   9.50, 'Salads',  '🥗', 5,  true),
  ('Spaghetti Carbonara', 'Guanciale, egg yolk, aged pecorino, black pepper',     14.00, 'Pasta',   '🍝', 0,  true),
  ('Penne Arrabbiata',    'San Marzano tomato, garlic, bird''s eye chili, basil', 10.50, 'Pasta',   '🍝', 20, true),
  ('Mango Lassi',         'Alphonso mango, chilled yogurt, hint of cardamom',      4.50, 'Drinks',  '🥭', 0,  true),
  ('Espresso',            'Double-shot Italian roast, crema on top',               3.00, 'Drinks',  '☕', 0,  true),
  ('Tiramisu',            'Mascarpone cream, espresso-soaked ladyfingers, cocoa',  6.50, 'Desserts','🍮', 0,  true),
  ('Lava Cake',           'Warm dark chocolate fondant, vanilla ice cream',        7.00, 'Desserts','🍫', 12, true)
on conflict do nothing;

-- ─── Make yourself admin (run after signing up) ───────────────────────────────
-- update public.profiles set role = 'admin' where email = 'your@email.com';
