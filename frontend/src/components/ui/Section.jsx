export default function Section({ title, subtitle, children, className = '' }) {
  return (
    <section className={`px-4 py-3 ${className}`}>
      {(title || subtitle) && (
        <header className="mb-2">
          {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  )
}
