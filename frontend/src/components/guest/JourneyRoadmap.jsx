import { CheckCircle, Clock, Unlock, CreditCard, MapPin, AlertCircle } from 'lucide-react'

const JourneyRoadmap = ({ checkinCompleted, services = [], canAccessStayInfo, property, reservation }) => {
  // Calculate journey progress based on current state
  const calculateJourneyProgress = () => {
    const steps = [
      {
        id: 'checkin',
        title: 'Online Check-in',
        description: 'Complete your guest registration and documentation',
        status: checkinCompleted ? 'completed' : 'current',
        icon: 'checkin'
      },
      {
        id: 'services',
        title: 'Required Services',
        description: 'Pay for mandatory services and accommodation tax',
        status: checkinCompleted ? 
          (services.filter(s => s.is_mandatory && s.payment_status !== 'paid').length === 0 ? 'completed' : 'current') : 
          'pending',
        icon: 'services'
      },
      {
        id: 'access',
        title: 'Stay Access Available',
        description: 'Room access code and stay information unlocked',
        status: canAccessStayInfo ? 'completed' : 
          (checkinCompleted && services.filter(s => s.is_mandatory && s.payment_status !== 'paid').length === 0 ? 'current' : 'pending'),
        icon: 'access'
      }
    ]

    const completedSteps = steps.filter(step => step.status === 'completed').length
    const progressPercentage = Math.round((completedSteps / steps.length) * 100)
    const currentStepIndex = steps.findIndex(step => step.status === 'current')
    const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null

    return {
      steps,
      currentStep,
      progressPercentage,
      completedSteps,
      totalSteps: steps.length
    }
  }

  const progress = calculateJourneyProgress()
  const mandatoryServices = services.filter(service => service.is_mandatory)
  const unpaidMandatoryServices = mandatoryServices.filter(service => service.payment_status !== 'paid')

  const getStepIcon = (iconType) => {
    switch (iconType) {
      case 'checkin':
        return <MapPin className="w-5 h-5" />
      case 'services':
        return <CreditCard className="w-5 h-5" />
      case 'access':
        return <Unlock className="w-5 h-5" />
      default:
        return <Clock className="w-5 h-5" />
    }
  }

  const getStepStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'current':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'pending':
        return 'text-gray-400 bg-gray-50 border-gray-200'
      default:
        return 'text-gray-400 bg-gray-50 border-gray-200'
    }
  }

  const getConnectorColor = (currentIndex, steps) => {
    if (currentIndex >= steps.length - 1) return 'bg-gray-200'
    
    const currentStep = steps[currentIndex]
    
    if (currentStep.status === 'completed') {
      return 'bg-green-400'
    } else if (currentStep.status === 'current') {
      return 'bg-blue-400'
    } else {
      return 'bg-gray-200'
    }
  }

  const formatAccessTime = (timeString) => {
    if (!timeString) return ''
    try {
      const [hours, minutes] = timeString.split(':')
      const time = new Date()
      time.setHours(parseInt(hours), parseInt(minutes))
      return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (error) {
      return timeString
    }
  }

  return (
    <div className="card border-primary-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Your Journey</h2>
          <p className="text-sm text-gray-600">Track your stay preparation progress</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-primary-600">{progress.progressPercentage}%</div>
          <div className="text-xs text-gray-500">Complete</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div 
          className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress.progressPercentage}%` }}
        />
      </div>

      {/* Journey Steps */}
      <div className="relative">
        {progress.steps.map((step, index) => (
          <div key={step.id} className="flex items-start mb-6 last:mb-0">
            {/* Step Icon */}
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 ${getStepStatusColor(step.status)} flex-shrink-0`}>
              {step.status === 'completed' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : step.status === 'current' ? (
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
              ) : (
                getStepIcon(step.icon)
              )}
              
              {/* Connector Line */}
              {index < progress.steps.length - 1 && (
                <div className={`absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-8 ${getConnectorColor(index, progress.steps)}`} />
              )}
            </div>

            {/* Step Content */}
            <div className="ml-4 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className={`text-base font-medium ${
                  step.status === 'completed' ? 'text-green-800' :
                  step.status === 'current' ? 'text-blue-800' :
                  'text-gray-500'
                }`}>
                  {step.title}
                </h3>
                
                {step.status === 'completed' && (
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    ✓ Done
                  </span>
                )}
                
                {step.status === 'current' && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full animate-pulse">
                    In Progress
                  </span>
                )}
              </div>
              
              <p className={`text-sm mt-1 ${
                step.status === 'completed' ? 'text-green-700' :
                step.status === 'current' ? 'text-blue-700' :
                'text-gray-500'
              }`}>
                {step.description}
              </p>

              {/* Services Payment Step Details */}
              {step.id === 'services' && mandatoryServices.length > 0 && (
                <div className="mt-3 space-y-2">
                  {mandatoryServices.map((service) => (
                    <div key={service.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">
                        {service.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-gray-900">
                          €{service.price}
                        </span>
                        {service.payment_status === 'paid' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {step.status === 'current' && unpaidMandatoryServices.length > 0 && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center text-amber-700 text-sm">
                        <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                        <span>Payment required for {unpaidMandatoryServices.length} service{unpaidMandatoryServices.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Access Step Details */}
              {step.id === 'access' && property?.access_time && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Access Available From
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatAccessTime(property.access_time)}
                    </span>
                  </div>
                  {step.status !== 'completed' && (
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(reservation.check_in_date).toLocaleDateString()} at {formatAccessTime(property.access_time)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Overall Status Message */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        {progress.progressPercentage === 100 ? (
          <div className="flex items-center text-green-600">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">All steps completed! Enjoy your stay.</span>
          </div>
        ) : progress.currentStep?.id === 'access' ? (
          <div className="flex items-center text-blue-600">
            <Clock className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">Waiting for access time. You're almost there!</span>
          </div>
        ) : progress.currentStep?.id === 'services' ? (
          <div className="flex items-center text-amber-600">
            <CreditCard className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">Complete service payments to unlock stay information.</span>
          </div>
        ) : (
          <div className="flex items-center text-blue-600">
            <MapPin className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">Complete check-in to continue your journey.</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default JourneyRoadmap
