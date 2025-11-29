import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../middleware/auth";
import { enqueueAgentRun } from "../services/modules/agentRuns";
import { listEvents } from "../services/modules/events";

const runRecommendationsSchema = z.object({
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const registerRecommendationRoutes = async (app: FastifyInstance) => {
  app.post(
    "/recommendations/run",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = runRecommendationsSchema.parse(request.body ?? {});
      const run = await enqueueAgentRun({
        userId: request.user!.id,
        type: "weekend_scouter",
        payload: body,
      });

      reply.code(202).send({ runId: run.id });
    },
  );

  app.get(
    "/recommendations",
    { preHandler: requireUser },
    async (request) => {
      const items = await listEvents(request.user!.id);
      return { items };
    },
  );
};

