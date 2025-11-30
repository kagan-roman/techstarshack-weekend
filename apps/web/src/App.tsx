import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginView, InviteView } from "./components/auth";
import { ProfileView } from "./components/profile";
import { TripsView } from "./components/trips";
import { RecommendationsView } from "./components/recommendations";
import { BottomNav } from "./components/layout/BottomNav";
import { AppHeader } from "./components/layout/AppHeader";
import "./styles.css";

type Tab = "profile" | "trips" | "recommendations";

function AppContent() {
  const { isAuthenticated, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  // Check for invite URL
  const [inviteTripId, setInviteTripId] = useState<string | null>(null);
  const [joiningInvite, setJoiningInvite] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/invite\/([a-f0-9-]+)$/i);
    if (match) {
      setInviteTripId(match[1]);
      setJoiningInvite(true); // Mark that we're in invite flow
    }
  }, []);

  const handleInviteJoined = (tripId: string) => {
    setInviteTripId(null);
    setJoiningInvite(false);
    setSelectedTripId(tripId);
    setActiveTab("recommendations");
    window.history.replaceState({}, "", "/");
  };

  const handleTripCreated = (tripId: string) => {
    setSelectedTripId(tripId);
    setActiveTab("recommendations");
  };

  const profileComplete = !!profile?.interests && profile.interests.length > 0;

  // Show invite view if we're in invite flow (even if authenticated - need to complete join)
  if (inviteTripId && joiningInvite) {
    return <InviteView tripId={inviteTripId} onJoined={handleInviteJoined} />;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // Authenticated - main app
  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        {activeTab === "profile" && <ProfileView />}
        {activeTab === "trips" && <TripsView onTripCreated={handleTripCreated} />}
        {activeTab === "recommendations" && (
          <RecommendationsView initialTripId={selectedTripId ?? undefined} />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        profileComplete={profileComplete}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
