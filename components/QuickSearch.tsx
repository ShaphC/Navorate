"use client";

import { useEffect, useRef, useState } from "react";

import { ArrowRight, Film, Loader2, Search, X } from "lucide-react";

import { posterUrl, type SearchItem } from "@/lib/media";

type QuickSearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onViewAll: () => void;
};

export default function QuickSearch({
  query,
  onQueryChange,
  onViewAll,
}: QuickSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          q: trimmed,
          category: "all",
        });

        const response = await fetch(`/api/media/search?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Search failed (${response.status})`);
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setResults(
            Array.isArray(data.results) ? data.results.slice(0, 6) : [],
          );
        }
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error("Quick search error:", err);
        setError("Unable to load search results.");
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const showDropdown = open && query.trim().length >= 2;

  function viewAll() {
    setOpen(false);
    onViewAll();
  }

  return (
    <div className="quick-search" ref={containerRef}>
      <div className={`quick-search-input ${open ? "focused" : ""}`}>
        <Search size={18} />

        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search movies, TV series, anime, manga..."
          aria-label="Quick search media"
          aria-expanded={showDropdown}
          aria-controls="quick-search-results"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }

            if (event.key === "Enter" && query.trim()) {
              viewAll();
            }
          }}
        />

        {loading ? (
          <Loader2 size={16} className="quick-search-spinner" />
        ) : query ? (
          <button
            type="button"
            className="quick-search-clear"
            aria-label="Clear search"
            onClick={() => {
              onQueryChange("");
              setResults([]);
              inputRef.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      {showDropdown && (
        <div id="quick-search-results" className="quick-search-dropdown">
          <div className="quick-search-heading">
            <span>Search results</span>
            <span>TMDB + AniList</span>
          </div>

          {error ? (
            <div className="quick-search-message">{error}</div>
          ) : loading ? (
            <div className="quick-search-message">Searching media...</div>
          ) : results.length === 0 ? (
            <div className="quick-search-message">
              No results found for "{query}"
            </div>
          ) : (
            <div className="quick-search-results">
              {results.map((item) => {
                const poster = posterUrl(item.poster_path);

                return (
                  <button
                    type="button"
                    className="quick-search-result"
                    key={`${item.source}-${item.external_id}`}
                    onClick={viewAll}
                  >
                    <div className="quick-search-poster">
                      {poster ? (
                        <img src={poster} alt="" loading="lazy" />
                      ) : (
                        <Film size={20} />
                      )}
                    </div>

                    <div className="quick-search-result-info">
                      <strong>{item.title}</strong>

                      <span>
                        {item.media_type} ·{" "}
                        {item.release_date?.slice(0, 4) || "Unknown year"}
                      </span>
                    </div>

                    <ArrowRight size={16} />
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className="quick-search-view-all"
            onClick={viewAll}
          >
            View all results
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
