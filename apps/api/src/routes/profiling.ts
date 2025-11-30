import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../middleware/auth";
import { createAgentRun, updateAgentRunStatus, getAgentRun } from "../services/modules/agentRuns";
import { saveUserProfile, getLatestUserProfile } from "../services/modules/userProfiles";
import { notifyRunUpdate, sendProgressSteps } from "../lib/runNotifier";
import { runProfiler } from "../services/profilerRunner";

// Fake progress steps for profiling
const PROFILING_STEPS = [
  { step: "spotify", message: "🎵 Analyzing music preferences..." },
  { step: "youtube", message: "📺 Scanning YouTube history..." },
  { step: "instagram", message: "📸 Processing Instagram activity..." },
  { step: "interests", message: "🧠 Building interest graph..." },
  { step: "finalize", message: "✨ Finalizing your profile..." },
];

// Skip zod validation for profileData - it's a complex nested object
// We trust the frontend to send valid data

export const registerProfilingRoutes = async (app: FastifyInstance) => {
  // Start profiling run
  app.post(
    "/profiling/run",
    { preHandler: requireUser },
    async (request, reply) => {
      const userId = request.user!.id;

      request.log.info({ userId }, "Creating profiling run");

      // Create the run record
      const run = await createAgentRun({
        userId,
        type: "interest_extraction",
        payload: {},
      });

      request.log.info({ runId: run.id, status: run.status }, "Profiling run created");
      notifyRunUpdate(run.id, "queued");

      // Start processing in background
      setImmediate(async () => {
        try {
          request.log.info({ runId: run.id }, "Starting profiler agent");
          await updateAgentRunStatus(run.id, "running");
          notifyRunUpdate(run.id, "running");

          // Send fake progress updates (10 seconds total, 2 sec per step)
          await sendProgressSteps(run.id, PROFILING_STEPS, 2000);

          // Run the actual profiler
          const result = await runProfiler(userId);

          request.log.info({ runId: run.id, workspacePath: result.workspacePath }, "Profiler completed");

          // Save profile to database
          if (result.profile) {
            await saveUserProfile({
              userId,
              agentRunId: run.id,
              profileData: result.profile,
            });
            request.log.info({ runId: run.id }, "Profile saved to database");
          }

          await updateAgentRunStatus(run.id, "succeeded", {
            workspacePath: result.workspacePath,
            hasProfile: Boolean(result.profile),
            personaSummary: result.personaSummary,
          });
          notifyRunUpdate(run.id, "succeeded", {
            profile: result.profile,
            personaSummary: result.personaSummary,
          });

        } catch (err) {
          const errorMsg = String(err);
          request.log.error({ runId: run.id, err }, "Profiler failed");
          await updateAgentRunStatus(run.id, "failed", undefined, errorMsg);
          notifyRunUpdate(run.id, "failed", null, errorMsg);
        }
      });

      reply.code(202).send({ runId: run.id });
    },
  );

  // Get profiling run status
  app.get(
    "/profiling/run/:runId",
    { preHandler: requireUser },
    async (request, reply) => {
      const { runId } = request.params as { runId: string };

      const run = await getAgentRun(runId);

      if (!run) {
        reply.code(404).send({ error: "Run not found" });
        return;
      }

      if (run.user_id !== request.user!.id) {
        reply.code(403).send({ error: "Access denied" });
        return;
      }

      return {
        id: run.id,
        status: run.status,
        type: run.type,
        result: run.result,
        error: run.error,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      };
    },
  );

  // Get latest profile
  app.get(
    "/profiling/profile",
    { preHandler: requireUser },
    async (request, reply) => {
      const profile = await getLatestUserProfile(request.user!.id);

      if (!profile) {
        reply.code(404).send({ error: "No profile found. Run profiling first." });
        return;
      }

      return {
        id: profile.id,
        version: profile.version,
        profileData: profile.profile_data,
        createdAt: profile.created_at,
      };
    },
  );

  // Update/edit profile
  app.put(
    "/profiling/profile",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = request.body as { profileData?: Record<string, unknown> };
      
      if (!body?.profileData) {
        reply.code(400).send({ error: "profileData is required" });
        return;
      }
      
      const userId = request.user!.id;

      // Save as new version
      const profile = await saveUserProfile({
        userId,
        profileData: body.profileData,
      });

      request.log.info({ userId, version: profile.version }, "Profile updated");

      return {
        id: profile.id,
        version: profile.version,
        profileData: profile.profile_data,
        createdAt: profile.created_at,
      };
    },
  );
};

