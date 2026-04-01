const testimonials = [
  {
    quote:
      'Nunca pensei que conseguiria automatizar tudo isso sozinho. Em 3 dias já tinha bot rodando e vendendo.',
    result: 'R$ 14.800 em 3 dias',
    name: 'Carlos M.',
    role: 'Afiliado digital',
    initials: 'CM',
    avatarGradient: 'from-violet-500 to-purple-600',
  },
  {
    quote:
      'A recuperação automática sozinha já paga o Eaglebot. Recuperei clientes que eu teria perdido.',
    result: '+38% de conversão',
    name: 'Juliana F.',
    role: 'Infoprodutora',
    initials: 'JF',
    avatarGradient: 'from-blue-500 to-indigo-600',
  },
  {
    quote:
      'Tracking que nunca tinha visto em ferramenta nacional. Sei exatamente de onde vem cada real.',
    result: '3x o ROI do tráfego',
    name: 'Rafael S.',
    role: 'Gestor de tráfego',
    initials: 'RS',
    avatarGradient: 'from-cyan-500 to-blue-600',
  },
]

export default function TestimonialsSection() {
  return (
    <section id="depoimentos" className="bg-[#080B14] py-24 lg:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Quem já usa o Eaglebot{' '}
            <span className="text-slate-500">não volta para o manual</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 flex flex-col gap-5"
            >
              {/* Stars */}
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon key={i} />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm text-slate-300 leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Result callout */}
              <div className="rounded-xl bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-white/[0.06] px-4 py-3 text-center">
                <p className="text-lg font-black bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                  {t.result}
                </p>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.avatarGradient} flex items-center justify-center text-xs font-bold text-white flex-shrink-0`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function StarIcon() {
  return (
    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}
