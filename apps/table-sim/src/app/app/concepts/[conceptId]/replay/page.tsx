import { ReplayInspectorView } from "@/components/concepts/ReplayInspectorView";

export default async function ConceptReplayPage({
  params,
}: {
  params: Promise<{ conceptId: string }>;
}) {
  const { conceptId } = await params;

  return <ReplayInspectorView conceptId={decodeURIComponent(conceptId)} />;
}
