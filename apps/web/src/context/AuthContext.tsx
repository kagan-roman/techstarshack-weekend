import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { loginWithGoogle, getProfile, type GoogleUserPayload } from "../lib/api";
import { requestGoogleAccessToken, fetchGoogleUserInfo } from "../lib/googleOAuth";

export type UserInfo = {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
};

export type ProfileData = {
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

type AuthContextType = {
  user: UserInfo | null;
  token: string | null;
  profile: ProfileData | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
  setProfile: (profile: ProfileData | null) => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for alias param on mount
  const [createAlias, setCreateAlias] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("alias") === "true") {
      setCreateAlias(true);
      // Clean URL
      const path = window.location.pathname;
      window.history.replaceState({}, "", path);
    }
  }, []);

  const login = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const accessToken = await requestGoogleAccessToken();
      const googleUser = await fetchGoogleUserInfo(accessToken);

      const response = await loginWithGoogle({
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        createAlias,
      });

      setToken(response.token);
      setUser(response.user);

      // Reset alias flag
      if (createAlias) {
        setCreateAlias(false);
      }

      // Try to load existing profile
      if (!createAlias) {
        try {
          const existingProfile = await getProfile(response.token);
          if (existingProfile) {
            setProfile(existingProfile.profileData as ProfileData);
          }
        } catch {
          // No profile yet, that's ok
        }
      }
    } catch (err) {
      console.error("[Auth] Login failed:", err);
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const existingProfile = await getProfile(token);
      if (existingProfile) {
        setProfile(existingProfile.profileData as ProfileData);
      }
    } catch {
      // No profile yet
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        profile,
        isAuthenticated: !!token,
        isLoading,
        error,
        login,
        logout,
        setProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

