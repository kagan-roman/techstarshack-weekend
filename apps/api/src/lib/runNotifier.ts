import type { WebSocket } from "@fastify/websocket";
import type { RunStatus } from "../services/modules/agentRuns";

type RunUpdate = {
  runId: string;
  status: RunStatus;
  result?: Record<string, unknown> | null;
  error?: string | null;
  timestamp: string;
};

type ProgressUpdate = {
  runId: string;
  step: string;
  message: string;
  progress?: number; // 0-100
  timestamp: string;
};

// Map of runId -> Set of WebSocket connections
const runSubscribers = new Map<string, Set<WebSocket>>();

// Map of WebSocket -> Set of runIds (for cleanup)
const socketSubscriptions = new Map<WebSocket, Set<string>>();

export function subscribeToRun(socket: WebSocket, runId: string): void {
  // Add to run subscribers
  if (!runSubscribers.has(runId)) {
    runSubscribers.set(runId, new Set());
  }
  runSubscribers.get(runId)!.add(socket);

  // Track socket subscriptions for cleanup
  if (!socketSubscriptions.has(socket)) {
    socketSubscriptions.set(socket, new Set());
  }
  socketSubscriptions.get(socket)!.add(runId);

  console.log(`[WS] Client subscribed to run ${runId}`);
}

export function unsubscribeFromRun(socket: WebSocket, runId: string): void {
  const subscribers = runSubscribers.get(runId);
  if (subscribers) {
    subscribers.delete(socket);
    if (subscribers.size === 0) {
      runSubscribers.delete(runId);
    }
  }

  const subs = socketSubscriptions.get(socket);
  if (subs) {
    subs.delete(runId);
  }

  console.log(`[WS] Client unsubscribed from run ${runId}`);
}

export function cleanupSocket(socket: WebSocket): void {
  const subs = socketSubscriptions.get(socket);
  if (subs) {
    for (const runId of subs) {
      const subscribers = runSubscribers.get(runId);
      if (subscribers) {
        subscribers.delete(socket);
        if (subscribers.size === 0) {
          runSubscribers.delete(runId);
        }
      }
    }
    socketSubscriptions.delete(socket);
  }
  console.log(`[WS] Client disconnected, cleaned up subscriptions`);
}

export function notifyRunUpdate(
  runId: string,
  status: RunStatus,
  result?: Record<string, unknown> | null,
  error?: string | null,
): void {
  const subscribers = runSubscribers.get(runId);
  if (!subscribers || subscribers.size === 0) {
    console.log(`[WS] No subscribers for run ${runId}`);
    return;
  }

  const update: RunUpdate = {
    runId,
    status,
    result,
    error,
    timestamp: new Date().toISOString(),
  };

  const message = JSON.stringify({ type: "run_update", data: update });

  console.log(`[WS] Notifying ${subscribers.size} subscribers about run ${runId} status: ${status}`);

  for (const socket of subscribers) {
    try {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(message);
      }
    } catch (err) {
      console.error(`[WS] Failed to send to subscriber:`, err);
    }
  }

  // Auto-cleanup on terminal states
  if (status === "succeeded" || status === "failed") {
    // Give clients a moment to receive the final update before cleanup
    setTimeout(() => {
      runSubscribers.delete(runId);
      console.log(`[WS] Cleaned up subscribers for completed run ${runId}`);
    }, 5000);
  }
}

export function notifyRunProgress(
  runId: string,
  step: string,
  message: string,
  progress?: number,
): void {
  const subscribers = runSubscribers.get(runId);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const update: ProgressUpdate = {
    runId,
    step,
    message,
    progress,
    timestamp: new Date().toISOString(),
  };

  const wsMessage = JSON.stringify({ type: "run_progress", data: update });

  for (const socket of subscribers) {
    try {
      if (socket.readyState === 1) {
        socket.send(wsMessage);
      }
    } catch (err) {
      console.error(`[WS] Failed to send progress:`, err);
    }
  }
}

// Helper to send progress updates with delay
export async function sendProgressSteps(
  runId: string,
  steps: Array<{ step: string; message: string }>,
  delayMs = 2000,
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    const { step, message } = steps[i];
    const progress = Math.round(((i + 1) / steps.length) * 100);
    notifyRunProgress(runId, step, message, progress);
    if (i < steps.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

