const stats = [
  { value: '2.400+', label: 'Bots ativos agora' },
  { value: 'R$ 4.2M', label: 'Processados / mês' },
  { value: '38%', label: 'Aumento médio de conversão' },
]

export default function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#030508] flex flex-col">
      {/* Grid background */}
      <div className="absolute inset-0 grid-lines" />

      {/* Gradient mesh — top right */}
      <div className="absolute top-0 right-0 w-3/4 h-3/4 bg-[radial-gradient(ellipse_at_top_right,rgba(79,70,229,0.15),transparent_65%)]" />
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,212,0.08),transparent_60%)]" />

      {/* Bottom fade */}
      <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-[#030508] to-transparent z-10" />

      {/* ── Main content ── */}
      <div className="relative z-10 flex-1 flex items-center">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-28 pb-24">
          {/* Live badge */}
          <div className="animate-fade-up inline-flex items-center gap-2.5 mb-10 border border-cyan-500/20 bg-cyan-500/[0.06] rounded-full px-4 py-1.5">
            <span className="live-dot block w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
            <span
              className="text-xs text-cyan-400 tracking-[0.12em] uppercase"
              style={{ fontFamily: 'var(--font-jetbrains)' }}
            >
              Plataforma ao vivo · +2.400 bots rodando
            </span>
          </div>

          {/* Headline — massive, left-aligned */}
          <h1
            className="mb-8 leading-[0.92] tracking-tight"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            <span className="animate-fade-up-1 block text-[clamp(3.5rem,8vw,5.5rem)] font-extrabold text-white">
              Você ainda
            </span>
            <span className="animate-fade-up-2 block text-[clamp(3.5rem,8vw,5.5rem)] font-extrabold text-white/[0.15]">
              vende no
            </span>
            <span className="animate-fade-up-3 block text-[clamp(3.5rem,8vw,5.5rem)] font-extrabold text-white">
              Telegram
            </span>
            <span className="animate-fade-up-4 block text-[clamp(3.5rem,8vw,5.5rem)] font-extrabold gradient-text">
              na mão?
            </span>
          </h1>

          {/* Body */}
          <div className="max-w-xl">
            <p className="animate-fade-up-4 text-lg text-slate-400 leading-relaxed mb-4">
              PIX manual. Follow-up no braço. Sem rastreamento. Cada venda que
              você fecha custou trabalho que deveria ser automático.
            </p>
            <p className="animate-fade-up-5 text-base text-slate-300 leading-relaxed mb-10">
              O Eaglebot coloca seu Telegram em{' '}
              <strong className="text-white font-semibold">modo piloto automático</strong>{' '}
              — funil, cobrança, recuperação e tracking rodando 24h sem você tocar em nada.
            </p>

            {/* CTA row */}
            <div className="animate-fade-up-5 flex flex-col sm:flex-row gap-4 items-start">
              <a
                href="/register"
                className="group inline-flex items-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-all duration-200 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/45 hover:-translate-y-0.5"
              >
                Criar meu bot grátis
                <svg
                  className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-150"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <span className="self-center text-sm text-slate-600">
                Sem cartão · Setup em 5 min
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="relative z-20 border-t border-white/[0.06] bg-[#030508]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
            {stats.map((s) => (
              <div key={s.label} className="py-5 sm:py-6 px-4 sm:px-8 text-center">
                <p
                  className="text-xl sm:text-2xl font-bold text-white mb-0.5"
                  style={{ fontFamily: 'var(--font-jetbrains)' }}
                >
                  {s.value}
                </p>
                <p className="text-xs text-slate-600 tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
