// components/ui/LayoutShell.jsx
import { CheckCircle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../LanguageSwitcher'

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
  const { t } = useTranslation('guest')
  const isCompact = headerVariant === 'compact'

  // shared glass styles (transparent, blurred, with subtle edge + inner highlight)
const glass = [
  'bg-white/10 dark:bg-white/5',
  // better cross-browser: only blur if supported
  'supports-[backdrop-filter]:backdrop-blur-xl',
  'supports-[backdrop-filter]:saturate-150',
  'border border-white/25 dark:border-white/10',
  // soft outside shadow + faint inner top highlight
  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_12px_30px_-12px_rgba(0,0,0,0.45)]',
].join(' ');

const cls = {
  wrap:
    'min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 ' +
    'dark:from-slate-950 dark:to-slate-900',
  max:
    'mx-auto w-full max-w-[420px] sm:max-w-[520px] md:max-w-[720px] ' +
    'lg:max-w-[840px] xl:max-w-[960px]',
  header: 'sticky top-0 z-[60]',
  hero: [
    'relative overflow-visible text-white ' ,
    isCompact ? 'rounded-b-2xl' : 'rounded-b-3xl',
    glass,
    'before:absolute before:inset-0 before:rounded-inherit ' +
      'before:pointer-events-none ' +
      'before:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] ' +
      'after:absolute after:inset-x-0 after:-top-1 after:h-16 after:rounded-[inherit] after:pointer-events-none ' +
      'after:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.45),transparent)]',
  ].join(' '),
  grad: 'absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-500 pointer-events-none',
  pad: [
    'relative safe-pt',
    isCompact ? 'px-4 pt-3 pb-3' : 'px-5 pt-5 pb-6',
  ].join(' '),
  idRow: ['text-[10px]', isCompact ? 'opacity-70' : 'opacity-80'].join(' '),
  name: [isCompact ? 'text-lg' : 'text-2xl', 'font-semibold'].join(' '),
  chipsRow: 'mt-2 flex flex-wrap gap-1.5',
  main: 'relative z-0 px-4 pt-6 pb-20',
};


const StatusChip = ({ ok, okText = 'Ready', waitText = 'Pending' }) => (
  <span
    className={[
      'inline-flex items-center gap-1 rounded-full font-medium',
      isCompact ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
      'text-white/95',
      'bg-white/15 hover:bg-white/20',
      'supports-[backdrop-filter]:backdrop-blur-md',
      'border border-white/25',
      'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_6px_18px_-10px_rgba(0,0,0,0.45)]',
      'transition-colors',
    ].join(' ')}
  >
    {ok ? (
      <CheckCircle className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
    ) : (
      <Clock className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
    )}
    {ok ? okText : waitText}
  </span>
);
  

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
    <div className="fixed left-1/2 bottom-2 z-20 -translate-x-1/2 w-full px-4 safe-pb">
      <div className="mx-auto w-full max-w-[420px] sm:max-w-[520px] md:max-w-[720px] lg:max-w-[840px] xl:max-w-[960px]">
        <div className="pointer-events-auto rounded-full bg-white/70 backdrop-blur shadow-lg ring-1 ring-black/5">
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
            <div className={`${isCompact ? 'rounded-b-2xl' : 'rounded-b-3xl'} absolute inset-0 overflow-hidden pointer-events-none`}>
              <div className={cls.grad} />
            </div>
            <div className={cls.pad}>
              {/* Language switcher and ID row */}
              <div className="flex items-center justify-between">
                <div className={cls.idRow}>{t('labelId', { token })}</div>
                <LanguageSwitcher 
                  userType="guest" 
                  identifier={token} 
                  compact={true}
                  className="ml-auto"
                />
              </div>
              <h1 className={cls.name}>{t('welcome', { name: guestName })}</h1>
              <div className={cls.chipsRow}>
                <StatusChip ok={checkinCompleted} okText={t('status.checkinCompleted')} waitText={t('status.checkinRequired')} />
                <StatusChip ok={accessUnlocked} okText={t('status.accessAvailable')} waitText={t('status.accessLocked')} />
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
