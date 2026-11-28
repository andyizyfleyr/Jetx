-- Merge existing fictitious balances without discarding either game's funds.
-- Serialize with game transactions; old code must not mutate the retired balances.
BEGIN;
SELECT id FROM demo_treasury WHERE id = 1 FOR UPDATE;
CREATE TABLE demo_shared_wallets (
  player_id uuid PRIMARY KEY,
  balance bigint NOT NULL CHECK (balance >= 0)
);
INSERT INTO demo_shared_wallets (player_id, balance)
SELECT player_id, SUM(balance)::bigint FROM demo_wallets GROUP BY player_id;
CREATE FUNCTION demo_block_legacy_wallet_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Legacy per-game wallets are retired';
END;
$$;
CREATE TRIGGER demo_no_legacy_wallet_update BEFORE UPDATE OR DELETE ON demo_wallets
FOR EACH ROW EXECUTE FUNCTION demo_block_legacy_wallet_update();
COMMIT;
