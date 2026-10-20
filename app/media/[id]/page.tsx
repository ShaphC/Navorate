import MyMediaApp from "@/components/MyMediaApp";

export default async function MediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MyMediaApp initialView="library" initialSelectedId={id} />;
}
