import { CreateBotForm } from "@/components/dashboard/create-bot-form";
import { isOwner } from "@/lib/actions/owner-actions";

export default async function NewBotPage() {
  const owner = await isOwner();
  return (
    <div>
      <div className="mb-8">
        <a
          href="/dashboard"
          className="text-white/40 hover:text-white text-sm transition"
        >
          ← Voltar
        </a>
        <h1 className="text-2xl font-bold text-white mt-4">Novo Bot</h1>
        <p className="text-white/50 mt-1">
          Conecte seu bot do Telegram para começar a vender
        </p>
      </div>
      <CreateBotForm isOwner={owner} />
    </div>
  );
}
