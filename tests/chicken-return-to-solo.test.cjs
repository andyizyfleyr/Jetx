/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
test('cutover preserves earned balances, restores unused free bets and stops old shared engine',async()=>{
 const db=new PGlite();try{
  for(const m of ['001_fictitious_treasury.sql','002_fictitious_wallet.sql','003_fictitious_chicken.sql','004_fictitious_skyjet.sql','005_shared_wallet.sql','006_accounts.sql','007_remove_house_bank.sql','008_chicken_shared_rounds.sql'])await db.exec(fs.readFileSync(path.join(root,'db/migrations',m),'utf8'));
  const round=randomUUID();await db.query("INSERT INTO demo_chicken_rounds(id,seed,commitment,phase,step,deadline,created_at) VALUES($1,'seed','hash','decision',2,1,1)",[round]);
  const cases=[{step:0,free:false,balance:2950000,credit:50000},{step:1,free:false,balance:2950000,credit:54500},{step:0,free:true,balance:3000000,credit:0},{step:1,free:true,balance:3000000,credit:54500}];
  for(const c of cases){c.player=randomUUID();c.bet=randomUUID();await db.query("INSERT INTO demo_wallets(player_id,game,balance) VALUES($1,'pilot-chicken',0)",[c.player]);await db.query('INSERT INTO demo_shared_wallets(player_id,balance) VALUES($1,$2)',[c.player,c.balance]);await db.query("INSERT INTO demo_wagers(bet_id,player_id,game,stake,funded_stake,status) VALUES($1,$2,'pilot-chicken',50000,$3,'open')",[c.bet,c.player,c.free?0:50000]);await db.query("INSERT INTO demo_chicken_state(player_id,state) VALUES($1,$2::jsonb)",[c.player,JSON.stringify({phase:'idle',freeAvailable:!c.free,history:[]})]);await db.query("INSERT INTO demo_chicken_round_players(round_id,player_id,bet_id,stake,free,status,step) VALUES($1,$2,$3,500,$4,'playing',$5)",[round,c.player,c.bet,c.free,c.step]);}
  await db.exec(fs.readFileSync(path.join(root,'db/migrations/009_chicken_return_to_solo.sql'),'utf8'));
  for(const c of cases){const wallet=await db.query('SELECT balance FROM demo_shared_wallets WHERE player_id=$1',[c.player]);assert.equal(Number(wallet.rows[0].balance),c.balance+c.credit);const wager=await db.query('SELECT status,payout FROM demo_wagers WHERE bet_id=$1',[c.bet]);assert.equal(wager.rows[0].status,c.step?'settled':'cancelled');assert.equal(Number(wager.rows[0].payout),c.credit);const state=(await db.query('SELECT state FROM demo_chicken_state WHERE player_id=$1',[c.player])).rows[0].state;if(c.free&&c.step===0)assert.equal(state.freeAvailable,true);if(c.step)assert.equal(state.history[0].payout,545);}
  assert.equal((await db.query('SELECT phase FROM demo_chicken_rounds WHERE id=$1',[round])).rows[0].phase,'finished');
  await assert.rejects(db.query("UPDATE demo_chicken_rounds SET phase='decision' WHERE id=$1",[round]),/retired/);
  await assert.rejects(db.query("UPDATE demo_chicken_round_players SET status='playing' WHERE round_id=$1",[round]),/retired/);
 }finally{await db.close();}
});
