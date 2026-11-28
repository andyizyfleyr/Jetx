-- Shared rounds: seeds are secret until the round closes.
CREATE TABLE demo_chicken_rounds (
 id uuid PRIMARY KEY,
 seed text NOT NULL,
 commitment text NOT NULL,
 phase text NOT NULL CHECK (phase IN ('betting','decision','finished')),
 step smallint NOT NULL DEFAULT 0 CHECK (step BETWEEN 0 AND 24),
 deadline bigint NOT NULL,
 created_at bigint NOT NULL,
 finished_at bigint,
 outcome text CHECK (outcome IN ('collision','complete','cashout','empty'))
);
CREATE UNIQUE INDEX demo_chicken_one_round ON demo_chicken_rounds ((true)) WHERE phase <> 'finished';
CREATE TABLE demo_chicken_round_players (
 round_id uuid NOT NULL REFERENCES demo_chicken_rounds(id),
 player_id uuid NOT NULL,
 bet_id uuid NOT NULL UNIQUE REFERENCES demo_wagers(bet_id),
 stake integer NOT NULL,
 free boolean NOT NULL,
 status text NOT NULL CHECK (status IN ('playing','won','lost')),
 step smallint NOT NULL DEFAULT 0,
 chosen_step smallint,
 payout bigint,
 PRIMARY KEY (round_id, player_id)
);
CREATE INDEX demo_chicken_round_player_lookup ON demo_chicken_round_players(player_id,round_id);
