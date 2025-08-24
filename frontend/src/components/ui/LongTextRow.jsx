import { useEffect, useRef, useState } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { createPortal } from 'react-dom'
import { ListRow } from './ListGroup'

export default function LongTextRow({
  icon,
  label,
  text,
  title,
  lines = 2,
  rightHint = 'View',
  showPreview = true,          // <— NEW
  dialog = 'center',
  renderRich,
}) {
  const [open, setOpen] = useState(false)
  const wantsPreview = showPreview && lines > 0

  const preview = wantsPreview ? (
    <span
      className="block text-sm text-slate-600 text-right"
      style={{
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: lines,
        overflow: 'hidden',
      }}
      title={typeof text === 'string' ? text : undefined}
    >
      {typeof text === 'string' ? text : ''}
    </span>
  ) : null
  
  return (
    <>
      <ListRow
        onClick={() => setOpen(true)}
        left={
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-slate-900">{label}</span>
          </div>
        }
        right={
          <div className="ml-auto flex items-center gap-1 justify-end text-right">
            {preview}
            <span className="text-[11px] text-slate-400">{rightHint}</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>
        }
      />

      {open && (dialog === 'center'
        ? <CenterModal title={title || label} onClose={() => setOpen(false)}>
            {renderRich ? renderRich(text) : (
              <p className="text-[13px] leading-6 text-slate-700 whitespace-pre-line">
                {text}
              </p>
            )}
          </CenterModal>
        : <BottomSheet title={title || label} onClose={() => setOpen(false)}>
            {renderRich ? renderRich(text) : (
              <p className="text-[13px] leading-6 text-slate-700 whitespace-pre-line">
                {text}
              </p>
            )}
          </BottomSheet>
      )}
    </>
  )
}


function useEscapeClose(onClose) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}

function useScrollShadows(ref) {
  const [shadow, setShadow] = useState({ top: false, bottom: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      setShadow({
        top: scrollTop > 2,
        bottom: scrollTop + clientHeight < scrollHeight - 2,
      })
    }
    onScroll()
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  return shadow
}


/* ---- Centered modal (smartphone card) ---- */
export function CenterModal({ title, children, onClose }) {
  useEscapeClose(onClose)
  const bodyRef = useRef(null)
  const shadow = useScrollShadows(bodyRef)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lt-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* backdrop (click to close) */}
        <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        />
      <div
        role="document"
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 animate-[pop_.22s_ease-out]"
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <h3 id="lt-title" className="text-base font-semibold text-slate-900">
            {title}
          </h3>
          {/* <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200"
            aria-label="Close"
            autoFocus
          >
            <X className="w-4 h-4 text-slate-600" />
          </button> */}
        </div>

        {/* body */}
        <div ref={bodyRef} className="relative px-4 pb-4 pt-2 max-h-[70vh] overflow-y-auto">
          <div className="readable">{children}</div>

          {/* scroll shadows */}
          <div
            className={`pointer-events-none absolute left-0 right-0 top-0 h-4 bg-gradient-to-b from-white to-transparent transition-opacity ${
              shadow.top ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`pointer-events-none absolute left-0 right-0 bottom-0 h-4 bg-gradient-to-t from-white to-transparent transition-opacity ${
              shadow.bottom ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ---- Bottom sheet (mobile) ---- */
export function BottomSheet({ title, children, onClose }) {
  useEscapeClose(onClose)
  const bodyRef = useRef(null)
  const shadow = useScrollShadows(bodyRef)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lt-title-sheet"
      className="fixed inset-0 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-lg ring-1 ring-slate-200 animate-[slideUp_.22s_ease-out]">
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200 absolute right-2 top-2"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="px-4 pb-6 pt-2 max-h-[70vh] overflow-y-auto relative">
          <h3 id="lt-title-sheet" className="text-base font-semibold text-slate-900 mb-2">
            {title}
          </h3>
          <div ref={bodyRef} className="relative">
            <div className="readable">{children}</div>

            {/* scroll shadows */}
            <div
              className={`pointer-events-none absolute left-0 right-0 -top-2 h-4 bg-gradient-to-b from-white to-transparent transition-opacity ${
                shadow.top ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div
              className={`pointer-events-none absolute left-0 right-0 -bottom-2 h-4 bg-gradient-to-t from-white to-transparent transition-opacity ${
                shadow.bottom ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

