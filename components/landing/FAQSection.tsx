'use client'

import { useState } from 'react'

const faqs = [
  {
    question: 'Preciso saber programar?',
    answer:
      'Não. O Eaglebot foi construído para quem vende, não para quem programa. Tudo é configurado visualmente — sem uma linha de código.',
  },
  {
    question: 'Funciona para afiliados?',
    answer:
      'Sim. Você pode usar com qualquer produto — seu ou de terceiros — e rastrear cada fonte de tráfego de forma independente.',
  },
  {
    question: 'Quanto tempo leva para configurar?',
    answer:
      'A maioria dos usuários tem o primeiro bot ativo em menos de 5 minutos. O painel é intuitivo e guia você em cada etapa.',
  },
  {
    question: 'Tem suporte?',
    answer:
      'Sim. Suporte via chat durante horário comercial e base de conhecimento completa disponível 24h.',
  },
  {
    question: 'Funciona com qualquer nicho?',
    answer:
      'Sim. O Eaglebot é agnóstico de nicho. Funciona para cursos, produtos físicos, serviços e qualquer tipo de infoproduto.',
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="bg-[#080B14] py-24 lg:py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Perguntas frequentes
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="text-sm font-semibold text-white">
                  {faq.question}
                </span>
                <ChevronIcon open={openIndex === i} />
              </button>

              {openIndex === i && (
                <div className="px-6 pb-5 border-t border-white/[0.05]">
                  <p className="text-sm text-slate-400 leading-relaxed pt-4">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
        open ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
