# Eaglebot Landing Page — Design Spec
**Date:** 2026-04-01  
**Status:** Approved

---

## Overview

A single-page landing for Eaglebot — a Telegram sales-bot SaaS targeting Brazilian affiliates, info-producers, and paid-traffic operators. The goal is direct signup (no pricing exposed, no trial friction). The narrative arc follows the storytelling structure: anchor on pain → present solution → build desire → convert.

**Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript. No external UI libraries — custom components only.

---

## Visual System

### Color Palette
| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#080B14` | Page background |
| `--gradient-from` | `#7C3AED` | Gradient start (purple) |
| `--gradient-to` | `#2563EB` | Gradient end (electric blue) |
| `--accent` | `#6366F1` | Indigo neon glow accents |
| `--text-primary` | `#FFFFFF` | Headlines, labels |
| `--text-muted` | `#94A3B8` | Body copy, descriptions |
| `--glass-bg` | `rgba(255,255,255,0.05)` | Card backgrounds |
| `--glass-border` | `rgba(255,255,255,0.08)` | Card borders |
| `--pain-accent` | `#EF4444` | Pain section border accents |

### Typography
- Font: Geist Sans (already loaded in layout.tsx via `next/font/google`)
- Headlines: `font-black` / `font-bold`, large tracking-tight sizes
- Body: `font-normal`, `text-slate-400`
- Gradient text: CSS `bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-blue-500`

### Component Patterns
- **Glass cards:** `bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm`
- **Primary button:** `bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-lg shadow-violet-500/25`
- **Section spacing:** `py-24 lg:py-32`
- **Max content width:** `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8`

---

## Page Structure

### 1. Navbar
- **Left:** "Eaglebot" wordmark — eagle icon (SVG inline) + name in gradient text
- **Center:** Anchor links — Produto, Como funciona, Depoimentos
- **Right:** "Criar conta grátis" CTA button (gradient, small)
- **Behavior:** Sticky, `backdrop-blur` + `bg-white/5 border-b border-white/5` on scroll (via `IntersectionObserver` or scroll event)
- **Mobile:** Hamburger menu, links in slide-down drawer

### 2. Hero
- **Tag line** (small, uppercase, gradient): `AUTOMAÇÃO DE VENDAS NO TELEGRAM`
- **Headline** (very large, bold, white):
  > "Você ainda vende no Telegram na mão?"
- **Subheadline** (pain copy, slate-400):
  > Copiar link, mandar mensagem, cobrar no PIX manual, perder cliente por falta de follow-up. Isso não é automação — é trabalho braçal disfarçado.
- **Promise paragraph** (white, medium):
  > O Eaglebot transforma seu Telegram numa máquina de vendas 24h. Funil, cobrança, recuperação e tracking — tudo automático, tudo no seu controle.
- **CTA:** `"Criar meu bot grátis →"` — large gradient button, full-width on mobile
- **Social proof strip** (below CTA, small, muted):  
  `🔥 +2.400 bots criados` · `⚡ Setup em menos de 5 min` · `✅ Sem cartão de crédito`
- **Background:** Full-viewport radial gradient dark overlay + CSS grid/dot pattern texture. No images needed.

### 3. Pain Section
- **Title:** `"A realidade de quem vende no Telegram sem automação"`
- **Layout:** 3 glass cards, 1-col mobile / 3-col desktop
- **Card structure:** Icon (large emoji or inline SVG) + title + 2-line description
- **Accent:** Left border `border-l-2 border-red-500` on each card for tension
- **Cards:**
  1. 😤 **Clientes sumindo** — "Você manda o link, a pessoa some. Sem follow-up automático, você perde venda toda hora."
  2. 💸 **Dinheiro na mesa** — "PIX manual, sem rastreamento. Você não sabe de onde veio nem o que converteu."
  3. 🔥 **Operação no limite** — "Responder, cobrar, reenviar, recuperar — tudo na mão. Não escala, não dorme, não para."
- **Transition line** (centered, bold, white, large):
  > "Existe um jeito melhor. E você está prestes a ver."

### 4. Features (Solution)
- **Title:** `"Tudo que você precisa para vender no piloto automático"`
- **Subtitle** (muted): `"Seis módulos integrados, um único painel, resultado real."`
- **Layout:** 2-col mobile (2x3) / 3-col desktop (2x2 effectively 3x2)
- **Cards** (glassmorphism, gradient border top on hover):
  1. 🎯 **Funil Automatizado** — "Sequências de mensagens que guiam o lead do interesse à compra sem você tocar em nada."
  2. ⚡ **Pagamento Integrado (PIX)** — "Cobrança gerada automaticamente no chat. O cliente paga sem sair do Telegram."
  3. 📊 **Tracking Avançado** — "Saiba exatamente qual campanha, criativo e fonte gerou cada venda."
  4. 🤖 **Fluxos Inteligentes** — "Lógica condicional: o bot age diferente dependendo do comportamento do lead."
  5. 🔄 **Recuperação Automática** — "Carrinho abandonado? O bot segue o lead e recupera a venda no automático."
  6. 🖥️ **Dashboard Completo** — "Visão em tempo real de faturamento, conversão, leads ativos e performance dos bots."

### 5. How It Works (3 Steps)
- **Title:** `"Três passos para o seu bot vender enquanto você dorme"`
- **Layout:** Horizontal timeline on desktop, vertical on mobile
- **Steps** (large number in gradient + title + description):
  1. **Crie seu bot** — "Cadastre-se, conecte seu Telegram e nomeie seu bot em menos de 2 minutos."
  2. **Monte seu funil** — "Defina mensagens, configure o PIX e ative os fluxos inteligentes no painel visual."
  3. **Ative e venda** — "Ligue o bot e acompanhe as vendas chegando em tempo real no dashboard."
- **Inline CTA** below steps: `"Quero começar agora →"` (same gradient button, medium size)

### 6. Testimonials
- **Title:** `"Quem já usa o Eaglebot não volta para o manual"`
- **Layout:** 3 cards, horizontal scroll on mobile / 3-col on desktop
- **Card structure:** Star rating (5 stars, yellow) + quote + result callout (bold, gradient) + avatar placeholder + name + niche
- **Placeholder testimonials:**
  1. *"Nunca pensei que conseguiria automatizar tudo isso sozinho. Em 3 dias já tinha bot rodando e vendendo."* — **R$ 14.800 em 3 dias** — Carlos M., Afiliado digital
  2. *"A recuperação automática sozinha já paga o Eaglebot. Recuperei clientes que eu teria perdido."* — **+38% de conversão** — Juliana F., Infoprodutora
  3. *"Tracking que nunca tinha visto em ferramenta nacional. Sei exatamente de onde vem cada real."* — **3x o ROI do tráfego** — Rafael S., Gestor de tráfego

### 7. FAQ
- **Title:** `"Perguntas frequentes"`
- **Layout:** Accordion, single column, max-w-3xl centered
- **5 questions:**
  1. **Preciso saber programar?** — Não. O Eaglebot foi construído para quem vende, não para quem programa. Tudo é configurado visualmente.
  2. **Funciona para afiliados?** — Sim. Você pode usar com qualquer produto — seu ou de terceiros — e rastrear cada fonte de tráfego.
  3. **Quanto tempo leva para configurar?** — A maioria dos usuários tem o primeiro bot ativo em menos de 5 minutos.
  4. **Tem suporte?** — Sim. Suporte via chat durante horário comercial e base de conhecimento completa.
  5. **Funciona com qualquer nicho?** — Sim. Eaglebot é agnóstico de nicho. Funciona para cursos, físicos, serviços e infoprodutos.

### 8. Final CTA
- **Background:** Full-width gradient section (`from-violet-900 via-blue-900 to-slate-900`)
- **Headline** (white, very large):
  > "Seu concorrente já está automatizando. E você?"
- **Subheadline** (reassurance, muted):
  > Sem cartão de crédito. Sem contrato. Cancele quando quiser.
- **CTA Button:** `"Criar meu bot grátis →"` (white bg, dark text — inverted for contrast)
- **Secondary note** below: `Leva menos de 5 minutos para começar.`

### 9. Footer
- **Left:** Eaglebot logo + tagline `"Automação de vendas no Telegram"`
- **Center columns:** Produto (features anchor), Empresa (sobre, contato), Legal (termos, privacidade)
- **Right:** Social icons (Instagram, YouTube, Telegram channel)
- **Bottom bar:** `© 2026 Eaglebot. Todos os direitos reservados.`

---

## Architecture & File Structure

```
app/
  page.tsx              ← landing page (composes all sections)
  layout.tsx            ← existing (update metadata only)
  globals.css           ← add CSS custom properties for palette
components/
  landing/
    Navbar.tsx
    Hero.tsx
    PainSection.tsx
    FeaturesSection.tsx
    HowItWorksSection.tsx
    TestimonialsSection.tsx
    FAQSection.tsx
    FinalCTA.tsx
    Footer.tsx
```

Each section is a self-contained server component (no client state needed), except:
- `Navbar.tsx` — needs `"use client"` for scroll detection and mobile menu toggle
- `FAQSection.tsx` — needs `"use client"` for accordion open/close state

All styling via Tailwind CSS v4 utility classes. No external UI library. No animations library — CSS transitions only.

---

## Constraints

- **No external UI libraries** (no shadcn, framer-motion, etc.)
- **No image assets required** — backgrounds are pure CSS, avatars are CSS placeholder circles
- **No pricing section**
- **Mobile-first** — every section designed for mobile, enhanced for desktop
- **Performance** — all sections are Server Components where possible; no heavy client bundles
- **Next.js App Router conventions** — read node_modules/next/dist before implementing

---

## Success Criteria

1. Single CTA throughout — always "Criar meu bot grátis →" pointing to `/cadastro` (placeholder href)
2. Full mobile responsiveness (no horizontal scroll, tap targets ≥ 44px)
3. No layout shift on load
4. Copy is in Portuguese (BR), direct and result-oriented
5. Dark theme with purple→blue gradient system applied consistently
