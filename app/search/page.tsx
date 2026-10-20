import MyMediaApp from "@/components/MyMediaApp";

export default async function SearchPage({ searchParams }: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <MyMediaApp initialView="search" initialSearchQuery={q ?? ""} />;
}
