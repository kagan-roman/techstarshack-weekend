import { useEffect, useState } from "react";
import { getTripInviteInfo, joinTrip, type TripInviteInfo } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { GoogleLoginButton } from "./GoogleLoginButton";

type Props = {
  tripId: string;
  onJoined: (tripId: string) => void;
};

export function InviteView({ tripId, onJoined }: Props) {
  const { token, isLoading, error, login } = useAuth();
  const [inviteInfo, setInviteInfo] = useState<TripInviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Load invite info
  useEffect(() => {
    getTripInviteInfo(tripId)
      .then(setInviteInfo)
      .catch((err) => setLoadError((err as Error).message))
      .finally(() => setLoading(false));
  }, [tripId]);

  // Auto-join after login
  useEffect(() => {
    if (token && inviteInfo && !joining) {
      handleJoin();
    }
  }, [token, inviteInfo]);

  const handleJoin = async () => {
    if (!token) return;
    
    setJoining(true);
    try {
      await joinTrip(token, tripId);
      onJoined(tripId);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setJoining(false);
    }
  };

  const handleLogin = async () => {
    await login();
    // Join will happen automatically via useEffect
  };

  if (loading) {
    return (
      <div className="auth-view">
        <div className="auth-card">
          <h2>Loading invitation...</h2>
        </div>
      </div>
    );
  }

  if (loadError && !inviteInfo) {
    return (
      <div className="auth-view">
        <div className="auth-card">
          <h2>Invitation not found 😞</h2>
          <p>{loadError}</p>
          <button
            className="button secondary"
            onClick={() => window.location.href = "/"}
          >
            Go to homepage
          </button>
        </div>
      </div>
    );
  }

  if (!inviteInfo) return null;

  const formatDate = (date?: string) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="auth-view">
      <div className="auth-card invite-card">
        <div className="invite-header">
          {inviteInfo.owner?.picture && (
            <img
              src={inviteInfo.owner.picture}
              alt=""
              className="invite-owner-pic"
            />
          )}
          <h2>You're invited! 🎉</h2>
        </div>

        <p className="invite-message">
          <strong>{inviteInfo.owner?.name || "Someone"}</strong> invites you to
          join their trip to
        </p>

        <div className="invite-destination">
          <span className="invite-city">{inviteInfo.destination}</span>
          {inviteInfo.country && (
            <span className="invite-country">{inviteInfo.country}</span>
          )}
        </div>

        {(inviteInfo.startDate || inviteInfo.endDate) && (
          <div className="invite-dates">
            📅 {formatDate(inviteInfo.startDate)}
            {inviteInfo.startDate && inviteInfo.endDate && " → "}
            {formatDate(inviteInfo.endDate)}
          </div>
        )}

        <p className="invite-tagline">Find the best places together.</p>

        {!token && (
          <GoogleLoginButton
            loading={isLoading || joining}
            label={isLoading || joining ? "Joining..." : "Join with Google"}
            onClick={handleLogin}
          />
        )}

        {joining && <p>Joining trip...</p>}

        {(error || loadError) && (
          <div className="feedback error">{error || loadError}</div>
        )}
      </div>
    </div>
  );
}

