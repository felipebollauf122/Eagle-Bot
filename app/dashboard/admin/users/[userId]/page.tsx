import { redirect, notFound } from "next/navigation";
import { isAdmin, getAdminUserProfile, getAdminUserBots } from "@/lib/actions/admin-actions";
import { AdminUserProfile } from "@/components/dashboard/admin-user-profile";

export default async function AdminUserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const { userId } = await params;
  const user = await getAdminUserProfile(userId);
  if (!user) notFound();

  const bots = await getAdminUserBots(userId);

  return (
    <div className="p-8 max-w-5xl">
      <div className="animate-up">
        <AdminUserProfile user={user} bots={bots} />
      </div>
    </div>
  );
}
