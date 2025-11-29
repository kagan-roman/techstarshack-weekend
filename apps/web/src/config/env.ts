const calendarClientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!calendarClientId) {
  throw new Error("VITE_GOOGLE_OAUTH_CLIENT_ID is required");
}

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is required");
}

export const clientEnv = Object.freeze({
  calendarClientId,
  apiBaseUrl,
});

