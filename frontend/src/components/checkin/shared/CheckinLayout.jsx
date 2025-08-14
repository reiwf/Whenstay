import { useEffect, useRef } from 'react'
import StepProgress from './StepProgress'

export default function CheckinLayout({ currentStep, children, title, subtitle }) {
  const containerRef = useRef(null)

  // Scroll to top when step changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      })
    }
  }, [currentStep])

  return (
    <div ref={containerRef} className="min-h-screen bg-primary-50 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow-sm border border-primary-200 mb-4 sm:mb-6">
          <StepProgress currentStep={currentStep} />
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-sm border border-primary-200 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
