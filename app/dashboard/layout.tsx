import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen relative">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-[30%] w-[600px] h-[400px] bg-(--accent) rounded-full opacity-[0.015] blur-[180px]" />
        <div className="absolute bottom-0 right-[20%] w-[500px] h-[300px] bg-(--cyan) rounded-full opacity-[0.01] blur-[150px]" />
      </div>
      <Sidebar isAdmin={tenant?.role === "admin"} />
      <main className="flex-1 min-w-0 relative z-10">{children}</main>
    </div>
  );
}
