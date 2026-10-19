"use client";

import { useEffect, useMemo, useState } from "react";

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

type MediaType = "movie" | "series" | "anime" | "manga";

type MediaStatus = "watching" | "watch_later" | "completed" | "on_hold";

type View =
  | "home"
  | "library"
  | "watch_later"
  | "completed"
  | "on_hold"
  | "search";

type MediaItem = {
  id: number;
  title: string;
  type: MediaType;
  year: number;
  poster: string;
  description: string;
  status: MediaStatus;
  season?: number;
  episode?: number;
  totalEpisodes?: number;
  chapter?: number;
  totalChapters?: number;
  duration?: number;
  progress?: number;
  notes?: string;
};

const image = (path: string) => `https://image.tmdb.org/t/p/w500${path}`;

const initialMedia: MediaItem[] = [
  {
    id: 1,
    title: "Mobile Suit Gundam 00",
    type: "anime",
    year: 2007,
    poster: image("/8zWv5FQWjTnY4N6xJYB6u7RZ5mB.jpg"),
    description:
      "In a world divided by conflict, Celestial Being intervenes with powerful mobile suits.",
    status: "watching",
    season: 1,
    episode: 12,
    totalEpisodes: 25,
  },
  {
    id: 2,
    title: "Frieren: Beyond Journey's End",
    type: "anime",
    year: 2023,
    poster: image("/dqZENchTd7lp5zht7BdlqM7RBhD.jpg"),
    description:
      "After the Demon King is defeated, Frieren reflects on the meaning of life and sets out on a new journey.",
    status: "watching",
    season: 1,
    episode: 7,
    totalEpisodes: 28,
  },
  {
    id: 3,
    title: "Breaking Bad",
    type: "series",
    year: 2008,
    poster: image("/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg"),
    description:
      "A chemistry teacher turns to a dangerous new life after a devastating diagnosis.",
    status: "watching",
    season: 2,
    episode: 4,
    totalEpisodes: 13,
  },
  {
    id: 4,
    title: "The Apothecary Diaries",
    type: "anime",
    year: 2023,
    poster: image("/e3z8dZ9v7H5y7rXf2f9xM3qM5pN.jpg"),
    description:
      "A clever young apothecary solves mysteries inside the imperial palace.",
    status: "watching",
    season: 1,
    episode: 8,
    totalEpisodes: 24,
  },
  {
    id: 5,
    title: "Dune",
    type: "movie",
    year: 2021,
    poster: image("/d5NXSklXo0qyIYkgV94XAgMIckC.jpg"),
    description:
      "Paul Atreides travels to the most dangerous planet in the universe.",
    status: "watching",
    duration: 155,
    progress: 60,
  },
  {
    id: 6,
    title: "Steins;Gate",
    type: "anime",
    year: 2011,
    poster: image("/5Yc1d6p0Vf4FzRkX2B8sT7uP9wQ.jpg"),
    description:
      "An eccentric scientist discovers a way to send messages into the past.",
    status: "watch_later",
  },
  {
    id: 7,
    title: "Attack on Titan",
    type: "anime",
    year: 2013,
    poster: image("/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg"),
    description:
      "Humanity struggles to survive behind walls protecting it from giant Titans.",
    status: "watch_later",
  },
  {
    id: 8,
    title: "Interstellar",
    type: "movie",
    year: 2014,
    poster: image("/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"),
    description:
      "Explorers travel through a wormhole to find humanity a new home.",
    status: "watch_later",
  },
  {
    id: 9,
    title: "Berserk",
    type: "manga",
    year: 1989,
    poster: "https://placehold.co/400x600/241b30/e8d8ff?text=Berserk",
    description:
      "A dark fantasy story following the journey of a lone swordsman.",
    status: "watching",
    chapter: 32,
    totalChapters: 100,
  },
  {
    id: 10,
    title: "The Matrix",
    type: "movie",
    year: 1999,
    poster: image("/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"),
    description: "A hacker discovers the truth about the reality around him.",
    status: "completed",
  },
];

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

const categories = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "TV Series" },
  { id: "anime", label: "Anime" },
  { id: "manga", label: "Manga" },
];

function getProgress(item: MediaItem) {
  if (item.status === "completed") return 100;

  if (item.type === "movie") {
    return item.progress ?? 0;
  }

  if (item.type === "manga") {
    return item.totalChapters
      ? Math.min(
          100,
          Math.round(((item.chapter ?? 0) / item.totalChapters) * 100),
        )
      : 0;
  }

  return item.totalEpisodes
    ? Math.min(
        100,
        Math.round(((item.episode ?? 0) / item.totalEpisodes) * 100),
      )
    : 0;
}

function getProgressLabel(item: MediaItem) {
  if (item.type === "movie") {
    return item.status === "completed"
      ? "Completed"
      : `${item.progress ?? 0}% watched`;
  }

  if (item.type === "manga") {
    return `Chapter ${item.chapter ?? 0}`;
  }

  return `S${item.season ?? 1} · E${item.episode ?? 0}`;
}

function MediaPoster({
  item,
  onClick,
}: {
  item: MediaItem;
  onClick: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const progress = getProgress(item);

  return (
    <button type="button" className="media-card" onClick={onClick}>
      <div className="poster-container">
        {!failed && item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="poster-fallback">
            <Film size={28} />
            <span>{item.title}</span>
          </div>
        )}

        <span className="poster-type">{item.type}</span>
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
}: {
  title: string;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  onSeeAll: () => void;
}) {
  if (!items.length) return null;

  return (
    <section className="media-section">
      <div className="section-heading">
        <h2>{title}</h2>

        <button className="text-link" onClick={onSeeAll}>
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
    <button className="status-card" onClick={onClick}>
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
}: {
  item: MediaItem;
  onClose: () => void;
  onUpdate: (item: MediaItem) => void;
}) {
  const [tab, setTab] = useState<"overview" | "episodes" | "details" | "notes">(
    "overview",
  );

  const [note, setNote] = useState(item.notes ?? "");

  const progress = getProgress(item);

  const episodic = item.type === "anime" || item.type === "series";

  const updateStatus = (status: MediaStatus) => {
    onUpdate({ ...item, status });
  };

  const advance = () => {
    if (item.type === "manga") {
      onUpdate({
        ...item,
        chapter: (item.chapter ?? 0) + 1,
        status: "watching",
      });
    } else if (episodic) {
      onUpdate({
        ...item,
        episode: (item.episode ?? 0) + 1,
        status: "watching",
      });
    } else {
      onUpdate({
        ...item,
        status: "completed",
        progress: 100,
      });
    }
  };

  const actionLabel =
    item.type === "manga"
      ? "Read next chapter"
      : episodic
        ? "Watched next episode"
        : "Mark as completed";

  return (
    <div className="details-overlay" onClick={onClose}>
      <div
        className="details-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="details-topbar">
          <button className="icon-button" onClick={onClose} aria-label="Back">
            <ChevronLeft size={22} />
          </button>

          <div className="details-top-actions">
            <button
              className="icon-button"
              aria-label="Bookmark"
              onClick={() => updateStatus("watch_later")}
            >
              <Bookmark size={18} />
            </button>

            <button
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
            {item.poster ? (
              <img
                src={item.poster}
                alt={item.title}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="poster-fallback">
                <Film size={28} />
                <span>{item.title}</span>
              </div>
            )}
          </div>

          <div className="details-hero-content">
            <div className="eyebrow">
              {item.type} · {item.year}
            </div>

            <h1>{item.title}</h1>

            <p>{item.description}</p>

            <div className="details-hero-actions">
              <button className="primary-button" onClick={advance}>
                <Play size={16} />
                {actionLabel}
              </button>

              <button
                className="secondary-button"
                onClick={() => updateStatus("watch_later")}
              >
                <Bookmark size={16} />
                {item.type === "manga" ? "Read later" : "Watch later"}
              </button>
            </div>
          </div>
        </div>

        <div className="details-tabs">
          {(
            [
              "overview",
              ...(episodic || item.type === "manga" ? ["episodes"] : []),
              "details",
              "notes",
            ] as string[]
          ).map((value) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value as typeof tab)}
            >
              {value === "episodes" && item.type === "manga"
                ? "Chapters"
                : value}
            </button>
          ))}
        </div>

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

              <div className="progress-track large">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="progress-info-grid">
                <div>
                  <span>Last completed</span>
                  <strong>{getProgressLabel(item)}</strong>
                </div>

                <div>
                  <span>Up next</span>
                  <strong>
                    {item.type === "manga"
                      ? `Chapter ${(item.chapter ?? 0) + 1}`
                      : episodic
                        ? `Episode ${(item.episode ?? 0) + 1}`
                        : "Continue watching"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="status-actions">
              {(
                [
                  ["watching", "Watching"],
                  ["watch_later", "Watch Later"],
                  ["completed", "Completed"],
                  ["on_hold", "On Hold"],
                ] as [MediaStatus, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={item.status === value ? "selected" : ""}
                  onClick={() => updateStatus(value)}
                >
                  {value === "watching" && <Play size={14} />}

                  {value === "watch_later" && <Bookmark size={14} />}

                  {value === "completed" && <Check size={14} />}

                  {value === "on_hold" && <PauseCircle size={14} />}

                  {item.type === "manga" && value === "watching"
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
                    <strong>Season {item.season ?? 1}</strong>
                    <span>{item.totalEpisodes ?? "—"} episodes</span>
                  </div>

                  <div className="season-progress">
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <small>{progress}%</small>
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
                {item.type === "manga"
                  ? "Chapter progress"
                  : `Season ${item.season ?? 1}`}
              </h3>
            </div>

            {item.type === "manga" ? (
              <div className="chapter-controls">
                <p>Current chapter</p>

                <div className="chapter-number">{item.chapter ?? 0}</div>

                <div className="chapter-buttons">
                  <button
                    className="secondary-button"
                    onClick={() =>
                      onUpdate({
                        ...item,
                        chapter: Math.max(0, (item.chapter ?? 0) - 1),
                      })
                    }
                  >
                    Previous
                  </button>

                  <button className="primary-button" onClick={advance}>
                    <Plus size={16} />
                    Next chapter
                  </button>
                </div>
              </div>
            ) : (
              <div className="episode-list">
                {Array.from(
                  {
                    length: Math.min(item.totalEpisodes ?? 12, 50),
                  },
                  (_, index) => index + 1,
                ).map((episode) => {
                  const watched = episode <= (item.episode ?? 0);

                  return (
                    <button
                      key={episode}
                      className="episode-row"
                      onClick={() =>
                        onUpdate({
                          ...item,
                          episode,
                          status: "watching",
                        })
                      }
                    >
                      <span className="episode-number">{episode}</span>

                      <span className="episode-title">Episode {episode}</span>

                      <span
                        className={`episode-check ${watched ? "checked" : ""}`}
                      >
                        {watched && <Check size={13} />}
                      </span>
                    </button>
                  );
                })}
              </div>
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
                <strong>{item.type}</strong>
              </div>

              <div>
                <span>Release year</span>
                <strong>{item.year}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>{item.status.replace("_", " ")}</strong>
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
              className="primary-button"
              onClick={() =>
                onUpdate({
                  ...item,
                  notes: note,
                })
              }
            >
              Save notes
            </button>

            <p className="muted-text">
              Notes are currently saved in local app state. Supabase persistence
              comes next.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [media, setMedia] = useState(initialMedia);

  const [view, setView] = useState<View>("home");

  const [searchQuery, setSearchQuery] = useState("");

  const [category, setCategory] = useState("all");

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [showFilters, setShowFilters] = useState(false);

  const [sort, setSort] = useState("recent");

  const [greeting, setGreeting] = useState("Welcome back!");

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      setGreeting("Good morning!");
    } else if (hour < 18) {
      setGreeting("Good afternoon!");
    } else {
      setGreeting("Good evening!");
    }
  }, []);

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
      results = results.filter((item) => item.type === category);
    }

    if (sort === "title") {
      results.sort((a, b) => a.title.localeCompare(b.title));
    }

    if (sort === "year") {
      results.sort((a, b) => b.year - a.year);
    }

    return results;
  }, [media, view, category, sort]);

  const updateItem = (updated: MediaItem) => {
    setMedia((previous) =>
      previous.map((item) => (item.id === updated.id ? updated : item)),
    );
  };

  const navigate = (nextView: View) => {
    setView(nextView);
    setCategory("all");
    setShowFilters(false);
  };

  const openFullSearch = () => {
    setView("search");
    setCategory("all");
    setShowFilters(false);
  };

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
      {/* SIDEBAR */}

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
          <button className="nav-item" onClick={() => navigate("library")}>
            <Settings size={19} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}

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
            {/* Desktop quick search.
                Hidden on full Search page. */}

            {view !== "search" && (
              <QuickSearch
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onViewAll={openFullSearch}
              />
            )}

            <button
              type="button"
              className="avatar"
              title="Personal library"
              onClick={() => navigate("library")}
            >
              M
            </button>
          </div>
        </header>

        {/* DASHBOARD */}

        {view === "home" && (
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

        {/* FULL SEARCH */}

        {view === "search" && (
          <MediaSearch
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onAdded={() => {
              // Later, refresh the user's Supabase-backed library here.
            }}
          />
        )}

        {/* PERSONAL LIBRARY */}

        {view !== "home" && view !== "search" && (
          <div className="library-page">
            <div className="library-toolbar">
              <div className="category-tabs">
                {categories.map((item) => (
                  <button
                    key={item.id}
                    className={category === item.id ? "active" : ""}
                    onClick={() => setCategory(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <button
                className="filter-button"
                onClick={() => setShowFilters(true)}
              >
                <SlidersHorizontal size={17} />
                <span>Filter & Sort</span>
              </button>
            </div>

            <div className="library-count">{filteredMedia.length} titles</div>

            {filteredMedia.length ? (
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
                <p>Try changing your filters.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MOBILE NAVIGATION */}

      <nav className="mobile-bottom-nav">
        {[
          {
            id: "home" as View,
            icon: Home,
            label: "Home",
          },
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
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}

        <button
          className={showFilters ? "active" : ""}
          onClick={() => setShowFilters(true)}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {/* MEDIA DETAILS */}

      {selectedItem && (
        <MediaDetails
          key={selectedItem.id}
          item={selectedItem}
          onClose={() => setSelectedId(null)}
          onUpdate={updateItem}
        />
      )}

      {/* FILTERS */}

      {showFilters && (
        <div className="filter-overlay" onClick={() => setShowFilters(false)}>
          <div
            className="filter-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="filter-header">
              <h2>Filter & Sort</h2>

              <button
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
              {[
                ["recent", "Recently Added"],
                ["title", "Title (A-Z)"],
                ["year", "Release Date"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={sort === value ? "active" : ""}
                  onClick={() => setSort(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
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
