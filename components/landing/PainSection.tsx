const pains = [
  {
    icon: '😤',
    title: 'Clientes sumindo',
    description:
      'Você manda o link, a pessoa some. Sem follow-up automático, você perde venda toda hora.',
  },
  {
    icon: '💸',
    title: 'Dinheiro na mesa',
    description:
      'PIX manual, sem rastreamento. Você não sabe de onde veio nem o que converteu.',
  },
  {
    icon: '🔥',
    title: 'Operação no limite',
    description:
      'Responder, cobrar, reenviar, recuperar — tudo na mão. Não escala, não dorme, não para.',
  },
]

export default function PainSection() {
  return (
    <section className="bg-[#080B14] py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-16">
          A realidade de quem vende no Telegram{' '}
          <span className="text-slate-500">sem automação</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {pains.map((pain) => (
            <div
              key={pain.title}
              className="bg-white/[0.03] border border-white/[0.06] border-l-2 border-l-red-500/50 rounded-2xl p-6"
            >
              <div className="text-4xl mb-4">{pain.icon}</div>
              <h3 className="text-base font-bold text-white mb-2">{pain.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{pain.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-2xl sm:text-3xl font-bold text-white">
            Existe um jeito melhor.{' '}
            <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              E você está prestes a ver.
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
