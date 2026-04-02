-- +goose Up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE stores (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_code  TEXT NOT NULL UNIQUE,
    store_name  TEXT NOT NULL,
    ls_store_code TEXT NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE zones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID NOT NULL REFERENCES stores(id),
    zone_code   TEXT NOT NULL,
    zone_name   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(store_id, zone_code)
);

CREATE TABLE aisles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id     UUID NOT NULL REFERENCES zones(id),
    aisle_code  TEXT NOT NULL,
    aisle_name  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(zone_id, aisle_code)
);

CREATE TABLE bays (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aisle_id    UUID NOT NULL REFERENCES aisles(id),
    bay_code    TEXT NOT NULL,
    bay_name    TEXT NOT NULL,
    barcode     TEXT NOT NULL UNIQUE,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(aisle_id, bay_code)
);

-- +goose Down
DROP TABLE IF EXISTS bays, aisles, zones, stores;
