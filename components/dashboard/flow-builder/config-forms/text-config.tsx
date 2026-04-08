"use client";

interface TextConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function TextConfig({ data, onChange }: TextConfigProps) {
  return (
    <div>
      <label className="input-label">Mensagem</label>
      <textarea
        value={String(data.text ?? "")}
        onChange={(e) => onChange({ ...data, text: e.target.value })}
        rows={5}
        placeholder="Use {{first_name}} para variaveis"
        className="input resize-none"
      />
      <p className="text-(--text-muted) text-[10px] mt-2">
        Variaveis: {`{{first_name}}`}, {`{{username}}`}, ou variaveis do estado
      </p>
    </div>
  );
}
