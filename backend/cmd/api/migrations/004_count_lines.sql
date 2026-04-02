-- +goose Up
CREATE TABLE count_lines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES stock_take_sessions(id),
    bay_id      UUID NOT NULL REFERENCES bays(id),
    item_no     TEXT NOT NULL,
    counter_id  UUID NOT NULL REFERENCES counters(id),
    quantity    NUMERIC(14,4) NOT NULL,
    counted_at  TIMESTAMPTZ NOT NULL,
    synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    round_no    INT NOT NULL DEFAULT 0,
    client_uuid UUID NOT NULL UNIQUE
);

CREATE INDEX idx_count_lines_session  ON count_lines(session_id);
CREATE INDEX idx_count_lines_item     ON count_lines(session_id, item_no);
CREATE INDEX idx_count_lines_counter  ON count_lines(session_id, counter_id);
CREATE INDEX idx_count_lines_bay      ON count_lines(session_id, bay_id);

CREATE TABLE bin_submissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID NOT NULL REFERENCES stock_take_sessions(id),
    bay_id       UUID NOT NULL REFERENCES bays(id),
    counter_id   UUID NOT NULL REFERENCES counters(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS bin_submissions, count_lines;
