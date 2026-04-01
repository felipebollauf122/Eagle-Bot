export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#080B14] py-24 lg:py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-[#080B14] to-blue-900/30" />
      <div className="absolute inset-0 dot-grid opacity-20" />

      {/* Top border line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.1] mb-6">
          Seu concorrente já está
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            automatizando. E você?
          </span>
        </h2>

        <p className="text-slate-400 text-lg mb-10">
          Sem cartão de crédito. Sem contrato. Cancele quando quiser.
        </p>

        <a
          href="/cadastro"
          className="inline-flex items-center gap-2 rounded-full bg-white hover:bg-slate-100 px-10 py-5 text-base font-bold text-slate-900 transition-all duration-200 shadow-2xl shadow-white/10 hover:-translate-y-0.5 active:translate-y-0"
        >
          Criar meu bot grátis
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>

        <p className="mt-5 text-sm text-slate-600">
          Leva menos de 5 minutos para começar.
        </p>
      </div>
    </section>
  )
}
