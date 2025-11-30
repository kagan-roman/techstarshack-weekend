import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { clientEnv } from "../../config/env";

type Trip = {
  id: string;
  destination: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  createdAt: string;
};

type Props = {
  onSelectTrip: (tripId: string) => void;
};

export function TripsList({ onSelectTrip }: Props) {
  const { token } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    fetch(`${clientEnv.apiBaseUrl}/trips`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setTrips(data.trips ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const formatDate = (date?: string) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  if (loading) {
    return <div className="loading-text">Loading trips...</div>;
  }

  if (trips.length === 0) {
    return (
      <div className="empty-state">
        <p>No trips yet. Create your first trip to get started!</p>
      </div>
    );
  }

  return (
    <div className="trips-list">
      {trips.map((trip) => (
        <button
          key={trip.id}
          className="trip-card"
          onClick={() => onSelectTrip(trip.id)}
        >
          <div className="trip-destination">{trip.destination}</div>
          {trip.country && <div className="trip-country">{trip.country}</div>}
          {(trip.startDate || trip.endDate) && (
            <div className="trip-dates">
              📅 {formatDate(trip.startDate)}
              {trip.startDate && trip.endDate && " → "}
              {formatDate(trip.endDate)}
            </div>
          )}
          <div className={`trip-status status-${trip.status}`}>{trip.status}</div>
        </button>
      ))}
    </div>
  );
}

