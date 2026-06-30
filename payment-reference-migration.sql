-- Payment reference cleanup for The Legends of Ren Zu
-- Purpose: stop using the old `paystack_reference` name for Flutterwave payments.
-- Safe migration: keeps old column for backward compatibility, adds new payment_reference.

alter table public.payment_codes
add column if not exists payment_reference text;

alter table public.payment_codes
add column if not exists payment_provider text not null default 'flutterwave';

alter table public.payment_codes
add column if not exists flutterwave_transaction_id text;

-- Backfill old rows that stored Flutterwave tx_ref inside paystack_reference.
update public.payment_codes
set payment_reference = paystack_reference
where payment_reference is null
  and paystack_reference is not null;

-- Prevent duplicate payment references while allowing nulls.
create unique index if not exists payment_codes_payment_reference_unique_idx
on public.payment_codes(payment_reference)
where payment_reference is not null;

create index if not exists payment_codes_payment_provider_idx
on public.payment_codes(payment_provider);

create index if not exists payment_codes_flutterwave_transaction_id_idx
on public.payment_codes(flutterwave_transaction_id);
