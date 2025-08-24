import { useEffect, useState, useMemo } from 'react'
import { CheckCircle, Clock, Unlock, CreditCard, MapPin, AlertCircle, Pointer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Section from '../ui/Section'
import { ListGroup }  from '../ui/ListGroup'

// Neutral "glass" circle for step icons
const circleBase =
  'relative flex items-center justify-center w-10 h-10 rounded-full ' +
  'ring-1 ring-slate-200 bg-white/80 dark:bg-slate-900/60 backdrop-blur flex-shrink-0'

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
  reservation,
  onStartCheckin
}) {
  const { t } = useTranslation('guest')
  
  // Function to scroll to add-ons section
  const scrollToAddOns = () => {
    // Try multiple strategies to find the Add-ons section
    let addOnsSection = null;
    
    // Strategy 1: Look for section with data-section attribute
    addOnsSection = document.querySelector('[data-section="add-ons"]');
    
    // Strategy 2: Look for section with specific ID
    if (!addOnsSection) {
      addOnsSection = document.getElementById('add-ons-section');
    }
    
    // Strategy 3: Look for text content "Add-ons" in headers
    if (!addOnsSection) {
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (const heading of headings) {
        if (heading.textContent.trim() === 'Add-ons') {
          addOnsSection = heading.closest('section') || heading.closest('div') || heading;
          break;
        }
      }
    }
    
    // Strategy 4: Look for any element containing "Add-ons" text
    if (!addOnsSection) {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.includes('Add-ons')) {
          addOnsSection = node.parentElement.closest('section') || node.parentElement.closest('div');
          if (addOnsSection) break;
        }
      }
    }
    
    if (addOnsSection) {
      addOnsSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    } else {
      // Fallback: scroll down significantly if add-ons section not found
      window.scrollTo({ 
        top: window.scrollY + 600, 
        behavior: 'smooth' 
      });
    }
  }
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
    () => mandatoryServices.filter((s) => s.payment_status !== 'paid' && s.payment_status !== 'exempted'),
    [mandatoryServices]
  )

  const progress = useMemo(() => {
    const steps = [
      {
        id: 'checkin',
        title: t('journeyRoadmap.steps.checkin'),
        status: checkinCompleted ? 'completed' : 'current',
        icon: 'checkin'
      },
      {
        id: 'services',
        title: t('journeyRoadmap.steps.accommodationTax'),
        status: checkinCompleted
          ? (unpaidMandatoryServices.length === 0 ? 'completed' : 'current')
          : 'pending',
        icon: 'services'
      },
      {
        id: 'access',
        title: t('journeyRoadmap.steps.accessKey'),
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
  }, [checkinCompleted, unpaidMandatoryServices.length, accessUnlocked, t])

  const getStepIcon = (iconType) => {
    switch (iconType) {
      case 'checkin':  return <MapPin className="w-5 h-5" />
      case 'services': return <CreditCard className="w-5 h-5" />
      case 'access':   return <Unlock className="w-5 h-5" />
      default:         return <Clock className="w-5 h-5" />
    }
  }

  const getConnectorColor = (idx, steps) => {
    if (idx >= steps.length - 1) return 'bg-slate-200'
    const s = steps[idx]
    if (s.status === 'completed') return 'bg-emerald-400'  // subtle success accent
    if (s.status === 'current')   return 'bg-slate-400'    // neutral active
    return 'bg-slate-200'
  }

  return (
    <Section title={t('journeyRoadmap.title')} subtitle={t('journeyRoadmap.subtitle')} className="pt-2">
     <div className="flex items-center justify-between mb-3">
       <div className="text-xs text-slate-500">{t('journeyRoadmap.progress')}</div>
       <div className="text-sm font-semibold text-slate-800">{progress.progressPercentage}%</div>
     </div>
     {/* (optional) thin progress bar for a native feel */}
     <div className="h-1.5 bg-slate-200/70 dark:bg-slate-800/60 rounded-full overflow-hidden mb-4">
       <div className="h-full bg-slate-800 dark:bg-slate-100" style={{ width: `${progress.progressPercentage}%` }} />
     </div>

      {/* Steps */}
      <div className="relative">
        {progress.steps.map((step, index) => (
          <div key={step.id} className="relative flex items-start mb-6 last:mb-0">
             {index < progress.steps.length - 1 && (
                <div
                  className={`absolute left-5 top-10 w-px ${getConnectorColor(index, progress.steps)}`}
                  style={{ height: 'calc(100% + 1.5rem)' }} // 1.5rem = mb-6
                />
              )}
            {/* Icon */}
            <div className={circleBase}>
              {step.status === 'completed' ? (
                <CheckCircle strokeWidth={1.5} className="w-5 h-5 text-emerald-600" />
              ) : step.status === 'current' ? (
                <div className="w-3 h-3 bg-slate-900 rounded-full animate-pulse" />
              ) : (
                getStepIcon(step.icon)
              )}

            </div>

            {/* Content */}
            <div className="ml-4 mt-1 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className={`text-base font-medium ${
                  step.status === 'pending' ? 'text-slate-500' : 'text-slate-900'}`}>
                  {step.title}
                </h3>
                 {step.status === 'completed' && (
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{t('journeyRoadmap.status.done')}</span>
                  )}
                  {step.status === 'current' && (
                    <span className="text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">{t('journeyRoadmap.status.inProgress')}</span>
                  )}
              </div>

              {/* Check-in button */}
              {step.id === 'checkin' && step.status === 'current' && onStartCheckin && (
                <div className="flex items-center px-3 py-2 bg-slate-900 rounded-xl ring-1 ring-slate-300 w-fit ">
                  <button
                    onClick={onStartCheckin}
                  >
                    <div className="flex items-center space-x-2">                   
                   <span className="text-[11px] font-medium text-white animate-pulse">{t('journeyRoadmap.startCheckin')}</span>     
                    <MapPin className="w-4 h-4 text-green-600 animate-pulse" />               
                   </div>
                  </button>
                  
                </div>
              )}

              {/* Services details */}
              {step.id === 'services' && mandatoryServices.length > 0 && (
                <div>
                  {mandatoryServices.map((service) => (
                    <div 
                      key={service.id} 
                      className="w-40 flex justify-between items-center px-3 py-2 bg-slate-50 rounded-xl ring-1 ring-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={scrollToAddOns}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-medium text-gray-800">JPY {service.price}</span>
                        {(service.payment_status === 'paid' || service.payment_status === 'exempted')
                          ? <CheckCircle className="w-4 h-4 text-green-600" />
                          : <Clock className="w-3 h-3 text-amber-600" />}
                      </div>
                    </div>
                  ))}

                  {step.status === 'current' && unpaidMandatoryServices.length > 0 && (
                    <div className="mt-2 px-3 py-2  rounded-xl">
                      <div className="flex items-center text-amber-700 text-sm">
                        <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                        <span>{t('journeyRoadmap.paymentRequired', { count: unpaidMandatoryServices.length })}</span>
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
                      <span className="text-[11px] font-medium text-slate-600">{t('journeyRoadmap.accessAvailableFrom')}</span>
                      <div className="grid grid-cols-4 gap-2" aria-live="polite">
                        {[
                          { k: 'days', label: t('journeyRoadmap.countdown.days') },
                          { k: 'hours', label: t('journeyRoadmap.countdown.hours') },
                          { k: 'minutes', label: t('journeyRoadmap.countdown.minutes') },
                          { k: 'seconds', label: t('journeyRoadmap.countdown.seconds') },
                        ].map(({ k, label }) => (
                          <div key={k} className="relative">
                            <div className="rounded-2xl bg-white/80 dark:bg-slate-900/60 backdrop-blur
                                            ring-1 ring-slate-200/60 dark:ring-slate-700/60 shadow-sm
                                            px-3 py-2 text-center">
                              {/* re-mount on change to trigger micro animation */}
                              <div key={`${k}-${countdown[k]}`}
                                  className="font-mono tabular-nums text-xl leading-none font-semibold text-slate-900 dark:text-slate-50 animate-pop">
                                {pad2(countdown[k])}
                              </div>
                              <div className="text-[10px] font-medium tracking-wide text-slate-500 dark:text-slate-300">
                                {label}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2">
                        {t('journeyRoadmap.visitAt', { 
                          date: new Date(reservation.check_in_date).toLocaleDateString(), 
                          time: formatAccessTime(property.access_time) 
                        })}
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
        <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-700/60">
          {progress.progressPercentage === 100 ? (
            <div className="flex items-center text-slate-600">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">{t('journeyRoadmap.status.allCompleted')}</span>
            </div>
          ) : progress.currentStep?.id === 'access' ? (
            <div className="flex items-center text-slate-600">
              <Clock className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">{t('journeyRoadmap.status.waitingForCheckinTime')}</span>
            </div>
          ) : progress.currentStep?.id === 'services' ? (
            <div className="flex items-center text-slate-600">
              <CreditCard className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">{t('journeyRoadmap.status.completeServicePayments')}</span>
            </div>
          ) : (
            <div className="flex items-center text-slate-600">
              <MapPin className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">{t('journeyRoadmap.status.completeCheckin')}</span>
            </div>
          )}
        </div>
    </Section>
  )
}
