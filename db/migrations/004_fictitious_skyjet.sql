BEGIN;
CREATE TABLE IF NOT EXISTS demo_skyjet_bets (
 bet_id uuid PRIMARY KEY REFERENCES demo_wagers(bet_id),
 player_id uuid NOT NULL,
 slot smallint NOT NULL CHECK (slot IN (0,1)),
 round_id bigint NOT NULL,
 flight_start double precision NOT NULL,
 crash_at double precision NOT NULL,
 crash double precision NOT NULL,
 cap_payout bigint NOT NULL CHECK (cap_payout >= 0),
 auto_target double precision,
 status text NOT NULL CHECK (status IN ('open','settled','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS demo_skyjet_open_slot ON demo_skyjet_bets(player_id,slot) WHERE status='open';
CREATE TABLE IF NOT EXISTS demo_skyjet_actions (player_id uuid NOT NULL, action_id uuid NOT NULL, request jsonb NOT NULL, response jsonb NOT NULL, PRIMARY KEY(player_id,action_id));
COMMIT;
