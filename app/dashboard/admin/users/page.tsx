import { redirect } from "next/navigation";
import { isAdmin, getAdminUsers } from "@/lib/actions/admin-actions";
import { AdminUserTable } from "@/components/dashboard/admin-user-table";

export default async function AdminUsersPage() {
  const admin = await isAdmin();
  if (!admin) redirect("/dashboard");

  const users = await getAdminUsers();

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8 animate-up">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center section-icon"
            style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight page-title">
              Painel Admin
            </h1>
            <p className="text-(--text-secondary) text-sm">
              Gerencie todos os usuarios da plataforma
            </p>
          </div>
        </div>
      </div>

      <div className="animate-up-1">
        <AdminUserTable users={users} />
      </div>
    </div>
  );
}
