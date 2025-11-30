import { useEffect, useState } from "react";
import { useAuth, type ProfileData } from "../../context/AuthContext";
import { startProfilingRun } from "../../lib/api";
import { wsClient, type RunUpdate, type ProgressUpdate } from "../../lib/wsClient";

type Props = {
  sources: string[];
  onComplete: (profile: ProfileData) => void;
  onBack: () => void;
};

type Status = "idle" | "queued" | "running" | "succeeded" | "failed";

export function ProfilingCard({ sources, onComplete, onBack }: Props) {
  const { token } = useAuth();
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // Start profiling on mount
  useEffect(() => {
    if (!token || runId) return;

    startProfilingRun(token)
      .then((id) => {
        setRunId(id);
        setStatus("queued");
      })
      .catch((err) => {
        setError((err as Error).message);
        setStatus("failed");
      });
  }, [token]);

  // Subscribe to run updates
  useEffect(() => {
    if (!runId) return;

    const handleUpdate = (update: RunUpdate) => {
      setStatus(update.status);

      if (update.status === "succeeded" && update.result) {
        const profile = (update.result as { profile?: ProfileData }).profile;
        if (profile) {
          onComplete(profile);
        }
      }

      if (update.status === "failed") {
        setError(update.error ?? "Profiling failed");
      }
    };

    const handleProgress = (update: ProgressUpdate) => {
      setProgressMessage(update.message);
      setProgressPercent(update.progress ?? 0);
    };

    return wsClient.subscribeToRun(runId, handleUpdate, handleProgress);
  }, [runId, onComplete]);

  return (
    <div className="card profiling-card">
      <h2>Building your profile</h2>

      <div className="profiling-status">
        {status === "running" && progressMessage ? (
          <div className="progress-message">{progressMessage}</div>
        ) : (
          <div className={`status-badge status-${status}`}>
            {status === "idle" && "Starting..."}
            {status === "queued" && "Queued..."}
            {status === "running" && "Analyzing..."}
            {status === "succeeded" && "Complete!"}
            {status === "failed" && "Failed"}
          </div>
        )}

        {status === "running" && (
          <div className="progress-bar">
            <div
              className="progress-fill animated"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {error && <div className="feedback error">{error}</div>}
      </div>

      <div className="card-actions">
        <button className="button secondary" onClick={onBack} disabled={status === "running"}>
          ← Back
        </button>
      </div>
    </div>
  );
}

