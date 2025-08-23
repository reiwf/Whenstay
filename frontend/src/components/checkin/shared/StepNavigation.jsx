import { ChevronLeft, ChevronRight } from 'lucide-react'
import LoadingSpinner from '../../LoadingSpinner'

export default function StepNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  isNextDisabled = false,
  isLoading = false,
  nextButtonText = 'Next',
  showPrevious = true,
  showNext = true
}) {
  const isFirstStep = currentStep === 1
  const isLastStep = currentStep === totalSteps

  return (
    <div className="pt-4 sm:pt-6 border-t border-slate-200/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* Previous */}
      {showPrevious && !isFirstStep ? (
        <button
          type="button"
          onClick={onPrevious}
          disabled={isLoading}
          className="order-2 sm:order-1 w-full sm:w-auto inline-flex items-center justify-center
                     px-4 py-2 text-sm font-medium text-slate-800 bg-white
                     ring-1 ring-slate-300 rounded-xl hover:bg-slate-50
                     focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </button>
      ) : <span className="hidden sm:block" />}

      {/* Next */}
      {showNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled || isLoading}
          className="order-1 sm:order-2 w-full sm:w-auto inline-flex items-center justify-center
                     px-5 sm:px-6 py-2 text-sm font-medium text-white
                     rounded-xl bg-slate-900 hover:opacity-90
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="small" />
              <span className="ml-2">Processing…</span>
            </>
          ) : (
            <>
              <span>{isLastStep ? 'Complete Check-in' : nextButtonText}</span>
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
            </>
          )}
        </button>
      )}
    </div>
  )
}
