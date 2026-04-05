import { CommandCenter } from "@/components/command/CommandCenter";
import { parseDailyPlanSessionOverride } from "@/lib/daily-plan-session-bridge";

export default function SessionPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const dailyPlanOverride = parseDailyPlanSessionOverride(searchParams);
  return <CommandCenter dailyPlanOverride={dailyPlanOverride} />;
}
