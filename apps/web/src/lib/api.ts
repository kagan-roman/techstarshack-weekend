import { clientEnv } from "../config/env";

type GoogleLoginResponse = {
  token: string;
  user: {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
  };
};

type RunResponse = {
  runId: string;
};

type ProfileResponse = {
  id: string;
  version: number;
  profileData: Record<string, unknown>;
  createdAt: string;
};

export type GoogleUserPayload = {
  googleId: string;
  email?: string;
  name?: string;
  picture?: string;
  createAlias?: boolean; // For testing - creates new user even if exists
};

export async function loginWithGoogle(payload: GoogleUserPayload): Promise<GoogleLoginResponse> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to authenticate with Google");
  }

  const data = (await response.json()) as GoogleLoginResponse;
  if (!data.token) {
    throw new Error("Session token is missing in the response");
  }

  return data;
}

// Start profiling run
export async function startProfilingRun(token: string): Promise<string> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/profiling/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error("Failed to start profiling run");
  }

  const data = (await response.json()) as RunResponse;
  return data.runId;
}

// Get latest profile
export async function getProfile(token: string): Promise<ProfileResponse | null> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/profiling/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch profile");
  }

  return (await response.json()) as ProfileResponse;
}

// Update profile
export async function updateProfile(
  token: string,
  profileData: Record<string, unknown>,
): Promise<ProfileResponse> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/profiling/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ profileData }),
  });

  if (!response.ok) {
    throw new Error("Failed to update profile");
  }

  return (await response.json()) as ProfileResponse;
}

// Start recommendations run
export async function startRecommendationsRun(
  token: string,
  payload: { location: string; startDate: string; endDate: string },
): Promise<string> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/recommendations/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to start recommendations run");
  }

  const data = (await response.json()) as RunResponse;
  return data.runId;
}

// Calendar API types
type CalendarTestResponse = {
  success: boolean;
  calendar: {
    id: string;
    name: string;
  };
  event: {
    id: string;
    title: string;
    link: string;
  };
};

type CalendarEventPayload = {
  summary: string;
  description?: string;
  location?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
};

type AddEventResponse = {
  success: boolean;
  event: {
    id: string;
    title: string;
    link: string;
  };
};

// Test calendar integration - creates a calendar and test event
export async function testCalendarIntegration(
  token: string,
  googleAccessToken: string,
  options?: {
    calendarName?: string;
    eventTitle?: string;
    eventDate?: string;
  },
): Promise<CalendarTestResponse> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/calendar/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      accessToken: googleAccessToken,
      ...options,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((error as { error?: string }).error ?? "Failed to test calendar");
  }

  return (await response.json()) as CalendarTestResponse;
}

// Add event to a specific calendar
export async function addEventToCalendar(
  token: string,
  googleAccessToken: string,
  calendarId: string,
  event: CalendarEventPayload,
): Promise<AddEventResponse> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/calendar/add-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      accessToken: googleAccessToken,
      calendarId,
      event,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((error as { error?: string }).error ?? "Failed to add event");
  }

  return (await response.json()) as AddEventResponse;
}

// Recommendation event for calendar
export type RecommendationEvent = {
  id: string;
  title: string;
  description?: string;
  venue?: { name: string; address?: string };
  address?: string;
  startDateTime: string;
  endDateTime?: string;
};

type AddRecommendationsResponse = {
  success: boolean;
  calendar: {
    id: string;
    name: string;
  };
  eventsCreated: number;
  events: Array<{
    id: string;
    title: string;
    link: string;
    originalId: string;
  }>;
  errors?: Array<{ originalId: string; error: string }>;
};

// === VOTING API ===

export type VoteData = {
  score: number;
  upvotes: number;
  downvotes: number;
  userVote: -1 | 1 | null;
};

type CastVoteResponse = {
  success: boolean;
  score: number;
  upvotes: number;
  downvotes: number;
  userVote: -1 | 1;
};

type BatchVotesResponse = {
  votes: Record<string, VoteData>;
};

// Cast a vote (upvote or downvote)
export async function castVote(
  token: string,
  recommendationId: string,
  voteType: -1 | 1,
): Promise<CastVoteResponse> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/votes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recommendationId, voteType }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((error as { error?: string }).error ?? "Failed to vote");
  }

  return (await response.json()) as CastVoteResponse;
}

// Remove a vote
export async function removeVote(
  token: string,
  recommendationId: string,
): Promise<VoteData> {
  const response = await fetch(
    `${clientEnv.apiBaseUrl}/votes/${encodeURIComponent(recommendationId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((error as { error?: string }).error ?? "Failed to remove vote");
  }

  return (await response.json()) as VoteData;
}

// Get votes for multiple recommendations
export async function getVotesBatch(
  token: string,
  recommendationIds: string[],
): Promise<Record<string, VoteData>> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/votes/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ recommendationIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((error as { error?: string }).error ?? "Failed to get votes");
  }

  const data = (await response.json()) as BatchVotesResponse;
  return data.votes;
}

// === INVITE API ===

export type TripInviteInfo = {
  tripId: string;
  destination: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  owner: {
    name?: string;
    picture?: string;
  } | null;
};

export type JoinTripResponse = {
  success: boolean;
  alreadyMember: boolean;
  tripId: string;
  destination: string;
};

// Get public trip info for invite (no auth required)
export async function getTripInviteInfo(tripId: string): Promise<TripInviteInfo> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/invite/${tripId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Trip not found" }));
    throw new Error((error as { error?: string }).error ?? "Failed to get trip info");
  }

  return (await response.json()) as TripInviteInfo;
}

// Join a trip (requires auth)
export async function joinTrip(token: string, tripId: string): Promise<JoinTripResponse> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/invite/${tripId}/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to join" }));
    throw new Error((error as { error?: string }).error ?? "Failed to join trip");
  }

  return (await response.json()) as JoinTripResponse;
}

// Add all event recommendations to calendar
export async function addRecommendationsToCalendar(
  token: string,
  googleAccessToken: string,
  destination: string,
  events: RecommendationEvent[],
): Promise<AddRecommendationsResponse> {
  const response = await fetch(`${clientEnv.apiBaseUrl}/calendar/add-recommendations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      accessToken: googleAccessToken,
      calendarName: `Weekend Scout: ${destination}`,
      destination,
      events,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((error as { error?: string }).error ?? "Failed to add recommendations to calendar");
  }

  return (await response.json()) as AddRecommendationsResponse;
}
