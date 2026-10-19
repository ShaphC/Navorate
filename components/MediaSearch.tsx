"use client";

import { useEffect, useState } from "react";

import { Check, Film, Loader2, Plus, Search, X } from "lucide-react";

import { posterUrl, type SearchItem } from "@/lib/media";

import { addMedia } from "@/lib/media-store";

type SearchCategory = "all" | "movie" | "series" | "anime" | "manga";

type MediaSearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onAdded?: () => void | Promise<void>;
};

const categories: {
  id: SearchCategory;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "TV Series" },
  { id: "anime", label: "Anime" },
  { id: "manga", label: "Manga" },
];

export default function MediaSearch({
  query,
  onQueryChange,
  onAdded,
}: MediaSearchProps) {
  const [category, setCategory] = useState<SearchCategory>("all");

  const [results, setResults] = useState<SearchItem[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [savingId, setSavingId] = useState<string | null>(null);

  const [addedIds, setAddedIds] = useState<string[]>([]);

  const [searched, setSearched] = useState(false);

  /*
   * Search TMDB and AniList.
   *
   * The query comes from page.tsx,
   * so QuickSearch and MediaSearch
   * share the same text.
   */
  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      setSearched(false);
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setError("");
    setSearched(false);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: trimmedQuery,
          category,
        });

        const response = await fetch(`/api/media/search?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          let message = `Search failed (${response.status}).`;

          try {
            const body = await response.json();

            if (typeof body.error === "string") {
              message = body.error;
            }
          } catch {
            // Keep the default error message.
          }

          throw new Error(message);
        }

        const data = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        setResults(Array.isArray(data.results) ? data.results : []);

        setSearched(true);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Media search error:", err);

        setResults([]);
        setSearched(true);

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while searching.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, category]);

  /*
   * Add a selected title to Supabase.
   */
  async function handleAdd(item: SearchItem) {
    const itemId = `${item.source}-${item.external_id}`;

    if (savingId !== null || addedIds.includes(itemId)) {
      return;
    }

    setSavingId(itemId);
    setError("");

    try {
      await addMedia(item, "watch_later");

      setAddedIds((previous) => {
        if (previous.includes(itemId)) {
          return previous;
        }

        return [...previous, itemId];
      });

      await onAdded?.();
    } catch (err) {
      console.error("Failed to add media:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to add this title to your library.",
      );
    } finally {
      setSavingId(null);
    }
  }

  const hasQuery = query.trim().length >= 2;

  return (
    <div className="media-search-page">
      {/* SEARCH INPUT */}

      <div className="real-search-field">
        <Search size={19} />

        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search movies, TV series, anime, manga..."
          aria-label="Search movies, TV series, anime, and manga"
          autoComplete="off"
        />

        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* CATEGORY FILTERS */}

      <div className="category-tabs real-search-categories">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            className={category === item.id ? "active" : ""}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="search-error" role="alert">
          {error}
        </div>
      )}

      {/* LOADING */}

      {loading && (
        <div className="search-loading">
          <Loader2 size={23} className="quick-search-spinner" />

          <span>Searching media...</span>
        </div>
      )}

      {/* EMPTY INITIAL STATE */}

      {!hasQuery && !loading && (
        <div className="empty-state">
          <Search size={36} />

          <h3>Discover something new</h3>

          <p>
            Search for movies, TV series, anime, or manga to add to your
            library.
          </p>
        </div>
      )}

      {/* NO RESULTS */}

      {hasQuery && !loading && searched && !error && results.length === 0 && (
        <div className="empty-state">
          <Film size={36} />

          <h3>No results found</h3>

          <p>No matches for "{query}". Try a different title or category.</p>
        </div>
      )}

      {/* SEARCH RESULTS */}

      {hasQuery && !loading && results.length > 0 && (
        <>
          <div className="library-count">
            {results.length} {results.length === 1 ? "result" : "results"}
          </div>

          <div className="real-search-grid">
            {results.map((item) => {
              const itemId = `${item.source}-${item.external_id}`;

              const poster = posterUrl(item.poster_path);

              const isAdded = addedIds.includes(itemId);

              const isSaving = savingId === itemId;

              return (
                <div key={itemId} className="search-result-card">
                  {/* POSTER */}

                  <div className="search-result-poster">
                    {poster ? (
                      <img src={poster} alt={item.title} loading="lazy" />
                    ) : (
                      <div className="poster-fallback">
                        <Film size={28} />
                        <span>{item.title}</span>
                      </div>
                    )}
                  </div>

                  {/* TITLE AND METADATA */}

                  <div className="search-result-info">
                    <strong title={item.title}>{item.title}</strong>

                    <span>
                      {item.media_type} ·{" "}
                      {item.release_date?.slice(0, 4) || "Unknown year"}
                    </span>
                  </div>

                  {/* ADD TO LIBRARY */}

                  <button
                    type="button"
                    className={`search-add-button ${isAdded ? "saved" : ""}`}
                    disabled={isAdded || savingId !== null}
                    onClick={() => handleAdd(item)}
                  >
                    {isAdded ? (
                      <Check size={15} />
                    ) : isSaving ? (
                      <Loader2 size={15} className="quick-search-spinner" />
                    ) : (
                      <Plus size={15} />
                    )}

                    {isAdded
                      ? "Added"
                      : isSaving
                        ? "Adding..."
                        : "Add to Library"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
