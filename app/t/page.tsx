import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { nanoid } from "nanoid";
import type { Bot } from "@/lib/types/database";

interface TrackingPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function generateFbp(): string {
  const rand = Math.floor(Math.random() * 1e10);
  return `fb.1.${Date.now()}.${rand}`;
}

/** Extract client IP from proxy headers (Cloudflare, Vercel, etc), prefer IPv4 */
function extractClientIp(hdrs: Headers): string | null {
  const candidates = [
    hdrs.get("cf-connecting-ip"),
    hdrs.get("x-real-ip"),
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim(),
    hdrs.get("x-client-ip"),
  ];
  for (const ip of candidates) {
    if (ip && ip.length > 0) return ip;
  }
  return null;
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

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

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

  // Capture or generate _fbp cookie (Facebook browser ID)
  const cookieStore = await cookies();
  const existingFbp = cookieStore.get("_fbp")?.value;
  const fbp = existingFbp || generateFbp();

  // Capture client IP and User-Agent for Facebook CAPI matching
  const hdrs = await headers();
  const clientIp = extractClientIp(hdrs);
  const userAgent = hdrs.get("user-agent") ?? null;

  // Build source URL (landing page URL) for event_source_url — improves attribution
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const queryString = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (typeof v === "string" && v.length > 0) queryString.set(k, v);
  }
  const sourceUrl = host ? `${proto}://${host}/t${queryString.toString() ? "?" + queryString.toString() : ""}` : null;

  // Real click timestamp — this is THE moment the user clicked the ad
  const clickTime = Date.now();

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
    event_data: {
      fbp,
      click_time: clickTime,
      client_ip: clientIp,
      user_agent: userAgent,
      source_url: sourceUrl,
    },
    sent_to_facebook: false,
    sent_to_utmify: false,
  });

  const telegramDeepLink = `https://t.me/${typedBot.bot_username}?start=${tid}`;
  const botHandle = `@${typedBot.bot_username}`;

  return (
    <>
      <meta httpEquiv="refresh" content={`1;url=${telegramDeepLink}`} />
      <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-(--bg-root) via-(--bg-surface) to-(--bg-root)" />
        <div className="grid-lines absolute inset-0 opacity-50" />
        <div className="dot-pattern absolute inset-0 opacity-20" />

        <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] bg-(--accent) rounded-full opacity-[0.05] blur-[140px]" style={{ animation: "float 10s ease-in-out infinite" }} />
        <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] bg-(--cyan) rounded-full opacity-[0.04] blur-[120px]" style={{ animation: "float 12s ease-in-out infinite 3s" }} />

        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-(--accent)/30 to-transparent" />

        <div className="relative z-10 max-w-md w-full text-center animate-up">
          <div className="mb-10 flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-(--accent)/20 border-t-(--accent) animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--accent)">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
              </div>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3 tracking-tight">
            Redirecionando...
          </h1>

          <p className="text-(--text-secondary) text-base mb-2">
            Você está sendo redirecionado para
          </p>
          <p className="text-(--accent) text-lg font-semibold mb-10">
            {botHandle}
          </p>

          <a
            href={telegramDeepLink}
            className="inline-flex items-center gap-2 px-6 py-3 text-(--text-muted) text-sm font-medium rounded-xl border border-(--border-default) hover:border-(--accent)/50 hover:text-(--accent) transition-all"
          >
            <span>Abrir manualmente se não for redirecionado</span>
          </a>

          <p className="text-(--text-ghost) text-xs mt-14 tracking-wider uppercase font-medium">
            Powered by EagleBot
          </p>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var existing = document.cookie.split('; ').find(function(c){ return c.indexOf('_fbp=') === 0; });
                  if (!existing) {
                    document.cookie = '_fbp=${fbp}; path=/; max-age=7776000; SameSite=Lax';
                  }
                } catch(e) {}
                setTimeout(function(){ window.location.href = ${JSON.stringify(telegramDeepLink)}; }, 800);
              })();
            `,
          }}
        />
      </div>
    </>
  );
}
