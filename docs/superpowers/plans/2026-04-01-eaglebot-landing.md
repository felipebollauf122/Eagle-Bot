# Eaglebot Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Next.js starter template with a full conversion-optimized dark landing page for Eaglebot SaaS.

**Architecture:** 9 isolated section components composed in `app/page.tsx`. `Navbar` and `FAQSection` are client components (need scroll/state); all others are server components. Design system lives in `globals.css` via a single `.dot-grid` utility class and CSS custom properties.

**Tech Stack:** Next.js 16.2.2 (App Router), React 19, Tailwind CSS v4, TypeScript. No external UI libraries.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `app/globals.css` | Add `.dot-grid` background utility |
| Modify | `app/layout.tsx` | Update page metadata |
| Modify | `app/page.tsx` | Compose all section components |
| Create | `components/landing/Navbar.tsx` | Sticky nav, mobile menu — `"use client"` |
| Create | `components/landing/Hero.tsx` | Full-viewport hero with CTA |
| Create | `components/landing/PainSection.tsx` | 3 pain cards |
| Create | `components/landing/FeaturesSection.tsx` | 6 feature cards |
| Create | `components/landing/HowItWorksSection.tsx` | 3-step timeline |
| Create | `components/landing/TestimonialsSection.tsx` | 3 testimonial cards |
| Create | `components/landing/FAQSection.tsx` | Accordion FAQ — `"use client"` |
| Create | `components/landing/FinalCTA.tsx` | Gradient conversion section |
| Create | `components/landing/Footer.tsx` | Footer with links |

---

## Task 1: Update globals.css and layout metadata

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add dot-grid utility and override body background in globals.css**

Replace the entire contents of `app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --background: #080B14;
  --foreground: #ffffff;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}

.dot-grid {
  background-image: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.06) 1px,
    transparent 1px
  );
  background-size: 28px 28px;
}
```

- [ ] **Step 2: Update metadata in app/layout.tsx**

Replace the metadata export:

```tsx
export const metadata: Metadata = {
  title: "Eaglebot — Automação de Vendas no Telegram",
  description:
    "Crie bots de vendas automatizados no Telegram. Funil, PIX integrado, tracking avançado e recuperação automática — tudo no piloto automático.",
};
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "chore: configure dark theme and metadata for Eaglebot landing"
```

---

## Task 2: Create Navbar component

**Files:**
- Create: `components/landing/Navbar.tsx`

- [ ] **Step 1: Create the file**

```bash
mkdir -p C:/Users/Administrator/eaglebot/components/landing
```

- [ ] **Step 2: Write Navbar.tsx**

Create `components/landing/Navbar.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#080B14]/80 backdrop-blur-md border-b border-white/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <EagleIcon />
            <span className="text-xl font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              Eaglebot
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <a
              href="/cadastro"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 px-5 py-2 text-sm font-semibold text-white transition-all shadow-lg shadow-violet-500/20"
            >
              Criar conta grátis
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Abrir menu"
          >
            {mobileOpen ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#080B14]/95 backdrop-blur-md border-b border-white/5 px-4 pb-4">
          <nav className="flex flex-col gap-4 pt-4">
            {navLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {label}
              </a>
            ))}
            <a
              href="/cadastro"
              className="inline-flex justify-center rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Criar conta grátis
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}

const navLinks = [
  { href: '#produto', label: 'Produto' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#depoimentos', label: 'Depoimentos' },
]

function EagleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="eagleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <path
        d="M14 3L4 10l3 2-5 6h6l2-3 4 8 4-8 2 3h6l-5-6 3-2L14 3z"
        fill="url(#eagleGrad)"
      />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/landing/Navbar.tsx
git commit -m "feat: add Navbar component with scroll effect and mobile menu"
```

---

## Task 3: Create Hero component

**Files:**
- Create: `components/landing/Hero.tsx`

- [ ] **Step 1: Write Hero.tsx**

Create `components/landing/Hero.tsx`:

```tsx
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

function ArrowIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/Hero.tsx
git commit -m "feat: add Hero section with pain narrative and CTA"
```

---

## Task 4: Create PainSection component

**Files:**
- Create: `components/landing/PainSection.tsx`

- [ ] **Step 1: Write PainSection.tsx**

Create `components/landing/PainSection.tsx`:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/PainSection.tsx
git commit -m "feat: add PainSection with three pain-point cards"
```

---

## Task 5: Create FeaturesSection component

**Files:**
- Create: `components/landing/FeaturesSection.tsx`

- [ ] **Step 1: Write FeaturesSection.tsx**

Create `components/landing/FeaturesSection.tsx`:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/FeaturesSection.tsx
git commit -m "feat: add FeaturesSection with 6 feature cards"
```

---

## Task 6: Create HowItWorksSection component

**Files:**
- Create: `components/landing/HowItWorksSection.tsx`

- [ ] **Step 1: Write HowItWorksSection.tsx**

Create `components/landing/HowItWorksSection.tsx`:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/HowItWorksSection.tsx
git commit -m "feat: add HowItWorksSection with 3-step timeline"
```

---

## Task 7: Create TestimonialsSection component

**Files:**
- Create: `components/landing/TestimonialsSection.tsx`

- [ ] **Step 1: Write TestimonialsSection.tsx**

Create `components/landing/TestimonialsSection.tsx`:

```tsx
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
                "{t.quote}"
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
```

- [ ] **Step 2: Type-check**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/TestimonialsSection.tsx
git commit -m "feat: add TestimonialsSection with placeholder social proof"
```

---

## Task 8: Create FAQSection component

**Files:**
- Create: `components/landing/FAQSection.tsx`

- [ ] **Step 1: Write FAQSection.tsx**

Create `components/landing/FAQSection.tsx`:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/FAQSection.tsx
git commit -m "feat: add FAQSection accordion with 5 questions"
```

---

## Task 9: Create FinalCTA component

**Files:**
- Create: `components/landing/FinalCTA.tsx`

- [ ] **Step 1: Write FinalCTA.tsx**

Create `components/landing/FinalCTA.tsx`:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/FinalCTA.tsx
git commit -m "feat: add FinalCTA conversion section"
```

---

## Task 10: Create Footer component

**Files:**
- Create: `components/landing/Footer.tsx`

- [ ] **Step 1: Write Footer.tsx**

Create `components/landing/Footer.tsx`:

```tsx
const productLinks = [
  { href: '#produto', label: 'Funcionalidades' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#depoimentos', label: 'Depoimentos' },
]

const companyLinks = [
  { href: '#', label: 'Sobre' },
  { href: '#', label: 'Contato' },
]

const legalLinks = [
  { href: '#', label: 'Termos de uso' },
  { href: '#', label: 'Privacidade' },
]

export default function Footer() {
  return (
    <footer className="bg-[#080B14] border-t border-white/[0.05]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          {/* Brand */}
          <div className="max-w-xs">
            <span className="text-lg font-bold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
              Eaglebot
            </span>
            <p className="mt-2 text-sm text-slate-500">
              Automação de vendas no Telegram
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <LinkColumn title="Produto" links={productLinks} />
            <LinkColumn title="Empresa" links={companyLinks} />
            <LinkColumn title="Legal" links={legalLinks} />
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-600">
            © 2026 Eaglebot. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-5">
            <SocialLink href="#" label="Instagram" icon={<InstagramIcon />} hoverColor="hover:text-violet-400" />
            <SocialLink href="#" label="Telegram" icon={<TelegramIcon />} hoverColor="hover:text-blue-400" />
          </div>
        </div>
      </div>
    </footer>
  )
}

function LinkColumn({
  title,
  links,
}: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <div>
      <p className="font-semibold text-white mb-3">{title}</p>
      <ul className="flex flex-col gap-2 text-slate-500">
        {links.map(({ href, label }) => (
          <li key={label}>
            <a href={href} className="hover:text-white transition-colors">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SocialLink({
  href,
  label,
  icon,
  hoverColor,
}: {
  href: string
  label: string
  icon: React.ReactNode
  hoverColor: string
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className={`text-slate-600 ${hoverColor} transition-colors`}
    >
      {icon}
    </a>
  )
}

function InstagramIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function TelegramIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/Footer.tsx
git commit -m "feat: add Footer with link columns and social icons"
```

---

## Task 11: Compose page.tsx and verify full build

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace app/page.tsx with the composed landing page**

Replace the entire contents of `app/page.tsx` with:

```tsx
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import PainSection from '@/components/landing/PainSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import TestimonialsSection from '@/components/landing/TestimonialsSection'
import FAQSection from '@/components/landing/FAQSection'
import FinalCTA from '@/components/landing/FinalCTA'
import Footer from '@/components/landing/Footer'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <PainSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Verify tsconfig has path alias configured**

Check `tsconfig.json` contains:

```json
"paths": {
  "@/*": ["./*"]
}
```

If not present, open `tsconfig.json` and add it inside `"compilerOptions"`.

- [ ] **Step 3: Type-check the entire project**

```bash
cd C:/Users/Administrator/eaglebot && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run production build**

```bash
cd C:/Users/Administrator/eaglebot && npm run build
```

Expected: build completes with no errors. Output should show all routes compiled.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: compose Eaglebot landing page from section components"
```

---

## Self-Review

**Spec coverage:**
- ✅ Navbar with sticky scroll, mobile menu, CTA → Task 2
- ✅ Hero with pain headline, promise, CTA, social proof strip → Task 3
- ✅ Pain section with 3 cards and transition line → Task 4
- ✅ Features section with 6 cards (all 6 features from spec) → Task 5
- ✅ How it works (3 steps, inline CTA) → Task 6
- ✅ Testimonials (3 placeholders with result callout) → Task 7
- ✅ FAQ accordion (5 questions) → Task 8
- ✅ Final CTA (gradient, inverted button, urgency copy) → Task 9
- ✅ Footer (3 link columns, social icons, copyright) → Task 10
- ✅ Composition + build verification → Task 11
- ✅ globals.css + metadata → Task 1

**Placeholder scan:** No TBD or incomplete steps. All code is complete and explicit. `/cadastro` is the CTA href throughout — intentional per spec.

**Type consistency:** `ChevronIcon` accepts `{ open: boolean }` — used identically in Task 8. `LinkColumn` and `SocialLink` props defined and used in Task 10. `EagleIcon`, `MenuIcon`, `XIcon`, `ArrowIcon` — all defined as zero-prop components in their respective files. No cross-task type mismatches.
