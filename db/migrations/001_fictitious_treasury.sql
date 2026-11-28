-- Prototype for fictitious funds only. Apply explicitly to a dedicated database.
-- All amounts are integer hundredths of F; 100000 F = 10000000 units.
BEGIN;
CREATE TABLE IF NOT EXISTS demo_treasury (
  id smallint PRIMARY KEY CHECK (id = 1),
  equity bigint NOT NULL CHECK (equity >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO demo_treasury (id, equity) VALUES (1, 10000000) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS demo_risk_reservations (
  bet_id uuid PRIMARY KEY,
  player_id uuid NOT NULL,
  game text NOT NULL CHECK (game IN ('skyjet', 'pilot-chicken')),
  risk bigint NOT NULL CHECK (risk >= 0),
  status text NOT NULL CHECK (status IN ('open', 'settled', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demo_risk_open_player ON demo_risk_reservations(player_id) WHERE status = 'open';
CREATE TABLE IF NOT EXISTS demo_treasury_events (
  operation_id uuid PRIMARY KEY,
  bet_id uuid NOT NULL REFERENCES demo_risk_reservations(bet_id),
  kind text NOT NULL CHECK (kind IN ('reserve', 'settle', 'cancel')),
  -- Positive values are losses for the house; negative values are profits.
  house_loss bigint NOT NULL DEFAULT 0,
  risk_after bigint NOT NULL CHECK (risk_after >= 0),
  equity_after bigint NOT NULL CHECK (equity_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demo_treasury_events_hour ON demo_treasury_events(created_at) WHERE kind = 'settle';
COMMIT;
