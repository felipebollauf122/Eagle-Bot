"use client";

import { MediaUpload } from "./media-upload";

interface ImageConfigProps {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function ImageConfig({ data, onChange }: ImageConfigProps) {
  return (
    <div className="space-y-3">
      <MediaUpload
        value={String(data.image_url ?? "")}
        onChange={(url) => onChange({ ...data, image_url: url })}
        accept="image/jpeg,image/png,image/gif,image/webp"
        label="Imagem"
        placeholder="https://... ou envie do computador"
      />
      <div>
        <label className="input-label">Legenda (opcional)</label>
        <input
          type="text"
          value={String(data.caption ?? "")}
          onChange={(e) => onChange({ ...data, caption: e.target.value })}
          className="input"
        />
      </div>
    </div>
  );
}
