import { InterventionExecutionView } from "@/components/concepts/InterventionExecutionView";

export default async function InterventionExecutionPage({
  params,
}: {
  params: Promise<{ conceptId: string }>;
}) {
  const { conceptId } = await params;

  return <InterventionExecutionView conceptId={decodeURIComponent(conceptId)} />;
}
