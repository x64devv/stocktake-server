-- +goose Up

-- 1. Add new session type values to the existing enum
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'FLOOR';
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'BAKERY';
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'BUTCHERY';
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'FRUIT_VEG';
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'DELI_COLD';
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'DELI_HOT';
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'QSR';
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'RESTAURANT';

-- 2. Change the default from FULL to FLOOR (FULL is now deprecated)
ALTER TABLE sessions ALTER COLUMN type SET DEFAULT 'FLOOR';

-- 3. Add worksheet_no: the LS Retail worksheet number paired to this session
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS worksheet_no TEXT;

-- 4. Add a unique constraint: only one active (non-CLOSED, non-SUBMITTED) session
--    per store+type combo. Enforced at application layer for flexibility,
--    but we add a partial unique index for DRAFT/ACTIVE/COUNTING_COMPLETE/PENDING_REVIEW.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_store_type_active
    ON sessions (store_id, type)
    WHERE status NOT IN ('SUBMITTED', 'CLOSED');

-- +goose Down
DROP INDEX IF EXISTS idx_sessions_store_type_active;
ALTER TABLE sessions DROP COLUMN IF EXISTS worksheet_no;
-- Note: PostgreSQL does not support removing enum values.
-- To fully roll back, recreate the type without the new values.