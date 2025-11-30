import { useState } from "react";

type Props = {
  tripId: string;
};

export function InviteSection({ tripId }: Props) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}/invite/${tripId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
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
          onClick={handleCopy}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

