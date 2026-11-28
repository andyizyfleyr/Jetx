-- Keep historical tables and their lock row for safe rolling deployments, but
-- new wagers no longer require a house-risk reservation. Existing open SkyJet
-- wagers keep their original cash-out terms until they finish.
ALTER TABLE demo_wagers DROP CONSTRAINT IF EXISTS demo_wagers_bet_id_fkey;
