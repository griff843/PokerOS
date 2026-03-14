import { ConceptCaseView } from "@/components/concepts/ConceptCaseView";

export default async function ConceptCasePage({
  params,
}: {
  params: Promise<{ conceptId: string }>;
}) {
  const { conceptId } = await params;

  return <ConceptCaseView conceptId={decodeURIComponent(conceptId)} />;
}
