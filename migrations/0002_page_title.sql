-- Add title column to pages table for display in the dashboard.
-- The title is extracted from the first heading block at publish time.
ALTER TABLE pages ADD COLUMN title TEXT;
