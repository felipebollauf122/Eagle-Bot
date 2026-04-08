import { CreateBotForm } from "@/components/dashboard/create-bot-form";

export default function NewBotPage() {
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
      <CreateBotForm />
    </div>
  );
}
