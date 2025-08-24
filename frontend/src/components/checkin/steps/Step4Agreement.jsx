import { useState } from 'react'
import { FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import StepNavigation from '../shared/StepNavigation'
import { GUEST_AGREEMENT_TEMPLATE } from '../templates/GuestAgreementTemplate'
import Section from '@/components/ui/Section'

export default function Step4Agreement({
  formData,
  onUpdateFormData,
  onSubmit,
  onPrevious,
  isSubmitting = false,
  checkinCompleted = false,
  isModificationMode = false
}) {
  const { t } = useTranslation('guest')
  const [hasReadAgreement, setHasReadAgreement] = useState(false)
  const [agreementAccepted, setAgreementAccepted] = useState(formData.agreementAccepted || false)
  const [error, setError] = useState('')

  const isReadOnly = checkinCompleted && !isModificationMode

  const handleSubmit = () => {
    if (!agreementAccepted) {
      setError(t('step4.errors.mustAccept'))
      return
    }
    if (!hasReadAgreement) {
      setError(t('step4.errors.mustRead'))
      return
    }
    setError('')
    onUpdateFormData({ agreementAccepted: true })
    onSubmit()
  }

  const handleAgreementChange = (accepted) => {
    setAgreementAccepted(accepted)
    onUpdateFormData({ agreementAccepted: accepted })
    if (error) setError('')
  }

  const handleScroll = (e) => {
    const el = e.currentTarget
    const reachedBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 10
    if (reachedBottom && !hasReadAgreement) setHasReadAgreement(true)
  }

  // Very light markdown-ish formatter for the template
  const formatAgreementText = (text) =>
    text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <h3 key={i} className="text-base sm:text-lg font-semibold text-slate-900 mt-4 mb-2">{line.slice(2, -2)}</h3>
      }
      if (line.startsWith('•')) {
        return <li key={i} className="text-slate-700 mb-1">{line.slice(1).trim()}</li>
      }
      if (line.trim() === '') return <br key={i} />
      return <p key={i} className="text-slate-700 mb-2">{line}</p>
    })

  const Hint = ({ children }) => (
    <div className="rounded-xl bg-amber-50/80 ring-1 ring-amber-200 p-2.5 sm:p-3 text-amber-800 text-sm flex items-start">
      <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-amber-600" />
      <div className="break-words">{children}</div>
    </div>
  )

  const ErrorBox = ({ children }) => (
    <div className="rounded-xl bg-rose-50/80 ring-1 ring-rose-200 p-2.5 sm:p-3 text-rose-800 text-sm flex items-start">
      <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-rose-600" />
      <div className="break-words">{children}</div>
    </div>
  )

  const SuccessBox = ({ children }) => (
    <div className="rounded-xl bg-emerald-50/80 ring-1 ring-emerald-200 p-2.5 sm:p-3 text-emerald-800 text-sm flex items-start">
      <CheckCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-emerald-600" />
      <div>{children}</div>
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <Section
        title={t('step4.title')}
        subtitle={
          isReadOnly
            ? t('step4.subtitleReadOnly')
            : isModificationMode
            ? t('step4.subtitleModification')
            : t('step4.subtitle')
        }
        className="pt-2"
      />

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm sm:text-base font-semibold text-slate-900">{t('step4.agreementAccepted')}</h3>
          </div>
          <p className="text-sm text-slate-700">
            {t('step4.agreementAcceptedDesc')}
          </p>
        </div>
      )}

      {/* Agreement sheet */}
      <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 overflow-hidden">
        <div className="px-3 sm:px-4 py-3 bg-white/60 ring-0 flex items-center">
          <FileText className="w-5 h-5 text-slate-700 mr-2" />
          <div>
            <div className="text-sm sm:text-base font-semibold text-slate-900">{t('step4.termsAndConditions')}</div>
            <div className="text-xs text-slate-600">{t('step4.scrollInstructions')}</div>
          </div>
        </div>

        <div
          className="px-3 sm:px-4 py-3 sm:py-4 max-h-72 sm:max-h-[28rem] overflow-y-auto leading-relaxed"
          onScroll={handleScroll}
        >
          <div className="text-sm sm:text-[15px]">
            {formatAgreementText(GUEST_AGREEMENT_TEMPLATE)}
          </div>
        </div>

        {!hasReadAgreement && (
          <div className="px-3 sm:px-4 py-3 bg-white/60">
            <Hint>{t('step4.scrollToBottom')}</Hint>
          </div>
        )}
      </div>

      {/* Acceptance control */}
      <div className="mx-3 sm:mx-0 rounded-2xl bg-white/70 ring-1 ring-slate-200 p-3 sm:p-4">
        <label
          htmlFor="agreement"
          className={`flex items-start gap-3 cursor-pointer ${isReadOnly ? 'cursor-default' : ''}`}
        >
          <input
            id="agreement"
            type="checkbox"
            checked={agreementAccepted}
            onChange={(e) => handleAgreementChange(e.target.checked)}
            disabled={!hasReadAgreement || isReadOnly}
            className="mt-0.5 h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
          />
          <div className="text-xs sm:text-sm text-slate-700">
            <span className="font-medium">
              {t('step4.agreementText')}
            </span>
            <br />
            <span className="text-slate-600">
              {t('step4.agreementSubtext')}
            </span>
          </div>
        </label>
      </div>

      {/* Messages */}
      {error && <ErrorBox>{error}</ErrorBox>}
      {hasReadAgreement && agreementAccepted && (
        <SuccessBox>{t('step4.thankYou')}</SuccessBox>
      )}

      <StepNavigation
        currentStep={4}
        totalSteps={4}
        onNext={handleSubmit}
        onPrevious={onPrevious}
        isNextDisabled={!agreementAccepted || !hasReadAgreement}
        isLoading={isSubmitting}
        nextButtonText={t('step4.completeCheckIn')}
        showNext={!(checkinCompleted && agreementAccepted && !isModificationMode)}
      />
    </div>
  )
}
