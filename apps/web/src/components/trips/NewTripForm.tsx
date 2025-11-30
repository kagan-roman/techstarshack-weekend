import { useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { startRecommendationsRun } from "../../lib/api";
import { wsClient, type RunUpdate, type ProgressUpdate } from "../../lib/wsClient";

type Props = {
  onCreated: (tripId: string) => void;
  onCancel: () => void;
};

export function NewTripForm({ onCreated, onCancel }: Props) {
  const { token } = useAuth();
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const isValid =
    destination.trim().length > 2 &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    startDate <= endDate;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !isValid) return;

    setSubmitting(true);
    setError(null);
    setStatus("Creating trip...");
    setProgressPercent(0);

    try {
      const runId = await startRecommendationsRun(token, {
        location: destination.trim(),
        startDate,
        endDate,
      });

      setStatus("🔍 Starting search...");

      // Subscribe to updates with progress
      const unsubscribe = wsClient.subscribeToRun(
        runId,
        (update: RunUpdate) => {
          if (update.status === "succeeded") {
            const result = update.result as { tripId?: string };
            if (result?.tripId) {
              onCreated(result.tripId);
            }
            unsubscribe();
          }
          if (update.status === "failed") {
            setError(update.error ?? "Failed to create trip");
            setSubmitting(false);
            unsubscribe();
          }
        },
        (progress: ProgressUpdate) => {
          setStatus(progress.message);
          setProgressPercent(progress.progress ?? 0);
        },
      );
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>Plan a new trip</h2>

      <form className="trip-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="destination">Where to?</label>
          <input
            id="destination"
            type="text"
            placeholder="Tallinn, Berlin, Tokyo..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="startDate">From</label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="endDate">To</label>
            <input
              id="endDate"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
        </div>

        {submitting && (
          <div className="trip-progress">
            <div className="progress-message">{status}</div>
            <div className="progress-bar">
              <div
                className="progress-fill animated"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
        {error && <div className="feedback error">{error}</div>}

        <div className="card-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={!isValid || submitting}
          >
            {submitting ? "Creating..." : "Create Trip"}
          </button>
        </div>
      </form>
    </div>
  );
}

