"use client";

interface TriggerConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function TriggerConfig({ data, onChange }: TriggerConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="input-label">Tipo de Gatilho</label>
        <select
          value={String(data.trigger ?? "command")}
          onChange={(e) => onChange({ ...data, trigger: e.target.value })}
          className="input"
        >
          <option value="command">Comando</option>
          <option value="first_contact">Primeiro Contato</option>
        </select>
      </div>
      {String(data.trigger ?? "command") === "command" && (
        <div>
          <label className="input-label">Comando</label>
          <input
            type="text"
            value={String(data.command ?? "/start")}
            onChange={(e) => onChange({ ...data, command: e.target.value })}
            className="input"
          />
        </div>
      )}
    </div>
  );
}
