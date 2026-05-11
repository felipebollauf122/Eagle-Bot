"use client";

import { useRef } from "react";

interface TextConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

interface FormatButton {
  label: string;
  tag: string;
  title: string;
}

const FORMAT_BUTTONS: FormatButton[] = [
  { label: "B", tag: "b", title: "Negrito" },
  { label: "I", tag: "i", title: "Itálico" },
  { label: "U", tag: "u", title: "Sublinhado" },
  { label: "S", tag: "s", title: "Riscado" },
  { label: "</>", tag: "code", title: "Destaque (fundo)" },
  { label: "▒", tag: "tg-spoiler", title: "Spoiler (clica pra revelar)" },
];

export function TextConfig({ data, onChange }: TextConfigProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(tag: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const value = String(data.text ?? "");
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) {
      // Sem seleção: insere as duas tags com cursor no meio
      const next = `${value.slice(0, start)}<${tag}></${tag}>${value.slice(end)}`;
      onChange({ ...data, text: next });
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + tag.length + 2;
        ta.setSelectionRange(pos, pos);
      });
      return;
    }
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}<${tag}>${selected}</${tag}>${value.slice(end)}`;
    onChange({ ...data, text: next });
    requestAnimationFrame(() => {
      ta.focus();
      const newEnd = end + tag.length * 2 + 5;
      ta.setSelectionRange(start, newEnd);
    });
  }

  return (
    <div>
      <label className="input-label">Mensagem</label>
      <div className="flex flex-wrap gap-1 mb-2">
        {FORMAT_BUTTONS.map((btn) => (
          <button
            key={btn.tag}
            type="button"
            onClick={() => wrapSelection(btn.tag)}
            title={btn.title}
            className="px-2 py-1 text-xs rounded border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 font-mono"
          >
            {btn.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={String(data.text ?? "")}
        onChange={(e) => onChange({ ...data, text: e.target.value })}
        rows={5}
        placeholder="Use {{first_name}} para variaveis"
        className="input resize-none font-mono text-sm"
      />
      <p className="text-(--text-muted) text-[10px] mt-2">
        Selecione o texto e clique no botão pra formatar. Suporte: negrito, itálico, sublinhado, riscado, destaque (fundo) e spoiler.
        Variáveis: {`{{first_name}}`}, {`{{username}}`}, ou variáveis do estado.
      </p>
    </div>
  );
}
