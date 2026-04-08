import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import type { Bot } from "@/lib/types/database";

interface TrackingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TrackingPage({ searchParams }: TrackingPageProps) {
  const search = await searchParams;

  const botId = String(search.bot ?? "");

  if (!botId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-(--text-muted) text-sm">Link invalido</p>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("*")
    .eq("id", botId)
    .eq("is_active", true)
    .single();

  if (!bot) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-(--text-muted) text-sm">Link invalido</p>
      </div>
    );
  }

  const typedBot = bot as Bot;

  const fbclid = String(search.fbclid ?? "");
  const utmSource = String(search.utm_source ?? "");
  const utmMedium = String(search.utm_medium ?? "");
  const utmCampaign = String(search.utm_campaign ?? "");
  const utmContent = String(search.utm_content ?? "");
  const utmTerm = String(search.utm_term ?? "");

  const tid = `tid_${nanoid(16)}`;

  await supabase.from("tracking_events").insert({
    tenant_id: typedBot.tenant_id,
    bot_id: typedBot.id,
    lead_id: null,
    event_type: "page_view",
    fbclid: fbclid || null,
    tid,
    utm_params: {
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
    },
    event_data: {},
    sent_to_facebook: false,
    sent_to_utmify: false,
  });

  const telegramDeepLink = `https://t.me/${typedBot.bot_username}?start=${tid}`;

  if (typedBot.tracking_mode === "redirect") {
    redirect(telegramDeepLink);
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4">
      {/* Multi-layer background */}
      <div className="absolute inset-0 bg-gradient-to-b from-(--bg-root) via-(--bg-surface) to-(--bg-root)" />
      <div className="grid-lines absolute inset-0 opacity-50" />
      <div className="dot-pattern absolute inset-0 opacity-20" />

      {/* Ambient orbs */}
      <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] bg-(--accent) rounded-full opacity-[0.04] blur-[140px]" style={{ animation: "float 10s ease-in-out infinite" }} />
      <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] bg-(--cyan) rounded-full opacity-[0.03] blur-[120px]" style={{ animation: "float 12s ease-in-out infinite 3s" }} />
      <div className="absolute top-[60%] left-[10%] w-[300px] h-[300px] bg-(--purple) rounded-full opacity-[0.025] blur-[100px]" style={{ animation: "float 14s ease-in-out infinite 5s" }} />

      {/* Top glow line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-(--accent)/25 to-transparent" />

      <div className="relative z-10 max-w-md w-full text-center animate-up">
        {typedBot.prelander_image_url && (
          <div className="mb-8 rounded-2xl overflow-hidden border border-(--border-default) relative group" style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 32px -8px rgba(16,185,129,0.1)" }}>
            <img
              src={typedBot.prelander_image_url}
              alt=""
              className="w-full max-h-72 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-(--bg-root)/60 to-transparent pointer-events-none" />
          </div>
        )}

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight leading-tight page-title">
          {typedBot.prelander_headline ?? "Bem-vindo!"}
        </h1>

        {typedBot.prelander_description && (
          <p className="text-(--text-secondary) text-base md:text-lg mb-10 leading-relaxed max-w-sm mx-auto">
            {typedBot.prelander_description}
          </p>
        )}

        <a
          href={telegramDeepLink}
          className="group inline-flex items-center gap-3 px-8 py-4 text-black text-base font-bold rounded-2xl transition-all hover:-translate-y-1 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, var(--accent) 0%, #0d9668 100%)", boxShadow: "0 4px 24px rgba(16, 185, 129, 0.3), 0 0 48px -8px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(255,255,255,0.2)" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/15 to-transparent pointer-events-none" />
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="relative z-10">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          </svg>
          <span className="relative z-10">{typedBot.prelander_cta_text ?? "Acessar no Telegram"}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 transition-transform group-hover:translate-x-1">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>

        <p className="text-(--text-ghost) text-xs mt-14 tracking-wider uppercase font-medium">
          Powered by EagleBot
        </p>
      </div>
    </div>
  );
}
