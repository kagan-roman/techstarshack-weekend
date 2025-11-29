-- Add ON DELETE CASCADE to all foreign keys referencing users
-- This allows deleting a user and automatically removing all related records

SET search_path TO hackathon;

-- Drop existing constraints and recreate with CASCADE

-- agent_runs
ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_user_id_fkey;
ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- data_sources
ALTER TABLE data_sources DROP CONSTRAINT IF EXISTS data_sources_user_id_fkey;
ALTER TABLE data_sources ADD CONSTRAINT data_sources_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- user_profiles
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_agent_run_id_fkey;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_agent_run_id_fkey 
  FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL;

-- events
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_user_id_fkey;
ALTER TABLE events ADD CONSTRAINT events_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

