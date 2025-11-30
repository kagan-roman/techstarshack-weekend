import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../middleware/auth";
import { createAgentRun, updateAgentRunStatus, getAgentRun } from "../services/modules/agentRuns";
import { listEvents } from "../services/modules/events";
import { notifyRunUpdate, sendProgressSteps } from "../lib/runNotifier";
import { createTrip } from "../services/modules/trips";
import {
  saveRecommendations,
  getTripRecommendations,
  toClientFormat,
  type RawRecommendation,
} from "../services/modules/recommendations";

// Load mock recommendations from generated data
import MOCK_RECOMMENDATIONS from "../data/mock-recommendations.json";

// Fake progress steps for recommendations (based on interests from mock data)
const RECOMMENDATION_STEPS = [
  { step: "profile", message: "📋 Loading your profile..." },
  { step: "nightlife", message: "🎵 Searching nightlife & techno events..." },
  { step: "architecture", message: "🏛️ Finding architectural gems..." },
  { step: "nature", message: "🌿 Discovering nature spots..." },
  { step: "food", message: "🍽️ Curating local food experiences..." },
  { step: "compile", message: "✨ Compiling your recommendations..." },
];

const runRecommendationsSchema = z.object({
  location: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const registerRecommendationRoutes = async (app: FastifyInstance) => {
  app.post(
    "/recommendations/run",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = runRecommendationsSchema.parse(request.body ?? {});
      const userId = request.user!.id;

      request.log.info({ userId, payload: body }, "Creating recommendation run");

      // Create the run record
      const run = await createAgentRun({
        userId,
        type: "weekend_scouter",
        payload: body,
      });

      request.log.info({ runId: run.id, status: run.status }, "Agent run created");

      // Notify WebSocket subscribers about queued state
      notifyRunUpdate(run.id, "queued");

      // Start processing in background
      setImmediate(async () => {
        try {
          request.log.info({ runId: run.id }, "Starting recommendations agent");

          await updateAgentRunStatus(run.id, "running");
          notifyRunUpdate(run.id, "running");

          request.log.info({ runId: run.id, location: body.location }, "Generating recommendations");

          // Send fake progress updates (12 seconds total, 2 sec per step)
          await sendProgressSteps(run.id, RECOMMENDATION_STEPS, 2000);

          try {
            // 1. Create a trip for this recommendation run
            const trip = await createTrip({
              ownerId: userId,
              destination: body.location,
              startDate: body.startDate,
              endDate: body.endDate,
              notes: `Generated via Weekend Scout on ${new Date().toISOString()}`,
            });

            request.log.info({ tripId: trip.id }, "Trip created for recommendations");

            // 2. Save recommendations to DB (emulating LLM output)
            const rawRecs = MOCK_RECOMMENDATIONS as RawRecommendation[];
            await saveRecommendations(trip.id, rawRecs, userId);

            request.log.info(
              { tripId: trip.id, count: rawRecs.length },
              "Recommendations saved to DB",
            );

            // 3. Read back from DB to return to client
            const storedRecs = await getTripRecommendations(trip.id);
            const clientRecs = storedRecs.map(toClientFormat);

            const result = {
              tripId: trip.id,
              destination: body.location,
              dates: {
                start: body.startDate,
                end: body.endDate,
              },
              recommendations: clientRecs,
              generatedAt: new Date().toISOString(),
            };

            await updateAgentRunStatus(run.id, "succeeded", result);
            notifyRunUpdate(run.id, "succeeded", result);

            request.log.info(
              { runId: run.id, tripId: trip.id, count: clientRecs.length },
              "Recommendations generated and stored",
            );
          } catch (err) {
            request.log.error({ runId: run.id, err }, "Failed to save recommendations");
            const errorMsg = String(err);
            await updateAgentRunStatus(run.id, "failed", undefined, errorMsg);
            notifyRunUpdate(run.id, "failed", null, errorMsg);
          }

        } catch (err) {
          const errorMsg = String(err);
          request.log.error({ runId: run.id, err }, "Recommendations failed");
          await updateAgentRunStatus(run.id, "failed", undefined, errorMsg);
          notifyRunUpdate(run.id, "failed", null, errorMsg);
        }
      });

      reply.code(202).send({ runId: run.id });
    },
  );

  // Get run status
  app.get(
    "/recommendations/run/:runId",
    { preHandler: requireUser },
    async (request, reply) => {
      const { runId } = request.params as { runId: string };

      const run = await getAgentRun(runId);

      if (!run) {
        reply.code(404).send({ error: "Run not found" });
        return;
      }

      // Check ownership
      if (run.user_id !== request.user!.id) {
        reply.code(403).send({ error: "Access denied" });
        return;
      }

      return {
        id: run.id,
        status: run.status,
        type: run.type,
        payload: run.payload,
        result: run.result,
        error: run.error,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      };
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
