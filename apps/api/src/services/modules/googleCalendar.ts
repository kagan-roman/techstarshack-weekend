/**
 * Google Calendar API service
 * Uses access tokens obtained via OAuth2 to create calendars and events
 */

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export type CalendarEvent = {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
};

export type CreatedCalendar = {
  id: string;
  summary: string;
};

export type CreatedEvent = {
  id: string;
  htmlLink: string;
  summary: string;
};

/**
 * Create a new calendar for the user
 */
export async function createCalendar(
  accessToken: string,
  summary: string,
  description?: string,
): Promise<CreatedCalendar> {
  const response = await fetch(`${CALENDAR_API_BASE}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary,
      description,
      timeZone: "UTC",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create calendar: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    summary: data.summary,
  };
}

/**
 * Create an event in a calendar
 */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent,
): Promise<CreatedEvent> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create event: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    htmlLink: data.htmlLink,
    summary: data.summary,
  };
}

/**
 * List user's calendars
 */
export async function listCalendars(accessToken: string) {
  const response = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list calendars: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.items ?? [];
}

