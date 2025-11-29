import { FastifyInstance } from "fastify";
import { subscribeToRun, unsubscribeFromRun, cleanupSocket } from "../lib/runNotifier";

type WsMessage = {
  type: "subscribe" | "unsubscribe";
  runId: string;
};

export const registerWsRoutes = async (app: FastifyInstance) => {
  app.get("/ws", { websocket: true }, (socket, request) => {
    request.log.info("WebSocket client connected");

    socket.on("message", (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString()) as WsMessage;

        if (message.type === "subscribe" && message.runId) {
          subscribeToRun(socket, message.runId);
          socket.send(JSON.stringify({ type: "subscribed", runId: message.runId }));
        } else if (message.type === "unsubscribe" && message.runId) {
          unsubscribeFromRun(socket, message.runId);
          socket.send(JSON.stringify({ type: "unsubscribed", runId: message.runId }));
        } else {
          socket.send(JSON.stringify({ type: "error", message: "Unknown message type" }));
        }
      } catch (err) {
        request.log.error({ err }, "Failed to parse WebSocket message");
        socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      }
    });

    socket.on("close", () => {
      request.log.info("WebSocket client disconnected");
      cleanupSocket(socket);
    });

    socket.on("error", (err) => {
      request.log.error({ err }, "WebSocket error");
      cleanupSocket(socket);
    });

    // Send welcome message
    socket.send(JSON.stringify({ type: "connected", message: "WebSocket connected" }));
  });
};

