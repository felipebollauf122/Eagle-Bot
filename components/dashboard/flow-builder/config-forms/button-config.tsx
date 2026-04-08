"use client";

interface ButtonData { text: string; action: string; value: string; }

interface ButtonConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function ButtonConfig({ data, onChange }: ButtonConfigProps) {
  const text = String(data.text ?? "");
  const buttons = (data.buttons ?? []) as ButtonData[];

  const updateButton = (index: number, field: keyof ButtonData, value: string) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...data, buttons: updated });
  };

  const addButton = () => {
    onChange({ ...data, buttons: [...buttons, { text: "Novo Botao", action: "callback", value: "" }] });
  };

  const removeButton = (index: number) => {
    onChange({ ...data, buttons: buttons.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="input-label">Mensagem</label>
        <textarea
          value={text}
          onChange={(e) => onChange({ ...data, text: e.target.value })}
          rows={3}
          className="input resize-none"
        />
      </div>
      <div>
        <label className="input-label">Botoes</label>
        {buttons.map((btn, i) => (
          <div
            key={i}
            className="rounded-xl p-3 mb-2 space-y-2"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="text"
              value={btn.text}
              onChange={(e) => updateButton(i, "text", e.target.value)}
              placeholder="Texto do botao"
              className="input py-2! text-xs!"
            />
            <div className="flex gap-2">
              <select
                value={btn.action}
                onChange={(e) => updateButton(i, "action", e.target.value)}
                className="input flex-1 py-2! text-xs!"
              >
                <option value="callback">Callback</option>
                <option value="go_to_node">Ir para no</option>
                <option value="open_url">Abrir URL</option>
              </select>
              <button
                onClick={() => removeButton(i)}
                className="px-2 py-1 text-(--red) text-xs rounded-lg hover:bg-(--red-muted) transition"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              value={btn.value}
              onChange={(e) => updateButton(i, "value", e.target.value)}
              placeholder={btn.action === "open_url" ? "https://..." : "Valor"}
              className="input py-2! text-xs!"
            />
          </div>
        ))}
        <button
          onClick={addButton}
          className="w-full py-2 rounded-xl text-xs font-medium transition-all text-(--text-muted) hover:text-(--text-secondary) hover:bg-white/4"
          style={{
            border: "1px dashed var(--border-default)",
          }}
        >
          + Adicionar Botao
        </button>
      </div>
    </div>
  );
}
