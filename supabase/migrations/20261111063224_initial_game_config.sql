-- Production-safe runtime defaults. Fictional influencers and demo accounts stay in local seed/setup.
insert into public.game_config(key,value) values
  ('grade_rates','{"common":70,"rare":20,"epic":7.5,"special":2.5}'::jsonb),
  ('upgrade_cost','10'::jsonb),
  ('room_entry','{"min_earned_draws":5}'::jsonb),
  ('priority_weights','{"own":0.6,"quality":0.4}'::jsonb),
  ('gauge','{"start":50,"monthly_min_rounds":3,"per_round_delta":12.5,"max":100}'::jsonb)
on conflict(key) do nothing;
