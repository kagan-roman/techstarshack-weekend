import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../middleware/auth";
import {
  castVote,
  removeVote,
  getVoteCountsBatch,
  getUserVotesBatch,
  type VoteType,
} from "../services/modules/votes";

const voteSchema = z.object({
  recommendationId: z.string(),
  voteType: z.union([z.literal(-1), z.literal(1)]),
});

const batchVotesSchema = z.object({
  recommendationIds: z.array(z.string()),
});

export const registerVoteRoutes = async (app: FastifyInstance) => {
  /**
   * Cast a vote (upvote or downvote)
   */
  app.post(
    "/votes",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = voteSchema.parse(request.body);
      const userId = request.user!.id;

      request.log.info(
        { userId, recommendationId: body.recommendationId, voteType: body.voteType },
        "Casting vote",
      );

      const result = await castVote(userId, body.recommendationId, body.voteType as VoteType);

      return {
        success: true,
        ...result,
        userVote: body.voteType,
      };
    },
  );

  /**
   * Remove a vote (unvote)
   */
  app.delete(
    "/votes/:recommendationId",
    { preHandler: requireUser },
    async (request, reply) => {
      const { recommendationId } = request.params as { recommendationId: string };
      const userId = request.user!.id;

      request.log.info({ userId, recommendationId }, "Removing vote");

      const result = await removeVote(userId, recommendationId);

      return {
        success: true,
        ...result,
        userVote: null,
      };
    },
  );

  /**
   * Get vote counts and user's votes for multiple recommendations
   */
  app.post(
    "/votes/batch",
    { preHandler: requireUser },
    async (request) => {
      const body = batchVotesSchema.parse(request.body);
      const userId = request.user!.id;

      const [voteCounts, userVotes] = await Promise.all([
        getVoteCountsBatch(body.recommendationIds),
        getUserVotesBatch(userId, body.recommendationIds),
      ]);

      // Combine into response
      const votes: Record<string, { score: number; upvotes: number; downvotes: number; userVote: number | null }> = {};
      
      for (const id of body.recommendationIds) {
        const counts = voteCounts.get(id) ?? { upvotes: 0, downvotes: 0, score: 0 };
        const userVote = userVotes.get(id) ?? null;
        
        votes[id] = {
          score: counts.score,
          upvotes: counts.upvotes,
          downvotes: counts.downvotes,
          userVote,
        };
      }

      return { votes };
    },
  );
};

