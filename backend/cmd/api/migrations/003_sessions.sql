-- +goose Up
CREATE TYPE session_type   AS ENUM ('FULL', 'PARTIAL');
CREATE TYPE session_status AS ENUM ('DRAFT', 'ACTIVE', 'COUNTING_COMPLETE', 'PENDING_REVIEW', 'SUBMITTED', 'CLOSED');

CREATE TABLE stock_take_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id     UUID NOT NULL REFERENCES stores(id),
    session_date DATE NOT NULL,
    type         session_type   NOT NULL DEFAULT 'FULL',
    status       session_status NOT NULL DEFAULT 'DRAFT',
    created_by   UUID NOT NULL REFERENCES admin_users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE session_items (
    session_id  UUID NOT NULL REFERENCES stock_take_sessions(id),
    item_no     TEXT NOT NULL,
    description TEXT NOT NULL,
    barcode     TEXT NOT NULL,
    uom         TEXT NOT NULL,
    PRIMARY KEY (session_id, item_no)
);

CREATE TABLE session_counters (
    session_id  UUID NOT NULL REFERENCES stock_take_sessions(id),
    counter_id  UUID NOT NULL REFERENCES counters(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (session_id, counter_id)
);

CREATE TABLE theoretical_stock (
    session_id      UUID NOT NULL REFERENCES stock_take_sessions(id),
    item_no         TEXT NOT NULL,
    theoretical_qty NUMERIC(14,4) NOT NULL,
    pulled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, item_no)
);

-- +goose Down
DROP TABLE IF EXISTS theoretical_stock, session_counters, session_items, stock_take_sessions;
DROP TYPE  IF EXISTS session_status, session_type;
