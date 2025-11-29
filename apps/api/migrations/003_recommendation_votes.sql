-- Recommendation votes table (Reddit-style upvote/downvote)
SET search_path TO hackathon;

CREATE TABLE IF NOT EXISTS recommendation_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id TEXT NOT NULL,  -- The ID from recommendations JSON (e.g., "event-pakapikumatk-pirita-2025-12-06-1100")
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type SMALLINT NOT NULL CHECK (vote_type IN (-1, 1)),  -- -1 = downvote, 1 = upvote
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recommendation_id, user_id)  -- One vote per user per recommendation
);

-- Aggregated vote counts (for fast reads)
CREATE TABLE IF NOT EXISTS recommendation_vote_counts (
  recommendation_id TEXT PRIMARY KEY,
  upvotes INT NOT NULL DEFAULT 0,
  downvotes INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,  -- upvotes - downvotes
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recommendation_votes_rec_id ON recommendation_votes(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_votes_user_id ON recommendation_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_vote_counts_score ON recommendation_vote_counts(score DESC);

