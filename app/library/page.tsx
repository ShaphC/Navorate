import MyMediaApp from "@/components/MyMediaApp";

type LibraryView = "library" | "watch_later" | "completed" | "on_hold";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const initialView: LibraryView = status === "watch_later" || status === "completed" || status === "on_hold" ? status : "library";
  return <MyMediaApp initialView={initialView} />;
}
