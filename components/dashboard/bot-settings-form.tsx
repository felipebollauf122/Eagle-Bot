"use client";

import { useState, useRef } from "react";
import { saveBotSettings, updateBotAvatar, toggleBlackEnabled } from "@/lib/actions/bot-settings-actions";
import { uploadMedia } from "@/lib/actions/upload-actions";
import type { Bot } from "@/lib/types/database";

interface BotSettingsFormProps {
  bot: Bot;
  isAdmin?: boolean;
}

const sections = [
  { key: "info", label: "Informacoes do Bot", desc: "Status e configuracao geral", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z", color: "var(--accent)" },
  { key: "facebook", label: "Facebook Ads", desc: "Pixel e Conversions API", icon: "M22 12h-4l-3 9L9 3l-3 9H2", color: "var(--cyan)" },
  { key: "utmify", label: "Utmify", desc: "Integracao de tracking", icon: "M22 12h-4l-3 9L9 3l-3 9H2", color: "var(--purple)" },
  { key: "sigilo", label: "Poseidon Pay (Pix)", desc: "Gateway de pagamento", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6", color: "var(--accent)" },
  { key: "tracking", label: "Pagina de Tracking", desc: "Configuracao da pagina de redirecionamento", icon: "M21 12a9 9 0 11-6.219-8.56", color: "var(--amber)" },
];

export function BotSettingsForm({ bot, isAdmin = false }: BotSettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isActive, setIsActive] = useState(bot.is_active);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [blackEnabled, setBlackEnabled] = useState(bot.black_enabled ?? false);
  const [togglingBlack, setTogglingBlack] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(bot.avatar_url ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [pixelId, setPixelId] = useState(bot.facebook_pixel_id ?? "");
  const [accessToken, setAccessToken] = useState(bot.facebook_access_token ?? "");
  const [utmifyKey, setUtmifyKey] = useState(bot.utmify_api_key ?? "");
  const [sigiloPublicKey, setSigiloPublicKey] = useState(bot.sigilopay_public_key ?? "");
  const [sigiloSecretKey, setSigiloSecretKey] = useState(bot.sigilopay_secret_key ?? "");
  const [trackingMode, setTrackingMode] = useState<"redirect" | "prelander">(bot.tracking_mode ?? "redirect");
  const [headline, setHeadline] = useState(bot.prelander_headline ?? "");
  const [description, setDescription] = useState(bot.prelander_description ?? "");
  const [imageUrl, setImageUrl] = useState(bot.prelander_image_url ?? "");
  const [ctaText, setCtaText] = useState(bot.prelander_cta_text ?? "");
  const [redirectDisplayName, setRedirectDisplayName] = useState(bot.redirect_display_name ?? "");

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveBotSettings(bot.id, {
        facebook_pixel_id: pixelId,
        facebook_access_token: accessToken,
        utmify_api_key: utmifyKey,
        sigilopay_public_key: sigiloPublicKey,
        sigilopay_secret_key: sigiloSecretKey,
        tracking_mode: trackingMode,
        prelander_headline: headline,
        prelander_description: description,
        prelander_image_url: imageUrl,
        prelander_cta_text: ctaText,
        redirect_display_name: redirectDisplayName,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { url } = await uploadMedia(fd);
      await updateBotAvatar(bot.id, url);
      setAvatarUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await updateBotAvatar(bot.id, null);
      setAvatarUrl("");
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleToggleActive = async () => {
    setActivating(true);
    setActivateError(null);
    try {
      const serverUrl = (process.env.NEXT_PUBLIC_BOT_SERVER_URL ?? "http://localhost:3001").replace(/\/+$/, "");
      if (!isActive) {
        const res = await fetch(`${serverUrl}/api/bots/${bot.id}/register-webhook`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao ativar bot");
        setIsActive(true);
      } else {
        const res = await fetch(`${serverUrl}/api/bots/${bot.id}/deactivate`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro ao desativar bot");
        setIsActive(false);
      }
    } catch (e) {
      setActivateError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setActivating(false);
    }
  };

  function SectionHeader({ sKey }: { sKey: string }) {
    const s = sections.find((x) => x.key === sKey)!;
    return (
      <div className="flex items-center gap-3 mb-5">
        {sKey === "info" ? (
          <img src="/logo.png" alt="" className="w-10 h-10 object-contain drop-shadow-[0_0_6px_rgba(34,211,238,0.2)]" />
        ) : (
          <div className="section-icon w-10 h-10" style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)`, boxShadow: `0 0 12px -4px ${s.color}` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={s.icon} />
            </svg>
          </div>
        )}
        <div>
          <h2 className="text-foreground font-semibold text-sm tracking-tight">{s.label}</h2>
          <p className="text-(--text-muted) text-xs">{s.desc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground tracking-tight page-title mb-1">Configuracoes</h1>
      <p className="text-(--text-secondary) text-sm mb-8">Configure as integracoes e tracking deste bot</p>

      {/* Bot Info */}
      <div className="card p-6 mb-5 relative">
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-(--accent)/15 to-transparent" />
        <SectionHeader sKey="info" />

        {/* Avatar Upload */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Bot avatar"
                className="w-20 h-20 rounded-2xl object-cover border border-(--border-subtle)"
                style={{ boxShadow: "0 0 20px -6px rgba(16,185,129,0.15)" }}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-2xl border border-dashed border-(--border-subtle) flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-ghost)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            >
              {uploadingAvatar ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-foreground text-sm font-semibold">Foto de Perfil</span>
            <span className="text-(--text-muted) text-xs">JPG, PNG, WebP ou GIF. Max 50MB.</span>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-3 py-1.5 text-xs font-bold text-(--accent) border border-(--accent)/15 rounded-lg hover:bg-(--accent-muted) transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, var(--accent-muted) 0%, rgba(16,185,129,0.04) 100%)" }}
              >
                {uploadingAvatar ? "Enviando..." : "Enviar foto"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="px-3 py-1.5 text-xs font-bold text-(--red) border border-(--red)/15 rounded-lg hover:bg-(--red-muted) transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, var(--red-muted) 0%, rgba(239,68,68,0.04) 100%)" }}
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm mb-5">
          <p className="text-(--text-secondary)">Username: <span className="text-foreground font-medium">@{bot.bot_username}</span></p>
          <p className="text-(--text-secondary) flex items-center gap-2">Status:
            <span className={`badge ${isActive ? "badge-active" : "badge-inactive"}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive ? "bg-(--accent)" : "bg-(--text-ghost)"}`} />
              {isActive ? "Ativo" : "Inativo"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleActive}
            disabled={activating}
            className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${
              isActive
                ? "text-(--red) border border-(--red)/15"
                : "text-(--accent) border border-(--accent)/15"
            }`}
            style={isActive
              ? { background: "linear-gradient(135deg, var(--red-muted) 0%, rgba(239,68,68,0.04) 100%)", boxShadow: "0 0 12px -4px rgba(239,68,68,0.2)" }
              : { background: "linear-gradient(135deg, var(--accent-muted) 0%, rgba(16,185,129,0.04) 100%)", boxShadow: "0 0 12px -4px rgba(16,185,129,0.2)" }
            }
          >
            {activating ? "Processando..." : isActive ? "Desativar Bot" : "Ativar Bot"}
          </button>
          {activateError && <span className="text-(--red) text-xs font-medium">{activateError}</span>}
        </div>

        {/* Black Flow Toggle — admin only */}
        {isAdmin && (
          <div className="mt-6 pt-5 border-t border-(--border-subtle)">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="section-icon w-8 h-8" style={{ background: "color-mix(in srgb, var(--red) 14%, transparent)", boxShadow: "0 0 12px -4px var(--red)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-foreground font-semibold text-sm tracking-tight">Fluxo Black</h3>
                  <p className="text-(--text-muted) text-xs">Ativar fluxo alternativo para trafego pago</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setTogglingBlack(true);
                  try {
                    await toggleBlackEnabled(bot.id, !blackEnabled);
                    setBlackEnabled(!blackEnabled);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setTogglingBlack(false);
                  }
                }}
                disabled={togglingBlack}
                className={`relative w-11 h-6 rounded-full transition-all duration-200 ${blackEnabled ? "bg-(--red)" : "bg-(--border-default)"}`}
                style={blackEnabled ? { boxShadow: "0 0 12px -2px rgba(239,68,68,0.4)" } : {}}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${blackEnabled ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Facebook */}
      <div className="card p-6 mb-5 relative">
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-(--cyan)/15 to-transparent" />
        <SectionHeader sKey="facebook" />
        <div className="space-y-4">
          <div>
            <label className="input-label">Pixel ID</label>
            <input type="text" value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="123456789012345" className="input" />
          </div>
          <div>
            <label className="input-label">Conversions API Token</label>
            <input type="text" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAx..." className="input" />
          </div>
        </div>
      </div>

      {/* Utmify */}
      <div className="card p-6 mb-5 relative">
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-(--purple)/15 to-transparent" />
        <SectionHeader sKey="utmify" />
        <div>
          <label className="input-label">API Key</label>
          <input type="text" value={utmifyKey} onChange={(e) => setUtmifyKey(e.target.value)} placeholder="utm_..." className="input" />
        </div>
      </div>

      {/* Poseidon Pay */}
      <div className="card p-6 mb-5 relative">
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-(--accent)/15 to-transparent" />
        <SectionHeader sKey="sigilo" />
        <div className="space-y-4">
          <div>
            <label className="input-label">Chave Publica</label>
            <input type="text" value={sigiloPublicKey} onChange={(e) => setSigiloPublicKey(e.target.value)} placeholder="pub_..." className="input" />
          </div>
          <div>
            <label className="input-label">Chave Secreta</label>
            <input type="text" value={sigiloSecretKey} onChange={(e) => setSigiloSecretKey(e.target.value)} placeholder="sec_..." className="input" />
          </div>
        </div>
      </div>

      {/* Tracking Page */}
      <div className="card p-6 mb-8 relative">
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-(--amber)/15 to-transparent" />
        <SectionHeader sKey="tracking" />
        <div className="space-y-4">
          <div>
            <label className="input-label">Modo</label>
            <select value={trackingMode} onChange={(e) => setTrackingMode(e.target.value as "redirect" | "prelander")} className="input">
              <option value="redirect">Redirect (redirecionamento direto)</option>
              <option value="prelander">Pre-lander (pagina customizavel)</option>
            </select>
          </div>

          {trackingMode === "redirect" && (
            <div className="animate-in">
              <label className="input-label">Nome exibido no redirect</label>
              <input
                type="text"
                value={redirectDisplayName}
                onChange={(e) => setRedirectDisplayName(e.target.value)}
                placeholder="Ex: Oferta VIP"
                className="input"
              />
              <p className="text-(--text-muted) text-xs mt-2">
                Nome amigável que aparece na pagina antes do Telegram abrir. Deixe em branco para usar o @username do bot.
              </p>
            </div>
          )}

          {trackingMode === "prelander" && (
            <div className="space-y-4 animate-in">
              <div>
                <label className="input-label">Titulo</label>
                <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Bem-vindo!" className="input" />
              </div>
              <div>
                <label className="input-label">Descricao</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Descricao da oferta..." className="input resize-none" />
              </div>
              <div>
                <label className="input-label">URL da Imagem</label>
                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="input" />
              </div>
              <div>
                <label className="input-label">Texto do Botao CTA</label>
                <input type="text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Acessar no Telegram" className="input" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? "Salvando..." : "Salvar Configuracoes"}
        </button>
        {saved && (
          <span className="text-(--accent) text-sm font-semibold animate-in flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            Salvo com sucesso!
          </span>
        )}
      </div>
    </div>
  );
}
