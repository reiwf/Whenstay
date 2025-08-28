import React from 'react';
import { X, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

/**
 * ErrorModal (Glassy)
 * - Same props as before
 * - Frosted glass panel, blurred overlay, subtle gradients
 * - Dark-mode friendly
 * - Gentle enter/exit animation
 */
export default function ErrorModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'error', // 'error' | 'warning' | 'info' | 'success'
  details = null,
  onConfirm = null,
  confirmText = 'OK',
  showCancel = false,
  cancelText = 'Cancel'
}) {
  const [mounted, setMounted] = React.useState(false);

  // palette per type (glassy-friendly, lighter tints)
  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return {
          icon: XCircle,
          iconColor: 'text-rose-300',
          ring: 'ring-rose-300/20',
          grad: 'from-rose-300/25 via-transparent to-transparent',
          btn: 'bg-rose-500/80 hover:bg-rose-500 text-white focus:ring-rose-400/50',
          title: 'text-rose-50',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: 'text-amber-300',
          ring: 'ring-amber-300/20',
          grad: 'from-amber-300/25 via-transparent to-transparent',
          btn: 'bg-amber-500/80 hover:bg-amber-500 text-slate-900 focus:ring-amber-300/50',
          title: 'text-amber-50',
        };
      case 'info':
        return {
          icon: Info,
          iconColor: 'text-sky-300',
          ring: 'ring-sky-300/20',
          grad: 'from-sky-300/25 via-transparent to-transparent',
          btn: 'bg-sky-500/80 hover:bg-sky-500 text-white focus:ring-sky-300/50',
          title: 'text-sky-50',
        };
      case 'success':
        return {
          icon: CheckCircle,
          iconColor: 'text-emerald-300',
          ring: 'ring-emerald-300/20',
          grad: 'from-emerald-300/25 via-transparent to-transparent',
          btn: 'bg-emerald-500/80 hover:bg-emerald-500 text-white focus:ring-emerald-300/50',
          title: 'text-emerald-50',
        };
      default:
        return {
          icon: Info,
          iconColor: 'text-slate-200',
          ring: 'ring-white/20',
          grad: 'from-white/20 via-transparent to-transparent',
          btn: 'bg-slate-500/80 hover:bg-slate-500 text-white focus:ring-white/40',
          title: 'text-slate-50',
        };
    }
  };

  const styles = getTypeStyles();
  const Icon = styles.icon;

  const handleConfirm = () => (onConfirm ? onConfirm() : onClose());
  const handleCancel = () => onClose();

  // Close on Escape
  React.useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // mount animation
  React.useEffect(() => {
    if (isOpen) {
      // slight delay to let initial classes apply before transition
      const t = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(t);
    }
    setMounted(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4
        bg-slate-900/60 backdrop-blur-sm
        transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}
      `}
      aria-modal="true"
      role="dialog"
    >
      {/* subtle vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06),_transparent_60%)]" />

      <div
        className={`
          relative w-full max-w-md
          rounded-2xl border border-white/15 bg-white/10 dark:bg-slate-900/20
          backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]
          ring-1 ${styles.ring}
          transition-all duration-200
          ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        `}
      >
        {/* gradient accent strip */}
        <div
          className={`
            absolute inset-x-0 -top-px h-px
            bg-gradient-to-r ${styles.grad}
            pointer-events-none
            rounded-t-2xl
          `}
        />

        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`
                  inline-flex items-center justify-center
                  h-9 w-9 rounded-full bg-white/10 border border-white/15
                `}
              >
                <Icon className={`h-5 w-5 ${styles.iconColor}`} />
              </span>
              <h3 className={`text-base font-semibold tracking-tight ${styles.title}`}>
                {title}
              </h3>
            </div>

            <button
              onClick={onClose}
              aria-label="Close modal"
              className="
                shrink-0 rounded-full p-2
                text-slate-200/80 hover:text-white
                hover:bg-white/10 border border-transparent hover:border-white/10
                transition-colors
              "
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-5">
          <p className="text-sm leading-relaxed text-slate-100/90">
            {message}
          </p>

          {details && (
            <div
              className="
                mt-4 rounded-xl border border-white/15 bg-white/5
                p-3
              "
            >
              <h4 className="text-xs font-medium text-slate-200/90 mb-2">
                Technical Details
              </h4>
              <pre className="text-[11px] leading-relaxed text-slate-200/80 font-mono whitespace-pre-wrap break-words">
                {details}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          className="
            flex justify-end gap-2.5 px-6 pb-5
          "
        >
          {showCancel && (
            <button
              onClick={handleCancel}
              className="
                inline-flex items-center justify-center
                rounded-lg px-4 py-2 text-sm font-medium
                text-slate-100/90
                bg-white/10 hover:bg-white/15
                border border-white/15
                focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-white/30
                transition-colors
              "
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`
              inline-flex items-center justify-center
              rounded-lg px-4 py-2 text-sm font-semibold
              ${styles.btn}
              border border-white/10
              focus:outline-none focus:ring-2 focus:ring-offset-0
              transition-colors
            `}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

ErrorModal.displayName = 'ErrorModal';
