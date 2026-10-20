import { NextRequest, NextResponse } from "next/server";

const series = {
  "blue-lock": { name: "Blue Lock", wiki: "Blue_Lock" },
  "world-trigger": { name: "World Trigger", wiki: "World_Trigger" },
} as const;

type SeriesKey = keyof typeof series;

async function fromJikan(key: SeriesKey) {
  const target = series[key];
  const response = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(target.name)}&limit=10`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!response.ok) throw new Error(`Jikan returned HTTP ${response.status}`);
  const json = await response.json();
  const data = (json?.data ?? []).find((candidate: { title?: string; title_english?: string; titles?: { title?: string }[] }) => {
    const names = [candidate.title, candidate.title_english, ...(candidate.titles ?? []).map(x => x.title)].filter(Boolean).join(" ").toLowerCase();
    return key === "blue-lock" ? /(?:^|\b)blue\s*lock(?:\b|$)|ブルーロック/.test(names) : /world\s*trigger|ワールドトリガー/.test(names);
  });
  const titles = [data?.title, data?.title_english, ...(data?.titles ?? []).map((x: { title?: string }) => x.title)].filter(Boolean).join(" ").toLowerCase();
  const matches = key === "blue-lock" ? /blue\s*lock|ブルーロック/.test(titles) : /world\s*trigger|ワールドトリガー/.test(titles);
  if (!matches) throw new Error("Jikan returned a different manga");
  const count = data?.volumes;
  if (!Number.isSafeInteger(count) || count < 1) return null;
  return { total_volumes: count as number, source: "MyAnimeList via Jikan", source_url: data.url as string };
}

// Wikipedia's manga infobox can have a current Japanese volume count even when MAL lists null.
async function fromWikipedia(key: SeriesKey) {
  const target = series[key];
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${target.wiki}&prop=text&format=json&formatversion=2&redirects=1`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "MyMedia/1.0 (personal manga metadata tracker)" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 60 * 60 * 12 },
  });
  if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}`);
  const json = await response.json();
  const html: string = json?.parse?.text ?? "";
  const infobox = html.match(/<table\b[^>]*class="[^"]*infobox[^\"]*"[^>]*>[\s\S]*?<\/table>/i)?.[0] ?? "";
  const row = [...infobox.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(m => m[0]).find(r => /(?:No\. of volumes|Volumes)/i.test(r)) ?? "";
  const clean = row.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
  const number = clean.match(/(?:No\. of volumes|Volumes)\s*:?\s*(\d{1,3})\b/i);
  const count = number ? Number(number[1]) : null;
  if (!count || count > 200) return null;
  return { total_volumes: count, source: "Wikipedia manga infobox", source_url: `https://en.wikipedia.org/wiki/${target.wiki}` };
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("title");
  if (key !== "blue-lock" && key !== "world-trigger") {
    return NextResponse.json({ error: "Unsupported manga title" }, { status: 400 });
  }
  const attempts = await Promise.allSettled([fromJikan(key), fromWikipedia(key)]);
  const results = attempts.filter((r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof fromJikan>>>> => r.status === "fulfilled" && r.value !== null).map(r => r.value);
  // Prefer Jikan when it has a value; the second source helps with ongoing titles.
  const chosen = results[0] ?? null;
  return NextResponse.json({
    title: series[key].name,
    total_volumes: chosen?.total_volumes ?? null,
    source: chosen?.source ?? null,
    source_url: chosen?.source_url ?? null,
    status: chosen ? "available" : "unavailable",
    checked_at: new Date().toISOString(),
  });
}
