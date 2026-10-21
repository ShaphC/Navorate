"use client";

import { useEffect, useState } from "react";

import { Check, Clock3, Film, Loader2, Plus, Search, X } from "lucide-react";

import { posterUrl, type SearchItem } from "@/lib/media";
import { addMedia } from "@/lib/media-store";

type SearchCategory = "all" | "movie" | "series" | "anime" | "manga";

type MediaSearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onAdded?: () => void | Promise<void>;
};

type ProviderDetails = {
  runtime_minutes?: number | null;
  total_episodes?: number | null;
  total_seasons?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  publication_status?: string | null;
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

  const [previewItem, setPreviewItem] = useState<SearchItem | null>(null);
  const [previewDetails, setPreviewDetails] = useState<ProviderDetails | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

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

        if (controller.signal.aborted) return;

        setResults(Array.isArray(data.results) ? data.results : []);
        setSearched(true);
      } catch (err) {
        if (controller.signal.aborted) return;

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

  useEffect(() => {
    if (!previewItem) {
      setPreviewDetails(null);
      setPreviewError("");
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();

    setPreviewDetails(null);
    setPreviewError("");
    setPreviewLoading(true);

    const params = new URLSearchParams({
      source: previewItem.source,
      type: previewItem.media_type,
      id: previewItem.external_id,
    });

    void (async () => {
      try {
        const response = await fetch(
          `/api/media/details?${params.toString()}`,
          { signal: controller.signal },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load provider details.");
        }

        if (!controller.signal.aborted) {
          setPreviewDetails(data as ProviderDetails);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setPreviewError(
            err instanceof Error
              ? err.message
              : "Unable to load additional details.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [previewItem]);

  useEffect(() => {
    if (!previewItem) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && savingId === null) {
        setPreviewItem(null);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [previewItem, savingId]);

  async function handleAdd(item: SearchItem) {
    const itemId = `${item.source}-${item.external_id}`;

    if (savingId !== null || addedIds.includes(itemId)) return;

    setSavingId(itemId);
    setError("");
    setPreviewError("");

    try {
      await addMedia(item, "watch_later");

      setAddedIds((previous) =>
        previous.includes(itemId) ? previous : [...previous, itemId],
      );

      await onAdded?.();
    } catch (err) {
      console.error("Failed to add media:", err);

      const message =
        err instanceof Error
          ? err.message
          : "Unable to add this title to your library.";

      setError(message);
      setPreviewError(message);
    } finally {
      setSavingId(null);
    }
  }

  const hasQuery = query.trim().length >= 2;

  const previewId = previewItem
    ? `${previewItem.source}-${previewItem.external_id}`
    : null;

  const previewAdded = previewId !== null && addedIds.includes(previewId);
  const previewSaving = previewId !== null && savingId === previewId;

  return (
    <div className="media-search-page">
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

      {error && (
        <div className="search-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="search-loading">
          <Loader2 size={23} className="quick-search-spinner" />
          <span>Searching media...</span>
        </div>
      )}

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

      {hasQuery && !loading && searched && !error && results.length === 0 && (
        <div className="empty-state">
          <Film size={36} />
          <h3>No results found</h3>
          <p>No matches for "{query}". Try a different title or category.</p>
        </div>
      )}

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
                  <button
                    type="button"
                    className="search-result-poster"
                    onClick={() => setPreviewItem(item)}
                    aria-label={`View details for ${item.title}`}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: 0,
                      border: 0,
                      cursor: "pointer",
                      background: "transparent",
                      textAlign: "left",
                    }}
                  >
                    {poster ? (
                      <img src={poster} alt={item.title} loading="lazy" />
                    ) : (
                      <div className="poster-fallback">
                        <Film size={28} />
                        <span>{item.title}</span>
                      </div>
                    )}
                  </button>

                  <div className="search-result-info">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      title={`View details for ${item.title}`}
                      style={{
                        border: 0,
                        padding: 0,
                        background: "transparent",
                        color: "inherit",
                        textAlign: "left",
                        cursor: "pointer",
                        font: "inherit",
                      }}
                    >
                      <strong>{item.title}</strong>
                    </button>

                    <span>
                      {item.media_type} ·{" "}
                      {item.release_date?.slice(0, 4) || "Unknown year"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`search-add-button ${isAdded ? "saved" : ""}`}
                    disabled={isAdded || savingId !== null}
                    onClick={() => void handleAdd(item)}
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

      {previewItem && (
        <div
          className="details-overlay"
          onClick={() => {
            if (savingId === null) setPreviewItem(null);
          }}
        >
          <div
            className="details-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`Details for ${previewItem.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="details-topbar">
              <span className="muted-text">Media preview</span>

              <button
                type="button"
                className="icon-button"
                onClick={() => setPreviewItem(null)}
                disabled={savingId !== null}
                aria-label="Close preview"
              >
                <X size={19} />
              </button>
            </div>

            <div className="details-hero">
              <div className="details-poster">
                {posterUrl(previewItem.poster_path) ? (
                  <img
                    src={posterUrl(previewItem.poster_path)!}
                    alt={previewItem.title}
                  />
                ) : (
                  <div className="poster-fallback">
                    <Film size={28} />
                    <span>{previewItem.title}</span>
                  </div>
                )}
              </div>

              <div className="details-hero-content">
                <div className="eyebrow">
                  {previewItem.media_type} ·{" "}
                  {previewItem.release_date?.slice(0, 4) || "Unknown year"}
                </div>

                <h1>{previewItem.title}</h1>

                {previewItem.original_title &&
                  previewItem.original_title !== previewItem.title && (
                    <p className="muted-text">
                      Original title: {previewItem.original_title}
                    </p>
                  )}

                <p>{previewItem.overview || "No description available."}</p>

                <div className="details-hero-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={previewAdded || savingId !== null}
                    onClick={() => void handleAdd(previewItem)}
                  >
                    {previewAdded ? (
                      <Check size={16} />
                    ) : previewSaving ? (
                      <Loader2 size={16} className="quick-search-spinner" />
                    ) : (
                      <Plus size={16} />
                    )}

                    {previewAdded
                      ? "Added to Library"
                      : previewSaving
                        ? "Adding..."
                        : "Add to Library"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={savingId !== null}
                    onClick={() => setPreviewItem(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="details-body">
              <h3>Media information</h3>

              <div className="info-list">
                <div>
                  <span>Type</span>
                  <strong>{previewItem.media_type}</strong>
                </div>

                <div>
                  <span>Release date</span>
                  <strong>{previewItem.release_date || "Unknown"}</strong>
                </div>

                {previewItem.original_title && (
                  <div>
                    <span>Original title</span>
                    <strong>{previewItem.original_title}</strong>
                  </div>
                )}

                <div>
                  <span>Source</span>
                  <strong>
                    {previewItem.source === "tmdb" ? "TMDB" : "AniList"}
                  </strong>
                </div>

                {previewDetails?.runtime_minutes != null && (
                  <div>
                    <span>Runtime</span>
                    <strong>
                      <Clock3 size={14} style={{ display: "inline" }} />{" "}
                      {previewDetails.runtime_minutes} minutes
                    </strong>
                  </div>
                )}

                {previewDetails?.total_episodes != null && (
                  <div>
                    <span>Total episodes</span>
                    <strong>{previewDetails.total_episodes}</strong>
                  </div>
                )}

                {previewDetails?.total_seasons != null && (
                  <div>
                    <span>Total seasons</span>
                    <strong>{previewDetails.total_seasons}</strong>
                  </div>
                )}

                {previewDetails?.chapters != null && (
                  <div>
                    <span>Chapters</span>
                    <strong>{previewDetails.chapters}</strong>
                  </div>
                )}

                {previewDetails?.volumes != null && (
                  <div>
                    <span>Volumes</span>
                    <strong>{previewDetails.volumes}</strong>
                  </div>
                )}

                {previewDetails?.publication_status && (
                  <div>
                    <span>Publication status</span>
                    <strong>{previewDetails.publication_status}</strong>
                  </div>
                )}
              </div>

              {previewLoading && (
                <p className="muted-text">
                  <Loader2
                    size={15}
                    className="quick-search-spinner"
                    style={{ display: "inline" }}
                  />{" "}
                  Loading additional information...
                </p>
              )}

              {previewError && (
                <p className="muted-text" role="alert">
                  {previewError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
