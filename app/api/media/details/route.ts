import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";

type MediaType = "movie" | "series" | "anime" | "manga";

type TMDBEpisode = {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
};

type TMDBSeason = {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
};

type TMDBShow = {
  id: number;
  name: string;
  number_of_episodes: number;
  number_of_seasons: number;
  seasons: TMDBSeason[];
};

type TMDBSeasonDetail = {
  id: number;
  season_number: number;
  name: string;
  episodes: TMDBEpisode[];
};

type TMDBMovie = {
  id: number;
  title: string;
  runtime: number | null;
};

type AniListMedia = {
  id: number;
  chapters: number | null;
  volumes: number | null;
  status: string | null;
};

const privateHeaders = { "Cache-Control": "private, no-store" };

async function tmdbFetch<T>(path: string): Promise<T> {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_API_READ_ACCESS_TOKEN is missing.");

  const response = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`TMDB returned ${response.status}.`);
  return (await response.json()) as T;
}

async function anilistDetails(id: number) {
  const query = `query ($id: Int) {
    Media(id: $id, type: MANGA) { id chapters volumes status }
  }`;
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { id } }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`AniList returned ${response.status}.`);
  const result: { data?: { Media?: AniListMedia }; errors?: { message: string }[] } = await response.json();
  if (result.errors?.length) throw new Error(result.errors[0].message);
  if (!result.data?.Media) throw new Error("Manga not found.");
  return result.data.Media;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const params = request.nextUrl.searchParams;
  const source = params.get("source");
  const type = params.get("type") as MediaType | null;
  const idRaw = params.get("id") ?? "";
  const seasonRaw = params.get("season");

  if (!/^[1-9]\d{0,14}$/.test(idRaw)) {
    return NextResponse.json({ error: "Invalid media ID." }, { status: 400, headers: privateHeaders });
  }
  if (!type || !["movie", "series", "anime", "manga"].includes(type)) {
    return NextResponse.json({ error: "Invalid media type." }, { status: 400, headers: privateHeaders });
  }
  if ((type === "manga" && source !== "anilist") || (type !== "manga" && source !== "tmdb")) {
    return NextResponse.json({ error: "Invalid provider for media type." }, { status: 400, headers: privateHeaders });
  }
  if (seasonRaw !== null && (!/^\d{1,3}$/.test(seasonRaw) || Number(seasonRaw) > 999)) {
    return NextResponse.json({ error: "Invalid season number." }, { status: 400, headers: privateHeaders });
  }

  try {
    if (type === "manga") {
      const manga = await anilistDetails(Number(idRaw));
      return NextResponse.json({
        source, type, external_id: idRaw,
        chapters: manga.chapters,
        volumes: manga.volumes,
        publication_status: manga.status,
      }, { headers: privateHeaders });
    }

    if (type === "movie") {
      const movie = await tmdbFetch<TMDBMovie>(`/movie/${idRaw}?language=en-US`);
      return NextResponse.json({ source, type, external_id: idRaw, runtime_minutes: movie.runtime }, { headers: privateHeaders });
    }

    const show = await tmdbFetch<TMDBShow>(`/tv/${idRaw}?language=en-US`);
    const seasons = show.seasons.map((season) => ({
      id: season.id,
      season_number: season.season_number,
      name: season.name,
      episode_count: season.episode_count,
      air_date: season.air_date,
      poster_path: season.poster_path,
    }));
    const selectedSeason = seasonRaw === null ? null : Number(seasonRaw);
    const seasonExists = selectedSeason === null || seasons.some((s) => s.season_number === selectedSeason);
    if (!seasonExists) {
      return NextResponse.json({ error: "Season not found." }, { status: 404, headers: privateHeaders });
    }

    let episodes: Array<{
      id: number;
      episode_number: number;
      name: string;
      overview: string;
      still_path: string | null;
      air_date: string | null;
      runtime_minutes: number | null;
    }> | null = null;

    if (selectedSeason !== null) {
      const detail = await tmdbFetch<TMDBSeasonDetail>(`/tv/${idRaw}/season/${selectedSeason}?language=en-US`);
      episodes = detail.episodes.map((episode) => ({
        id: episode.id,
        episode_number: episode.episode_number,
        name: episode.name,
        overview: episode.overview,
        still_path: episode.still_path,
        air_date: episode.air_date,
        runtime_minutes: episode.runtime,
      }));
    }

    return NextResponse.json({
      source, type, external_id: idRaw,
      total_episodes: show.number_of_episodes,
      total_seasons: show.number_of_seasons,
      seasons, selected_season: selectedSeason, episodes,
    }, { headers: privateHeaders });
  } catch (error) {
    console.error("Media details provider error:", error);
    return NextResponse.json({ error: "Unable to load media details from the provider." }, { status: 502, headers: privateHeaders });
  }
}
