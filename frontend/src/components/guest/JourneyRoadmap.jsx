import { useEffect, useState, useMemo } from 'react'
import { CheckCircle, Clock, Unlock, CreditCard, MapPin, AlertCircle } from 'lucide-react'

const pad2 = (n) => String(n ?? 0).padStart(2, '0')

const formatAccessTime = (timeString) => {
  if (!timeString) return ''
  try {
    const [hours, minutes] = timeString.split(':')
    const t = new Date()
    t.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
    return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return timeString
  }
}

export default function JourneyRoadmap({
  checkinCompleted,
  services = [],
  canAccessStayInfo,
  property,
  reservation
}) {
  // Normalize: support function or boolean prop for access gating
  const accessUnlocked = typeof canAccessStayInfo === 'function'
    ? !!canAccessStayInfo()
    : !!canAccessStayInfo

  // ---- Countdown (now INSIDE the component)
  const [countdown, setCountdown] = useState(null)

  useEffect(() => {
    if (!checkinCompleted || accessUnlocked || !property?.access_time || !reservation?.check_in_date) {
      setCountdown(null)
      return
    }

    const tick = () => {
      const now = new Date()

      const d = (dateObj) =>
        `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`

      const todayStr = d(now)
      const checkinDateObj = new Date(reservation.check_in_date)
      const checkinStr = d(checkinDateObj)

      const [h, m] = property.access_time.split(':').map((n) => parseInt(n, 10))
      let target

      if (todayStr < checkinStr) {
        target = new Date(checkinDateObj); target.setHours(h, m, 0, 0)
      } else if (todayStr === checkinStr) {
        target = new Date(); target.setHours(h, m, 0, 0)
      } else {
        setCountdown(null)
        return
      }

      const diff = target.getTime() - now.getTime()
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setCountdown({ days, hours, minutes, seconds })
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [checkinCompleted, accessUnlocked, property?.access_time, reservation?.check_in_date])

  // ---- Derived data
  const mandatoryServices = useMemo(
    () => services.filter((s) => s.is_mandatory),
    [services]
  )
  const unpaidMandatoryServices = useMemo(
    () => mandatoryServices.filter((s) => s.payment_status !== 'paid'),
    [mandatoryServices]
  )

  const progress = useMemo(() => {
    const steps = [
      {
        id: 'checkin',
        title: 'Online Check-in',
        status: checkinCompleted ? 'completed' : 'current',
        icon: 'checkin'
      },
      {
        id: 'services',
        title: 'Accommodation Tax',
        status: checkinCompleted
          ? (unpaidMandatoryServices.length === 0 ? 'completed' : 'current')
          : 'pending',
        icon: 'services'
      },
      {
        id: 'access',
        title: 'Access Code',
        status: accessUnlocked
          ? 'completed'
          : (checkinCompleted && unpaidMandatoryServices.length === 0 ? 'current' : 'pending'),
        icon: 'access'
      }
    ]

    const completedSteps = steps.filter((s) => s.status === 'completed').length
    const currentStepIndex = steps.findIndex((s) => s.status === 'current')

    return {
      steps,
      currentStep: currentStepIndex >= 0 ? steps[currentStepIndex] : null,
      progressPercentage: Math.round((completedSteps / steps.length) * 100),
      completedSteps,
      totalSteps: steps.length
    }
  }, [checkinCompleted, unpaidMandatoryServices.length, accessUnlocked])

  const getStepIcon = (iconType) => {
    switch (iconType) {
      case 'checkin':  return <MapPin className="w-5 h-5" />
      case 'services': return <CreditCard className="w-5 h-5" />
      case 'access':   return <Unlock className="w-5 h-5" />
      default:         return <Clock className="w-5 h-5" />
    }
  }

  const getStepStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200'
      case 'current':   return 'text-blue-600 bg-blue-50 border-blue-200'
      default:          return 'text-gray-400 bg-gray-50 border-gray-200'
    }
  }

  const getConnectorColor = (idx, steps) => {
    if (idx >= steps.length - 1) return 'bg-gray-200'
    const s = steps[idx]
    if (s.status === 'completed') return 'bg-green-400'
    if (s.status === 'current')   return 'bg-blue-400'
    return 'bg-gray-200'
  }

  return (
    <div className="card border-primary-200">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Journey to your stay</h2>
          <p className="text-sm text-gray-600">Things to do before to get the key</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-primary-600">{progress.progressPercentage}%</div>
          <div className="text-xs text-gray-500">Complete</div>
        </div>
      </div>

      {/* Steps */}
      <div className="relative">
        {progress.steps.map((step, index) => (
          <div key={step.id} className="flex items-start mb-6 last:mb-0">
            {/* Icon */}
            <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 ${getStepStatusColor(step.status)} flex-shrink-0`}>
              {step.status === 'completed' ? (
                <CheckCircle size={16} strokeWidth={1.5} className="w-5 h-5 text-green-600" />
              ) : step.status === 'current' ? (
                <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
              ) : (
                getStepIcon(step.icon)
              )}

              {/* Connector */}
              {index < progress.steps.length - 1 && (
                <div className={`absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-8 ${getConnectorColor(index, progress.steps)}`} />
              )}
            </div>

            {/* Content */}
            <div className="ml-4 mt-1 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className={`text-base font-medium ${
                  step.status === 'completed' ? 'text-green-800'
                : step.status === 'current'   ? 'text-blue-800'
                : 'text-gray-500'}`}>
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

              {/* Services details */}
              {step.id === 'services' && mandatoryServices.length > 0 && (
                <div className="mt-3 space-y-2">
                  {mandatoryServices.map((service) => (
                    <div key={service.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">{service.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-gray-900">€{service.price}</span>
                        {service.payment_status === 'paid'
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : <Clock className="w-4 h-4 text-amber-600" />}
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

              {/* Access w/ Countdown */}
              {step.id === 'access' && property?.access_time && (
                <div>
                  {checkinCompleted && !accessUnlocked && countdown && (
                    <div>
                      <span className="text-[11px] font-medium text-blue-900">Access Available From</span>
                      <div className="grid grid-cols-4 gap-2" aria-live="polite">
                        {[
                          { k: 'days', label: 'Days' },
                          { k: 'hours', label: 'Hours' },
                          { k: 'minutes', label: 'Min' },
                          { k: 'seconds', label: 'Sec' },
                        ].map(({ k, label }) => (
                          <div key={k} className="relative">
                            <div className="rounded-2xl bg-white/80 dark:bg-slate-900/60 backdrop-blur
                                            border border-blue-200/60 dark:border-slate-700/60 shadow-sm
                                            px-3 py-2 text-center">
                              {/* re-mount on change to trigger micro animation */}
                              <div key={`${k}-${countdown[k]}`}
                                  className="font-mono tabular-nums text-xl leading-none font-semibold text-blue-900 dark:text-blue-50 animate-pop">
                                {pad2(countdown[k])}
                              </div>
                              <div className="text-[10px] font-medium tracking-wide text-blue-700/80 dark:text-blue-200/80">
                                {label}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-blue-700 mt-2">
                        visit at {new Date(reservation.check_in_date).toLocaleDateString()} at {formatAccessTime(property.access_time)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Overall status */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        {progress.progressPercentage === 100 ? (
          <div className="flex items-center text-green-600">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">All steps completed! Enjoy your stay.</span>
          </div>
        ) : progress.currentStep?.id === 'access' ? (
          <div className="flex items-center text-blue-600">
            <Clock className="w-5 h-5 mr-2" />
            <span className="text-sm font-medium">Waiting for check-in time. You're almost there!</span>
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
