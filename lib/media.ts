export type MediaType = "movie" | "series" | "anime" | "manga";
export type MediaStatus = "watching" | "watch_later" | "completed" | "on_hold";

export type SearchItem = {
  source: "tmdb" | "anilist";
  external_id: string;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
};

export type SavedMedia = {
  id: string;
  user_id: string;
  source: string;
  external_id: string | null;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  status: MediaStatus;
  current_season: number | null;
  last_watched_episode: number | null;
  total_episodes: number | null;
  current_volume: number | null;
  last_read_chapter: number | null;
  total_chapters: number | null;
  total_volumes: number | null;
  movie_progress_seconds: number | null;
  runtime_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function posterUrl(path: string | null) {
  if (!path) return "";
  if (path.startsWith("https://")) return path;
  if (path.startsWith("/")) return `https://image.tmdb.org/t/p/w500${path}`;
  return "";
}
