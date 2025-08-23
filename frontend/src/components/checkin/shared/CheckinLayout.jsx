import { useEffect, useRef } from 'react'
import StepProgress from './StepProgress'

export default function CheckinLayout({ currentStep, children }) {
  const containerRef = useRef(null)

  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentStep])

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pb-8">
        {/* Progress (blended + sticky) */}
        <div className="sticky top-0 z-10 -mx-1 sm:mx-0 px-1 sm:px-0 pt-4 sm:pt-6 bg-slate-50/60 backdrop-blur supports-[backdrop-filter]:bg-slate-50/40">
          <div className="rounded-2xl bg-white/70 backdrop-blur ring-1 ring-slate-200/70 shadow-sm p-3 sm:p-4">
            <StepProgress currentStep={currentStep} />
          </div>
        </div>

        {/* Content (no big card; your steps render their own sections) */}
        <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          {children}
        </div>
      </div>
    </div>
  )
}
