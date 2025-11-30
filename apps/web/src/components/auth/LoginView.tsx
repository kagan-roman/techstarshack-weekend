import { useAuth } from "../../context/AuthContext";
import { GoogleLoginButton } from "./GoogleLoginButton";

export function LoginView() {
  const { isLoading, error } = useAuth();

  return (
    <div className="auth-view">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Weekend Scout</h1>
          <p className="auth-subtitle">
            Discover experiences tailored to your interests.
            Plan trips together with friends.
          </p>
        </div>

        <div className="auth-content">
          <h2>Get started</h2>
          <p>Sign in with Google to begin your journey.</p>

          <GoogleLoginButton loading={isLoading} />

          <p className="auth-hint">
            🔒 We request profile and calendar access to personalize your experience
          </p>

          {error && <div className="feedback error">{error}</div>}
        </div>
      </div>
    </div>
  );
}

