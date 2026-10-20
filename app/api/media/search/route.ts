import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";

type Category = "all" | "movie" | "series" | "anime" | "manga";
type SearchResult = {
  source: "tmdb" | "anilist";
  external_id: string;
  media_type: "movie" | "series" | "anime" | "manga";
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
};
type TMDBItem = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  genre_ids?: number[];
};
type AniListItem = {
  id: number;
  title: { english: string | null; romaji: string | null; native: string | null };
  description: string | null;
  coverImage: { large: string | null } | null;
  bannerImage: string | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
};

const privateHeaders = { "Cache-Control": "private, no-store" };

function isAnime(item: TMDBItem) {
  return item.original_language === "ja" && (item.genre_ids ?? []).includes(16);
}

function formatAniListDate(date: AniListItem["startDate"]): string | null {
  if (!date?.year) return null;
  const month = String(date.month ?? 1).padStart(2, "0");
  const day = String(date.day ?? 1).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

async function searchTMDB(query: string, type: "movie" | "tv"): Promise<SearchResult[]> {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) throw new Error("TMDB_API_READ_ACCESS_TOKEN is missing.");

  const params = new URLSearchParams({ query, include_adult: "false", language: "en-US", page: "1" });
  const response = await fetch(`https://api.themoviedb.org/3/search/${type}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`TMDB returned ${response.status}.`);
  const data: { results?: TMDBItem[] } = await response.json();

  return (data.results ?? []).map((item) => ({
    source: "tmdb",
    external_id: String(item.id),
    media_type: type === "movie" ? "movie" : isAnime(item) ? "anime" : "series",
    title: item.title ?? item.name ?? "Untitled",
    original_title: item.original_title ?? item.original_name ?? null,
    overview: item.overview ?? null,
    poster_path: item.poster_path ?? null,
    backdrop_path: item.backdrop_path ?? null,
    release_date: item.release_date ?? item.first_air_date ?? null,
  }));
}

async function searchAniList(search: string): Promise<SearchResult[]> {
  const graphqlQuery = `
    query ($search: String) {
      Page(page: 1, perPage: 20) {
        media(search: $search, type: MANGA) {
          id
          title { english romaji native }
          description(asHtml: false)
          coverImage { large }
          bannerImage
          startDate { year month day }
        }
      }
    }
  `;
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: graphqlQuery, variables: { search } }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`AniList returned ${response.status}.`);
  const data: {
    data?: { Page?: { media?: AniListItem[] } };
    errors?: { message: string }[];
  } = await response.json();
  if (data.errors?.length) throw new Error(data.errors[0].message);

  return (data.data?.Page?.media ?? []).map((item) => ({
    source: "anilist",
    external_id: String(item.id),
    media_type: "manga",
    title: item.title.english ?? item.title.romaji ?? item.title.native ?? "Untitled",
    original_title: item.title.native ?? null,
    overview: item.description ?? null,
    poster_path: item.coverImage?.large ?? null,
    backdrop_path: item.bannerImage,
    release_date: formatAniListDate(item.startDate),
  }));
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const category = request.nextUrl.searchParams.get("category") ?? "all";
  const allowed: Category[] = ["all", "movie", "series", "anime", "manga"];

  if (!allowed.includes(category as Category)) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400, headers: privateHeaders });
  }
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({ error: "Search must contain 2–100 characters." }, { status: 400, headers: privateHeaders });
  }

  const jobs: Promise<SearchResult[]>[] = [];
  if (category === "all" || category === "movie") jobs.push(searchTMDB(query, "movie"));
  if (category === "all" || category === "series" || category === "anime") jobs.push(searchTMDB(query, "tv"));
  if (category === "all" || category === "manga") jobs.push(searchAniList(query));

  const settled = await Promise.allSettled(jobs);
  const successful = settled.filter(
    (result): result is PromiseFulfilledResult<SearchResult[]> => result.status === "fulfilled",
  );
  if (!successful.length) {
    console.error("All media searches failed:", settled);
    return NextResponse.json({ error: "Media providers are unavailable." }, { status: 502, headers: privateHeaders });
  }

  let results = successful.flatMap((result) => result.value);
  if (category === "anime") results = results.filter((item) => item.media_type === "anime");

  return NextResponse.json({ results, partial: successful.length !== jobs.length }, { headers: privateHeaders });
}
