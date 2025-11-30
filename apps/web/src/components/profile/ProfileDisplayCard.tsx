import { type ProfileData } from "../../context/AuthContext";

type Props = {
  profile: ProfileData;
  onReProfile: () => void;
};

export function ProfileDisplayCard({ profile, onReProfile }: Props) {
  return (
    <div className="card profile-complete-card">
      <div className="profile-complete-header">
        <span className="checkmark">✓</span>
        <h2>Profile Complete</h2>
      </div>

      {profile.identity?.bioSummary && (
        <div className="profile-section">
          <h3>About you</h3>
          <p className="bio-text">{profile.identity.bioSummary}</p>
        </div>
      )}

      <div className="profile-section">
        <h3>Your interests ({profile.interests?.length ?? 0})</h3>
        <div className="interests-grid">
          {(profile.interests ?? []).map((interest) => (
            <div key={interest.id} className="interest-pill">
              <span className="interest-name">{interest.label}</span>
              <span className="interest-weight-badge">
                {Math.round((interest.weight ?? 0.5) * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card-actions">
        <button className="button secondary" onClick={onReProfile}>
          Edit profile
        </button>
      </div>
    </div>
  );
}

