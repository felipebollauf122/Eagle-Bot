"use client";

interface ConditionConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function ConditionConfig({ data, onChange }: ConditionConfigProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="input-label">Campo</label>
        <input
          type="text"
          value={String(data.field ?? "")}
          onChange={(e) => onChange({ ...data, field: e.target.value })}
          placeholder="Ex: paid, email, tag"
          className="input"
        />
      </div>
      <div>
        <label className="input-label">Operador</label>
        <select
          value={String(data.operator ?? "equals")}
          onChange={(e) => onChange({ ...data, operator: e.target.value })}
          className="input"
        >
          <option value="equals">Igual a</option>
          <option value="not_equals">Diferente de</option>
          <option value="exists">Existe</option>
          <option value="not_exists">Nao existe</option>
          <option value="contains">Contem</option>
          <option value="greater_than">Maior que</option>
          <option value="less_than">Menor que</option>
        </select>
      </div>
      {!["exists", "not_exists"].includes(String(data.operator ?? "equals")) && (
        <div>
          <label className="input-label">Valor</label>
          <input
            type="text"
            value={String(data.value ?? "")}
            onChange={(e) => onChange({ ...data, value: e.target.value })}
            className="input"
          />
        </div>
      )}
    </div>
  );
}
