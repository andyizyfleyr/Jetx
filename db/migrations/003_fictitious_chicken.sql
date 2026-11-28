BEGIN;
CREATE TABLE IF NOT EXISTS demo_sessions (token_hash text PRIMARY KEY, player_id uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS demo_chicken_state (player_id uuid PRIMARY KEY, state jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS demo_chicken_actions (player_id uuid NOT NULL, action_id uuid NOT NULL, request jsonb NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(player_id,action_id));
COMMIT;
