export function ListGroup({ children, inset = true, className = '' }) {
  return (
    <div
      className={[
        inset
          ? 'rounded-2xl bg-white/70 dark:bg-slate-900/50 backdrop-blur supports-[backdrop-filter]:bg-white/60 ring-1 ring-slate-200/60 dark:ring-slate-700/50 shadow-sm'
          : 'bg-transparent',
        'divide-y divide-slate-200/70 dark:divide-slate-700/60',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function ListRow({ left, right, onClick, className = '' }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 flex items-center justify-between gap-3',
        onClick ? 'active:bg-slate-100/70 dark:active:bg-slate-800/50' : '',
        className,
      ].join(' ')}
    >
      <div className="min-w-0 text-sm text-slate-800 dark:text-slate-100">{left}</div>
      <div className="shrink-0 text-sm text-slate-600 dark:text-slate-300">{right}</div>
    </Comp>
  )
}

export function PlainGroup({ children, className = '' }) {
  return (
    <div className={['divide-y divide-slate-200/70 dark:divide-slate-700/60', className].join(' ')}>
      {children}
    </div>
  )
}

export function ListRowLarge({ left, right, onClick, className = '' }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={[
        'w-full text-left px-4 py-3 flex items-center gap-3',
        onClick ? 'active:bg-slate-100/70 dark:active:bg-slate-800/50' : '',
        className,
      ].join(' ')}
    >
      {/* Label stays left */}
      <div className="min-w-0 shrink-0 text-sm text-slate-800 dark:text-slate-100">
        {left}
      </div>

      {/* Right column is flex and right-aligned */}
      <div className="flex-1 flex justify-end">
        <div className="w-full max-w-xl">{right}</div>
      </div>
    </Comp>
  )
}
