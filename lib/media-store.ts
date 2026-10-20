import { createClient } from "@/lib/supabase/client";
import type { MediaStatus, SavedMedia, SearchItem } from "@/lib/media";

const supabase = createClient();

async function userId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Please sign in.");
  return user.id;
}

export async function getMyMedia(): Promise<SavedMedia[]> {
  const id = await userId();
  const { data, error } = await supabase.from("media_items")
    .select("*").eq("user_id", id).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedMedia[];
}

export async function addMedia(item: SearchItem, status: MediaStatus = "watch_later") {
  const id = await userId();
  const { data, error } = await supabase.from("media_items")
    .upsert({
      user_id: id, source: item.source, external_id: item.external_id,
      media_type: item.media_type, title: item.title,
      original_title: item.original_title, overview: item.overview,
      poster_path: item.poster_path, backdrop_path: item.backdrop_path,
      release_date: item.release_date, status,
    }, { onConflict: "user_id,source,external_id", ignoreDuplicates: true })
    .select().maybeSingle();
  if (error) throw error;
  return data;
}

export type MediaChanges = Partial<Pick<SavedMedia,
  | "status" | "current_season" | "last_watched_episode"
  | "total_episodes" | "current_volume" | "last_read_chapter"
  | "total_chapters" | "total_volumes" | "movie_progress_seconds" | "runtime_minutes" | "notes"
>>;

export async function updateMedia(id: string, changes: MediaChanges): Promise<SavedMedia> {
  const user = await userId();
  const { data, error } = await supabase.from("media_items")
    .update(changes).eq("id", id).eq("user_id", user).select().single();
  if (error) throw error;
  return data as SavedMedia;
}
