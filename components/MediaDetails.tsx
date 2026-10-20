"use client";

import { useEffect, useState } from "react";
import { Bookmark, Check, ChevronLeft, ChevronRight, Film, Loader2, Play, Tv, X } from "lucide-react";
import { posterUrl, type MediaStatus, type SavedMedia } from "@/lib/media";
import { updateMedia } from "@/lib/media-store";
import type { WatchedEpisode } from "@/lib/episode-store";

type MediaChanges = Parameters<typeof updateMedia>[1];

type SeasonInfo = { season_number: number; name: string; episode_count: number; air_date: string | null };
type EpisodeInfo = { id: number; episode_number: number; name: string; overview: string; air_date: string | null; runtime_minutes: number | null };
type VolumeIndex = { total_volumes: number | null; source: string | null; source_url: string | null; status: string };
type ChapterIndex = { title: string; source: string; source_url: string; latest_chapter: string; latest_full_chapter: number | null; chapters: { number: string; value: number; url: string }[] };

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

export default function MediaDetails({
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
  const [chapterIndex, setChapterIndex] = useState<ChapterIndex | null>(null);
  const [volumeIndex, setVolumeIndex] = useState<VolumeIndex | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(false);
  const [chapterIndexError, setChapterIndexError] = useState("");
  const [chapterIndexLoading, setChapterIndexLoading] = useState(false);
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

  useEffect(() => {
    if (item.media_type !== "manga") return;
    const normalized = (item.title + " " + (item.original_title ?? "")).toLowerCase();
    const key = /blue\s*lock|ブルーロック/.test(normalized)
      ? "blue-lock"
      : /world\s*trigger|ワールドトリガー/.test(normalized)
        ? "world-trigger"
        : null;
    if (!key) return;
    const controller = new AbortController();
    setChapterIndexLoading(true);
    setChapterIndexError("");
    void (async () => {
      try {
        const response = await fetch(`/api/media/chapters?title=${key}`, { signal: controller.signal });
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(`Chapter API returned a webpage (HTTP ${response.status}). Check that app/api/media/chapters/route.ts exists and restart or redeploy Next.js.`);
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Chapter index unavailable.");
        if (controller.signal.aborted) return;
        const index = data as ChapterIndex;
        setChapterIndex(index);
        if (index.latest_full_chapter != null && index.latest_full_chapter > (item.total_chapters ?? 0)) {
          void onUpdate(item.id, { total_chapters: index.latest_full_chapter });
        }
      } catch (error) {
        if (!controller.signal.aborted) setChapterIndexError(error instanceof Error ? error.message : "Chapter index unavailable.");
      } finally {
        if (!controller.signal.aborted) setChapterIndexLoading(false);
      }
    })();
    return () => controller.abort();
  }, [item.id, item.media_type, item.title, item.original_title]);

  useEffect(() => {
    if (item.media_type !== "manga") return;
    const normalized = (item.title + " " + (item.original_title ?? "")).toLowerCase();
    const key = /blue\s*lock|ブルーロック/.test(normalized) ? "blue-lock"
      : /world\s*trigger|ワールドトリガー/.test(normalized) ? "world-trigger" : null;
    setVolumeIndex(null);
    if (!key) return;
    const controller = new AbortController();
    setVolumeLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/media/volumes?title=${key}`, { signal: controller.signal });
        if (!(response.headers.get("content-type") ?? "").includes("application/json")) throw new Error("Volume API did not return JSON");
        const data = await response.json() as VolumeIndex;
        if (!response.ok) throw new Error("Volume lookup unavailable");
        if (controller.signal.aborted) return;
        setVolumeIndex(data);
        // Never reduce an existing total if a source is stale.
        if (data.total_volumes != null && data.total_volumes > (item.total_volumes ?? 0)) {
          void onUpdate(item.id, { total_volumes: data.total_volumes });
        }
      } catch {
        if (!controller.signal.aborted) setVolumeIndex(null);
      } finally {
        if (!controller.signal.aborted) setVolumeLoading(false);
      }
    })();
    return () => controller.abort();
  }, [item.id, item.media_type, item.title, item.original_title]);

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
              <div className="chapter-controls" style={{ gap: 14 }}>
                <div className="episode-heading"><h3>Reading progress</h3></div>
                <div className="progress-info-grid">
                  <div><span>Chapters available</span><strong>{item.total_chapters ?? chapterIndex?.latest_full_chapter ?? provider?.chapters ?? "—"}</strong></div>
                  <div><span>Volumes published</span><strong>{Math.max(item.total_volumes ?? 0, volumeIndex?.total_volumes ?? 0, provider?.volumes ?? 0) || "—"}</strong></div>
                </div>
                {chapterIndexLoading && <p className="muted-text">Checking latest chapters…</p>}
                {volumeLoading && <p className="muted-text">Checking published volumes…</p>}
                {volumeIndex?.source && <p className="muted-text">Volume count: <a href={volumeIndex.source_url ?? "#"} target="_blank" rel="noopener noreferrer">{volumeIndex.source}</a> · Japanese publication metadata</p>}
                {chapterIndex && (
                  <div className="season-preview">
                    <h3>Recent chapters</h3>
                    <p className="muted-text">Latest listed: {chapterIndex.latest_chapter} · {chapterIndex.source}</p>
                    <div className="chapter-buttons" style={{ flexWrap: "wrap", marginTop: 12 }}>
                      {chapterIndex.chapters.slice(0, 12).map((chapter) => (
                        <button key={chapter.number} type="button" className="secondary-button"
                          onClick={() => setChapterInput(String(Math.floor(chapter.value)))}>
                          {chapter.number}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chapterIndexError && (
                  <p className="muted-text" role="status">Chapter listings are temporarily unavailable. You can still track what you've read.</p>
                )}
                {providerLoading && <p className="muted-text">Loading manga details…</p>}
                <div className="progress-info-grid">
                  <div>
                    <label htmlFor="manga-chapter">Current chapter</label>
                    <input id="manga-chapter" type="number" min="0" step="1" value={chapterInput}
                      onChange={(event) => setChapterInput(event.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="manga-volume">Current volume</label>
                    <input id="manga-volume" type="number" min="0" step="1" value={volumeInput}
                      onChange={(event) => setVolumeInput(event.target.value)} />
                  </div>
                </div>
                <div className="chapter-buttons" style={{ flexWrap: "wrap" }}>
                  <button type="button" className="secondary-button" disabled={saving || (item.last_read_chapter ?? 0) === 0}
                    onClick={() => onUpdate(item.id, { last_read_chapter: Math.max(0, (item.last_read_chapter ?? 0) - 1) })}>
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button type="button" className="primary-button" disabled={saving}
                    onClick={() => onUpdate(item.id, {
                      last_read_chapter: Math.max(0, Math.floor(Number(chapterInput) || 0)),
                      current_volume: Math.max(0, Math.floor(Number(volumeInput) || 0)),
                      status: "watching",
                    })}>
                    <Check size={16} /> Save progress
                  </button>
                  <button type="button" className="secondary-button" disabled={saving} onClick={advance}>
                    Next <ChevronRight size={16} />
                  </button>
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

