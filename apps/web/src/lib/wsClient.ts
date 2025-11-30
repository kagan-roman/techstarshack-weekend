import { clientEnv } from "../config/env";

export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export type RunUpdate = {
  runId: string;
  status: RunStatus;
  result?: Record<string, unknown> | null;
  error?: string | null;
  timestamp: string;
};

export type ProgressUpdate = {
  runId: string;
  step: string;
  message: string;
  progress?: number;
  timestamp: string;
};

type WsMessage =
  | { type: "connected"; message: string }
  | { type: "subscribed"; runId: string }
  | { type: "unsubscribed"; runId: string }
  | { type: "run_update"; data: RunUpdate }
  | { type: "run_progress"; data: ProgressUpdate }
  | { type: "error"; message: string };

type RunUpdateCallback = (update: RunUpdate) => void;
type ProgressCallback = (update: ProgressUpdate) => void;

class WsClient {
  private socket: WebSocket | null = null;
  private callbacks = new Map<string, Set<RunUpdateCallback>>();
  private progressCallbacks = new Map<string, Set<ProgressCallback>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const wsUrl = clientEnv.apiBaseUrl.replace(/^http/, "ws") + "/ws";
      console.log("[WS] Connecting to", wsUrl);

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log("[WS] Connected");
        this.reconnectAttempts = 0;
        resolve();
      };

      this.socket.onclose = () => {
        console.log("[WS] Disconnected");
        this.handleReconnect();
      };

      this.socket.onerror = (err) => {
        console.error("[WS] Error:", err);
        reject(err);
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WsMessage;
          this.handleMessage(message);
        } catch (err) {
          console.error("[WS] Failed to parse message:", err);
        }
      };
    });
  }

  private handleMessage(message: WsMessage): void {
    console.log("[WS] Received:", message.type);

    if (message.type === "run_update") {
      const update = message.data;
      const callbacks = this.callbacks.get(update.runId);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(update);
        }
      }
    }

    if (message.type === "run_progress") {
      const update = message.data;
      const callbacks = this.progressCallbacks.get(update.runId);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(update);
        }
      }
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WS] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((err) => {
        console.error("[WS] Reconnect failed:", err);
      });
    }, delay);
  }

  subscribeToRun(
    runId: string,
    callback: RunUpdateCallback,
    progressCallback?: ProgressCallback,
  ): () => void {
    // Ensure connected
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.connect().then(() => {
        this.subscribeToRun(runId, callback, progressCallback);
      });
      return () => this.unsubscribeFromRun(runId, callback, progressCallback);
    }

    // Register status callback
    if (!this.callbacks.has(runId)) {
      this.callbacks.set(runId, new Set());
    }
    this.callbacks.get(runId)!.add(callback);

    // Register progress callback
    if (progressCallback) {
      if (!this.progressCallbacks.has(runId)) {
        this.progressCallbacks.set(runId, new Set());
      }
      this.progressCallbacks.get(runId)!.add(progressCallback);
    }

    // Send subscribe message
    this.socket.send(JSON.stringify({ type: "subscribe", runId }));

    // Return unsubscribe function
    return () => this.unsubscribeFromRun(runId, callback, progressCallback);
  }

  private unsubscribeFromRun(
    runId: string,
    callback: RunUpdateCallback,
    progressCallback?: ProgressCallback,
  ): void {
    const callbacks = this.callbacks.get(runId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.callbacks.delete(runId);
      }
    }

    if (progressCallback) {
      const progressCbs = this.progressCallbacks.get(runId);
      if (progressCbs) {
        progressCbs.delete(progressCallback);
        if (progressCbs.size === 0) {
          this.progressCallbacks.delete(runId);
        }
      }
    }

    // Only unsubscribe from server if no callbacks remain
    if (!this.callbacks.has(runId) && !this.progressCallbacks.has(runId)) {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "unsubscribe", runId }));
      }
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.callbacks.clear();
  }
}

export const wsClient = new WsClient();

