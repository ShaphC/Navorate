import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";

// Explicitly allowlisted titles and hosts. No arbitrary URL fetching.
const sources = {
  "blue-lock": {
    name: "Blue Lock",
    url: "https://ww5.blmangafree.com/en",
    label: "Blue Lock chapter index",
  },
  "world-trigger": {
    name: "World Trigger",
    url: "https://world-trigger-chapters.online/",
    label: "World Trigger chapter index",
  },
} as const;

type TitleKey = keyof typeof sources;

type Chapter = {
  number: string;
  value: number;
  url: string;
};

function extractChapters(html: string, key: TitleKey): Chapter[] {
  const source = sources[key];
  const found = new Map<string, Chapter>();

  // Only links on the approved series index.
  // Don't fetch or copy chapter images.
  const links = html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  );

  for (const match of links) {
    const rawHref = match[1].replace(/&amp;/g, "&");

    let url: URL;

    try {
      url = new URL(rawHref, source.url);
    } catch {
      continue;
    }

    if (url.hostname !== new URL(source.url).hostname) {
      continue;
    }

    let path: string;

    try {
      path = decodeURIComponent(url.pathname);
    } catch {
      continue;
    }

    const pattern =
      key === "blue-lock"
        ? /\/blue-lock-en-chapter-(\d+(?:\.\d+)?)(?:\/)?$/i
        : /\/comic\/world-trigger-chapter-(\d+(?:\.\d+)?)(?:\/)?$/i;

    const chapterMatch = path.match(pattern);

    if (!chapterMatch) {
      continue;
    }

    const number = chapterMatch[1];
    const value = Number(number);

    if (!Number.isFinite(value) || value <= 0 || value > 10000) {
      continue;
    }

    const linkText = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Skip placeholder listings such as chapter 365 "SOON".
    if (/\b(soon|coming soon|upcoming)\b/i.test(linkText)) {
      continue;
    }

    found.set(number, {
      number,
      value,
      url: url.toString(),
    });
  }

  return [...found.values()].sort((a, b) => b.value - a.value);
}

export async function GET(request: NextRequest) {
  // Authenticate before processing any request, including ping.
  const auth = await requireApiUser();

  if (auth.response) {
    return auth.response;
  }

  if (request.nextUrl.searchParams.get("ping") === "1") {
    return NextResponse.json({
      ok: true,
      route: "/api/media/chapters",
    });
  }

  const key = request.nextUrl.searchParams.get("title");

  if (key !== "blue-lock" && key !== "world-trigger") {
    return NextResponse.json(
      { error: "Unsupported manga title." },
      { status: 400 },
    );
  }

  const source = sources[key];

  try {
    const response = await fetch(source.url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "MyMedia/1.0 (personal chapter metadata tracker)",
      },
      signal: AbortSignal.timeout(9000),
      next: {
        revalidate: 60 * 60 * 6,
      },
    });

    if (!response.ok) {
      throw new Error(`Source returned ${response.status}`);
    }

    const html = (await response.text()).slice(0, 2_000_000);
    const chapters = extractChapters(html, key);

    if (!chapters.length) {
      throw new Error("No chapter links found on source page.");
    }

    // Fractional chapters exist.
    // Use the latest full chapter for integer progress.
    const latestFull = chapters.find((chapter) =>
      Number.isInteger(chapter.value),
    );

    return NextResponse.json(
      {
        title: source.name,
        source: source.label,
        source_url: source.url,
        latest_chapter: chapters[0].number,
        latest_full_chapter: latestFull?.value ?? null,
        chapters,
        fetched_at: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    console.error("Manga chapter index unavailable", error);

    return NextResponse.json(
      {
        error: "Chapter source unavailable or its layout changed.",
      },
      { status: 502 },
    );
  }
}
