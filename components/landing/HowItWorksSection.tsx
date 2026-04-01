const steps = [
  {
    number: '01',
    title: 'Crie seu bot',
    description:
      'Cadastre-se, conecte seu Telegram e nomeie seu bot em menos de 2 minutos.',
  },
  {
    number: '02',
    title: 'Monte seu funil',
    description:
      'Defina mensagens, configure o PIX e ative os fluxos inteligentes no painel visual.',
  },
  {
    number: '03',
    title: 'Ative e venda',
    description:
      'Ligue o bot e acompanhe as vendas chegando em tempo real no dashboard.',
  },
]

export default function HowItWorksSection() {
  return (
    <section id="como-funciona" className="bg-[#080B14] py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Três passos para seu bot vender{' '}
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              enquanto você dorme
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-6 relative">
          {/* Connector line visible on desktop */}
          <div className="hidden lg:block absolute top-10 left-[calc(16.666%+2.5rem)] right-[calc(16.666%+2.5rem)] h-px bg-gradient-to-r from-violet-500/40 via-blue-500/40 to-violet-500/40" />

          {steps.map((step) => (
            <div
              key={step.number}
              className="flex flex-col items-center text-center lg:items-start lg:text-left"
            >
              <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20 mb-6">
                <span className="text-3xl font-black bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                  {step.number}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-14">
          <a
            href="/cadastro"
            className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 px-7 py-3 text-sm font-semibold text-violet-300 hover:text-white transition-all"
          >
            Quero começar agora
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}
