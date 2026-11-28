BEGIN;
ALTER TABLE demo_sessions DROP CONSTRAINT IF EXISTS demo_sessions_player_id_key;
CREATE INDEX IF NOT EXISTS demo_sessions_player_idx ON demo_sessions(player_id);
CREATE TABLE demo_accounts (
 player_id uuid PRIMARY KEY,
 username text NOT NULL UNIQUE,
 password_salt text NOT NULL,
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE demo_login_limits (
 key text PRIMARY KEY,
 failures integer NOT NULL DEFAULT 0,
 locked_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
