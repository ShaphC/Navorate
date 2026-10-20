import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export type WatchedEpisode = {
  media_id: string;
  season_number: number;
  episode_number: number;
};

async function requireUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Please sign in.");
  return user.id;
}

export async function getWatchedEpisodes(mediaId?: string): Promise<WatchedEpisode[]> {
  const userId = await requireUserId();
  let query = supabase
    .from("media_episode_progress")
    .select("media_id,season_number,episode_number")
    .eq("user_id", userId);
  if (mediaId) query = query.eq("media_id", mediaId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WatchedEpisode[];
}

export async function setEpisodeWatched(
  mediaId: string,
  seasonNumber: number,
  episodeNumber: number,
  watched: boolean,
): Promise<void> {
  const userId = await requireUserId();
  if (watched) {
    const { error } = await supabase.from("media_episode_progress").upsert(
      {
        user_id: userId,
        media_id: mediaId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
      },
      { onConflict: "user_id,media_id,season_number,episode_number" },
    );
    if (error) throw error;
  } else {
    const { error } = await supabase.from("media_episode_progress")
      .delete()
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .eq("season_number", seasonNumber)
      .eq("episode_number", episodeNumber);
    if (error) throw error;
  }
}
