import { sql } from "../../lib/db";

const VOTES_TABLE = "hackathon.recommendation_votes";
const COUNTS_TABLE = "hackathon.recommendation_vote_counts";

export type VoteType = -1 | 1;

export type VoteCounts = {
  recommendationId: string;
  upvotes: number;
  downvotes: number;
  score: number;
};

/**
 * Cast or update a vote on a recommendation
 */
export async function castVote(
  userId: string,
  recommendationId: string,
  voteType: VoteType,
): Promise<VoteCounts> {
  // Get existing vote if any
  const [existingVote] = await sql.unsafe(
    `SELECT vote_type FROM ${VOTES_TABLE} 
     WHERE user_id = $1 AND recommendation_id = $2`,
    [userId, recommendationId],
  );

  const oldVote = existingVote?.vote_type ?? 0;

  // Upsert the vote
  await sql.unsafe(
    `INSERT INTO ${VOTES_TABLE} (user_id, recommendation_id, vote_type, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (recommendation_id, user_id) 
     DO UPDATE SET vote_type = $3, updated_at = now()`,
    [userId, recommendationId, voteType],
  );

  // Calculate delta for vote counts
  const upvoteDelta = (voteType === 1 ? 1 : 0) - (oldVote === 1 ? 1 : 0);
  const downvoteDelta = (voteType === -1 ? 1 : 0) - (oldVote === -1 ? 1 : 0);

  // Upsert vote counts
  await sql.unsafe(
    `INSERT INTO ${COUNTS_TABLE} (recommendation_id, upvotes, downvotes, score, updated_at)
     VALUES ($1, GREATEST(0, $2), GREATEST(0, $3), $2 - $3, now())
     ON CONFLICT (recommendation_id) 
     DO UPDATE SET 
       upvotes = GREATEST(0, ${COUNTS_TABLE}.upvotes + $2),
       downvotes = GREATEST(0, ${COUNTS_TABLE}.downvotes + $3),
       score = GREATEST(0, ${COUNTS_TABLE}.upvotes + $2) - GREATEST(0, ${COUNTS_TABLE}.downvotes + $3),
       updated_at = now()`,
    [recommendationId, upvoteDelta, downvoteDelta],
  );

  return getVoteCounts(recommendationId);
}

/**
 * Remove a vote (unvote)
 */
export async function removeVote(
  userId: string,
  recommendationId: string,
): Promise<VoteCounts> {
  // Get existing vote
  const [existingVote] = await sql.unsafe(
    `SELECT vote_type FROM ${VOTES_TABLE} 
     WHERE user_id = $1 AND recommendation_id = $2`,
    [userId, recommendationId],
  );

  if (!existingVote) {
    return getVoteCounts(recommendationId);
  }

  const oldVote = existingVote.vote_type;

  // Delete the vote
  await sql.unsafe(
    `DELETE FROM ${VOTES_TABLE} 
     WHERE user_id = $1 AND recommendation_id = $2`,
    [userId, recommendationId],
  );

  // Update counts
  const upvoteDelta = oldVote === 1 ? -1 : 0;
  const downvoteDelta = oldVote === -1 ? -1 : 0;

  await sql.unsafe(
    `UPDATE ${COUNTS_TABLE} 
     SET upvotes = GREATEST(0, upvotes + $2),
         downvotes = GREATEST(0, downvotes + $3),
         score = GREATEST(0, upvotes + $2) - GREATEST(0, downvotes + $3),
         updated_at = now()
     WHERE recommendation_id = $1`,
    [recommendationId, upvoteDelta, downvoteDelta],
  );

  return getVoteCounts(recommendationId);
}

/**
 * Get vote counts for a single recommendation
 */
export async function getVoteCounts(recommendationId: string): Promise<VoteCounts> {
  const [row] = await sql.unsafe(
    `SELECT recommendation_id, upvotes, downvotes, score 
     FROM ${COUNTS_TABLE} 
     WHERE recommendation_id = $1`,
    [recommendationId],
  );

  return {
    recommendationId,
    upvotes: row?.upvotes ?? 0,
    downvotes: row?.downvotes ?? 0,
    score: row?.score ?? 0,
  };
}

/**
 * Get vote counts for multiple recommendations
 */
export async function getVoteCountsBatch(recommendationIds: string[]): Promise<Map<string, VoteCounts>> {
  if (recommendationIds.length === 0) {
    return new Map();
  }

  const rows = await sql.unsafe(
    `SELECT recommendation_id, upvotes, downvotes, score 
     FROM ${COUNTS_TABLE} 
     WHERE recommendation_id = ANY($1)`,
    [recommendationIds],
  );

  const result = new Map<string, VoteCounts>();
  
  // Initialize all with zeros
  for (const id of recommendationIds) {
    result.set(id, { recommendationId: id, upvotes: 0, downvotes: 0, score: 0 });
  }
  
  // Fill in actual counts
  for (const row of rows) {
    result.set(row.recommendation_id, {
      recommendationId: row.recommendation_id,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      score: row.score,
    });
  }

  return result;
}

/**
 * Get user's votes for multiple recommendations
 */
export async function getUserVotesBatch(
  userId: string,
  recommendationIds: string[],
): Promise<Map<string, VoteType>> {
  if (recommendationIds.length === 0) {
    return new Map();
  }

  const rows = await sql.unsafe(
    `SELECT recommendation_id, vote_type 
     FROM ${VOTES_TABLE} 
     WHERE user_id = $1 AND recommendation_id = ANY($2)`,
    [userId, recommendationIds],
  );

  const result = new Map<string, VoteType>();
  for (const row of rows) {
    result.set(row.recommendation_id, row.vote_type as VoteType);
  }

  return result;
}
