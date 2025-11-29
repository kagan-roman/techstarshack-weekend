export type IdTokenPayload = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

export function decodeIdToken(token: string): IdTokenPayload {
  const segments = token.split(".");
  if (segments.length < 2) {
    throw new Error("Invalid ID token format");
  }

  const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  const json = window.atob(padded);
  const payload = JSON.parse(json) as IdTokenPayload;

  if (!payload.sub) {
    throw new Error("ID token payload is missing the subject");
  }

  return payload;
}

