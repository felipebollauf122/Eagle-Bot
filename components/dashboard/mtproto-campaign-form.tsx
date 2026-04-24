"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaign, launchCampaign } from "@/app/dashboard/automations/actions";

export function MtprotoCampaignForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [targetsRaw, setTargetsRaw] = useState("");
  const [delayMin, setDelayMin] = useState(30);
  const [delayMax, setDelayMax] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent, launch: boolean) {
    e.preventDefault();
    setError(null);
    if (delayMin > delayMax) {
      setError("Delay mínimo não pode ser maior que o máximo");
      return;
    }
    startTransition(async () => {
      try {
        const { campaignId } = await createCampaign({
          name,
          message,
          targetsRaw,
          delayMin,
          delayMax,
        });
        if (launch) await launchCampaign(campaignId);
        router.push(`/dashboard/automations/campaigns/${campaignId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "erro");
      }
    });
  }

  return (
    <form className="space-y-4">
      <div>
        <label className="text-white/70 text-sm block mb-1">Nome</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white"
        />
      </div>
      <div>
        <label className="text-white/70 text-sm block mb-1">Mensagem</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white"
        />
      </div>
      <div>
        <label className="text-white/70 text-sm block mb-1">
          Lista de alvos (um por linha, @username ou +telefone)
        </label>
        <textarea
          value={targetsRaw}
          onChange={(e) => setTargetsRaw(e.target.value)}
          required
          rows={8}
          className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white font-mono text-sm"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-white/70 text-sm block mb-1">Delay mín (s)</label>
          <input
            type="number"
            value={delayMin}
            onChange={(e) => setDelayMin(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white"
          />
        </div>
        <div className="flex-1">
          <label className="text-white/70 text-sm block mb-1">Delay máx (s)</label>
          <input
            type="number"
            value={delayMax}
            onChange={(e) => setDelayMax(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white"
          />
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={(e) => submit(e, false)}
          disabled={pending}
          className="px-4 py-2 rounded border border-white/15 text-white/80 hover:bg-white/5"
        >
          Salvar rascunho
        </button>
        <button
          onClick={(e) => submit(e, true)}
          disabled={pending}
          className="px-4 py-2 rounded bg-(--accent) text-black font-medium"
        >
          Salvar e disparar
        </button>
      </div>
    </form>
  );
}
