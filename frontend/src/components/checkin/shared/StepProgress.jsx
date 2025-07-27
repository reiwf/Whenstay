import { CheckCircle } from 'lucide-react'

export default function StepProgress({ currentStep, totalSteps = 4 }) {
  const steps = [
    { number: 1, title: 'Reservation' },
    { number: 2, title: 'Guest Info' },
    { number: 3, title: 'Documents' },
    { number: 4, title: 'Agreement' }
  ]

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            {/* Step Circle */}
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
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
              
              {/* Step Title */}
              <div className="ml-3 hidden sm:block">
                <p
                  className={`text-sm font-medium ${
                    step.number <= currentStep
                      ? 'text-gray-900'
                      : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </p>
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`hidden sm:block w-16 h-0.5 mx-4 ${
                  step.number < currentStep
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`}
              />
            )}
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




