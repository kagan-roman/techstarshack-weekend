import { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";

const debugLoginSchema = z.object({
  userId: z.string().min(3),
  email: z.string().email().optional(),
});

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post("/auth/debug-login", async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      reply.code(403).send({ error: "Debug login disabled" });
      return reply;
    }

    const body = debugLoginSchema.parse(request.body ?? {});
    const token = jwt.sign(
      {
        sub: body.userId,
        email: body.email,
      },
      env.supabaseJwtSecret,
      { expiresIn: "1h" },
    );

    return { token };
  });
};

