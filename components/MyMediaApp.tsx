"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
import MediaDetails from "@/components/MediaDetails";

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

export default function MyMediaApp({ initialView = "home", initialSelectedId = null, initialSearchQuery = "" }: { initialView?: View; initialSelectedId?: string | null; initialSearchQuery?: string }) {
  const router = useRouter();
  const [media, setMedia] = useState<SavedMedia[]>([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<WatchedEpisode[]>([]);
  const [view, setView] = useState<View>(initialView);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [category, setCategory] = useState<Category>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const [greeting, setGreeting] = useState("Welcome back!");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setView(initialView);
    setSelectedId(initialSelectedId);
  }, [initialView, initialSelectedId]);

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
  const missingSelectedItem = !loading && !loadError && selectedId !== null && !selectedItem;
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
    setSelectedId(null);
    const destinations: Record<View, string> = {
      home: "/",
      library: "/library",
      watch_later: "/library?status=watch_later",
      completed: "/library?status=completed",
      on_hold: "/library?status=on_hold",
      search: "/search",
    };
    router.push(nextView === "search" && searchQuery.trim()
      ? `/search?q=${encodeURIComponent(searchQuery.trim())}`
      : destinations[nextView]);
  }

  function openMedia(item: SavedMedia) {
    setSelectedId(item.id);
    router.push(`/media/${encodeURIComponent(item.id)}`);
  }

  function closeMedia() {
    setSelectedId(null);
    router.push("/library");
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
                  onSelect={openMedia}
                  onSeeAll={() => navigate("library")}
                  watchedCounts={watchedCounts}
                />

                <MediaSection
                  title="Watch Later"
                  items={media.filter((item) => item.status === "watch_later")}
                  onSelect={openMedia}
                  onSeeAll={() => navigate("watch_later")}
                  watchedCounts={watchedCounts}
                />

                <MediaSection
                  title="Recently Completed"
                  items={media.filter((item) => item.status === "completed")}
                  onSelect={openMedia}
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
                    onClick={() => openMedia(item)}
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

      {missingSelectedItem && (
        <div className="details-overlay" onClick={closeMedia}>
          <div className="details-panel" onClick={(event) => event.stopPropagation()}>
            <div className="details-body">
              <h2>Title not found in your library</h2>
              <p className="muted-text">This media item may have been removed or is unavailable.</p>
              <button className="primary-button" type="button" onClick={closeMedia}>Back to library</button>
            </div>
          </div>
        </div>
      )}
      {selectedItem && (
        <MediaDetails
          key={selectedItem.id}
          item={selectedItem}
          onClose={closeMedia}
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
