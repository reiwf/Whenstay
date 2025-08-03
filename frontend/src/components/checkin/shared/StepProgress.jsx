import { CheckCircle } from 'lucide-react'

export default function StepProgress({ currentStep, totalSteps = 4 }) {
  const steps = [
    { number: 1, title: 'Reservation' },
    { number: 2, title: 'Guest Info' },
    { number: 3, title: 'Documents' },
    { number: 4, title: 'Agreement' }
  ]

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">

        {steps.map((step, index) => (
          <div key={step.number} className="flex-1 flex flex-col items-center relative">
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="absolute top-5 left-1/2 w-full h-1 bg-gray-200 -z-10">
                <div
                  className="h-1 bg-green-500 transition-all duration-500"
                  style={{
                    width:
                      step.number < currentStep
                        ? '100%'
                        : step.number === currentStep
                        ? '50%'
                        : '0%'
                  }}
                />
              </div>
            )}

            {/* Step Circle */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
              ${
                step.number < currentStep
                  ? 'bg-green-500 text-white'
                  : step.number === currentStep
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step.number < currentStep ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                step.number
              )}
            </div>

            {/* Step Label */}
            <p
              className={`mt-2 text-xs sm:text-sm font-medium text-center whitespace-nowrap
              ${step.number <= currentStep ? 'text-gray-900' : 'text-gray-500'}`}
            >
              {step.title}
            </p>
          </div>
        ))}

      </div>

      {/* Mobile Step Indicator */}
      <div className="sm:hidden mt-4 text-center">
        <p className="text-sm text-gray-600">
          Step {currentStep} of {totalSteps}: {steps[currentStep - 1]?.title}
        </p>
      </div>
    </div>
  )
}
