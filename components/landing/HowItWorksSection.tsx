const steps = [
  {
    number: '01',
    title: 'Crie seu bot',
    description:
      'Cadastre-se, conecte seu Telegram e configure o bot em menos de 2 minutos. Sem código, sem técnico.',
    detail: 'Setup · < 2min',
  },
  {
    number: '02',
    title: 'Monte seu funil',
    description:
      'Defina a sequência de mensagens, configure o PIX e ative os fluxos inteligentes no painel visual.',
    detail: 'Painel visual',
  },
  {
    number: '03',
    title: 'Ative e venda',
    description:
      'Ligue o bot. A partir de agora, ele vende, cobra e recupera leads 24 horas por dia por conta própria.',
    detail: '24h · 7 dias',
  },
]

export default function HowItWorksSection() {
  return (
    <section id="como-funciona" className="bg-[#030508] py-28 lg:py-36 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <p
          className="text-xs text-slate-600 tracking-[0.2em] uppercase mb-5"
          style={{ fontFamily: 'var(--font-jetbrains)' }}
        >
          Como funciona
        </p>
        <h2
          className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-16 max-w-2xl"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          Três passos para seu bot vender{' '}
          <span className="gradient-text">enquanto você dorme</span>
        </h2>

        {/* Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-0 relative">
          {/* Connector */}
          <div className="hidden lg:block absolute top-[2.25rem] left-[calc(16.67%+3rem)] right-[calc(16.67%+3rem)] h-px">
            <div className="w-full h-full bg-gradient-to-r from-indigo-500/30 via-cyan-500/30 to-indigo-500/30" />
          </div>

          {steps.map((step, i) => (
            <div
              key={step.number}
              className={`flex flex-col gap-6 ${i !== 0 ? 'lg:pl-16' : ''}`}
            >
              {/* Number + detail */}
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-2xl border border-white/[0.08] bg-white/[0.03]">
                  <span
                    className="text-2xl font-bold gradient-text"
                    style={{ fontFamily: 'var(--font-jetbrains)' }}
                  >
                    {step.number}
                  </span>
                </div>
                <span
                  className="text-xs text-slate-600 tracking-widest uppercase"
                  style={{ fontFamily: 'var(--font-jetbrains)' }}
                >
                  {step.detail}
                </span>
              </div>

              <div>
                <h3
                  className="text-xl font-semibold text-white mb-2"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 pt-12 border-t border-white/[0.06]">
          <a
            href="/register"
            className="inline-flex items-center gap-2.5 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors group"
          >
            Quero começar agora
            <svg
              className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
