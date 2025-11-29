import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../middleware/auth";
import { createDataSource, listDataSources } from "../services/modules/dataSources";

const createDataSourceSchema = z.object({
  provider: z.string().min(2),
  payloadUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});

export const registerDataSourceRoutes = async (app: FastifyInstance) => {
  app.post(
    "/data-sources",
    { preHandler: requireUser },
    async (request, reply) => {
      const body = createDataSourceSchema.parse(request.body ?? {});
      const record = await createDataSource({
        ...body,
        userId: request.user!.id,
      });

      reply.code(201).send(record);
    },
  );

  app.get(
    "/data-sources",
    { preHandler: requireUser },
    async (request) => {
      const rows = await listDataSources(request.user!.id);
      return { items: rows };
    },
  );
};

