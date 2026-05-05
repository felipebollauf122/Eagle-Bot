-- EvPay como gateway alternativo (cada bot escolhe sigilopay ou evpay)

alter table public.bots
  add column payment_gateway text not null default 'sigilopay'
    check (payment_gateway in ('sigilopay', 'evpay')),
  add column evpay_api_key text,
  add column evpay_project_id text,
  add column evpay_webhook_secret text,
  add column evpay_webhook_id text;
