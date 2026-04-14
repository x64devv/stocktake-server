-- =============================================================================
-- StockTake Demo Seed — updated for migration 007 (new session types)
-- Run:
--   Get-Content "seed.sql" | docker exec -i stocktake-db psql -U stocktake -d stocktake
-- =============================================================================

BEGIN;

-- ── Store ─────────────────────────────────────────────────────────────────────
INSERT INTO stores (id, store_code, store_name, ls_store_code, active) VALUES
('11111111-1111-1111-1111-000000000001', 'MSASA01', 'Spar Msasa', 'SPARMSASA', true)
ON CONFLICT (id) DO NOTHING;

-- ── Zones ─────────────────────────────────────────────────────────────────────
INSERT INTO zones (id, store_id, zone_code, zone_name) VALUES
('22222222-2222-2222-2222-000000000001', '11111111-1111-1111-1111-000000000001', 'GRC', 'Grocery'),
('22222222-2222-2222-2222-000000000002', '11111111-1111-1111-1111-000000000001', 'BWG', 'Beverages'),
('22222222-2222-2222-2222-000000000003', '11111111-1111-1111-1111-000000000001', 'FRZ', 'Frozen')
ON CONFLICT (id) DO NOTHING;

-- ── Aisles ────────────────────────────────────────────────────────────────────
INSERT INTO aisles (id, zone_id, aisle_code, aisle_name) VALUES
('33333333-3333-3333-3333-000000000001', '22222222-2222-2222-2222-000000000001', 'GRC-A1', 'Tinned Goods'),
('33333333-3333-3333-3333-000000000002', '22222222-2222-2222-2222-000000000001', 'GRC-A2', 'Cereals'),
('33333333-3333-3333-3333-000000000003', '22222222-2222-2222-2222-000000000002', 'BWG-A1', 'Cold Drinks'),
('33333333-3333-3333-3333-000000000004', '22222222-2222-2222-2222-000000000003', 'FRZ-A1', 'Frozen Meals')
ON CONFLICT (id) DO NOTHING;

-- ── Bays ──────────────────────────────────────────────────────────────────────
INSERT INTO bays (id, aisle_id, bay_code, bay_name, barcode, active) VALUES
('44444444-4444-4444-4444-000000000001', '33333333-3333-3333-3333-000000000001', 'GRC-A1-B1', 'Tinned Bay 1', 'BAY-GRC-A1-B1', true),
('44444444-4444-4444-4444-000000000002', '33333333-3333-3333-3333-000000000001', 'GRC-A1-B2', 'Tinned Bay 2', 'BAY-GRC-A1-B2', true),
('44444444-4444-4444-4444-000000000003', '33333333-3333-3333-3333-000000000002', 'GRC-A2-B1', 'Cereal Bay 1', 'BAY-GRC-A2-B1', true),
('44444444-4444-4444-4444-000000000004', '33333333-3333-3333-3333-000000000003', 'BWG-A1-B1', 'Drinks Bay 1', 'BAY-BWG-A1-B1', true),
('44444444-4444-4444-4444-000000000005', '33333333-3333-3333-3333-000000000003', 'BWG-A1-B2', 'Drinks Bay 2', 'BAY-BWG-A1-B2', true),
('44444444-4444-4444-4444-000000000006', '33333333-3333-3333-3333-000000000004', 'FRZ-A1-B1', 'Frozen Bay 1', 'BAY-FRZ-A1-B1', true)
ON CONFLICT (id) DO NOTHING;

-- ── Counters ──────────────────────────────────────────────────────────────────
INSERT INTO counters (id, name, mobile_number) VALUES
('55555555-5555-5555-5555-000000000001', 'Tinashe Moyo',  '+263771100001'),
('55555555-5555-5555-5555-000000000002', 'Blessing Dube', '+263771100002'),
('55555555-5555-5555-5555-000000000003', 'Rudo Ncube',    '+263771100003')
ON CONFLICT (id) DO NOTHING;

-- ── Session ───────────────────────────────────────────────────────────────────
-- Type is now FLOOR (replaces FULL). Worksheet paired to the LS Floor worksheet.
INSERT INTO sessions (id, store_id, session_date, type, status, variance_tolerance_pct, worksheet_no, created_by) VALUES
(
    '66666666-6666-6666-6666-000000000001',
    '11111111-1111-1111-1111-000000000001',
    CURRENT_DATE,
    'FLOOR',
    'PENDING_REVIEW',
    2.0,
    'ST-FLOOR-001',
    (SELECT id FROM admin_users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (id) DO NOTHING;

-- ── Session counters ──────────────────────────────────────────────────────────
INSERT INTO session_counters (session_id, counter_id, active) VALUES
('66666666-6666-6666-6666-000000000001', '55555555-5555-5555-5555-000000000001', true),
('66666666-6666-6666-6666-000000000001', '55555555-5555-5555-5555-000000000002', true),
('66666666-6666-6666-6666-000000000001', '55555555-5555-5555-5555-000000000003', true);

-- ── Session items ─────────────────────────────────────────────────────────────
INSERT INTO session_items (session_id, item_no, description, barcode, uo_m) VALUES
('66666666-6666-6666-6666-000000000001', 'ITEM-001', 'Lucky Star Pilchards 400g',   '6001234100001', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-002', 'Koo Baked Beans 410g',        '6001234100002', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-003', 'Bull Brand Corned Meat 300g', '6001234100003', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-004', 'All Gold Tomato Paste 115g',  '6001234100004', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-005', 'Jungle Oats 1kg',             '6001234100005', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-006', 'Weet-Bix 450g',               '6001234100006', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-007', 'Coke 2L',                     '6001234100007', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-008', 'Sprite 2L',                   '6001234100008', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-009', 'Minute Maid Orange 2L',       '6001234100009', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-010', 'Energade 500ml',              '6001234100010', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-011', 'Ama Braai Chicken 1kg',       '6001234100011', 'EA'),
('66666666-6666-6666-6666-000000000001', 'ITEM-012', 'McCain Chips 1kg',            '6001234100012', 'EA');

-- ── Theoretical stock ─────────────────────────────────────────────────────────
INSERT INTO theoretical_stocks (session_id, item_no, theoretical_qty) VALUES
('66666666-6666-6666-6666-000000000001', 'ITEM-001', 48),
('66666666-6666-6666-6666-000000000001', 'ITEM-002', 60),
('66666666-6666-6666-6666-000000000001', 'ITEM-003', 36),
('66666666-6666-6666-6666-000000000001', 'ITEM-004', 72),
('66666666-6666-6666-6666-000000000001', 'ITEM-005', 24),
('66666666-6666-6666-6666-000000000001', 'ITEM-006', 30),
('66666666-6666-6666-6666-000000000001', 'ITEM-007', 96),
('66666666-6666-6666-6666-000000000001', 'ITEM-008', 84),
('66666666-6666-6666-6666-000000000001', 'ITEM-009', 48),
('66666666-6666-6666-6666-000000000001', 'ITEM-010', 120),
('66666666-6666-6666-6666-000000000001', 'ITEM-011', 18),
('66666666-6666-6666-6666-000000000001', 'ITEM-012', 40);

-- ── Count lines (round 0 — original counts) ───────────────────────────────────
-- Tinashe: GRC bays (items 001-006)
INSERT INTO count_lines (id, session_id, bay_id, item_no, counter_id, quantity, counted_at, round_no, client_uuid) VALUES
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000001', 'ITEM-001', '55555555-5555-5555-5555-000000000001', 45, NOW() - INTERVAL '4 hours',            0, gen_random_uuid()),
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000001', 'ITEM-002', '55555555-5555-5555-5555-000000000001', 60, NOW() - INTERVAL '4 hours',            0, gen_random_uuid()),
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000002', 'ITEM-003', '55555555-5555-5555-5555-000000000001', 38, NOW() - INTERVAL '3 hours 45 minutes', 0, gen_random_uuid()),
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000002', 'ITEM-004', '55555555-5555-5555-5555-000000000001', 68, NOW() - INTERVAL '3 hours 45 minutes', 0, gen_random_uuid()),
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000003', 'ITEM-005', '55555555-5555-5555-5555-000000000001', 22, NOW() - INTERVAL '3 hours 30 minutes', 0, gen_random_uuid()),
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000003', 'ITEM-006', '55555555-5555-5555-5555-000000000001', 31, NOW() - INTERVAL '3 hours 30 minutes', 0, gen_random_uuid());

-- Blessing: BWG bays (items 007-010)
INSERT INTO count_lines (id, session_id, bay_id, item_no, counter_id, quantity, counted_at, round_no, client_uuid) VALUES
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000004', 'ITEM-007', '55555555-5555-5555-5555-000000000002', 80,  NOW() - INTERVAL '3 hours',            0, gen_random_uuid()),
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000004', 'ITEM-008', '55555555-5555-5555-5555-000000000002', 84,  NOW() - INTERVAL '3 hours',            0, gen_random_uuid()),
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000005', 'ITEM-009', '55555555-5555-5555-5555-000000000002', 50,  NOW() - INTERVAL '2 hours 45 minutes', 0, gen_random_uuid()),
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000005', 'ITEM-010', '55555555-5555-5555-5555-000000000002', 115, NOW() - INTERVAL '2 hours 45 minutes', 0, gen_random_uuid());

-- Rudo: FRZ bay (items 011-012)
INSERT INTO count_lines (id, session_id, bay_id, item_no, counter_id, quantity, counted_at, round_no, client_uuid) VALUES
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000006', 'ITEM-011', '55555555-5555-5555-5555-000000000003', 10, NOW() - INTERVAL '2 hours', 0, gen_random_uuid()),
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000006', 'ITEM-012', '55555555-5555-5555-5555-000000000003', 38, NOW() - INTERVAL '2 hours', 0, gen_random_uuid());

-- Rudo: recount for ITEM-011 (round 1)
INSERT INTO count_lines (id, session_id, bay_id, item_no, counter_id, quantity, counted_at, round_no, client_uuid) VALUES
(gen_random_uuid(), '66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000006', 'ITEM-011', '55555555-5555-5555-5555-000000000003', 10, NOW() - INTERVAL '1 hour', 1, gen_random_uuid());

-- ── Bin submissions ───────────────────────────────────────────────────────────
INSERT INTO bin_submissions (session_id, bay_id, counter_id, submitted_at) VALUES
('66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000001', '55555555-5555-5555-5555-000000000001', NOW() - INTERVAL '3 hours 50 minutes'),
('66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000002', '55555555-5555-5555-5555-000000000001', NOW() - INTERVAL '3 hours 40 minutes'),
('66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000003', '55555555-5555-5555-5555-000000000001', NOW() - INTERVAL '3 hours 25 minutes'),
('66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000004', '55555555-5555-5555-5555-000000000002', NOW() - INTERVAL '2 hours 55 minutes'),
('66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000005', '55555555-5555-5555-5555-000000000002', NOW() - INTERVAL '2 hours 40 minutes'),
('66666666-6666-6666-6666-000000000001', '44444444-4444-4444-4444-000000000006', '55555555-5555-5555-5555-000000000003', NOW() - INTERVAL '1 hour 55 minutes');

-- ── Variance flags ────────────────────────────────────────────────────────────
-- ITEM-001: variance of -3 (counted 45, theoretical 48) — PENDING recount
-- ITEM-007: variance of -16 (counted 80, theoretical 96) — PENDING recount
-- ITEM-011: variance of -8 (counted 10, theoretical 18) — ACCEPTED after recount
INSERT INTO variance_flags (session_id, item_no, flagged_by, status) VALUES
('66666666-6666-6666-6666-000000000001', 'ITEM-001', (SELECT id FROM admin_users WHERE username = 'admin' LIMIT 1), 'PENDING'),
('66666666-6666-6666-6666-000000000001', 'ITEM-007', (SELECT id FROM admin_users WHERE username = 'admin' LIMIT 1), 'PENDING'),
('66666666-6666-6666-6666-000000000001', 'ITEM-011', (SELECT id FROM admin_users WHERE username = 'admin' LIMIT 1), 'ACCEPTED');

-- ── Recount decision for ITEM-011 ────────────────────────────────────────────
INSERT INTO recount_decisions (flag_id, reviewed_by, decision, notes)
SELECT
    vf.id,
    (SELECT id FROM admin_users WHERE username = 'admin' LIMIT 1),
    'ACCEPTED',
    'Recount confirmed — 8 units located in back store, count of 10 on shelf is correct'
FROM variance_flags vf
WHERE vf.session_id = '66666666-6666-6666-6666-000000000001'
  AND vf.item_no = 'ITEM-011';

COMMIT;

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT 'stores'            AS tbl, COUNT(*) FROM stores            WHERE id = '11111111-1111-1111-1111-000000000001'
UNION ALL SELECT 'zones',           COUNT(*) FROM zones            WHERE store_id = '11111111-1111-1111-1111-000000000001'
UNION ALL SELECT 'aisles',          COUNT(*) FROM aisles           WHERE zone_id IN (SELECT id FROM zones WHERE store_id = '11111111-1111-1111-1111-000000000001')
UNION ALL SELECT 'bays',            COUNT(*) FROM bays             WHERE id LIKE '44444444%'
UNION ALL SELECT 'counters',        COUNT(*) FROM counters         WHERE id LIKE '55555555%'
UNION ALL SELECT 'sessions',        COUNT(*) FROM sessions         WHERE id = '66666666-6666-6666-6666-000000000001'
UNION ALL SELECT 'session_items',   COUNT(*) FROM session_items    WHERE session_id = '66666666-6666-6666-6666-000000000001'
UNION ALL SELECT 'theoretical_stocks', COUNT(*) FROM theoretical_stocks WHERE session_id = '66666666-6666-6666-6666-000000000001'
UNION ALL SELECT 'count_lines',     COUNT(*) FROM count_lines      WHERE session_id = '66666666-6666-6666-6666-000000000001'
UNION ALL SELECT 'bin_submissions', COUNT(*) FROM bin_submissions  WHERE session_id = '66666666-6666-6666-6666-000000000001'
UNION ALL SELECT 'variance_flags',  COUNT(*) FROM variance_flags   WHERE session_id = '66666666-6666-6666-6666-000000000001'
UNION ALL SELECT 'recount_decisions', COUNT(*) FROM recount_decisions;