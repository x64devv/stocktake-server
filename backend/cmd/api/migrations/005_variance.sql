-- +goose Up
CREATE TYPE flag_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE TABLE variance_flags (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES stock_take_sessions(id),
    item_no    TEXT NOT NULL,
    flagged_by UUID NOT NULL REFERENCES admin_users(id),
    flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status     flag_status NOT NULL DEFAULT 'PENDING',
    UNIQUE (session_id, item_no)
);

CREATE INDEX idx_variance_flags_session ON variance_flags(session_id);
CREATE INDEX idx_variance_flags_status  ON variance_flags(session_id, status);

CREATE TABLE recount_decisions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id     UUID NOT NULL REFERENCES variance_flags(id),
    reviewed_by UUID NOT NULL REFERENCES admin_users(id),
    decision    flag_status NOT NULL,
    notes       TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS recount_decisions, variance_flags;
DROP TYPE  IF EXISTS flag_status;
