import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Layout dedicado da proof: bypass do sidebar/dashboard layout.
// Mantém auth (redirect /login se não logado) mas renderiza o documento
// limpo, otimizado pra leitura/impressão.
export default async function ProofLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {children}
    </div>
  );
}
