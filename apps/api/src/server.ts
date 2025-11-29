import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import sensible from "fastify-sensible";
import { env } from "./config/env";
import { registerHealthRoutes } from "./routes/health";
import { registerAuthRoutes } from "./routes/auth";
import { registerDataSourceRoutes } from "./routes/dataSources";
import { registerInterestRoutes } from "./routes/interests";
import { registerRecommendationRoutes } from "./routes/recommendations";
import { registerProfileRoutes } from "./routes/profiles";
import { registerProfilingRoutes } from "./routes/profiling";
import { registerWsRoutes } from "./routes/ws";
import { registerCalendarRoutes } from "./routes/calendar";
import { registerVoteRoutes } from "./routes/votes";
import { registerTripRoutes } from "./routes/trips";
import { registerInviteRoutes } from "./routes/invite";

export const buildServer = () => {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });
  app.register(websocket);
  app.register(sensible);
  app.register(registerHealthRoutes);
  app.register(registerAuthRoutes);
  app.register(registerDataSourceRoutes);
  app.register(registerInterestRoutes);
  app.register(registerRecommendationRoutes);
  app.register(registerProfileRoutes);
  app.register(registerProfilingRoutes);
  app.register(registerWsRoutes);
  app.register(registerCalendarRoutes);
  app.register(registerVoteRoutes);
  app.register(registerTripRoutes);
  app.register(registerInviteRoutes);

  return app;
};

if (require.main === module) {
  const server = buildServer();
  server
    .listen({ host: "0.0.0.0", port: env.port })
    .then(() => {
      server.log.info(`API listening on ${env.port}`);
    })
    .catch((error) => {
      server.log.error(error, "Failed to start API");
      process.exit(1);
    });
}
