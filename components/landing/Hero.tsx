import ArrowIcon from './ArrowIcon'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#080B14]">
      {/* Dot grid texture */}
      <div className="absolute inset-0 dot-grid opacity-40" />

      {/* Radial purple glow from top */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(124,58,237,0.25),transparent)]" />

      {/* Central ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-violet-600/[0.07] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-16">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-violet-300 uppercase mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Automação de vendas no Telegram
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.05] mb-6">
          Você ainda vende
          <br />
          no Telegram{' '}
          <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
            na mão?
          </span>
        </h1>

        {/* Pain subheadline */}
        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-5">
          Copiar link, mandar mensagem, cobrar no PIX manual, perder cliente por
          falta de follow-up. Isso não é automação —{' '}
          <strong className="text-slate-300">é trabalho braçal disfarçado.</strong>
        </p>

        {/* Promise */}
        <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed mb-10">
          O Eaglebot transforma seu Telegram numa{' '}
          <strong className="text-white">máquina de vendas 24h</strong>. Funil,
          cobrança, recuperação e tracking — tudo automático, tudo no seu controle.
        </p>

        {/* Primary CTA */}
        <a
          href="/cadastro"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 px-9 py-4 text-base font-bold text-white transition-all duration-200 shadow-xl shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 active:translate-y-0"
        >
          Criar meu bot grátis
          <ArrowIcon />
        </a>

        {/* Social proof strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
          <span>🔥 +2.400 bots criados</span>
          <span className="hidden sm:inline text-slate-700">·</span>
          <span>⚡ Setup em menos de 5 min</span>
          <span className="hidden sm:inline text-slate-700">·</span>
          <span>✅ Sem cartão de crédito</span>
        </div>
      </div>

      {/* Bottom gradient fade into next section */}
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#080B14] to-transparent" />
    </section>
  )
}
