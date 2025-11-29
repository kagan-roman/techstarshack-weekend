import { FastifyInstance } from "fastify";
import { requireUser } from "../middleware/auth";
import {
  createCalendar,
  createEvent,
  listCalendars,
  type CalendarEvent,
} from "../services/modules/googleCalendar";

export const registerCalendarRoutes = async (app: FastifyInstance) => {
  /**
   * Test endpoint: Create a calendar and add a test event
   * Requires Google OAuth access token with calendar scope
   */
  app.post(
    "/calendar/test",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = request.body as {
        accessToken: string;
        calendarName?: string;
        eventTitle?: string;
        eventDate?: string;
      };

      if (!body.accessToken) {
        reply.code(400).send({ error: "accessToken is required" });
        return;
      }

      const calendarName = body.calendarName ?? "Weekend Scout Trips";
      const eventTitle = body.eventTitle ?? "Test Event from Weekend Scout";
      const eventDate = body.eventDate ?? new Date().toISOString().split("T")[0];

      request.log.info({ calendarName, eventTitle, eventDate }, "Creating test calendar and event");

      try {
        // 1. Create a new calendar
        const calendar = await createCalendar(
          body.accessToken,
          calendarName,
          "Created by Weekend Scout app",
        );
        request.log.info({ calendarId: calendar.id }, "Calendar created");

        // 2. Create an event in that calendar
        const event: CalendarEvent = {
          summary: eventTitle,
          description: "This is a test event created by Weekend Scout to verify calendar integration.",
          location: "Test Location",
          start: {
            date: eventDate,
          },
          end: {
            date: eventDate,
          },
        };

        const createdEvent = await createEvent(body.accessToken, calendar.id, event);
        request.log.info({ eventId: createdEvent.id }, "Event created");

        return {
          success: true,
          calendar: {
            id: calendar.id,
            name: calendar.summary,
          },
          event: {
            id: createdEvent.id,
            title: createdEvent.summary,
            link: createdEvent.htmlLink,
          },
        };
      } catch (error) {
        const message = (error as Error).message;
        request.log.error({ err: error }, "Calendar API error");
        reply.code(500).send({ error: message });
      }
    },
  );

  /**
   * List user's calendars
   */
  app.get(
    "/calendar/list",
    { preHandler: requireUser },
    async (request, reply) => {
      const query = request.query as { accessToken?: string };

      if (!query.accessToken) {
        reply.code(400).send({ error: "accessToken query param is required" });
        return;
      }

      try {
        const calendars = await listCalendars(query.accessToken);
        return { calendars };
      } catch (error) {
        const message = (error as Error).message;
        request.log.error({ err: error }, "Failed to list calendars");
        reply.code(500).send({ error: message });
      }
    },
  );

  /**
   * Add a recommendation to calendar
   */
  app.post(
    "/calendar/add-event",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = request.body as {
        accessToken: string;
        calendarId: string;
        event: CalendarEvent;
      };

      if (!body.accessToken || !body.calendarId || !body.event) {
        reply.code(400).send({ error: "accessToken, calendarId, and event are required" });
        return;
      }

      try {
        const createdEvent = await createEvent(body.accessToken, body.calendarId, body.event);
        return {
          success: true,
          event: {
            id: createdEvent.id,
            title: createdEvent.summary,
            link: createdEvent.htmlLink,
          },
        };
      } catch (error) {
        const message = (error as Error).message;
        request.log.error({ err: error }, "Failed to create event");
        reply.code(500).send({ error: message });
      }
    },
  );

  /**
   * Add all event recommendations to calendar
   * Creates a new calendar and adds all events with fixed dates
   */
  app.post(
    "/calendar/add-recommendations",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = request.body as {
        accessToken: string;
        calendarName: string;
        destination: string;
        events: Array<{
          id: string;
          title: string;
          description?: string;
          venue?: { name: string; address?: string };
          address?: string;
          startDateTime: string;
          endDateTime?: string;
        }>;
      };

      if (!body.accessToken || !body.events || body.events.length === 0) {
        reply.code(400).send({ error: "accessToken and events array are required" });
        return;
      }

      const calendarName = body.calendarName ?? `Weekend Scout: ${body.destination ?? "Trip"}`;

      request.log.info(
        { calendarName, eventCount: body.events.length },
        "Creating calendar with recommendation events",
      );

      try {
        // 1. Create a new calendar for this trip
        const calendar = await createCalendar(
          body.accessToken,
          calendarName,
          `Events for your ${body.destination ?? ""} trip, curated by Weekend Scout`,
        );
        request.log.info({ calendarId: calendar.id }, "Calendar created");

        // 2. Add each event to the calendar
        const createdEvents: Array<{
          id: string;
          title: string;
          link: string;
          originalId: string;
        }> = [];

        const errors: Array<{ originalId: string; error: string }> = [];

        for (const rec of body.events) {
          try {
            const location = rec.venue
              ? `${rec.venue.name}${rec.venue.address ? `, ${rec.venue.address}` : ""}`
              : rec.address ?? "";

            const calendarEvent: CalendarEvent = {
              summary: rec.title,
              description: rec.description ?? `Added from Weekend Scout recommendations`,
              location,
              start: {
                dateTime: rec.startDateTime,
              },
              end: {
                dateTime: rec.endDateTime ?? rec.startDateTime,
              },
            };

            const created = await createEvent(body.accessToken, calendar.id, calendarEvent);
            createdEvents.push({
              id: created.id,
              title: created.summary,
              link: created.htmlLink,
              originalId: rec.id,
            });

            request.log.info({ eventId: created.id, title: rec.title }, "Event added to calendar");
          } catch (err) {
            const message = (err as Error).message;
            request.log.error({ err, recId: rec.id }, "Failed to create event");
            errors.push({ originalId: rec.id, error: message });
          }
        }

        return {
          success: true,
          calendar: {
            id: calendar.id,
            name: calendar.summary,
          },
          eventsCreated: createdEvents.length,
          events: createdEvents,
          errors: errors.length > 0 ? errors : undefined,
        };
      } catch (error) {
        const message = (error as Error).message;
        request.log.error({ err: error }, "Calendar API error");
        reply.code(500).send({ error: message });
      }
    },
  );
};

