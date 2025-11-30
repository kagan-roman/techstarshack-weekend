import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { clientEnv } from "../../config/env";
import { RecommendationCard } from "./RecommendationCard";
import { TripSelector } from "./TripSelector";
import { InviteSection } from "./InviteSection";
import { AddExperienceSection } from "./AddExperienceSection";
import { getVotesBatch, type VoteData } from "../../lib/api";

type Trip = {
  id: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  ownerId?: string;
};

type Recommendation = {
  id: string;
  type: "event" | "location";
  title: string;
  description?: string;
  venue?: { name: string; address?: string; neighborhood?: string };
  address?: string;
  startDateTime?: string;
  endDateTime?: string;
  operatingHours?: { summary: string };
  uniquenessReason?: string;
  tags?: string[];
  touristTrap?: number;
  price?: { amount?: number; currency?: string; note?: string; notes?: string };
  sources?: Array<{ url: string; type?: string; note?: string; name?: string }>;
  interestFit?: string;
  whyItFits?: string;
  fitReason?: string;
};

type Props = {
  initialTripId?: string;
};

export function RecommendationsView({ initialTripId }: Props) {
  const { token, user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(initialTripId ?? null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [votes, setVotes] = useState<Record<string, VoteData>>({});
  const [loading, setLoading] = useState(true);

  // Load trips
  useEffect(() => {
    if (!token) return;

    fetch(`${clientEnv.apiBaseUrl}/trips`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        const tripsList = data.trips ?? [];
        setTrips(tripsList);
        
        // Select nearest trip by default
        if (!selectedTripId && tripsList.length > 0) {
          const nearest = findNearestTrip(tripsList);
          setSelectedTripId(nearest?.id ?? tripsList[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  // Load recommendations for selected trip
  useEffect(() => {
    if (!token || !selectedTripId) return;

    setLoading(true);
    fetch(`${clientEnv.apiBaseUrl}/trips/${selectedTripId}/recommendations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setRecommendations(data.recommendations ?? []);
        
        // Load votes
        const recIds = (data.recommendations ?? []).map((r: Recommendation) => r.id);
        if (recIds.length > 0) {
          getVotesBatch(token, recIds)
            .then(setVotes)
            .catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, selectedTripId]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  if (loading && trips.length === 0) {
    return <div className="loading-text">Loading...</div>;
  }

  if (trips.length === 0) {
    return (
      <div className="empty-state">
        <h2>No trips yet</h2>
        <p>Create a trip first to see recommendations.</p>
      </div>
    );
  }

  return (
    <div className="recommendations-view">
      <TripSelector
        trips={trips}
        selectedId={selectedTripId}
        onSelect={setSelectedTripId}
      />

      {selectedTrip && (
        <>
          <div className="trip-header">
            <h2>{selectedTrip.destination} 🎉</h2>
            {selectedTrip.startDate && selectedTrip.endDate && (
              <p className="trip-dates">
                📅 {formatDate(selectedTrip.startDate)} → {formatDate(selectedTrip.endDate)}
              </p>
            )}
          </div>

          {selectedTrip.ownerId === user?.id ? (
            <InviteSection tripId={selectedTripId!} />
          ) : (
            <AddExperienceSection tripId={selectedTripId!} />
          )}
        </>
      )}

      {loading ? (
        <div className="loading-text">Loading recommendations...</div>
      ) : recommendations.length === 0 ? (
        <div className="empty-state">
          <p>No recommendations yet for this trip.</p>
        </div>
      ) : (
        <div className="recommendations-grid">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              vote={votes[rec.id]}
              onVoteChange={(newVote) =>
                setVotes((prev) => ({ ...prev, [rec.id]: newVote }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function findNearestTrip(trips: Trip[]): Trip | null {
  const now = new Date();
  let nearest: Trip | null = null;
  let nearestDiff = Infinity;

  for (const trip of trips) {
    if (!trip.startDate) continue;
    const start = new Date(trip.startDate);
    const diff = Math.abs(start.getTime() - now.getTime());
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearest = trip;
    }
  }

  return nearest;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

