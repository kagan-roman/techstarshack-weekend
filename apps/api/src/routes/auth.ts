import { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { findOrCreateUser } from "../services/modules/users";

const debugLoginSchema = z.object({
  userId: z.string().min(3),
  email: z.string().email().optional(),
});

const googleLoginSchema = z.object({
  googleId: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  createAlias: z.boolean().optional(), // For testing - creates new user even if exists
});

export const registerAuthRoutes = async (app: FastifyInstance) => {
  // Debug login for development
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
      env.jwtSecret,
      { expiresIn: "24h" },
    );

    return { token };
  });

  // Google OAuth login - creates or updates user, returns JWT
  app.post("/auth/google", async (request, reply) => {
    const body = googleLoginSchema.parse(request.body ?? {});

    const user = await findOrCreateUser(
      {
        googleId: body.googleId,
        email: body.email,
        name: body.name,
        picture: body.picture,
      },
      body.createAlias ?? false,
    );

    request.log.info(
      { userId: user.id, isAlias: body.createAlias },
      "User authenticated",
    );

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        googleId: user.google_id,
      },
      env.jwtSecret,
      { expiresIn: "7d" },
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    };
  });
};
