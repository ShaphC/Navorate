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

function getProgress(item: SavedMedia) {
  if (item.status === "completed") return 100;

  if (item.media_type === "movie") {
    // Duration is not stored in SavedMedia yet.
    // Do not treat seconds as a percentage.
    return 0;
  }

  if (item.media_type === "manga") {
    if (!item.total_chapters) return 0;

    return Math.min(
      100,
      Math.round(((item.last_read_chapter ?? 0) / item.total_chapters) * 100),
    );
  }

  if (!item.total_episodes) return 0;

  return Math.min(
    100,
    Math.round(((item.last_watched_episode ?? 0) / item.total_episodes) * 100),
  );
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
}: {
  item: SavedMedia;
  onClick: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const poster = posterUrl(item.poster_path);
  const progress = getProgress(item);

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

        {item.status === "watching" && item.media_type !== "movie" && (
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
}: {
  title: string;
  items: SavedMedia[];
  onSelect: (item: SavedMedia) => void;
  onSeeAll: () => void;
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
}: {
  item: SavedMedia;
  onClose: () => void;
  onUpdate: (id: string, changes: MediaChanges) => Promise<void>;
  saving: boolean;
  error: string;
}) {
  const [tab, setTab] = useState<"overview" | "episodes" | "details" | "notes">(
    "overview",
  );

  const [note, setNote] = useState(item.notes ?? "");
  const [movieMinutes, setMovieMinutes] = useState(
    String(Math.floor((item.movie_progress_seconds ?? 0) / 60)),
  );

  const episodic = isEpisodic(item);
  const progress = getProgress(item);
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
      return onUpdate(item.id, {
        last_watched_episode: (item.last_watched_episode ?? 0) + 1,
        status: "watching",
      });
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
              ...(episodic || item.media_type === "manga" ? ["episodes"] : []),
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
                {item.media_type !== "movie" && <span>{progress}%</span>}
              </div>

              <div className="progress-description">
                {getProgressLabel(item)}
              </div>

              {item.media_type !== "movie" && (
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
            <div className="episode-heading">
              <h3>
                {item.media_type === "manga"
                  ? "Chapter progress"
                  : `Season ${item.current_season ?? 1}`}
              </h3>
            </div>

            {item.media_type === "manga" ? (
              <div className="chapter-controls">
                <p>Current chapter</p>

                <div className="chapter-number">
                  {item.last_read_chapter ?? 0}
                </div>

                <div className="chapter-buttons">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving}
                    onClick={() =>
                      onUpdate(item.id, {
                        last_read_chapter: Math.max(
                          0,
                          (item.last_read_chapter ?? 0) - 1,
                        ),
                      })
                    }
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={saving}
                    onClick={advance}
                  >
                    <Plus size={16} />
                    Next chapter
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="chapter-buttons">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving}
                    onClick={() =>
                      onUpdate(item.id, {
                        current_season: Math.max(
                          1,
                          (item.current_season ?? 1) - 1,
                        ),
                        last_watched_episode: 0,
                      })
                    }
                  >
                    Previous season
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={saving}
                    onClick={() =>
                      onUpdate(item.id, {
                        current_season: (item.current_season ?? 1) + 1,
                        last_watched_episode: 0,
                      })
                    }
                  >
                    Next season
                  </button>
                </div>

                <div className="episode-list">
                  {Array.from(
                    {
                      length: Math.min(item.total_episodes ?? 12, 50),
                    },
                    (_, index) => index + 1,
                  ).map((episode) => {
                    const watched = episode <= (item.last_watched_episode ?? 0);

                    return (
                      <button
                        type="button"
                        key={episode}
                        className="episode-row"
                        disabled={saving}
                        onClick={() =>
                          onUpdate(item.id, {
                            last_watched_episode: episode,
                            status: "watching",
                          })
                        }
                      >
                        <span className="episode-number">{episode}</span>

                        <span className="episode-title">Episode {episode}</span>

                        <span
                          className={`episode-check ${
                            watched ? "checked" : ""
                          }`}
                        >
                          {watched && <Check size={13} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
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
      const items = await getMyMedia();
      setMedia(items);
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
                />

                <MediaSection
                  title="Watch Later"
                  items={media.filter((item) => item.status === "watch_later")}
                  onSelect={(item) => setSelectedId(item.id)}
                  onSeeAll={() => navigate("watch_later")}
                />

                <MediaSection
                  title="Recently Completed"
                  items={media.filter((item) => item.status === "completed")}
                  onSelect={(item) => setSelectedId(item.id)}
                  onSeeAll={() => navigate("completed")}
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
