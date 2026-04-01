const features = [
  {
    icon: '🎯',
    title: 'Funil Automatizado',
    description:
      'Sequências de mensagens que guiam o lead do interesse à compra sem você tocar em nada.',
    hoverGradient: 'from-violet-500/15 to-transparent',
  },
  {
    icon: '⚡',
    title: 'Pagamento Integrado (PIX)',
    description:
      'Cobrança gerada automaticamente no chat. O cliente paga sem sair do Telegram.',
    hoverGradient: 'from-blue-500/15 to-transparent',
  },
  {
    icon: '📊',
    title: 'Tracking Avançado',
    description:
      'Saiba exatamente qual campanha, criativo e fonte gerou cada venda.',
    hoverGradient: 'from-cyan-500/15 to-transparent',
  },
  {
    icon: '🤖',
    title: 'Fluxos Inteligentes',
    description:
      'Lógica condicional: o bot age diferente dependendo do comportamento do lead.',
    hoverGradient: 'from-indigo-500/15 to-transparent',
  },
  {
    icon: '🔄',
    title: 'Recuperação Automática',
    description:
      'Carrinho abandonado? O bot segue o lead e recupera a venda no automático.',
    hoverGradient: 'from-violet-500/15 to-transparent',
  },
  {
    icon: '🖥️',
    title: 'Dashboard Completo',
    description:
      'Visão em tempo real de faturamento, conversão, leads ativos e performance dos bots.',
    hoverGradient: 'from-blue-500/15 to-transparent',
  },
]

export default function FeaturesSection() {
  return (
    <section id="produto" className="bg-[#080B14] py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Tudo que você precisa para vender{' '}
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              no piloto automático
            </span>
          </h2>
          <p className="text-slate-400 text-lg">
            Seis módulos integrados, um único painel, resultado real.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative bg-white/[0.03] hover:bg-white/[0.055] border border-white/[0.07] rounded-2xl p-6 transition-all duration-300 overflow-hidden"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${f.hoverGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />
              <div className="relative">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
