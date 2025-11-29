import { FormEvent, useEffect, useMemo, useState } from "react";
import { dataSourceOptions } from "./constants/dataSources";
import "./styles.css";
import {
  loginWithGoogle,
  startProfilingRun,
  getProfile,
  updateProfile,
  startRecommendationsRun,
  addRecommendationsToCalendar,
  castVote,
  removeVote,
  getVotesBatch,
  getTripInviteInfo,
  joinTrip,
  type RecommendationEvent,
  type VoteData,
  type TripInviteInfo,
} from "./lib/api";
import {
  requestGoogleAccessToken,
  fetchGoogleUserInfo,
  getCachedAccessToken,
} from "./lib/googleOAuth";
import { wsClient } from "./lib/wsClient";
import type { RunStatus, RunUpdate } from "./lib/wsClient";

type Step = "calendar" | "sources" | "profiling" | "editProfile" | "trip" | "recommendations";

type UserInfo = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
};

type ProfileData = {
  identity?: {
    bioSummary?: string;
    preferredLanguages?: string[];
  };
  interests?: Array<{
    id: string;
    label: string;
    description?: string;
    tags?: string[];
    weight?: number;
  }>;
  macroPreferences?: Record<string, number>;
  latentTraits?: Record<string, number | string>;
  budget?: {
    final?: { score?: number; level?: string };
  };
};

type Source = {
  url: string;
  type?: string;
  note?: string;
  name?: string;
};

type Venue = {
  name: string;
  address: string;
  neighborhood?: string;
};

type OperatingHours = {
  summary: string;
};

type Price = {
  currency?: string;
  amount?: number;
  note?: string;
  notes?: string;
};

type Recommendation = {
  type: "event" | "location";
  id: string;
  title: string;
  description?: string;
  interestId?: string;
  interestFit?: string;
  whyItFits?: string;
  fitReason?: string;
  venue?: Venue;
  address?: string;
  startDateTime?: string;
  endDateTime?: string;
  operatingHours?: OperatingHours;
  uniquenessReason?: string;
  tags?: string[];
  touristTrap: number;
  sources: Source[];
  price?: Price;
  languages?: string[];
  confidence?: number;
};

type RecsResult = {
  tripId?: string;
  destination?: string;
  dates?: { start?: string; end?: string };
  recommendations?: Recommendation[];
  generatedAt?: string;
};

const stepOrder: Step[] = ["calendar", "sources", "profiling", "editProfile", "trip", "recommendations"];

const stepLabels: Record<Step, string> = {
  calendar: "Connect",
  sources: "Data sources",
  profiling: "Profiling",
  editProfile: "Review profile",
  trip: "Trip details",
  recommendations: "Results",
};

const statusLabels: Record<RunStatus, string> = {
  queued: "Queued...",
  running: "Processing...",
  succeeded: "Completed! 🎉",
  failed: "Failed 😞",
};

export default function App() {
  const [step, setStep] = useState<Step>("calendar");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  // Profiling state
  const [profilingRunId, setProfilingRunId] = useState<string | null>(null);
  const [profilingStatus, setProfilingStatus] = useState<RunStatus | null>(null);
  const [profilingError, setProfilingError] = useState<string | null>(null);

  // Profile editing state
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Trip state
  const [destination, setDestination] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [tripError, setTripError] = useState<string | null>(null);
  const [tripSubmitting, setTripSubmitting] = useState(false);

  // Recommendations state
  const [recsRunId, setRecsRunId] = useState<string | null>(null);
  const [recsStatus, setRecsStatus] = useState<RunStatus | null>(null);
  const [recsResult, setRecsResult] = useState<RecsResult | null>(null);
  const [recsError, setRecsError] = useState<string | null>(null);

  // Voting state
  const [votes, setVotes] = useState<Record<string, VoteData>>({});
  const [votingInProgress, setVotingInProgress] = useState<Set<string>>(new Set());

  // Calendar integration state
  const [calendarLoading2, setCalendarLoading2] = useState(false);
  const [calendarResult, setCalendarResult] = useState<{
    calendarId: string;
    calendarName: string;
    eventsCreated: number;
    calendarLink: string;
  } | null>(null);
  const [calendarAddError, setCalendarAddError] = useState<string | null>(null);

  // Invite state
  const [inviteTripId, setInviteTripId] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<TripInviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [joiningTrip, setJoiningTrip] = useState(false);

  const activeStepIndex = stepOrder.indexOf(step);

  const canAdvanceToProfiling = selectedSources.length > 0;
  const isTripValid =
    destination.trim().length > 2 &&
    dateRange.start.length > 0 &&
    dateRange.end.length > 0 &&
    dateRange.start <= dateRange.end;

  const selectedSourceLabels = useMemo(() => {
    return dataSourceOptions
      .filter((option) => selectedSources.includes(option.id))
      .map((option) => option.label);
  }, [selectedSources]);

  // Check for invite URL and alias param on mount
  const [shouldCreateAlias, setShouldCreateAlias] = useState(false);
  
  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    // Check for ?alias=true (hidden feature for testing)
    if (params.get("alias") === "true") {
      setShouldCreateAlias(true);
      // Clean URL
      window.history.replaceState({}, "", path);
    }
    
    // Check for invite URL
    const match = path.match(/^\/invite\/([a-f0-9-]+)$/i);
    
    if (match) {
      const tripId = match[1];
      setInviteTripId(tripId);
      setInviteLoading(true);
      
      getTripInviteInfo(tripId)
        .then((info) => {
          setInviteInfo(info);
        })
        .catch((err) => {
          console.error("[Invite] Error:", err);
          setInviteError((err as Error).message);
        })
        .finally(() => {
          setInviteLoading(false);
        });
    }
  }, []);

  // Subscribe to profiling run updates
  useEffect(() => {
    if (!profilingRunId) return;

    const handleUpdate = (update: RunUpdate) => {
      console.log("[App] Profiling update:", update);
      setProfilingStatus(update.status);

      if (update.status === "succeeded" && update.result) {
        // Profile is ready, move to edit step
        const profile = (update.result as { profile?: ProfileData }).profile;
        if (profile) {
          setProfileData(profile);
          setStep("editProfile");
        }
      }

      if (update.status === "failed") {
        setProfilingError(update.error ?? "Profiling failed");
      }
    };

    const unsubscribe = wsClient.subscribeToRun(profilingRunId, handleUpdate);
    return () => unsubscribe();
  }, [profilingRunId]);

  // Subscribe to recommendations run updates
  useEffect(() => {
    if (!recsRunId) return;

    const handleUpdate = (update: RunUpdate) => {
      console.log("[App] Recommendations update:", update);
      setRecsStatus(update.status);

      if (update.status === "succeeded" && update.result) {
        setRecsResult(update.result as RecsResult);
      }

      if (update.status === "failed") {
        setRecsError(update.error ?? "Recommendations failed");
      }
    };

    const unsubscribe = wsClient.subscribeToRun(recsRunId, handleUpdate);
    return () => unsubscribe();
  }, [recsRunId]);

  // Load votes when recommendations are loaded
  useEffect(() => {
    if (!sessionToken || !recsResult?.recommendations) return;

    const recIds = recsResult.recommendations.map((r) => r.id).filter(Boolean);
    if (recIds.length === 0) return;

    getVotesBatch(sessionToken, recIds)
      .then((votesData) => {
        setVotes(votesData);
      })
      .catch((err) => {
        console.error("[Votes] Failed to load votes:", err);
      });
  }, [sessionToken, recsResult]);

  const handleGoogleLogin = async () => {
    setCalendarError(null);
    setCalendarLoading(true);

    try {
      // 1. Request access token with all scopes (profile + calendar)
      console.log("[Auth] Requesting Google access token...");
      const accessToken = await requestGoogleAccessToken();
      console.log("[Auth] Got access token");

      // 2. Fetch user info from Google
      console.log("[Auth] Fetching user info...");
      const googleUser = await fetchGoogleUserInfo(accessToken);
      console.log("[Auth] Got user info:", googleUser.email);

      // 3. Login to our backend (createAlias from URL param ?alias=true)
      const response = await loginWithGoogle({
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        createAlias: shouldCreateAlias,
      });

      setSessionToken(response.token);
      setUser(response.user);

      // Reset alias flag after use
      if (shouldCreateAlias) {
        setShouldCreateAlias(false);
      }

      // 4. If this is an invite flow, join the trip
      if (inviteTripId && inviteInfo) {
        await handleJoinTrip(response.token);
        return;
      }

      // 5. Check if user already has a profile (skip for alias - always fresh)
      if (!shouldCreateAlias) {
        const existingProfile = await getProfile(response.token);
        if (existingProfile) {
          setProfileData(existingProfile.profileData as ProfileData);
          setStep("editProfile");
          return;
        }
      }
      
      setStep("sources");
    } catch (error) {
      console.error("Google login failed", error);
      setCalendarError((error as Error).message ?? "Could not connect. Please try again.");
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleJoinTrip = async (token: string) => {
    if (!inviteTripId) return;

    setJoiningTrip(true);
    setInviteError(null);

    try {
      const result = await joinTrip(token, inviteTripId);
      console.log("[Invite] Joined trip:", result);

      // Clear invite state and redirect to recommendations
      setInviteTripId(null);
      setInviteInfo(null);
      
      // Update URL to remove /invite
      window.history.replaceState({}, "", "/");

      // Set destination from invite info
      if (inviteInfo) {
        setDestination(inviteInfo.destination);
        if (inviteInfo.startDate) {
          setDateRange((prev) => ({ ...prev, start: inviteInfo.startDate! }));
        }
        if (inviteInfo.endDate) {
          setDateRange((prev) => ({ ...prev, end: inviteInfo.endDate! }));
        }
      }

      // Start fetching recommendations for the trip
      // For now, go to trip step - in future could load existing recs
      setStep("trip");
    } catch (err) {
      console.error("[Invite] Join failed:", err);
      setInviteError((err as Error).message);
    } finally {
      setJoiningTrip(false);
    }
  };

  const toggleDataSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const handleStartProfiling = async () => {
    if (!sessionToken) return;

    setProfilingError(null);
    setStep("profiling");

    try {
      const runId = await startProfilingRun(sessionToken);
      setProfilingRunId(runId);
      setProfilingStatus("queued");
    } catch (error) {
      console.error("Failed to start profiling", error);
      setProfilingError("Failed to start profiling. Please try again.");
    }
  };

  const handleSaveProfile = async () => {
    if (!sessionToken || !profileData) return;

    setProfileSaving(true);
    try {
      await updateProfile(sessionToken, profileData);
      setStep("trip");
    } catch (error) {
      console.error("Failed to save profile", error);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleTripSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTripError(null);

    if (!sessionToken) {
      setTripError("Session expired. Please reconnect.");
      setStep("calendar");
      return;
    }

    if (!isTripValid) {
      setTripError("Destination and both dates are required.");
      return;
    }

    setTripSubmitting(true);
    try {
      const runId = await startRecommendationsRun(sessionToken, {
        location: destination.trim(),
        startDate: dateRange.start,
        endDate: dateRange.end,
      });

      setRecsRunId(runId);
      setRecsStatus("queued");
      setStep("recommendations");
    } catch (error) {
      console.error("Trip submission failed", error);
      setTripError("Unable to start recommendations. Try again.");
    } finally {
      setTripSubmitting(false);
    }
  };

  const updateInterest = (index: number, field: string, value: string | number) => {
    if (!profileData?.interests) return;

    const updated = [...profileData.interests];
    updated[index] = { ...updated[index], [field]: value };
    setProfileData({ ...profileData, interests: updated });
  };

  const removeInterest = (index: number) => {
    if (!profileData?.interests) return;

    const updated = profileData.interests.filter((_, i) => i !== index);
    setProfileData({ ...profileData, interests: updated });
  };

  const addInterest = () => {
    const newInterest = {
      id: `custom-${Date.now()}`,
      label: "New interest",
      description: "",
      tags: [],
      weight: 0.5,
    };

    setProfileData({
      ...profileData,
      interests: [...(profileData?.interests ?? []), newInterest],
    });
  };

  const handleVote = async (recommendationId: string, voteType: -1 | 1) => {
    if (!sessionToken || votingInProgress.has(recommendationId)) return;

    setVotingInProgress((prev) => new Set(prev).add(recommendationId));

    try {
      const currentVote = votes[recommendationId]?.userVote;
      
      let result: VoteData;
      if (currentVote === voteType) {
        // Clicking same vote again = remove vote
        result = await removeVote(sessionToken, recommendationId);
      } else {
        // Cast new vote
        const response = await castVote(sessionToken, recommendationId, voteType);
        result = {
          score: response.score,
          upvotes: response.upvotes,
          downvotes: response.downvotes,
          userVote: response.userVote,
        };
      }

      setVotes((prev) => ({
        ...prev,
        [recommendationId]: result,
      }));
    } catch (err) {
      console.error("[Vote] Failed:", err);
    } finally {
      setVotingInProgress((prev) => {
        const next = new Set(prev);
        next.delete(recommendationId);
        return next;
      });
    }
  };

  const handleAddToCalendar = async () => {
    if (!sessionToken || !recsResult?.recommendations) return;

    setCalendarLoading2(true);
    setCalendarAddError(null);
    setCalendarResult(null);

    try {
      // Use cached access token from login (already has calendar scope)
      let accessToken = getCachedAccessToken();
      
      if (!accessToken) {
        console.log("[Calendar] No cached token, requesting new one...");
        accessToken = await requestGoogleAccessToken();
      }
      
      // Filter events with fixed dates
      const eventsWithDates: RecommendationEvent[] = recsResult.recommendations
        .filter((rec): rec is Recommendation & { startDateTime: string } => 
          rec.type === "event" && !!rec.startDateTime
        )
        .map((rec) => ({
          id: rec.id,
          title: rec.title,
          description: rec.description || rec.interestFit || rec.whyItFits,
          venue: rec.venue,
          address: rec.address,
          startDateTime: rec.startDateTime,
          endDateTime: rec.endDateTime,
        }));

      if (eventsWithDates.length === 0) {
        setCalendarAddError("No events with fixed dates to add");
        return;
      }

      console.log(`[Calendar] Adding ${eventsWithDates.length} events to calendar...`);
      
      const result = await addRecommendationsToCalendar(
        sessionToken,
        accessToken,
        destination,
        eventsWithDates,
      );

      console.log("[Calendar] Success:", result);
      setCalendarResult({
        calendarId: result.calendar.id,
        calendarName: result.calendar.name,
        eventsCreated: result.eventsCreated,
        calendarLink: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(result.calendar.id)}`,
      });
    } catch (error) {
      console.error("[Calendar] Error:", error);
      setCalendarAddError((error as Error).message);
    } finally {
      setCalendarLoading2(false);
    }
  };

  const renderStep = () => {
    // Invite flow - show invite page
    if (inviteTripId && !sessionToken) {
      if (inviteLoading) {
        return (
          <section className="panel invite-panel">
            <h2>Loading invitation...</h2>
          </section>
        );
      }

      if (inviteError) {
        return (
          <section className="panel invite-panel">
            <h2>Invitation not found 😞</h2>
            <p>{inviteError}</p>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setInviteTripId(null);
                setInviteError(null);
                window.history.replaceState({}, "", "/");
              }}
            >
              Go to homepage
            </button>
          </section>
        );
      }

      if (inviteInfo) {
        return (
          <section className="panel invite-panel">
            <div className="invite-header">
              {inviteInfo.owner?.picture && (
                <img src={inviteInfo.owner.picture} alt="" className="invite-owner-pic" />
              )}
              <h2>You're invited! 🎉</h2>
            </div>
            <p className="invite-message">
              <strong>{inviteInfo.owner?.name || "Someone"}</strong> invites you to join their trip to
            </p>
            <div className="invite-destination">
              <span className="invite-city">{inviteInfo.destination}</span>
              {inviteInfo.country && <span className="invite-country">{inviteInfo.country}</span>}
            </div>
            {(inviteInfo.startDate || inviteInfo.endDate) && (
              <div className="invite-dates">
                📅 {inviteInfo.startDate && new Date(inviteInfo.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {inviteInfo.startDate && inviteInfo.endDate && " → "}
                {inviteInfo.endDate && new Date(inviteInfo.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            )}
            <p className="invite-tagline">Find the best places together.</p>
            <div className="google-login-section">
              <button
                className="google-login-btn"
                type="button"
                disabled={calendarLoading || joiningTrip}
                onClick={handleGoogleLogin}
              >
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {calendarLoading || joiningTrip ? "Joining..." : "Join with Google"}
              </button>
            </div>
            {calendarError && <div className="feedback error">{calendarError}</div>}
          </section>
        );
      }
    }

    if (step === "calendar") {
      return (
        <section className="panel">
          <h2>Connect your Google account</h2>
          <p>
            Sign in with Google to get personalized recommendations. 
            We'll also request access to your calendar to add trip events.
          </p>
          <div className="google-login-section">
            <button
              className="google-login-btn"
              type="button"
              disabled={calendarLoading}
              onClick={handleGoogleLogin}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {calendarLoading ? "Connecting..." : "Continue with Google"}
            </button>
            <p className="login-hint">
              🔒 We request profile and calendar access in one step
            </p>
          </div>
          {calendarError && <div className="feedback error">{calendarError}</div>}
        </section>
      );
    }

    if (step === "sources") {
      return (
        <section className="panel">
          <h2>Select your data sources</h2>
          <p>We'll analyze these to understand your interests.</p>
          {user && (
            <div className="user-badge">
              {user.picture && <img src={user.picture} alt="" className="user-avatar" />}
              <span>{user.email ?? user.name}</span>
            </div>
          )}
          <div className="data-source-grid">
            {dataSourceOptions.map((option) => {
              const isSelected = selectedSources.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`data-source-card${isSelected ? " is-selected" : ""}`}
                  style={{ color: option.accent }}
                  onClick={() => toggleDataSource(option.id)}
                >
                  <span className="data-source-label">
                    {option.label}
                    <span>{isSelected ? "✓" : "+"}</span>
                  </span>
                  <span className="data-source-description">{option.description}</span>
                </button>
              );
            })}
          </div>
          <div className="cta-bar">
            <button
              className="button primary"
              type="button"
              disabled={!canAdvanceToProfiling}
              onClick={handleStartProfiling}
            >
              Start profiling
            </button>
          </div>
        </section>
      );
    }

    if (step === "profiling") {
      return (
        <section className="panel">
          <h2>Analyzing your data...</h2>
          <p>Our AI is building your interest profile. This may take a minute.</p>
          <div className="run-status-card">
            {profilingStatus && (
              <div className={`run-status status-${profilingStatus}`}>
                {statusLabels[profilingStatus]}
              </div>
            )}
            {profilingStatus === "running" && (
              <div className="run-progress">
                <div className="progress-bar">
                  <div className="progress-fill" />
                </div>
              </div>
            )}
            {profilingError && <div className="feedback error">{profilingError}</div>}
          </div>
        </section>
      );
    }

    if (step === "editProfile") {
      return (
        <section className="panel">
          <h2>Review your profile</h2>
          <p>We've analyzed your data. Edit anything that doesn't look right.</p>

          {profileData?.identity?.bioSummary && (
            <div className="profile-section">
              <h3>About you</h3>
              <textarea
                className="profile-bio"
                value={profileData.identity.bioSummary}
                onChange={(e) =>
                  setProfileData({
                    ...profileData,
                    identity: { ...profileData.identity, bioSummary: e.target.value },
                  })
                }
                rows={3}
              />
            </div>
          )}

          <div className="profile-section">
              <h3>Your interests</h3>
              <div className="interests-list">
                {(profileData?.interests ?? []).map((interest, index) => (
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
                      onChange={(e) => updateInterest(index, "description", e.target.value)}
                      rows={2}
                      placeholder="Describe this interest..."
                    />
                    {interest.tags && interest.tags.length > 0 && (
                      <div className="interest-tags">
                        {interest.tags.map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
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
                {(profileData?.interests ?? []).length === 0 && (
                  <p className="no-interests">No interests yet. Add some to get personalized recommendations!</p>
                )}
                <button type="button" className="add-interest-btn" onClick={addInterest}>
                  + Add interest
                </button>
              </div>
            </div>

          <div className="cta-bar">
            <button
              className="button secondary"
              type="button"
              onClick={() => setStep("sources")}
            >
              Re-profile
            </button>
            <button
              className="button primary"
              type="button"
              disabled={profileSaving}
              onClick={handleSaveProfile}
            >
              {profileSaving ? "Saving..." : "Looks good, continue"}
            </button>
          </div>
        </section>
      );
    }

    if (step === "trip") {
      return (
        <section className="panel">
          <h2>Where are you going?</h2>
          <p>Tell us about your trip and we'll find the best experiences.</p>
          <form className="trip-form" onSubmit={handleTripSubmit}>
            <div className="form-field">
              <label htmlFor="destination">Destination</label>
              <input
                id="destination"
                name="destination"
                placeholder="Berlin, Tallinn, Bali..."
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="startDate">Start date</label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="endDate">End date</label>
                <input
                  id="endDate"
                  name="endDate"
                  type="date"
                  min={dateRange.start}
                  value={dateRange.end}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                  required
                />
              </div>
            </div>
            {selectedSourceLabels.length > 0 && (
              <div className="feedback success">
                Profile based on: {selectedSourceLabels.join(", ")}
              </div>
            )}
            {tripError && <div className="feedback error">{tripError}</div>}
            <div className="cta-bar">
              <button
                className="button secondary"
                type="button"
                onClick={() => setStep("editProfile")}
              >
                Edit profile
              </button>
              <button
                className="button primary"
                type="submit"
                disabled={!isTripValid || tripSubmitting}
              >
                {tripSubmitting ? "Starting..." : "Get recommendations"}
              </button>
            </div>
          </form>
        </section>
      );
    }

    // recommendations step
    if (recsStatus === "succeeded" && recsResult?.recommendations) {
      const inviteUrl = recsResult.tripId 
        ? `${window.location.origin}/invite/${recsResult.tripId}`
        : null;

      return (
        <section className="panel success-panel">
          <h2>Your {destination} experiences 🎉</h2>
          <p className="recs-subtitle">
            {recsResult.dates?.start && recsResult.dates?.end && (
              <span>
                📅 {new Date(recsResult.dates.start).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                {" → "}
                {new Date(recsResult.dates.end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </p>
          
          {/* Invite friends section */}
          {inviteUrl && (
            <div className="invite-section">
              <h3>👥 Invite friends</h3>
              <p>Share this link to plan together:</p>
              <div className="invite-link-box">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="invite-link-input"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  className="button secondary copy-btn"
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    // Could add a toast here
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="recommendations-grid">
            {recsResult.recommendations.map((rec, index) => (
              <div key={rec.id || index} className={`recommendation-card rec-type-${rec.type}`}>
                {/* Vote controls - top right */}
                <div className="vote-controls">
                  <button
                    className={`vote-btn upvote ${votes[rec.id]?.userVote === 1 ? "active" : ""}`}
                    onClick={() => handleVote(rec.id, 1)}
                    disabled={votingInProgress.has(rec.id)}
                    title="Upvote"
                  >
                    ▲
                  </button>
                  <span className={`vote-score ${(votes[rec.id]?.score ?? 0) > 0 ? "positive" : (votes[rec.id]?.score ?? 0) < 0 ? "negative" : ""}`}>
                    {votes[rec.id]?.score ?? 0}
                  </span>
                  <button
                    className={`vote-btn downvote ${votes[rec.id]?.userVote === -1 ? "active" : ""}`}
                    onClick={() => handleVote(rec.id, -1)}
                    disabled={votingInProgress.has(rec.id)}
                    title="Downvote"
                  >
                    ▼
                  </button>
                </div>
                
                <span className={`rec-type-badge ${rec.type}`}>
                  {rec.type === "event" ? "🎫 Event" : "📍 Location"}
                </span>
                <h3 className="rec-title">{rec.title}</h3>
                
                {/* Venue / Address */}
                {rec.venue && (
                  <div className="rec-venue">
                    <strong>{rec.venue.name}</strong>
                    {rec.venue.neighborhood && <span className="rec-neighborhood"> · {rec.venue.neighborhood}</span>}
                    <div className="rec-address">{rec.venue.address}</div>
                  </div>
                )}
                {!rec.venue && rec.address && (
                  <div className="rec-address">📍 {rec.address}</div>
                )}
                
                {/* Date/Time for events */}
                {rec.type === "event" && rec.startDateTime && (
                  <div className="rec-datetime">
                    🗓️ {new Date(rec.startDateTime).toLocaleDateString("en-GB", { 
                      weekday: "short", day: "numeric", month: "short", year: "numeric" 
                    })}
                    {" "}
                    🕐 {new Date(rec.startDateTime).toLocaleTimeString("en-GB", { 
                      hour: "2-digit", minute: "2-digit" 
                    })}
                    {rec.endDateTime && (
                      <span> → {new Date(rec.endDateTime).toLocaleTimeString("en-GB", { 
                        hour: "2-digit", minute: "2-digit" 
                      })}</span>
                    )}
                  </div>
                )}
                
                {/* Operating hours for locations */}
                {rec.type === "location" && rec.operatingHours && (
                  <div className="rec-hours">🕐 {rec.operatingHours.summary}</div>
                )}
                
                {/* Tourist Trap / Hidden Gem indicator */}
                <div className="rec-trap-score">
                  <div className="trap-bar">
                    <div 
                      className="trap-fill gem" 
                      style={{ width: `${100 - rec.touristTrap}%` }}
                    />
                    <div 
                      className="trap-fill trap" 
                      style={{ width: `${rec.touristTrap}%` }}
                    />
                  </div>
                  <div className="trap-labels">
                    <span className="gem-label">💎 Hidden Gem: {100 - rec.touristTrap}%</span>
                    <span className="trap-label">🎯 Tourist Trap: {rec.touristTrap}%</span>
                  </div>
                </div>
                
                {/* Description / Fit reason */}
                {(rec.description || rec.interestFit || rec.whyItFits || rec.fitReason) && (
                  <p className="rec-description">
                    {rec.description || rec.interestFit || rec.whyItFits || rec.fitReason}
                  </p>
                )}
                
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
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                )}
                
                {/* Price */}
                {rec.price && (
                  <div className="rec-price">
                    💰 {rec.price.amount ? `${rec.price.amount} ${rec.price.currency || "EUR"}` : ""}
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
            ))}
          </div>
          <div className="calendar-section">
            <h3>📅 Add Events to Google Calendar</h3>
            {!calendarResult ? (
              <>
                <p>
                  Add all {recsResult.recommendations.filter(r => r.type === "event" && r.startDateTime).length} events 
                  with fixed dates to your Google Calendar.
                </p>
                <button
                  className="button primary"
                  type="button"
                  disabled={calendarLoading2}
                  onClick={handleAddToCalendar}
                >
                  {calendarLoading2 ? "Adding events..." : "🎫 Add All Events to Calendar"}
                </button>
                {calendarAddError && <div className="feedback error">{calendarAddError}</div>}
              </>
            ) : (
              <div className="calendar-success">
                <p>✅ Calendar "{calendarResult.calendarName}" created with {calendarResult.eventsCreated} events!</p>
                <a
                  href={calendarResult.calendarLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary"
                >
                  Open Calendar in Google →
                </a>
              </div>
            )}
          </div>

          <div className="cta-bar">
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setRecsResult(null);
                setRecsStatus(null);
                setRecsRunId(null);
                setCalendarResult(null);
                setCalendarAddError(null);
                setStep("trip");
              }}
            >
              Plan another trip
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="panel">
        <h2>Finding experiences for you 🔍</h2>
        <p>
          Our scout is searching for the best {destination} experiences based on your profile.
        </p>
        <div className="run-status-card">
          {recsStatus && (
            <div className={`run-status status-${recsStatus}`}>
              {statusLabels[recsStatus]}
            </div>
          )}
          {recsStatus === "running" && (
            <div className="run-progress">
              <div className="progress-bar">
                <div className="progress-fill" />
              </div>
            </div>
          )}
          {recsError && <div className="feedback error">{recsError}</div>}
        </div>
        <div className="cta-bar">
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setRecsResult(null);
              setRecsStatus(null);
              setRecsRunId(null);
              setRecsError(null);
              setStep("trip");
            }}
          >
            ← Back to trip details
          </button>
        </div>
      </section>
    );
  };

  return (
    <div className="app-shell">
      <div className="app-card">
        <header className="app-header">
          <h1 className="app-title">Weekend Scout</h1>
          <p className="app-subtitle">
            Connect your accounts, let us understand your vibe, then get personalized
            recommendations for your next trip.
          </p>
          <ol className="stepper">
            {stepOrder.map((item, index) => (
              <li
                key={item}
                className={`step${index < activeStepIndex ? " is-complete" : ""}${
                  index === activeStepIndex ? " is-active" : ""
                }`}
              >
                {stepLabels[item]}
              </li>
            ))}
          </ol>
        </header>
        {renderStep()}
      </div>
    </div>
  );
}
