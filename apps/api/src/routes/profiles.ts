import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../middleware/auth";
import { getLatestUserProfile, getUserProfileHistory, saveUserProfile } from "../services/modules/userProfiles";

const saveProfileSchema = z.object({
  agentRunId: z.string().uuid().optional(),
  profileData: z.record(z.unknown()),
});

export const registerProfileRoutes = async (app: FastifyInstance) => {
  // Save a new profile version
  app.post(
    "/profiles",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = saveProfileSchema.parse(request.body ?? {});

      const profile = await saveUserProfile({
        userId: request.user!.id,
        agentRunId: body.agentRunId,
        profileData: body.profileData,
      });

      reply.code(201).send(profile);
    },
  );

  // Get latest profile
  app.get(
    "/profiles/latest",
    { preHandler: requireUser },
    async (request, reply) => {
      const profile = await getLatestUserProfile(request.user!.id);

      if (!profile) {
        reply.code(404).send({ error: "No profile found" });
        return;
      }

      return profile;
    },
  );

  // Get profile history
  app.get(
    "/profiles/history",
    { preHandler: requireUser },
    async (request) => {
      const profiles = await getUserProfileHistory(request.user!.id);
      return { items: profiles };
    },
  );
};

