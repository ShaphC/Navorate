import { createClient } from "@/lib/supabase/client";
import type { MediaStatus, SavedMedia, SearchItem } from "@/lib/media";

const supabase = createClient();

export async function getMyMedia(): Promise<SavedMedia[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in.");
  }

  const { data, error } = await supabase
    .from("media_items")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as SavedMedia[];
}

export async function addMedia(
  item: SearchItem,
  status: MediaStatus = "watch_later",
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in.");
  }

  const { data, error } = await supabase
    .from("media_items")
    .upsert(
      {
        user_id: user.id,
        source: item.source,
        external_id: item.external_id,
        media_type: item.media_type,
        title: item.title,
        original_title: item.original_title,
        overview: item.overview,
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        release_date: item.release_date,
        status,
      },
      {
        onConflict: "user_id,source,external_id",
        ignoreDuplicates: true,
      },
    )
    .select()
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function updateMedia(
  id: string,
  changes: Partial<
    Pick<
      SavedMedia,
      | "status"
      | "current_season"
      | "last_watched_episode"
      | "current_volume"
      | "last_read_chapter"
      | "movie_progress_seconds"
      | "notes"
    >
  >,
) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in.");
  }

  const { data, error } = await supabase
    .from("media_items")
    .update(changes)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;

  return data as SavedMedia;
}
