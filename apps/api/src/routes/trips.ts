import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../middleware/auth";
import {
  createTrip,
  getTrip,
  getUserTrips,
  isUserParticipant,
  getTripParticipants,
} from "../services/modules/trips";
import {
  getTripRecommendations,
  toClientFormat,
} from "../services/modules/recommendations";

const createTripSchema = z.object({
  destination: z.string().min(1),
  country: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

export const registerTripRoutes = async (app: FastifyInstance) => {
  /**
   * Create a new trip
   */
  app.post(
    "/trips",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = createTripSchema.parse(request.body);
      const userId = request.user!.id;

      request.log.info({ userId, destination: body.destination }, "Creating trip");

      const trip = await createTrip({
        ownerId: userId,
        ...body,
      });

      return trip;
    },
  );

  /**
   * Get all trips for current user
   */
  app.get(
    "/trips",
    { preHandler: requireUser },
    async (request) => {
      const userId = request.user!.id;
      const trips = await getUserTrips(userId);
      return { trips };
    },
  );

  /**
   * Get a specific trip with recommendations
   */
  app.get(
    "/trips/:tripId",
    { preHandler: requireUser },
    async (request, reply) => {
      const { tripId } = request.params as { tripId: string };
      const userId = request.user!.id;

      // Check access
      const isParticipant = await isUserParticipant(tripId, userId);
      if (!isParticipant) {
        reply.code(403).send({ error: "Access denied" });
        return;
      }

      const trip = await getTrip(tripId);
      if (!trip) {
        reply.code(404).send({ error: "Trip not found" });
        return;
      }

      const participants = await getTripParticipants(tripId);
      const recommendations = await getTripRecommendations(tripId);

      return {
        ...trip,
        participants,
        recommendations: recommendations.map(toClientFormat),
      };
    },
  );

  /**
   * Get recommendations for a trip
   */
  app.get(
    "/trips/:tripId/recommendations",
    { preHandler: requireUser },
    async (request, reply) => {
      const { tripId } = request.params as { tripId: string };
      const userId = request.user!.id;

      // Check access
      const isParticipant = await isUserParticipant(tripId, userId);
      if (!isParticipant) {
        reply.code(403).send({ error: "Access denied" });
        return;
      }

      const recommendations = await getTripRecommendations(tripId);
      return { recommendations: recommendations.map(toClientFormat) };
    },
  );
};

