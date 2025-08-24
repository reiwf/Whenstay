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

// ListRow.jsx
  export function ListRow({
    left,
    right,
    onClick,
    className = '',
    rightTitle,          // tooltip (defaults to string value)
    rightLines = 1,      // 1 = single-line ellipsis, >1 = line clamp
    rightAlign = 'right',
    rightClass = '',
  }) {
    const Comp = onClick ? 'button' : 'div'
    const clamp =
      rightLines <= 1 ? 'truncate' : `line-clamp-${Math.min(Math.max(rightLines, 2), 6)}`

    return (
      <Comp
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={[
          'w-full text-left px-4 py-3 flex items-center gap-3',
          onClick ? 'active:bg-slate-100/70 dark:active:bg-slate-800/50' : '',
          className,
        ].join(' ')}
      >
        {/* label/icon stays fixed width */}
        <div className="shrink-0 text-sm text-slate-800 dark:text-slate-100">
          {left}
        </div>

        {/* value flexes + can shrink */}
        <div
          className={[
            'flex-1 min-w-0',
            rightAlign === 'right' ? 'text-right' : 'text-left',
          ].join(' ')}
        >
          <span
            className={[
              'block text-sm text-slate-900 dark:text-slate-100',
              clamp,
              rightClass,
            ].join(' ')}
            title={rightTitle ?? (typeof right === 'string' ? right : undefined)}
          >
            {right}
          </span>
        </div>
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
