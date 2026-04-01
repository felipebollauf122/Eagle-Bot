const features = [
  {
    index: '01',
    title: 'Funil Automatizado',
    description:
      'Sequências de mensagens que guiam o lead do interesse à compra sem você tocar em nada. Cada etapa, na hora certa.',
    accent: 'text-indigo-400',
  },
  {
    index: '02',
    title: 'Pagamento Integrado — PIX',
    description:
      'Cobrança gerada automaticamente dentro do chat. O cliente paga sem sair do Telegram. Zero fricção, mais conversão.',
    accent: 'text-cyan-400',
  },
  {
    index: '03',
    title: 'Tracking Avançado',
    description:
      'Saiba exatamente qual campanha, criativo e fonte gerou cada venda. Dados reais para decisões reais.',
    accent: 'text-violet-400',
  },
  {
    index: '04',
    title: 'Fluxos Inteligentes',
    description:
      'Lógica condicional nativa: o bot age diferente dependendo do que o lead fez, clicou ou respondeu.',
    accent: 'text-indigo-400',
  },
  {
    index: '05',
    title: 'Recuperação Automática',
    description:
      'Carrinho abandonado? O bot detecta, segue o lead e tenta a recuperação no momento certo — sem você fazer nada.',
    accent: 'text-cyan-400',
  },
  {
    index: '06',
    title: 'Dashboard Completo',
    description:
      'Visão em tempo real de faturamento, conversão, leads ativos e performance por bot. Tudo em um painel.',
    accent: 'text-violet-400',
  },
]

export default function FeaturesSection() {
  return (
    <section id="produto" className="bg-[#030508] py-28 lg:py-36 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
          <div>
            <p
              className="text-xs text-slate-600 tracking-[0.2em] uppercase mb-5"
              style={{ fontFamily: 'var(--font-jetbrains)' }}
            >
              O produto
            </p>
            <h2
              className="text-4xl sm:text-5xl font-bold text-white leading-tight max-w-lg"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Seis módulos.{' '}
              <span className="gradient-text">Um único painel.</span>
            </h2>
          </div>
          <p className="text-slate-500 text-base max-w-xs lg:text-right leading-relaxed">
            Cada módulo foi construído para eliminar uma tarefa manual do seu processo de vendas.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
          {features.map((f) => (
            <div
              key={f.index}
              className="relative bg-[#030508] hover:bg-[#080d1a] transition-colors duration-300 p-8 group overflow-hidden"
            >
              {/* Subtle hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(ellipse_at_top_left,rgba(79,70,229,0.06),transparent_60%)]" />

              <div className="relative">
                <p
                  className={`text-xs tracking-[0.15em] uppercase mb-5 ${f.accent}`}
                  style={{ fontFamily: 'var(--font-jetbrains)' }}
                >
                  {f.index}
                </p>
                <h3
                  className="text-base font-semibold text-white mb-3 leading-snug"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  {f.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
