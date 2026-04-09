-- +goose Up

-- Per-session variance tolerance (§4.6)
ALTER TABLE stock_take_sessions
    ADD COLUMN IF NOT EXISTS variance_tolerance_pct NUMERIC(6,2) NOT NULL DEFAULT 2.0;

-- LS integration call audit log (§4.8)
CREATE TABLE IF NOT EXISTS ls_integration_logs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID        REFERENCES stock_take_sessions(id),
    operation     TEXT        NOT NULL,
    endpoint      TEXT        NOT NULL,
    request_body  JSONB,
    status_code   INT,
    response_body JSONB,
    error_msg     TEXT,
    duration_ms   INT,
    logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ls_logs_session   ON ls_integration_logs(session_id);
CREATE INDEX idx_ls_logs_logged_at ON ls_integration_logs(logged_at DESC);

-- +goose Down
DROP TABLE IF EXISTS ls_integration_logs;
ALTER TABLE stock_take_sessions DROP COLUMN IF EXISTS variance_tolerance_pct;
