export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#030508] border-t border-white/[0.06]">
      {/* Background mesh */}
      <div className="absolute inset-0 grid-lines opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(79,70,229,0.14),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_0%,rgba(6,182,212,0.07),transparent)]" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
        {/* Ticker */}
        <div className="overflow-hidden mb-16 opacity-30">
          <div className="ticker-track flex gap-12 whitespace-nowrap w-max">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex gap-12 items-center">
                {['FUNIL AUTOMATIZADO', 'PIX INTEGRADO', 'TRACKING AVANÇADO', 'RECUPERAÇÃO AUTOMÁTICA', 'DASHBOARD COMPLETO', 'FLUXOS INTELIGENTES'].map((item) => (
                  <span
                    key={item}
                    className="text-xs text-slate-500 tracking-[0.25em] uppercase"
                    style={{ fontFamily: 'var(--font-jetbrains)' }}
                  >
                    {item} ·
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-4xl">
          <h2
            className="text-5xl sm:text-6xl lg:text-[72px] font-extrabold text-white leading-[0.95] tracking-tight mb-8"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Seu concorrente já está{' '}
            <span className="gradient-text">automatizando.</span>
            <br />
            <span className="text-slate-600">E você?</span>
          </h2>

          <p className="text-slate-500 text-lg mb-10 max-w-xl">
            Sem cartão de crédito. Sem contrato. Cancele quando quiser. Leva menos de 5 minutos para começar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <a
              href="/cadastro"
              className="group inline-flex items-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold px-8 py-4 rounded-xl transition-all duration-200 shadow-2xl shadow-white/10 hover:-translate-y-0.5"
            >
              Criar meu bot grátis
              <svg
                className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <span className="self-center text-sm text-slate-700">
              Setup em menos de 5 minutos
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
