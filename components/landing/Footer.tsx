import type { ReactNode } from 'react'

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
    <footer className="bg-[#030508] border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col lg:flex-row justify-between gap-12 pb-12 border-b border-white/[0.06]">
          {/* Brand */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-3">
              <EagleMark />
              <span
                className="text-lg font-bold text-white tracking-tight"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Eaglebot
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              A plataforma profissional para criar bots de vendas no Telegram.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 text-sm">
            <LinkColumn title="Produto" links={productLinks} />
            <LinkColumn title="Empresa" links={companyLinks} />
            <LinkColumn title="Legal" links={legalLinks} />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p
            className="text-xs text-slate-700"
            style={{ fontFamily: 'var(--font-jetbrains)' }}
          >
            © 2026 Eaglebot — Todos os direitos reservados
          </p>
          <div className="flex items-center gap-5">
            <SocialLink href="#" label="Instagram" icon={<InstagramIcon />} />
            <SocialLink href="#" label="Telegram" icon={<TelegramIcon />} />
          </div>
        </div>
      </div>
    </footer>
  )
}

function EagleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="footer-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L4 8l2.5 1.5L2 16h5.5L9 13.5l3 6.5 3-6.5 1.5 2.5H22l-4.5-6.5L20 8 12 2z"
        fill="url(#footer-grad)"
      />
    </svg>
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
      <p
        className="text-xs font-semibold text-slate-500 tracking-[0.12em] uppercase mb-4"
        style={{ fontFamily: 'var(--font-jetbrains)' }}
      >
        {title}
      </p>
      <ul className="flex flex-col gap-2.5">
        {links.map(({ href, label }) => (
          <li key={label}>
            <a href={href} className="text-slate-600 hover:text-white transition-colors text-sm">
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
}: {
  href: string
  label: string
  icon: ReactNode
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="text-slate-700 hover:text-white transition-colors duration-200"
    >
      {icon}
    </a>
  )
}

function InstagramIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function TelegramIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}
