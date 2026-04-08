import { redirect } from "next/navigation";

export default async function BotDashboardPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  redirect(`/dashboard/bots/${botId}/flows`);
}
