import { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export const requireUser = async (request: FastifyRequest, reply: FastifyReply) => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Authorization header missing" });
    return reply;
  }

  const token = header.substring("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    if (!payload.sub) {
      throw new Error("Missing subject in JWT");
    }
    request.user = {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch (error) {
    request.log.error({ err: error }, "JWT verification failed");
    reply.code(401).send({ error: "Invalid token" });
    return reply;
  }
};
