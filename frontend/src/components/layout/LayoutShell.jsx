// components/ui/LayoutShell.jsx
import { CheckCircle, Clock } from 'lucide-react'

export default function LayoutShell({
  token,
  guestName = 'Guest',
  navigationItems,
  activeSection,
  setActiveSection,
  checkinCompleted = false,
  accessUnlocked = false,
  children,
  headerVariant = 'compact', // 'default' | 'compact'
}) {
  const isCompact = headerVariant === 'compact'

  const cls = {
    wrap: 'min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900',
    max: 'mx-auto w-full max-w-[420px] sm:max-w-[520px] md:max-w-[720px] lg:max-w-[840px] xl:max-w-[960px]',
    header: 'sticky top-0 z-[60]',
    hero: `relative overflow-hidden ${isCompact ? 'rounded-b-2xl' : 'rounded-b-3xl'} text-white shadow`,
    grad: 'absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-500 pointer-events-none',
    pad: `relative ${isCompact ? 'px-4 pt-3 pb-3' : 'px-5 pt-5 pb-6'} safe-pt`,
    idRow: `text-[10px] ${isCompact ? 'opacity-70' : 'opacity-80'}`,
    name: `${isCompact ? 'text-lg' : 'text-2xl'} font-semibold`,
    chipsRow: `mt-2 flex flex-wrap gap-1.5`,
    main: 'relative z-0 px-4 pt-6 pb-28',
  }

  const StatusChip = ({ ok, okText = 'Ready', waitText = 'Pending' }) => (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${
        isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      } font-medium bg-white/15 text-white backdrop-blur`}
    >
      {ok ? <CheckCircle className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} /> : <Clock className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      {ok ? okText : waitText}
    </span>
  )

  const SegmentedTabs = ({ items, active, onSelect }) => (
    <div className="px-4">
      <div className={`mx-auto ${isCompact ? 'mt-2' : 'mt-3'} w-full max-w-[430px]`}>
        <div className="rounded-full bg-white shadow ring-1 ring-black/5 overflow-hidden pointer-events-auto">
          <nav className="grid grid-cols-3">
            {items.map(({ id, label, icon: Icon }) => {
              const on = active === id
              return (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  className={`flex items-center justify-center gap-2 ${isCompact ? 'py-2' : 'py-2.5'} text-sm transition
                    ${on ? 'bg-slate-50 text-slate-900' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Icon className={`w-4 h-4 ${on ? 'text-slate-900' : 'text-gray-400'}`} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )

  const FloatingBottomNav = ({ items, active, onSelect }) => (
    <div className="fixed left-1/2 bottom-4 z-20 -translate-x-1/2 w-full px-4 safe-pb">
      <div className="mx-auto w-full max-w-[420px] sm:max-w-[520px] md:max-w-[720px] lg:max-w-[840px] xl:max-w-[960px]">
        <div className="pointer-events-auto rounded-full bg-white/90 backdrop-blur shadow-lg ring-1 ring-black/5">
          <div className="grid grid-cols-3">
            {items.map(({ id, label, icon: Icon }) => {
              const on = active === id
              return (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  className={`flex flex-col items-center ${isCompact ? 'py-2.5' : 'py-3'} px-3 text-[11px] transition
                    ${on ? 'text-slate-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Icon className={`w-5 h-5 mb-0.5 ${on ? 'text-slate-900' : 'text-gray-400'}`} />
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className={cls.wrap}>
      <div className={cls.max}>
        <header className={cls.header}>
          <div className={cls.hero}>
            <div className={cls.grad} />
            <div className={cls.pad}>
              {/* make ID inline + smaller in compact mode */}
              <div className={cls.idRow}>Label ID: {token}</div>
              <h1 className={cls.name}>Hi, {guestName} 👋</h1>
              <div className={cls.chipsRow}>
                <StatusChip ok={checkinCompleted} okText="Check-in completed" waitText="Check-in required" />
                <StatusChip ok={accessUnlocked} okText="Access available" waitText="Access locked" />
              </div>
            </div>
          </div>

          {/* <div className="relative z-[60]">
            <SegmentedTabs items={navigationItems} active={activeSection} onSelect={setActiveSection} />
          </div> */}
        </header>

        <main className={cls.main}>{children}</main>

        <FloatingBottomNav items={navigationItems} active={activeSection} onSelect={setActiveSection} />
      </div>
    </div>
  )
}
