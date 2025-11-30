type Props = {
  tripId: string;
};

export function AddExperienceSection({ tripId }: Props) {
  const handleAddExperience = () => {
    // TODO: Navigate to add experience flow
    console.log("Add experience for trip:", tripId);
  };

  return (
    <div className="add-experience-section">
      <p>Share your favorite spots with the group!</p>
      <button className="button primary" onClick={handleAddExperience}>
        ✨ Add my recommendations
      </button>
    </div>
  );
}

