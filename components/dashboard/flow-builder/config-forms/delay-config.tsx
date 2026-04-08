"use client";

interface DelayConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function DelayConfig({ data, onChange }: DelayConfigProps) {
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <label className="input-label">Duracao</label>
        <input
          type="number"
          value={Number(data.amount ?? 0)}
          onChange={(e) => onChange({ ...data, amount: parseInt(e.target.value) || 0 })}
          min={0}
          className="input"
        />
      </div>
      <div className="flex-1">
        <label className="input-label">Unidade</label>
        <select
          value={String(data.unit ?? "seconds")}
          onChange={(e) => onChange({ ...data, unit: e.target.value })}
          className="input"
        >
          <option value="seconds">Segundos</option>
          <option value="minutes">Minutos</option>
          <option value="hours">Horas</option>
        </select>
      </div>
    </div>
  );
}
