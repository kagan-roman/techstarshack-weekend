import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { castVote, removeVote, type VoteData } from "../../lib/api";

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
  recommendation: Recommendation;
  vote?: VoteData;
  onVoteChange: (vote: VoteData) => void;
};

export function RecommendationCard({ recommendation: rec, vote, onVoteChange }: Props) {
  const { token } = useAuth();
  const [voting, setVoting] = useState(false);

  const handleVote = async (voteType: -1 | 1) => {
    if (!token || voting) return;

    setVoting(true);
    try {
      let result: VoteData;
      if (vote?.userVote === voteType) {
        // Remove vote
        result = await removeVote(token, rec.id);
      } else {
        const response = await castVote(token, rec.id, voteType);
        result = {
          score: response.score,
          upvotes: response.upvotes,
          downvotes: response.downvotes,
          userVote: response.userVote,
        };
      }
      onVoteChange(result);
    } catch (err) {
      console.error("[Vote] Failed:", err);
    } finally {
      setVoting(false);
    }
  };

  const score = vote?.score ?? 0;
  const touristTrap = rec.touristTrap ?? 50;
  const description = rec.description || rec.interestFit || rec.whyItFits || rec.fitReason;

  return (
    <div className={`recommendation-card rec-type-${rec.type}`}>
      {/* Vote controls */}
      <div className="vote-controls">
        <button
          className={`vote-btn upvote ${vote?.userVote === 1 ? "active" : ""}`}
          onClick={() => handleVote(1)}
          disabled={voting}
        >
          ▲
        </button>
        <span className={`vote-score ${score > 0 ? "positive" : score < 0 ? "negative" : ""}`}>
          {score}
        </span>
        <button
          className={`vote-btn downvote ${vote?.userVote === -1 ? "active" : ""}`}
          onClick={() => handleVote(-1)}
          disabled={voting}
        >
          ▼
        </button>
      </div>

      {/* Type badge */}
      <span className={`rec-type-badge ${rec.type}`}>
        {rec.type === "event" ? "🎫 Event" : "📍 Location"}
      </span>

      <h3 className="rec-title">{rec.title}</h3>

      {/* Venue */}
      {rec.venue && (
        <div className="rec-venue">
          <strong>{rec.venue.name}</strong>
          {rec.venue.neighborhood && (
            <span className="rec-neighborhood"> · {rec.venue.neighborhood}</span>
          )}
          {rec.venue.address && <div className="rec-address">{rec.venue.address}</div>}
        </div>
      )}
      {!rec.venue && rec.address && <div className="rec-address">📍 {rec.address}</div>}

      {/* DateTime for events */}
      {rec.type === "event" && rec.startDateTime && (
        <div className="rec-datetime">
          🗓️{" "}
          {new Date(rec.startDateTime).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}{" "}
          🕐{" "}
          {new Date(rec.startDateTime).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {rec.endDateTime && (
            <span>
              {" → "}
              {new Date(rec.endDateTime).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      )}

      {/* Operating hours for locations */}
      {rec.type === "location" && rec.operatingHours && (
        <div className="rec-hours">🕐 {rec.operatingHours.summary}</div>
      )}

      {/* Tourist Trap score */}
      <div className="rec-trap-score">
        <div className="trap-bar">
          <div className="trap-fill gem" style={{ width: `${100 - touristTrap}%` }} />
          <div className="trap-fill trap" style={{ width: `${touristTrap}%` }} />
        </div>
        <div className="trap-labels">
          <span className="gem-label">💎 Hidden Gem: {100 - touristTrap}%</span>
          <span className="trap-label">🎯 Tourist Trap: {touristTrap}%</span>
        </div>
      </div>

      {/* Description */}
      {description && <p className="rec-description">{description}</p>}

      {/* Uniqueness for locations */}
      {rec.type === "location" && rec.uniquenessReason && (
        <div className="rec-uniqueness">
          <strong>Why unique:</strong> {rec.uniquenessReason}
        </div>
      )}

      {/* Tags */}
      {Array.isArray(rec.tags) && rec.tags.length > 0 && (
        <div className="rec-tags">
          {rec.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Price */}
      {rec.price && (
        <div className="rec-price">
          💰{" "}
          {rec.price.amount ? `${rec.price.amount} ${rec.price.currency || "EUR"} ` : ""}
          {rec.price.note || rec.price.notes}
        </div>
      )}

      {/* Sources */}
      {Array.isArray(rec.sources) && rec.sources.length > 0 && (
        <div className="rec-sources">
          {rec.sources.slice(0, 3).map((source, i) => (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rec-source-link"
              title={source.note || source.name}
            >
              {source.type || source.name || `Source ${i + 1}`}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

