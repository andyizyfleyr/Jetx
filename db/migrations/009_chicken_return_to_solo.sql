-- Settle every unfinished shared game at the gain already reached, without
-- exposing players to another obstacle. An unused free bet is restored.
-- Keep the old tables as historical records and block old deployments from
-- creating or changing shared games after the cutover.
SELECT id FROM demo_treasury WHERE id=1 FOR UPDATE;
DO $$
DECLARE item record; result bigint; new_balance bigint; factor numeric; op uuid;
BEGIN
 FOR item IN SELECT p.*, w.funded_stake FROM demo_chicken_round_players p
  JOIN demo_wagers w ON w.bet_id=p.bet_id
  WHERE p.status='playing' AND w.status='open' FOR UPDATE OF p,w
 LOOP
  factor := 1;
  IF item.step>0 THEN
   factor := 1;
   FOR i IN 1..item.step LOOP
    factor := factor * (1 - (0.12 + (i-1)*0.005));
   END LOOP;
   factor := round((0.96 / factor)::numeric, 2);
  END IF;
  result := floor(item.stake * factor)::bigint * 100;
  IF item.free AND item.step=0 THEN result := 0; END IF;
  UPDATE demo_shared_wallets SET balance=balance+result WHERE player_id=item.player_id RETURNING balance INTO new_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing player wallet'; END IF;
  UPDATE demo_wagers SET status=CASE WHEN item.step=0 THEN 'cancelled' ELSE 'settled' END, payout=result WHERE bet_id=item.bet_id;
  UPDATE demo_chicken_round_players SET status='won', payout=result WHERE bet_id=item.bet_id;
  op := gen_random_uuid();
  INSERT INTO demo_wallet_events(operation_id,player_id,game,bet_id,kind,amount,balance_after)
   VALUES(op,item.player_id,'pilot-chicken',item.bet_id,CASE WHEN item.step=0 THEN 'refund' ELSE 'payout' END,result,new_balance);
  IF item.free AND item.step=0 THEN
   UPDATE demo_chicken_state SET state=jsonb_set(state,'{freeAvailable}','true'::jsonb,true) WHERE player_id=item.player_id;
  END IF;
  IF item.step>0 THEN
   UPDATE demo_chicken_state SET state=jsonb_set(state,'{history}',
    (jsonb_build_array(jsonb_build_object('id',item.bet_id,'multiplier',factor,'bet',item.stake,'payout',result/100,'won',true,'free',item.free)) || COALESCE(state->'history','[]'::jsonb)),true)
    WHERE player_id=item.player_id;
  END IF;
 END LOOP;
END $$;
UPDATE demo_chicken_rounds SET phase='finished',outcome='cashout',finished_at=(extract(epoch FROM clock_timestamp())*1000)::bigint WHERE phase<>'finished';
CREATE FUNCTION demo_block_retired_chicken_rounds() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Shared Chicken rounds have been retired'; END $$;
CREATE TRIGGER demo_retired_chicken_rounds BEFORE INSERT OR UPDATE OR DELETE ON demo_chicken_rounds FOR EACH ROW EXECUTE FUNCTION demo_block_retired_chicken_rounds();
CREATE TRIGGER demo_retired_chicken_players BEFORE INSERT OR UPDATE OR DELETE ON demo_chicken_round_players FOR EACH ROW EXECUTE FUNCTION demo_block_retired_chicken_rounds();
