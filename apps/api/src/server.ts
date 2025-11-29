import Fastify from "fastify";
import sensible from "fastify-sensible";
import { env } from "./config/env";
import { registerHealthRoutes } from "./routes/health";
import { registerAuthRoutes } from "./routes/auth";
import { registerDataSourceRoutes } from "./routes/dataSources";
import { registerInterestRoutes } from "./routes/interests";
import { registerRecommendationRoutes } from "./routes/recommendations";

export const buildServer = () => {
  const app = Fastify({
    logger: true,
  });

  app.register(sensible);
  app.register(registerHealthRoutes);
  app.register(registerAuthRoutes);
  app.register(registerDataSourceRoutes);
  app.register(registerInterestRoutes);
  app.register(registerRecommendationRoutes);

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

