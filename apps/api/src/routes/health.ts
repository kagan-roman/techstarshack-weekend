import { FastifyInstance } from "fastify";

export const registerHealthRoutes = async (app: FastifyInstance) => {
  app.get("/", async () => ({
    status: "ok",
    service: "weekend-api",
  }));

  app.get("/health", async () => ({
    status: "ok",
    service: "weekend-api",
  }));
};

