"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Film,
  Home,
  Library,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  Play,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Tv,
  X,
} from "lucide-react";

import QuickSearch from "@/components/QuickSearch";
import MediaSearch from "@/components/MediaSearch";
import AccountMenu from "@/components/AccountMenu";

import {
  posterUrl,
  type MediaStatus,
  type MediaType,
  type SavedMedia,
} from "@/lib/media";

import { getMyMedia, updateMedia } from "@/lib/media-store";
import { getWatchedEpisodes, setEpisodeWatched, setSeasonWatched, type WatchedEpisode } from "@/lib/episode-store";

type View =
  | "home"
  | "library"
  | "watch_later"
  | "completed"
  | "on_hold"
  | "search";

type Category = "all" | MediaType;
type Sort = "recent" | "title" | "year";

type MediaChanges = Parameters<typeof updateMedia>[1];

type SeasonInfo = { season_number: number; name: string; episode_count: number; air_date: string | null };
type EpisodeInfo = { id: number; episode_number: number; name: string; overview: string; air_date: string | null; runtime_minutes: number | null };
type ProviderDetails = {
  runtime_minutes?: number | null;
  total_episodes?: number | null;
  seasons?: SeasonInfo[];
  episodes?: EpisodeInfo[] | null;
  selected_season?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  publication_status?: string | null;
};



const navItems: {
  id: View;
  label: string;
  icon: typeof Home;
}[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "library", label: "Library", icon: Library },
  { id: "watch_later", label: "Watch Later", icon: Clock3 },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
  { id: "on_hold", label: "On Hold", icon: PauseCircle },
  { id: "search", label: "Search", icon: Search },
];

const categories: {
  id: Category;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "TV Series" },
  { id: "anime", label: "Anime" },
  { id: "manga", label: "Manga" },
];

const statuses: {
  id: MediaStatus;
  label: string;
}[] = [
  { id: "watching", label: "Watching" },
  { id: "watch_later", label: "Watch Later" },
  { id: "completed", label: "Completed" },
  { id: "on_hold", label: "On Hold" },
];

function getYear(item: SavedMedia) {
  return item.release_date?.slice(0, 4) || "—";
}

function isEpisodic(item: SavedMedia) {
  return item.media_type === "anime" || item.media_type === "series";
}

function getProgress(item: SavedMedia, watchedCount = 0) {
  if (item.status === "completed") return 100;

  if (item.media_type === "movie") {
    if (!item.runtime_minutes || item.runtime_minutes <= 0) return 0;
    return Math.min(100, Math.round(((item.movie_progress_seconds ?? 0) / (item.runtime_minutes * 60)) * 100));
  }

  if (item.media_type === "manga") {
    if (!item.total_chapters) return 0;

    return Math.min(
      100,
      Math.round(((item.last_read_chapter ?? 0) / item.total_chapters) * 100),
    );
  }

  if (!item.total_episodes) return 0;

  return Math.min(100, Math.round((watchedCount / item.total_episodes) * 100));
}

function getProgressLabel(item: SavedMedia) {
  if (item.status === "completed") {
    return "Completed";
  }

  if (item.media_type === "movie") {
    const seconds = item.movie_progress_seconds ?? 0;
    const minutes = Math.floor(seconds / 60);

    return minutes > 0 ? `${minutes} min watched` : "Not started";
  }

  if (item.media_type === "manga") {
    return `Chapter ${item.last_read_chapter ?? 0}`;
  }

  return `S${item.current_season ?? 1} · E${item.last_watched_episode ?? 0}`;
}

function MediaPoster({
  item,
  onClick,
  watchedCount,
}: {
  item: SavedMedia;
  onClick: () => void;
  watchedCount: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const poster = posterUrl(item.poster_path);
  const progress = getProgress(item, watchedCount);

  return (
    <button type="button" className="media-card" onClick={onClick}>
      <div className="poster-container">
        {poster && !imageFailed ? (
          <img
            src={poster}
            alt={item.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="poster-fallback">
            <Film size={28} />
            <span>{item.title}</span>
          </div>
        )}

        <span className="poster-type">{item.media_type}</span>
      </div>

      <div className="media-card-info">
        <div className="media-card-title">{item.title}</div>

        <div className="media-card-subtitle">{getProgressLabel(item)}</div>

        {item.status === "watching" && (
          <div className="media-progress-row">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span>{progress}%</span>
          </div>
        )}
      </div>
    </button>
  );
}

function MediaSection({
  title,
  items,
  onSelect,
  onSeeAll,
  watchedCounts,
}: {
  title: string;
  items: SavedMedia[];
  onSelect: (item: SavedMedia) => void;
  onSeeAll: () => void;
  watchedCounts: Record<string, number>;
}) {
  if (!items.length) return null;

  return (
    <section className="media-section">
      <div className="section-heading">
        <h2>{title}</h2>

        <button type="button" className="text-link" onClick={onSeeAll}>
          See all <ChevronRight size={15} />
        </button>
      </div>

      <div className="poster-scroll">
        {items.map((item) => (
          <MediaPoster
            key={item.id}
            item={item}
            watchedCount={watchedCounts[item.id] ?? 0}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </section>
  );
}

function StatusCard({
  icon: Icon,
  label,
  count,
  color,
  onClick,
}: {
  icon: typeof Play;
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="status-card" onClick={onClick}>
      <div className={`status-icon ${color}`}>
        <Icon size={21} />
      </div>

      <div>
        <span className="status-label">{label}</span>
        <strong className="status-number">{count}</strong>
      </div>
    </button>
  );
}

function MediaDetails({
  item,
  onClose,
  onUpdate,
  saving,
  error,
  watchedEpisodes,
  onToggleEpisode,
  onToggleSeason,
}: {
  item: SavedMedia;
  onClose: () => void;
  onUpdate: (id: string, changes: MediaChanges) => Promise<void>;
  saving: boolean;
  error: string;
  watchedEpisodes: WatchedEpisode[];
  onToggleEpisode: (season: number, episode: number, watched: boolean) => Promise<void>;
  onToggleSeason: (season: number, episodes: number[], watched: boolean) => Promise<void>;
}) {
  const [tab, setTab] = useState<"overview" | "episodes" | "details" | "notes">(
    "overview",
  );

  const [note, setNote] = useState(item.notes ?? "");
  const [movieMinutes, setMovieMinutes] = useState(
    String(Math.floor((item.movie_progress_seconds ?? 0) / 60)),
  );

  const [provider, setProvider] = useState<ProviderDetails | null>(null);
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState("");
  const [seasonNumber, setSeasonNumber] = useState(item.current_season ?? 1);
  const [chapterInput, setChapterInput] = useState(String(item.last_read_chapter ?? 0));
  const [volumeInput, setVolumeInput] = useState(String(item.current_volume ?? 0));
  const [chapterTotalInput, setChapterTotalInput] = useState(String(item.total_chapters ?? ""));
  const [volumeTotalInput, setVolumeTotalInput] = useState(String(item.total_volumes ?? ""));

  useEffect(() => {
    setChapterTotalInput(String(item.total_chapters ?? ""));
    setVolumeTotalInput(String(item.total_volumes ?? ""));
  }, [item.total_chapters, item.total_volumes]);

  useEffect(() => {
    setChapterInput(String(item.last_read_chapter ?? 0));
    setVolumeInput(String(item.current_volume ?? 0));
  }, [item.last_read_chapter, item.current_volume]);

  useEffect(() => {
    if (!item.external_id) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      source: item.source,
      type: item.media_type,
      id: item.external_id,
    });
    if (item.media_type === "series" || item.media_type === "anime") {
      params.set("season", String(seasonNumber));
    }
    setProviderLoading(true);
    setProviderError("");
    setProvider(null);
    void (async () => {
      try {
        const response = await fetch(`/api/media/details?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load details.");
        if (!controller.signal.aborted) {
          const details = data as ProviderDetails;
          setProvider(details);
          const changes: MediaChanges = {};
          if (item.media_type === "movie" && details.runtime_minutes != null && details.runtime_minutes !== item.runtime_minutes) changes.runtime_minutes = details.runtime_minutes;
          if (item.media_type === "manga" && details.chapters != null && item.total_chapters == null) changes.total_chapters = details.chapters;
          if (item.media_type === "manga" && details.volumes != null && item.total_volumes == null) changes.total_volumes = details.volumes;
          if (isEpisodic(item) && details.total_episodes != null && details.total_episodes !== item.total_episodes) changes.total_episodes = details.total_episodes;
          if (Object.keys(changes).length) void onUpdate(item.id, changes);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setProviderError(err instanceof Error ? err.message : "Unable to load details.");
        }
      } finally {
        if (!controller.signal.aborted) setProviderLoading(false);
      }
    })();
    return () => controller.abort();
  }, [item.source, item.media_type, item.external_id, seasonNumber]);

  function selectSeason(value: number) {
    setSeasonNumber(value);
    if (value !== (item.current_season ?? 1)) {
      // Only change the displayed season. Save progress when an episode is selected.
    }
  }

  const episodic = isEpisodic(item);
  const progress = getProgress(item, watchedEpisodes.length);
  const poster = posterUrl(item.poster_path);

  useEffect(() => {
    setNote(item.notes ?? "");
  }, [item.id, item.notes]);

  useEffect(() => {
    setMovieMinutes(
      String(Math.floor((item.movie_progress_seconds ?? 0) / 60)),
    );
  }, [item.id, item.movie_progress_seconds]);

  const updateStatus = (status: MediaStatus) => onUpdate(item.id, { status });

  const advance = () => {
    if (item.media_type === "manga") {
      return onUpdate(item.id, {
        last_read_chapter: (item.last_read_chapter ?? 0) + 1,
        status: "watching",
      });
    }

    if (episodic) {
      const seasonEpisodes = watchedEpisodes
        .filter((entry) => entry.season_number === seasonNumber)
        .map((entry) => entry.episode_number);
      const next = Math.max(0, ...seasonEpisodes) + 1;
      return onToggleEpisode(seasonNumber, next, true);
    }

    return updateStatus("completed");
  };

  return (
    <div className="details-overlay" onClick={onClose}>
      <div
        className="details-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="details-topbar">
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="details-top-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => updateStatus("watch_later")}
              disabled={saving}
              aria-label="Watch later"
            >
              <Bookmark size={18} />
            </button>

            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="details-hero">
          <div className="details-poster">
            {poster ? (
              <img src={poster} alt={item.title} />
            ) : (
              <div className="poster-fallback">
                <Film size={28} />
                <span>{item.title}</span>
              </div>
            )}
          </div>

          <div className="details-hero-content">
            <div className="eyebrow">
              {item.media_type} · {getYear(item)}
            </div>

            <h1>{item.title}</h1>

            <p>{item.overview || "No description available."}</p>

            <div className="details-hero-actions">
              <button
                type="button"
                className="primary-button"
                onClick={advance}
                disabled={saving}
              >
                {saving ? <Loader2 size={16} /> : <Play size={16} />}

                {item.media_type === "manga"
                  ? "Read next chapter"
                  : episodic
                    ? "Watched next episode"
                    : "Mark as completed"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => updateStatus("watch_later")}
                disabled={saving}
              >
                <Bookmark size={16} />
                {item.media_type === "manga" ? "Read later" : "Watch later"}
              </button>
            </div>
          </div>
        </div>

        <div className="details-tabs">
          {(
            [
              "overview",
              ...(episodic || item.media_type === "manga" ? (["episodes"] as const) : []),
              "details",
              "notes",
            ] as const
          ).map((value) => (
            <button
              type="button"
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
            >
              {value === "episodes" && item.media_type === "manga"
                ? "Chapters"
                : value}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="muted-text"
            style={{ color: "#ff9b9b", padding: "12px 20px" }}
          >
            {error}
          </p>
        )}

        {tab === "overview" && (
          <div className="details-body">
            <div className="progress-panel">
              <div className="progress-panel-header">
                <strong>Progress</strong>
                <span>{progress}%</span>
              </div>

              <div className="progress-description">
                {getProgressLabel(item)}
              </div>

              {(
                <div className="progress-track large">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {item.media_type === "movie" && (
                <div className="chapter-controls">
                  <label htmlFor="movie-minutes">Minutes watched</label>

                  <input
                    id="movie-minutes"
                    type="number"
                    min="0"
                    step="1"
                    value={movieMinutes}
                    onChange={(event) => setMovieMinutes(event.target.value)}
                  />

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving}
                    onClick={() =>
                      onUpdate(item.id, {
                        movie_progress_seconds:
                          Math.max(0, Math.floor(Number(movieMinutes) || 0)) *
                          60,
                        status: "watching",
                      })
                    }
                  >
                    Save progress
                  </button>
                </div>
              )}

              {providerLoading && <p className="muted-text">Loading provider details...</p>}
              {providerError && <p className="muted-text" role="status">{providerError}</p>}
              {item.media_type === "movie" && provider?.runtime_minutes != null && (
                <p className="muted-text">Runtime: {provider.runtime_minutes} minutes · {Math.min(100, Math.round(((item.movie_progress_seconds ?? 0) / 60 / Math.max(1, provider.runtime_minutes)) * 100))}% watched</p>
              )}
              {item.media_type === "manga" && provider && (
                <p className="muted-text">{provider.chapters ?? "Unknown"} chapters · {provider.volumes ?? "Unknown"} volumes</p>
              )}
              <div className="progress-info-grid">
                <div>
                  <span>Current progress</span>
                  <strong>{getProgressLabel(item)}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>{item.status.replace("_", " ")}</strong>
                </div>
              </div>
            </div>

            <div className="status-actions">
              {statuses.map(({ id, label }) => (
                <button
                  type="button"
                  key={id}
                  disabled={saving}
                  className={item.status === id ? "selected" : ""}
                  onClick={() => updateStatus(id)}
                >
                  {item.status === id && <Check size={14} />}
                  {id === "watching" && item.media_type === "manga"
                    ? "Reading"
                    : label}
                </button>
              ))}
            </div>

            {episodic && (
              <div className="season-preview">
                <h3>Seasons</h3>

                <div className="season-row">
                  <div className="season-icon">
                    <Tv size={20} />
                  </div>

                  <div>
                    <strong>Season {item.current_season ?? 1}</strong>
                    <span>
                      {item.total_episodes ?? "Unknown"} total episodes
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "episodes" && (
          <div className="details-body">
            {item.media_type === "manga" ? (
              <div className="chapter-controls">
                <h3>Reading progress</h3>
                {providerLoading && <p className="muted-text">Loading manga details...</p>}
                {providerError && <p role="status" className="muted-text">{providerError}</p>}
                {provider && (
                  <p className="muted-text">
                    Total: {item.total_chapters ?? provider.chapters ?? "Unknown"} chapters · {item.total_volumes ?? provider.volumes ?? "Unknown"} volumes
                    {provider.publication_status ? ` · ${provider.publication_status.replaceAll("_", " ")}` : ""}
                  </p>
                )}
                <p className="muted-text">If AniList has no totals, enter them yourself. Saved totals are used for progress percentages.</p>
                <label htmlFor="manga-total-chapters">Total chapters (optional)</label>
                <input id="manga-total-chapters" type="number" min="0" step="1" placeholder="Unknown"
                  value={chapterTotalInput} onChange={(event) => setChapterTotalInput(event.target.value)} />
                <label htmlFor="manga-total-volumes">Total volumes (optional)</label>
                <input id="manga-total-volumes" type="number" min="0" step="1" placeholder="Unknown"
                  value={volumeTotalInput} onChange={(event) => setVolumeTotalInput(event.target.value)} />
                <button type="button" className="secondary-button" disabled={saving}
                  onClick={() => onUpdate(item.id, {
                    total_chapters: chapterTotalInput.trim() === "" ? null : Math.max(0, Math.floor(Number(chapterTotalInput) || 0)),
                    total_volumes: volumeTotalInput.trim() === "" ? null : Math.max(0, Math.floor(Number(volumeTotalInput) || 0)),
                  })}>Save manga totals</button>
                <label htmlFor="manga-chapter">Current chapter</label>
                <input id="manga-chapter" type="number" min="0" step="1" value={chapterInput}
                  onChange={(event) => setChapterInput(event.target.value)} />
                <label htmlFor="manga-volume">Current volume</label>
                <input id="manga-volume" type="number" min="0" step="1" value={volumeInput}
                  onChange={(event) => setVolumeInput(event.target.value)} />
                <div className="chapter-buttons">
                  <button type="button" className="secondary-button" disabled={saving || (item.last_read_chapter ?? 0) === 0}
                    onClick={() => onUpdate(item.id, { last_read_chapter: Math.max(0, (item.last_read_chapter ?? 0) - 1) })}>
                    Previous chapter
                  </button>
                  <button type="button" className="primary-button" disabled={saving}
                    onClick={() => onUpdate(item.id, {
                      last_read_chapter: Math.max(0, Math.floor(Number(chapterInput) || 0)),
                      current_volume: Math.max(0, Math.floor(Number(volumeInput) || 0)),
                      status: "watching",
                    })}>
                    Save progress
                  </button>
                  <button type="button" className="secondary-button" disabled={saving}
                    onClick={advance}>Next chapter</button>
                </div>
              </div>
            ) : (
              <>
                <div className="episode-heading"><h3>Episodes</h3></div>
                <div className="chapter-controls">
                  <label htmlFor="season-select">Season</label>
                  {provider?.seasons?.length ? (
                    <select id="season-select" value={seasonNumber}
                      onChange={(event) => selectSeason(Number(event.target.value))}>
                      {provider.seasons.map((season) => (
                        <option key={season.season_number} value={season.season_number}>
                          {season.name} ({season.episode_count} episodes)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="muted-text">Season {seasonNumber}</p>
                  )}
                </div>
                {providerLoading && <p className="muted-text">Loading episodes...</p>}
                {providerError && <p role="status" className="muted-text">{providerError}</p>}
                {provider?.episodes?.length === 0 && <p className="muted-text">No episodes listed for this season.</p>}
                {provider?.episodes && provider.episodes.length > 0 && (
                  <div className="chapter-buttons" style={{ marginBottom: 16 }}>
                    <button type="button" className="primary-button" disabled={saving || providerLoading}
                      onClick={() => onToggleSeason(seasonNumber, provider.episodes!.map((episode) => episode.episode_number), true)}>
                      <Check size={16} /> Mark season watched
                    </button>
                    <button type="button" className="secondary-button" disabled={saving || providerLoading}
                      onClick={() => onToggleSeason(seasonNumber, provider.episodes!.map((episode) => episode.episode_number), false)}>
                      Clear season progress
                    </button>
                  </div>
                )}
                <div className="episode-list">
                  {(provider?.episodes ?? []).map((episode) => {
                    const watched = watchedEpisodes.some((entry) => entry.season_number === seasonNumber && entry.episode_number === episode.episode_number);
                    return (
                      <button type="button" key={episode.id} className="episode-row" disabled={saving}
                        onClick={() => onToggleEpisode(seasonNumber, episode.episode_number, !watched)}>
                        <span className="episode-number">{episode.episode_number}</span>
                        <span className="episode-title" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                          <strong>{episode.name || `Episode ${episode.episode_number}`}</strong>
                          <small>{[episode.air_date, episode.runtime_minutes ? `${episode.runtime_minutes} min` : null].filter(Boolean).join(" · ")}</small>
                          {episode.overview && <small style={{ textAlign: "left", opacity: 0.7 }}>{episode.overview}</small>}
                        </span>
                        <span className={`episode-check ${watched ? "checked" : ""}`}>
                          {watched && <Check size={13} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="muted-text">Tap an episode to mark it watched or unwatched. Episodes are tracked independently across seasons.</p>
              </>
            )}
          </div>
        )}

        {tab === "details" && (
          <div className="details-body">
            <div className="info-list">
              <div>
                <span>Title</span>
                <strong>{item.title}</strong>
              </div>

              <div>
                <span>Type</span>
                <strong>{item.media_type}</strong>
              </div>

              <div>
                <span>Release year</span>
                <strong>{getYear(item)}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{item.status.replace("_", " ")}</strong>
              </div>

              {item.media_type === "movie" && provider?.runtime_minutes != null && (
                <div><span>Runtime</span><strong>{provider.runtime_minutes} minutes</strong></div>
              )}
              {isEpisodic(item) && provider?.total_episodes != null && (
                <div><span>Total episodes (series)</span><strong>{provider.total_episodes}</strong></div>
              )}
              {item.media_type === "manga" && provider && (
                <>
                  <div><span>Chapters</span><strong>{provider.chapters ?? "Unknown"}</strong></div>
                  <div><span>Volumes</span><strong>{provider.volumes ?? "Unknown"}</strong></div>
                </>
              )}
              <div>
                <span>Source</span>
                <strong>{item.source}</strong>
              </div>
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div className="details-body">
            <h3>Personal notes</h3>

            <textarea
              className="notes-textarea"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Write your thoughts..."
            />

            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={() => onUpdate(item.id, { notes: note })}
            >
              {saving ? "Saving..." : "Save notes"}
            </button>

            <p className="muted-text">
              Notes are saved to your Supabase account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [media, setMedia] = useState<SavedMedia[]>([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<WatchedEpisode[]>([]);
  const [view, setView] = useState<View>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const [greeting, setGreeting] = useState("Welcome back!");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const refreshMedia = useCallback(async () => {
    setLoadError("");

    try {
      const [items, episodes] = await Promise.all([getMyMedia(), getWatchedEpisodes()]);
      setMedia(items);
      setWatchedEpisodes(episodes);
    } catch (error) {
      console.error("Failed to load media:", error);

      setLoadError(
        error instanceof Error ? error.message : "Unable to load your library.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();

    setGreeting(
      hour < 12
        ? "Good morning!"
        : hour < 18
          ? "Good afternoon!"
          : "Good evening!",
    );

    void refreshMedia();
  }, [refreshMedia]);

  const selectedItem = media.find((item) => item.id === selectedId) ?? null;
  const watchedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const episode of watchedEpisodes) counts[episode.media_id] = (counts[episode.media_id] ?? 0) + 1;
    return counts;
  }, [watchedEpisodes]);

  async function handleToggleEpisode(season: number, episode: number, watched: boolean) {
    if (!selectedItem || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await setEpisodeWatched(selectedItem.id, season, episode, watched);
      const episodes = await getWatchedEpisodes(selectedItem.id);
      setWatchedEpisodes((previous) => [
        ...previous.filter((entry) => entry.media_id !== selectedItem.id),
        ...episodes,
      ]);
      // Keep legacy season/episode display as the most recently selected position.
      const updated = await updateMedia(selectedItem.id, {
        current_season: season,
        last_watched_episode: episode,
        status: watched ? "watching" : selectedItem.status,
      });
      setMedia((previous) => previous.map((entry) => entry.id === updated.id ? updated : entry));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to save episode.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSeason(season: number, episodeNumbers: number[], watched: boolean) {
    if (!selectedItem || saving || !episodeNumbers.length) return;
    setSaving(true);
    setSaveError("");
    try {
      await setSeasonWatched(selectedItem.id, season, episodeNumbers, watched);
      const episodes = await getWatchedEpisodes(selectedItem.id);
      setWatchedEpisodes((previous) => [
        ...previous.filter((entry) => entry.media_id !== selectedItem.id),
        ...episodes,
      ]);
      const updated = await updateMedia(selectedItem.id, {
        current_season: season,
        last_watched_episode: watched ? Math.max(...episodeNumbers) : 0,
        ...(watched ? { status: "watching" as const } : {}),
      });
      setMedia((previous) => previous.map((entry) => entry.id === updated.id ? updated : entry));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Unable to update season progress.");
      // Refresh partial results if any batch succeeded before an error.
      try {
        const episodes = await getWatchedEpisodes(selectedItem.id);
        setWatchedEpisodes((previous) => [...previous.filter((entry) => entry.media_id !== selectedItem.id), ...episodes]);
      } catch { /* Keep existing display until next refresh. */ }
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(
    () => ({
      watching: media.filter((item) => item.status === "watching").length,
      watch_later: media.filter((item) => item.status === "watch_later").length,
      completed: media.filter((item) => item.status === "completed").length,
      on_hold: media.filter((item) => item.status === "on_hold").length,
    }),
    [media],
  );

  const filteredMedia = useMemo(() => {
    let results = [...media];

    if (view === "watch_later" || view === "completed" || view === "on_hold") {
      results = results.filter((item) => item.status === view);
    }

    if (category !== "all") {
      results = results.filter((item) => item.media_type === category);
    }

    if (sort === "title") {
      results.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "year") {
      results.sort((a, b) =>
        (b.release_date ?? "").localeCompare(a.release_date ?? ""),
      );
    } else {
      results.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }

    return results;
  }, [media, view, category, sort]);

  async function handleUpdate(id: string, changes: MediaChanges) {
    if (saving) return;

    setSaving(true);
    setSaveError("");

    try {
      const updated = await updateMedia(id, changes);

      setMedia((previous) =>
        previous.map((item) => (item.id === id ? updated : item)),
      );
    } catch (error) {
      console.error("Failed to update media:", error);

      setSaveError(
        error instanceof Error ? error.message : "Unable to save changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  function navigate(nextView: View) {
    setView(nextView);
    setCategory("all");
    setShowFilters(false);
  }

  const pageTitle: Record<View, string> = {
    home: greeting,
    library: "My Library",
    watch_later: "Watch Later",
    completed: "Completed",
    on_hold: "On Hold",
    search: "Search Media",
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Film size={25} />
          </div>
          <span>MyMedia</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className="nav-item"
            onClick={() => navigate("library")}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-heading">
            <h1>{pageTitle[view]}</h1>

            <p>
              {view === "home"
                ? "Here's what you're watching and reading."
                : view === "search"
                  ? "Discover and add titles to your personal library."
                  : "Your personal media collection."}
            </p>
          </div>

          <div className="topbar-actions">
            {view !== "search" && (
              <QuickSearch
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onViewAll={() => navigate("search")}
                onAdded={refreshMedia}
                savedKeys={media.map((item) => `${item.source}-${item.external_id}`)}
              />
            )}

            <AccountMenu />
          </div>
        </header>

        {view === "search" ? (
          <MediaSearch
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onAdded={refreshMedia}
          />
        ) : loading ? (
          <div className="empty-state">
            <Loader2 size={30} className="quick-search-spinner" />
            <h3>Loading your library...</h3>
          </div>
        ) : loadError ? (
          <div className="empty-state">
            <Film size={36} />
            <h3>Unable to load your library</h3>
            <p>{loadError}</p>

            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setLoading(true);
                void refreshMedia();
              }}
            >
              Try again
            </button>
          </div>
        ) : view === "home" ? (
          <>
            <div className="status-grid">
              <StatusCard
                icon={Play}
                label="Watching / Reading"
                count={counts.watching}
                color="purple"
                onClick={() => navigate("library")}
              />

              <StatusCard
                icon={Bookmark}
                label="Watch Later"
                count={counts.watch_later}
                color="blue"
                onClick={() => navigate("watch_later")}
              />

              <StatusCard
                icon={Check}
                label="Completed"
                count={counts.completed}
                color="green"
                onClick={() => navigate("completed")}
              />

              <StatusCard
                icon={PauseCircle}
                label="On Hold"
                count={counts.on_hold}
                color="orange"
                onClick={() => navigate("on_hold")}
              />
            </div>

            {media.length === 0 ? (
              <div className="empty-state">
                <Film size={36} />
                <h3>Your library is empty</h3>
                <p>Find your first movie, TV series, anime, or manga.</p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => navigate("search")}
                >
                  <Plus size={16} />
                  Add your first title
                </button>
              </div>
            ) : (
              <>
                <MediaSection
                  title="Continue Watching & Reading"
                  items={media.filter((item) => item.status === "watching")}
                  onSelect={(item) => setSelectedId(item.id)}
                  onSeeAll={() => navigate("library")}
                  watchedCounts={watchedCounts}
                />

                <MediaSection
                  title="Watch Later"
                  items={media.filter((item) => item.status === "watch_later")}
                  onSelect={(item) => setSelectedId(item.id)}
                  onSeeAll={() => navigate("watch_later")}
                  watchedCounts={watchedCounts}
                />

                <MediaSection
                  title="Recently Completed"
                  items={media.filter((item) => item.status === "completed")}
                  onSelect={(item) => setSelectedId(item.id)}
                  onSeeAll={() => navigate("completed")}
                  watchedCounts={watchedCounts}
                />
              </>
            )}
          </>
        ) : (
          <div className="library-page">
            <div className="library-toolbar">
              <div className="category-tabs">
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={category === item.id ? "active" : ""}
                    onClick={() => setCategory(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="filter-button"
                onClick={() => setShowFilters(true)}
              >
                <SlidersHorizontal size={17} />
                <span>Filter & Sort</span>
              </button>
            </div>

            <div className="library-count">{filteredMedia.length} titles</div>

            {filteredMedia.length > 0 ? (
              <div className="library-grid">
                {filteredMedia.map((item) => (
                  <MediaPoster
                    key={item.id}
                    item={item}
                    watchedCount={watchedCounts[item.id] ?? 0}
                    onClick={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Film size={36} />
                <h3>No titles found</h3>
                <p>
                  {media.length === 0
                    ? "Your library is empty."
                    : "Try another category or status."}
                </p>

                {media.length === 0 && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => navigate("search")}
                  >
                    Find media
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="mobile-bottom-nav">
        {[
          { id: "home" as View, icon: Home, label: "Home" },
          {
            id: "library" as View,
            icon: Library,
            label: "Library",
          },
          {
            id: "search" as View,
            icon: Search,
            label: "Search",
          },
        ].map(({ id, icon: Icon, label }) => (
          <button
            type="button"
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}

        <button
          type="button"
          className={showFilters ? "active" : ""}
          onClick={() => setShowFilters(true)}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {selectedItem && (
        <MediaDetails
          key={selectedItem.id}
          item={selectedItem}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdate}
          saving={saving}
          error={saveError}
          watchedEpisodes={watchedEpisodes.filter((entry) => entry.media_id === selectedItem.id)}
          onToggleEpisode={handleToggleEpisode}
          onToggleSeason={handleToggleSeason}
        />
      )}

      {showFilters && (
        <div className="filter-overlay" onClick={() => setShowFilters(false)}>
          <div
            className="filter-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="filter-header">
              <h2>Filter & Sort</h2>

              <button
                type="button"
                className="icon-button"
                onClick={() => setShowFilters(false)}
              >
                <X size={20} />
              </button>
            </div>

            <h3>Media Type</h3>

            <div className="filter-options">
              {categories.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={category === item.id ? "active" : ""}
                  onClick={() => setCategory(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <h3>Sort By</h3>

            <div className="filter-options">
              {(
                [
                  ["recent", "Recently Updated"],
                  ["title", "Title (A-Z)"],
                  ["year", "Release Date"],
                ] as [Sort, string][]
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={sort === value ? "active" : ""}
                  onClick={() => setSort(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="primary-button apply-filters"
              onClick={() => {
                if (view === "home" || view === "search") {
                  setView("library");
                }

                setShowFilters(false);
              }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
