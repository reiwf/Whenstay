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
    <div className="flex justify-between items-center pt-6 border-t border-primary-200">
      {/* Previous Button */}
      {showPrevious && !isFirstStep ? (
        <button
          type="button"
          onClick={onPrevious}
          disabled={isLoading}
          className="flex items-center px-4 py-2 text-sm font-medium text-primary-700 bg-white border border-primary-300 rounded-md hover:bg-primary-50 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </button>
      ) : (
        <div></div>
      )}

      {/* Next/Submit Button */}
      {showNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={isNextDisabled || isLoading}
          className="flex items-center px-6 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="small" />
              <span className="ml-2">Processing...</span>
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
