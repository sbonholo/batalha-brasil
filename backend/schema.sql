-- DUELO BR — payment / entitlement schema
-- Apply once to the Supabase project that will host the payment backend.
-- All writes happen server-side from the Edge Function (service role);
-- RLS denies anon access so a client can never grant itself a fighter.

create table if not exists public.game_orders (
  id            uuid primary key default gen_random_uuid(),
  device_id     text not null,
  fighter_key   text not null,               -- 'mimi' | 'jana' | 'leao' | 'dudu'
  mp_payment_id text,                          -- Mercado Pago payment id
  amount        numeric not null default 1,    -- BRL
  status        text not null default 'pending', -- pending | paid | expired | error
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);
create index if not exists game_orders_device_idx on public.game_orders (device_id);
create index if not exists game_orders_mp_idx      on public.game_orders (mp_payment_id);

create table if not exists public.game_entitlements (
  device_id    text not null,
  fighter_key  text not null,
  expires_at   timestamptz not null,          -- 30 days from grant
  source       text not null default 'purchase',
  created_at   timestamptz not null default now(),
  primary key (device_id, fighter_key)
);
create index if not exists game_entitlements_device_idx on public.game_entitlements (device_id);

-- Lock both tables down: no direct client access, ever.
alter table public.game_orders       enable row level security;
alter table public.game_entitlements enable row level security;
-- (no policies = deny all for anon/auth roles; the Edge Function uses the
--  service role key which bypasses RLS)
