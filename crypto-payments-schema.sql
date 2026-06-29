-- Crypto payment verification table for The Legends of Ren Zu
-- Run this in Supabase SQL Editor before enabling automatic crypto verification.

create table if not exists public.crypto_payments (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  device_id text,
  email text,
  plan text not null check (plan in ('gu_master', 'gu_immortal', 'venerable')),
  amount_usdt numeric(12, 6) not null default 0,
  required_usdt numeric(12, 6) not null default 0,
  currency text not null default 'USDT',
  network text not null default 'TRON_TRC20',
  wallet_address text not null,
  token_contract text,
  tx_hash text not null unique,
  status text not null default 'verifying' check (status in ('verifying', 'approved', 'failed', 'rejected')),
  raw jsonb,
  failure_reason text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crypto_payments_user_id_idx on public.crypto_payments(user_id);
create index if not exists crypto_payments_email_idx on public.crypto_payments(email);
create index if not exists crypto_payments_status_idx on public.crypto_payments(status);

alter table public.crypto_payments enable row level security;

-- Users can read their own crypto payment records.
drop policy if exists "Users can read own crypto payments" on public.crypto_payments;
create policy "Users can read own crypto payments"
on public.crypto_payments
for select
to authenticated
using (auth.uid() = user_id);

-- Server-side API uses service role key and bypasses RLS for inserts/updates.
