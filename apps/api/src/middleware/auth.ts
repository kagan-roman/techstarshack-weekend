import { FastifyReply, FastifyRequest } from "fastify";
import { AuthenticatedUser, verifySupabaseJwt } from "@weekend/core";
import { env } from "../config/env";

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
    const user = verifySupabaseJwt(token, env.supabaseJwtSecret);
    request.user = user;
  } catch (error) {
    request.log.error({ err: error }, "Supabase auth verification failed");
    reply.code(401).send({ error: "Invalid token" });
    return reply;
  }
};

