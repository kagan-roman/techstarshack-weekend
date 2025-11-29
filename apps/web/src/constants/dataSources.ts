export type DataSourceOption = {
  id: string;
  label: string;
  description: string;
  accent: string;
};

export const dataSourceOptions: DataSourceOption[] = [
  {
    id: "music",
    label: "Spotify",
    description: "Playlists and listening history",
    accent: "#1db954",
  },
  {
    id: "video",
    label: "YouTube",
    description: "Watch history and saved clips",
    accent: "#ff0000",
  },
  {
    id: "reels",
    label: "Instagram",
    description: "Saved reels and travel posts",
    accent: "#f77737",
  },
  {
    id: "events",
    label: "Facebook",
    description: "Events, RSVPs and groups",
    accent: "#1778f2",
  },
  {
    id: "audio",
    label: "SoundCloud",
    description: "Liked tracks and reposts",
    accent: "#ff5500",
  },
  {
    id: "reading",
    label: "Pocket",
    description: "Saved articles for inspiration",
    accent: "#ef4056",
  },
];

