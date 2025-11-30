import { useState } from "react";
import { dataSourceOptions } from "../../constants/dataSources";
import {
  SpotifyIcon,
  InstagramIcon,
  YouTubeIcon,
  TikTokIcon,
  RedditIcon,
  TwitterIcon,
  GoodreadsIcon,
  LetterboxdIcon,
  ManualIcon,
} from "../../assets/icons";

const iconMap: Record<string, React.FC> = {
  spotify: SpotifyIcon,
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
  reddit: RedditIcon,
  twitter: TwitterIcon,
  goodreads: GoodreadsIcon,
  letterboxd: LetterboxdIcon,
  manual: ManualIcon,
};

type Props = {
  selected: string[];
  onComplete: (sources: string[]) => void;
};

export function DataSourcesCard({ selected: initialSelected, onComplete }: Props) {
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  return (
    <div className="card sources-card">
      <h2>Select your data sources</h2>

      <div className="sources-grid">
        {dataSourceOptions.map((option) => {
          const isSelected = selected.includes(option.id);
          const Icon = iconMap[option.id];
          return (
            <button
              key={option.id}
              type="button"
              className={`source-tile${isSelected ? " is-selected" : ""}`}
              onClick={() => toggle(option.id)}
            >
              <div className="source-icon" style={{ color: option.accent }}>
                {Icon && <Icon />}
              </div>
              <span className="source-label">{option.label}</span>
              {isSelected && <span className="source-check">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="card-actions">
        <button
          className="button primary"
          disabled={selected.length === 0}
          onClick={() => onComplete(selected)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

