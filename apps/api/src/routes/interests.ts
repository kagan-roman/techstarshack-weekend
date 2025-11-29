import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../middleware/auth";
import { enqueueAgentRun } from "../services/modules/agentRuns";
import { getLatestUserProfile } from "../services/modules/userProfiles";

const triggerSchema = z.object({
  dataSourceIds: z.array(z.string().uuid()).optional(),
});

export const registerInterestRoutes = async (app: FastifyInstance) => {
  app.post(
    "/interests/run",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = triggerSchema.parse(request.body ?? {});
      const run = await enqueueAgentRun({
        userId: request.user!.id,
        type: "interest_extraction",
        payload: {
          dataSourceIds: body.dataSourceIds ?? [],
        },
      });

      reply.code(202).send({ runId: run.id });
    },
  );

  app.get(
    "/interests/latest",
    { preHandler: requireUser },
    async (request, reply) => {
      const profile = await getLatestUserProfile(request.user!.id);
      
      if (!profile) {
        reply.code(404).send({ error: "No interest profile available" });
        return;
      }

      // Return just the interests array from the profile
      const interests = profile.profile_data?.interests ?? [];
      reply.send({ interests });
    },
  );
};
