import { FastifyInstance } from "fastify";
import { requireUser } from "../middleware/auth";
import { getTrip, addParticipant, isUserParticipant } from "../services/modules/trips";
import { getUserById } from "../services/modules/users";

export const registerInviteRoutes = async (app: FastifyInstance) => {
  /**
   * Get public trip info for invite page (no auth required)
   */
  app.get(
    "/invite/:tripId",
    async (request, reply) => {
      const { tripId } = request.params as { tripId: string };

      const trip = await getTrip(tripId);
      if (!trip) {
        reply.code(404).send({ error: "Trip not found" });
        return;
      }

      // Get owner info
      const owner = await getUserById(trip.ownerId);

      return {
        tripId: trip.id,
        destination: trip.destination,
        country: trip.country,
        startDate: trip.startDate,
        endDate: trip.endDate,
        owner: owner ? {
          name: owner.name,
          picture: owner.picture,
        } : null,
      };
    },
  );

  /**
   * Join a trip (requires auth)
   */
  app.post(
    "/invite/:tripId/join",
    { preHandler: requireUser },
    async (request, reply) => {
      const { tripId } = request.params as { tripId: string };
      const userId = request.user!.id;

      const trip = await getTrip(tripId);
      if (!trip) {
        reply.code(404).send({ error: "Trip not found" });
        return;
      }

      // Check if already a participant
      const alreadyJoined = await isUserParticipant(tripId, userId);
      if (alreadyJoined) {
        return {
          success: true,
          alreadyMember: true,
          tripId: trip.id,
          destination: trip.destination,
        };
      }

      // Add as participant
      await addParticipant(tripId, userId, "participant");

      request.log.info({ tripId, userId }, "User joined trip");

      return {
        success: true,
        alreadyMember: false,
        tripId: trip.id,
        destination: trip.destination,
      };
    },
  );
};

