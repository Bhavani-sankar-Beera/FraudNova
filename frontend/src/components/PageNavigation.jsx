import React from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function PageNavigation({ breadcrumbs = [], fallback = '/dashboard', fallbackLabel = 'Back to Dashboard' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const canGoBack = Number(window.history.state?.idx) > 0

  const goBack = () => {
    if (location.state?.returnTo) {
      navigate(location.state.returnTo, { state: location.state.returnState || undefined })
    } else if (canGoBack) {
      navigate(-1)
    } else {
      navigate(fallback, { replace: true })
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 text-xs">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <ChevronRight size={13} className="text-gray-600 shrink-0" />}
            {crumb.to ? (
              <button
                onClick={() => navigate(crumb.to, { state: crumb.state })}
                className="text-gray-400 hover:text-cyan-300 transition-colors truncate"
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-gray-200 font-semibold truncate">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>
      <button
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-cyan-300 transition-colors shrink-0"
      >
        <ArrowLeft size={15} />
        <span>{location.state?.returnTo || canGoBack ? 'Back' : fallbackLabel}</span>
      </button>
    </div>
  )
}
