import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useAuth, type ProfileData } from "../../context/AuthContext";
import { updateProfile } from "../../lib/api";

// Auto-resize textarea helper
function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

type Props = {
  profile: ProfileData;
  onSave: () => void;
  onReProfile: () => void;
};

export function ProfileEditCard({ profile: initialProfile, onSave, onReProfile }: Props) {
  const { token, setProfile } = useAuth();
  const [profile, setLocalProfile] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize on mount
  useEffect(() => {
    autoResize(bioRef.current);
  }, []);

  const updateInterest = (index: number, field: string, value: string | number) => {
    if (!profile.interests) return;
    const updated = [...profile.interests];
    updated[index] = { ...updated[index], [field]: value };
    setLocalProfile({ ...profile, interests: updated });
  };

  const removeInterest = (index: number) => {
    if (!profile.interests) return;
    const updated = profile.interests.filter((_, i) => i !== index);
    setLocalProfile({ ...profile, interests: updated });
  };

  const addInterest = () => {
    const newInterest = {
      id: `custom-${Date.now()}`,
      label: "New interest",
      description: "",
      tags: [],
      weight: 0.5,
    };
    setLocalProfile({
      ...profile,
      interests: [...(profile.interests ?? []), newInterest],
    });
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await updateProfile(token, profile);
      setProfile(profile);
      onSave();
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2>Review your profile</h2>
      <p>We've analyzed your data. Edit anything that doesn't look right.</p>

      {profile.identity?.bioSummary && (
        <div className="profile-section">
          <h3>About you</h3>
          <textarea
            ref={bioRef}
            className="profile-bio"
            value={profile.identity.bioSummary}
            onChange={(e) => {
              autoResize(e.target);
              setLocalProfile({
                ...profile,
                identity: { ...profile.identity, bioSummary: e.target.value },
              });
            }}
          />
        </div>
      )}

      <div className="profile-section">
        <h3>Your interests</h3>
        <div className="interests-list">
          {(profile.interests ?? []).map((interest, index) => (
            <div key={interest.id} className="interest-card">
              <div className="interest-header">
                <input
                  type="text"
                  className="interest-label-input"
                  value={interest.label}
                  onChange={(e) => updateInterest(index, "label", e.target.value)}
                  placeholder="Interest name"
                />
                <button
                  type="button"
                  className="remove-interest"
                  onClick={() => removeInterest(index)}
                >
                  ×
                </button>
              </div>
              <textarea
                className="interest-description"
                value={interest.description ?? ""}
                onChange={(e) => {
                  autoResize(e.target);
                  updateInterest(index, "description", e.target.value);
                }}
                ref={(el) => el && autoResize(el)}
                placeholder="Describe this interest..."
              />
              {interest.tags && interest.tags.length > 0 && (
                <div className="interest-tags">
                  {interest.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
              <div className="interest-weight">
                <label>Relevance:</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={interest.weight ?? 0.5}
                  onChange={(e) => updateInterest(index, "weight", parseFloat(e.target.value))}
                />
                <span>{Math.round((interest.weight ?? 0.5) * 100)}%</span>
              </div>
            </div>
          ))}
          <button type="button" className="add-interest-btn" onClick={addInterest}>
            + Add interest
          </button>
        </div>
      </div>

      <div className="card-actions">
        <button className="button secondary" onClick={onReProfile}>
          Re-profile
        </button>
        <button className="button primary" disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}

