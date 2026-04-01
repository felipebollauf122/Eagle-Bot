const testimonials = [
  {
    result: 'R$ 14.800',
    resultSub: 'em 3 dias',
    quote:
      'Nunca pensei que conseguiria automatizar tudo isso sozinho. Em três dias já tinha bot rodando e vendendo no automático.',
    name: 'Carlos M.',
    role: 'Afiliado digital',
    initials: 'CM',
  },
  {
    result: '+38%',
    resultSub: 'de conversão',
    quote:
      'A recuperação automática sozinha já paga o Eaglebot. Recuperei clientes que eu definitivamente teria perdido.',
    name: 'Juliana F.',
    role: 'Infoprodutora',
    initials: 'JF',
  },
  {
    result: '3×',
    resultSub: 'o ROI do tráfego',
    quote:
      'Tracking que nunca tinha visto em ferramenta nacional. Sei exatamente de onde vem cada real que entra.',
    name: 'Rafael S.',
    role: 'Gestor de tráfego',
    initials: 'RS',
  },
]

export default function TestimonialsSection() {
  return (
    <section id="depoimentos" className="bg-[#030508] py-28 lg:py-36 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
          <div>
            <p
              className="text-xs text-slate-600 tracking-[0.2em] uppercase mb-5"
              style={{ fontFamily: 'var(--font-jetbrains)' }}
            >
              Resultados reais
            </p>
            <h2
              className="text-4xl sm:text-5xl font-bold text-white leading-tight"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Quem usa o Eaglebot{' '}
              <span className="text-slate-600">não volta para o manual</span>
            </h2>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col bg-[#080d1a] border border-white/[0.07] rounded-2xl overflow-hidden"
            >
              {/* Result — hero of the card */}
              <div className="px-8 pt-8 pb-6 border-b border-white/[0.06]">
                <p
                  className="text-5xl font-extrabold gold-text leading-none"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  {t.result}
                </p>
                <p
                  className="text-sm text-slate-500 mt-1"
                  style={{ fontFamily: 'var(--font-jetbrains)' }}
                >
                  {t.resultSub}
                </p>
              </div>

              {/* Quote */}
              <div className="flex-1 px-8 py-6">
                <p className="text-sm text-slate-400 leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              {/* Author */}
              <div className="px-8 pb-7 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-600">{t.role}</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
