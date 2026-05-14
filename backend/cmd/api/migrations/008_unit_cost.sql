-- +goose Up
ALTER TABLE session_items       ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE theoretical_stocks  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14,4) NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE session_items       DROP COLUMN IF EXISTS unit_cost;
ALTER TABLE theoretical_stocks  DROP COLUMN IF EXISTS unit_cost;