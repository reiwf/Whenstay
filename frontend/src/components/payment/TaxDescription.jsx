// src/components/ui/TaxDescription.jsx

// Pretty renderer for "Accommodation Tax" TEXT descriptions.
// Parses common patterns and falls back to a readable paragraph.

import { useTranslation } from 'react-i18next'

function TaxDescription({ desc }) {
  const { t } = useTranslation('guest')
  
  if (!desc) return null

  // Normalize punctuation/spaces
  const text = String(desc)
    .replace(/[–—－〜～]/g, '~')   // range dashes/tilde variants
    .replace(/\s+/g, ' ')
    .trim()

  // Extract bands like:
  // "No tax (<¥5,000), ¥200 (¥5,000~¥15,000), ¥400 (¥15,000~¥20,000), ¥500 (≥¥20,000)"
  const bands = []
  const noTax = text.match(/no\s*tax\s*\(([^)]+)\)/i)
  if (noTax) bands.push({ fee: '¥0', range: noTax[1] })

  const feeRe = /¥\s*([\d,]+)\s*\(([^)]+)\)/gi
  let m
  while ((m = feeRe.exec(text)) !== null) {
    bands.push({ fee: `¥${m[1]}`, range: m[2] })
  }

  const simplify = (r) => {
    let s = r
      .replace(/</g, t('taxDescription.under'))
      .replace(/>=|≥/g, '≥ ')
      .replace(/<=|≤/g, '≤ ')
      .replace(/~/g, ' – ')
      .replace(/\s*¥\s*/g, '¥')
      .replace(/\s+/g, ' ')
      .trim()
    return s.replace(/^\((.*)\)$/, '$1') // strip surrounding ()
  }

  // Fallback if parsing fails
  if (bands.length === 0) {
    return (
      <p className="text-sm text-slate-700 leading-6 whitespace-pre-wrap">
        {desc}
      </p>
    )
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-slate-600 mb-2">
        {t('taxDescription.taxRatesByAmount')}
      </p>
      <div className="rounded-xl bg-white/80 dark:bg-slate-900/60 backdrop-blur
                      ring-1 ring-slate-200/70 dark:ring-slate-700/60 divide-y
                      divide-slate-200/70 dark:divide-slate-700/60">
        {bands.map((b, i) => (
          <div key={i} className="px-3 py-2 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-700">{simplify(b.range)}</div>
            <div className="text-sm font-semibold tabular-nums text-slate-900">{b.fee}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mt-2">{t('taxDescription.perPersonPerNight')}</p>
    </div>
  )
}

export default TaxDescription
