import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";

const series = {
  "blue-lock": { name: "Blue Lock", wiki: "Blue_Lock" },
  "world-trigger": { name: "World Trigger", wiki: "World_Trigger" },
} as const;

type SeriesKey = keyof typeof series;
type VolumeResult = { total_volumes: number; source: string; source_url: string };
const privateHeaders = { "Cache-Control": "private, no-store" };

async function fromJikan(key: SeriesKey): Promise<VolumeResult | null> {
  const target = series[key];
  const response = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(target.name)}&limit=10`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!response.ok) throw new Error(`Jikan returned HTTP ${response.status}`);

  type JikanItem = {
    title?: string;
    title_english?: string;
    titles?: { title?: string }[];
    volumes?: number | null;
    url?: string;
  };
  const json: { data?: JikanItem[] } = await response.json();
  const data = (json.data ?? []).find((candidate) => {
    const names = [candidate.title, candidate.title_english, ...(candidate.titles ?? []).map((x) => x.title)]
      .filter(Boolean).join(" ").toLowerCase();
    return key === "blue-lock"
      ? /(?:^|\b)blue\s*lock(?:\b|$)|ブルーロック/.test(names)
      : /world\s*trigger|ワールドトリガー/.test(names);
  });
  const titles = [data?.title, data?.title_english, ...(data?.titles ?? []).map((x) => x.title)]
    .filter(Boolean).join(" ").toLowerCase();
  const matches = key === "blue-lock"
    ? /blue\s*lock|ブルーロック/.test(titles)
    : /world\s*trigger|ワールドトリガー/.test(titles);
  if (!matches) throw new Error("Jikan returned a different manga");
  const count = data?.volumes;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1) return null;
  return { total_volumes: count, source: "MyAnimeList via Jikan", source_url: data?.url ?? "" };
}

// Wikipedia's manga infobox can have a current Japanese volume count even when MAL lists null.
async function fromWikipedia(key: SeriesKey): Promise<VolumeResult | null> {
  const target = series[key];
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${target.wiki}&prop=text&format=json&formatversion=2&redirects=1`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "MyMedia/1.0 (personal manga metadata tracker)" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}`);
  const json: { parse?: { text?: string } } = await response.json();
  const html = json.parse?.text ?? "";
  const infobox = html.match(/<table\b[^>]*class="[^"]*infobox[^"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0] ?? "";
  const row = [...infobox.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map((m) => m[0]).find((r) => /(?:No\. of volumes|Volumes)/i.test(r)) ?? "";
  const clean = row.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
  const number = clean.match(/(?:No\. of volumes|Volumes)\s*:?\s*(\d{1,3})\b/i);
  const count = number ? Number(number[1]) : null;
  if (!count || count > 200) return null;
  return { total_volumes: count, source: "Wikipedia manga infobox", source_url: `https://en.wikipedia.org/wiki/${target.wiki}` };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const key = request.nextUrl.searchParams.get("title");
  if (key !== "blue-lock" && key !== "world-trigger") {
    return NextResponse.json({ error: "Unsupported manga title" }, { status: 400, headers: privateHeaders });
  }

  const attempts = await Promise.allSettled([fromJikan(key), fromWikipedia(key)]);
  const results = attempts
    .filter((r): r is PromiseFulfilledResult<VolumeResult> => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);
  // Prefer Jikan when it has a value; the second source helps with ongoing titles.
  const chosen = results[0] ?? null;

  return NextResponse.json({
    title: series[key].name,
    total_volumes: chosen?.total_volumes ?? null,
    source: chosen?.source ?? null,
    source_url: chosen?.source_url ?? null,
    status: chosen ? "available" : "unavailable",
    checked_at: new Date().toISOString(),
  }, { headers: privateHeaders });
}
