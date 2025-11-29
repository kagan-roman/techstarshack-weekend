import { clientEnv } from "../config/env";

/**
 * Google OAuth2 - unified auth for login + calendar access
 * Requests both profile and calendar scopes in one flow
 */

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string; message: string }) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

// Scopes: profile info + calendar access
const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

let tokenClient: TokenClient | null = null;
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((error: Error) => void) | null = null;

// Store the access token for reuse
let cachedAccessToken: string | null = null;

/**
 * Load the Google OAuth2 script if not already loaded
 */
function loadGoogleOAuth2Script(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.google?.accounts?.oauth2) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Google OAuth2 script load timeout"));
      }, 10000);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setTimeout(() => {
        if (window.google?.accounts?.oauth2) {
          resolve();
        } else {
          reject(new Error("Google OAuth2 not available after script load"));
        }
      }, 100);
    };
    script.onerror = () => reject(new Error("Failed to load Google OAuth2 script"));
    document.body.appendChild(script);
  });
}

/**
 * Initialize the token client with all scopes
 */
function initTokenClient(): TokenClient {
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google OAuth2 not loaded");
  }

  return window.google.accounts.oauth2.initTokenClient({
    client_id: clientEnv.calendarClientId,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        pendingReject?.(new Error(response.error_description ?? response.error));
        pendingResolve = null;
        pendingReject = null;
        return;
      }

      if (response.access_token) {
        cachedAccessToken = response.access_token;
        pendingResolve?.(response.access_token);
        pendingResolve = null;
        pendingReject = null;
      } else {
        pendingReject?.(new Error("No access token in response"));
        pendingResolve = null;
        pendingReject = null;
      }
    },
    error_callback: (error) => {
      pendingReject?.(new Error(error.message ?? "OAuth error"));
      pendingResolve = null;
      pendingReject = null;
    },
  });
}

/**
 * Request access token with all scopes (profile + calendar)
 * This is the main entry point for login
 */
export async function requestGoogleAccessToken(): Promise<string> {
  await loadGoogleOAuth2Script();

  if (!tokenClient) {
    tokenClient = initTokenClient();
  }

  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;

    // Request the token - this will open a popup
    tokenClient!.requestAccessToken({ prompt: "" });
  });
}

/**
 * Get cached access token (for calendar operations after login)
 */
export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

/**
 * Fetch user profile from Google using access token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture: string;
}> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user info from Google");
  }

  const data = await response.json();
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

// Keep backward compatibility
export const requestCalendarAccessToken = requestGoogleAccessToken;
