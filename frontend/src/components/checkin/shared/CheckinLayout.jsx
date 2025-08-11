import StepProgress from './StepProgress'

export default function CheckinLayout({ currentStep, children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-primary-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {title || 'Welcome to Whenstay!'}
          </h1>
          {subtitle && (
            <p className="text-lg text-gray-600">
              {subtitle}
            </p>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow-sm border border-primary-200 mb-6">
          <StepProgress currentStep={currentStep} />
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-sm border border-primary-200 p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
