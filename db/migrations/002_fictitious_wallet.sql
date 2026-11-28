-- Fictitious accounts only. Apply after 001 on a dedicated database.
BEGIN;
CREATE TABLE IF NOT EXISTS demo_wallets (
  player_id uuid NOT NULL,
  game text NOT NULL CHECK (game IN ('skyjet', 'pilot-chicken')),
  balance bigint NOT NULL CHECK (balance >= 0),
  PRIMARY KEY (player_id, game)
);
CREATE TABLE IF NOT EXISTS demo_wagers (
  bet_id uuid PRIMARY KEY REFERENCES demo_risk_reservations(bet_id),
  player_id uuid NOT NULL,
  game text NOT NULL,
  stake bigint NOT NULL CHECK (stake > 0),
  funded_stake bigint NOT NULL CHECK (funded_stake >= 0 AND funded_stake <= stake),
  status text NOT NULL CHECK (status IN ('open', 'settled', 'cancelled')),
  payout bigint CHECK (payout >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (player_id, game) REFERENCES demo_wallets(player_id, game)
);
CREATE TABLE IF NOT EXISTS demo_wallet_events (
  operation_id uuid PRIMARY KEY,
  player_id uuid NOT NULL,
  game text NOT NULL,
  bet_id uuid,
  kind text NOT NULL CHECK (kind IN ('initial', 'stake', 'payout', 'refund')),
  amount bigint NOT NULL,
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (player_id, game) REFERENCES demo_wallets(player_id, game)
);
COMMIT;
