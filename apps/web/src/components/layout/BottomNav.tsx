type Tab = "profile" | "trips" | "recommendations";

type Props = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  profileComplete: boolean;
};

export function BottomNav({ activeTab, onTabChange, profileComplete }: Props) {
  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
        onClick={() => onTabChange("profile")}
      >
        <span className="nav-icon">👤</span>
        <span className="nav-label">Profile</span>
      </button>

      <button
        className={`nav-item ${activeTab === "trips" ? "active" : ""} ${!profileComplete ? "disabled" : ""}`}
        onClick={() => profileComplete && onTabChange("trips")}
        disabled={!profileComplete}
      >
        <span className="nav-icon">✈️</span>
        <span className="nav-label">Trips</span>
        {!profileComplete && <span className="nav-lock">🔒</span>}
      </button>

      <button
        className={`nav-item ${activeTab === "recommendations" ? "active" : ""} ${!profileComplete ? "disabled" : ""}`}
        onClick={() => profileComplete && onTabChange("recommendations")}
        disabled={!profileComplete}
      >
        <span className="nav-icon">⭐</span>
        <span className="nav-label">Recs</span>
        {!profileComplete && <span className="nav-lock">🔒</span>}
      </button>
    </nav>
  );
}

