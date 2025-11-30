import { useState } from "react";
import { TripsList } from "./TripsList";
import { NewTripForm } from "./NewTripForm";

type Props = {
  onTripCreated: (tripId: string) => void;
};

export function TripsView({ onTripCreated }: Props) {
  const [showNewTrip, setShowNewTrip] = useState(false);

  const handleTripCreated = (tripId: string) => {
    setShowNewTrip(false);
    onTripCreated(tripId);
  };

  return (
    <div className="trips-view">
      {showNewTrip ? (
        <NewTripForm
          onCreated={handleTripCreated}
          onCancel={() => setShowNewTrip(false)}
        />
      ) : (
        <>
          <h2 className="section-title">Your Trips</h2>
          <TripsList onSelectTrip={onTripCreated} />

          <button
            className="new-trip-btn"
            onClick={() => setShowNewTrip(true)}
          >
            <span className="new-trip-icon">+</span>
            <span className="new-trip-text">Plan a new trip</span>
          </button>
        </>
      )}
    </div>
  );
}

