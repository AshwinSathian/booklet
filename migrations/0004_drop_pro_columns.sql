-- Remove dead Stripe/Pro columns that are no longer used.
-- These were placeholders for a paywall that was deliberately removed.
ALTER TABLE users DROP COLUMN is_pro;
ALTER TABLE users DROP COLUMN stripe_customer_id;
