-- +goose Up
-- Default admin: username=admin, password=admin123
-- Change this password immediately after first login
INSERT INTO admin_users (username, password_hash, full_name)
VALUES (
    'admin',
    '$2a$10$YmQtVT.4QqAM6P.HTAzxhOhMf2P5lcUE.jTbpKAPGlnhxQQH4LFDS',
    'System Administrator'
)
ON CONFLICT (username) DO NOTHING;

-- +goose Down
DELETE FROM admin_users WHERE username = 'admin';
