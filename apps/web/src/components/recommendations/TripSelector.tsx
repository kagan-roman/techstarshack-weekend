type Trip = {
  id: string;
  destination: string;
  startDate?: string;
  endDate?: string;
};

type Props = {
  trips: Trip[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function TripSelector({ trips, selectedId, onSelect }: Props) {
  const formatDate = (date?: string) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="trip-selector">
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="trip-dropdown"
      >
        {trips.map((trip) => (
          <option key={trip.id} value={trip.id}>
            {trip.destination}
            {trip.startDate && ` (${formatDate(trip.startDate)})`}
          </option>
        ))}
      </select>
    </div>
  );
}

