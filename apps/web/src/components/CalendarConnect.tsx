import { useEffect, useRef, useState } from "react";
import { clientEnv } from "../config/env";

type CalendarConnectProps = {
  disabled?: boolean;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            cancel_on_tap_outside?: boolean;
            ux_mode?: "popup" | "redirect";
          }) => void;
          renderButton: (
            container: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              width?: number;
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
            },
          ) => void;
          prompt: VoidFunction;
        };
      };
    };
  }
}

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export function CalendarConnect({ disabled, onCredential, onError }: CalendarConnectProps) {
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.google?.accounts?.id),
  );
  const [scriptFailed, setScriptFailed] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scriptReady) {
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_SCRIPT_SRC}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => setScriptReady(true), { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          setScriptFailed(true);
          onError("Calendar widget failed to load.");
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptReady(true);
    script.onerror = () => {
      setScriptFailed(true);
      onError("Calendar widget failed to load.");
    };
    document.body.appendChild(script);
  }, [scriptReady, onError]);

  useEffect(() => {
    if (!scriptReady || scriptFailed) {
      return;
    }
    const api = window.google?.accounts?.id;
    if (!api || !buttonRef.current) {
      return;
    }

    api.initialize({
      client_id: clientEnv.calendarClientId,
      callback: (response) => {
        if (response.credential) {
          onCredential(response.credential);
        } else {
          onError("Calendar provider did not return a credential.");
        }
      },
      cancel_on_tap_outside: false,
      ux_mode: "popup",
    });

    api.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      width: 340,
      text: "continue_with",
    });

    api.prompt();
  }, [scriptReady, scriptFailed, onCredential, onError]);

  return (
    <div
      className="calendar-connect"
      data-state={disabled ? "disabled" : scriptReady ? "ready" : "loading"}
    >
      <div ref={buttonRef} style={{ pointerEvents: disabled ? "none" : "auto", opacity: disabled ? 0.6 : 1 }} />
      {!scriptReady && !scriptFailed && <p>Loading Google widget…</p>}
      {scriptFailed && (
        <button
          className="button secondary"
          type="button"
          onClick={() => window.location.reload()}
        >
          Reload calendar connect
        </button>
      )}
    </div>
  );
}

