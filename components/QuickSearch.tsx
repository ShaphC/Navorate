"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { addMedia } from "@/lib/media-store";
import { posterUrl, type SearchItem } from "@/lib/media";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  onViewAll: () => void;
  onAdded?: () => void | Promise<void>;
  savedKeys?: string[];
};

const keyOf = (item: SearchItem) => `${item.source}-${item.external_id}`;

export default function QuickSearch({
  query,
  onQueryChange,
  onViewAll,
  onAdded,
  savedKeys = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const trimmed = query.trim();
  const saved = new Set([...savedKeys, ...justAdded]);

  useEffect(() => {
    if (!open || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const id = ++requestId.current;
    setLoading(true);
    setError("");

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/media/search?q=${encodeURIComponent(trimmed)}&category=all`,
          { signal: controller.signal },
        );
        const data: { results?: SearchItem[]; error?: string } =
          await response.json();
        if (!response.ok) throw new Error(data.error || "Search failed.");
        if (id === requestId.current) setResults((data.results ?? []).slice(0, 7));
      } catch (err) {
        if (controller.signal.aborted || id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Search failed.");
        setResults([]);
      } finally {
        if (id === requestId.current && !controller.signal.aborted) setLoading(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, trimmed]);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  async function handleAdd(item: SearchItem) {
    const key = keyOf(item);
    if (savingKey || saved.has(key)) return;
    setSavingKey(key);
    setError("");
    try {
      await addMedia(item, "watch_later");
      setJustAdded((previous) => [...previous, key]);
      try {
        await onAdded?.();
      } catch (refreshError) {
        console.error("Added media, but library refresh failed:", refreshError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add title.");
    } finally {
      setSavingKey(null);
    }
  }

  function viewAll() {
    setOpen(false);
    onViewAll();
  }

  return (
    <div className="quick-search" ref={rootRef}>
      <div className="mymedia-quick-input-wrap">
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Search movies, shows, anime and manga"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && trimmed.length >= 2) viewAll();
          }}
          placeholder="Search movies, shows, anime, manga..."
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { onQueryChange(""); setResults([]); }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {open && trimmed.length >= 2 && (
        <div className="mymedia-quick-dropdown">
          {loading && <div className="mymedia-quick-message"><Loader2 size={16} /> Searching...</div>}
          {!loading && results.length === 0 && !error && (
            <div className="mymedia-quick-message">No results found.</div>
          )}
          {error && <div role="alert" className="mymedia-quick-error">{error}</div>}
          {!loading && results.map((item) => {
            const key = keyOf(item);
            const alreadySaved = saved.has(key);
            const image = posterUrl(item.poster_path);
            return (
              <div className="mymedia-quick-result" key={key}>
                <button type="button" className="mymedia-quick-title" onClick={viewAll}>
                  {image ? <img src={image} alt="" loading="lazy" /> : <span className="mymedia-quick-placeholder">—</span>}
                  <span className="mymedia-quick-copy">
                    <strong>{item.title}</strong>
                    <small>{item.media_type} {item.release_date ? `· ${item.release_date.slice(0, 4)}` : ""}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="mymedia-quick-add"
                  disabled={alreadySaved || savingKey !== null}
                  onClick={() => void handleAdd(item)}
                  aria-label={alreadySaved ? `${item.title} already in library` : `Add ${item.title} to Watch Later`}
                  title={alreadySaved ? "Already in library" : "Add to Watch Later"}
                >
                  {alreadySaved ? <><Check size={15} /> Added</> : savingKey === key ? <Loader2 size={15} /> : <><Plus size={15} /> Add</>}
                </button>
              </div>
            );
          })}
          <button type="button" className="mymedia-quick-view-all" onClick={viewAll}>
            View all results →
          </button>
        </div>
      )}
      <style jsx>{`
        .quick-search { position: relative; width: 480px; max-width: 100%; z-index: 100; }
        .mymedia-quick-input-wrap { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 13px; border-radius: 12px; border: 1px solid rgba(190,184,230,.18); background: #1b1b31; color: #a9a7c4; }
        .mymedia-quick-input-wrap:focus-within { border-color: #8974e8; }
        .mymedia-quick-input-wrap input { min-width: 0; width: 100%; border: 0; outline: 0; background: transparent; color: #f6f4ff; font: inherit; font-size: 13px; }
        .mymedia-quick-input-wrap input::placeholder { color: #9490ac; }
        .mymedia-quick-input-wrap button { display: grid; place-items: center; border: 0; background: transparent; color: #aaa6c3; cursor: pointer; }
        .mymedia-quick-dropdown { position: absolute; top: calc(100% + 9px); right: 0; width: min(520px, 92vw); max-height: 520px; overflow-y: auto; border: 1px solid rgba(190,184,230,.18); border-radius: 14px; background: #19192e; box-shadow: 0 20px 55px rgba(0,0,0,.45); padding: 7px; }
        .mymedia-quick-result { display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 9px; }
        .mymedia-quick-result:hover { background: rgba(255,255,255,.045); }
        .mymedia-quick-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 11px; text-align: left; border: 0; background: transparent; color: #f4f2ff; cursor: pointer; }
        .mymedia-quick-title img, .mymedia-quick-placeholder { width: 37px; height: 53px; object-fit: cover; border-radius: 5px; flex-shrink: 0; }
        .mymedia-quick-placeholder { display: grid; place-items: center; background: #30304b; }
        .mymedia-quick-copy { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
        .mymedia-quick-copy strong { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mymedia-quick-copy small { font-size: 11px; color: #a6a2be; text-transform: capitalize; }
        .mymedia-quick-add { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; padding: 8px 9px; border: 1px solid rgba(151,132,245,.45); border-radius: 8px; background: rgba(122,95,230,.18); color: #d8d0ff; font-size: 12px; cursor: pointer; }
        .mymedia-quick-add:disabled { opacity: .65; cursor: default; }
        .mymedia-quick-message, .mymedia-quick-error { padding: 15px 11px; color: #b5b1cd; font-size: 13px; display: flex; align-items: center; gap: 8px; }
        .mymedia-quick-error { color: #ff9b9b; }
        .mymedia-quick-view-all { display: block; width: 100%; padding: 12px; margin-top: 5px; border: 0; border-top: 1px solid rgba(255,255,255,.08); background: transparent; color: #c3b7ff; font-size: 13px; font-weight: 600; text-align: center; cursor: pointer; }
      `}</style>
    </div>
  );
}
