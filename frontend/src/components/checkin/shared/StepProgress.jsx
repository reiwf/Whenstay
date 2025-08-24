import { CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function StepProgress({ currentStep, totalSteps = 4 }) {
  const { t } = useTranslation('guest')
  
  const steps = [
    { number: 1, title: t('stepProgress.steps.reservation') },
    { number: 2, title: t('stepProgress.steps.guestInfo') },
    { number: 3, title: t('stepProgress.steps.documents') },
    { number: 4, title: t('stepProgress.steps.agreement') }
  ]

  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between">
        {steps.map((step, idx) => {
          const state =
            step.number < currentStep ? 'done'
            : step.number === currentStep ? 'current'
            : 'todo'

          const circleCls = {
            done:    'bg-emerald-600 text-white',
            current: 'bg-slate-900 text-white',
            todo:    'bg-white text-slate-600 ring-1 ring-slate-300'
          }[state]

          return (
            <div key={step.number} className="flex-1 flex flex-col items-center relative">
              {/* segment rail behind each pair */}
              {idx < steps.length - 1 && (
                <div className="absolute top-5 left-1/2 w-full -z-10">
                  <div className="h-px w-full bg-slate-200/80">
                    <div
                      className={`h-px bg-slate-900 transition-all duration-500`}
                      style={{
                        width:
                          step.number < currentStep ? '100%'
                          : step.number === currentStep ? '50%'
                          : '0%'
                      }}
                    />
                  </div>
                </div>
              )}

              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shadow-sm ${circleCls}`}>
                {state === 'done' ? <CheckCircle className="w-5 h-5" /> : step.number}
              </div>

              <p className={`mt-2 text-xs sm:text-sm font-medium text-center whitespace-nowrap ${
                step.number <= currentStep ? 'text-slate-900' : 'text-slate-500'
              }`}>
                {step.title}
              </p>
            </div>
          )
        })}
      </div>

      {/* Mobile caption */}
      <div className="sm:hidden mt-3 text-center text-sm text-slate-600">
        {t('stepProgress.stepOf', { 
          current: currentStep, 
          total: totalSteps, 
          title: steps[currentStep - 1]?.title 
        })}
      </div>
    </div>
  )
}
