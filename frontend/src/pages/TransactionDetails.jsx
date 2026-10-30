import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Database, ShieldAlert, CheckCircle2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import PageNavigation from '../components/PageNavigation'
import { getTransactionDetail } from '../services/api'

function valueOf(details, primary, ...aliases) {
  return [primary, ...aliases].map(key => details?.[key]).find(value => value !== undefined && value !== null && value !== '') ?? 'N/A'
}

function amount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? `₹${parsed.toLocaleString('en-IN')}` : value
}

export default function TransactionDetails() {
  const { transactionId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [details, setDetails] = useState(state?.transaction || null)
  const [loading, setLoading] = useState(!state?.transaction)
  const [error, setError] = useState('')

  useEffect(() => {
    if (state?.transaction || !transactionId) return
    let active = true
    getTransactionDetail(transactionId)
      .then(({ data }) => { if (active) setDetails(data) })
      .catch(err => { if (active) setError(err.response?.data?.message || 'Transaction details could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [state?.transaction, transactionId])

  const parentPath = state?.returnTo || (state?.batchId ? '/bulk' : '/history')
  const parentState = state?.returnState

  const fields = [
    ['Customer ID', valueOf(details, 'customer_id')],
    ['Amount', amount(valueOf(details, 'amount', 'amount_inr'))],
    ['Transaction time', valueOf(details, 'time', 'transaction_time')],
    ['Merchant category', valueOf(details, 'merchant_category', 'merchant')],
    ['Payment method', valueOf(details, 'payment_method')],
    ['Location', valueOf(details, 'location')],
    ['Device type', valueOf(details, 'device_type')],
    ['Network connection', valueOf(details, 'network_type')],
    ['Transaction frequency', valueOf(details, 'transaction_frequency')],
    ['Average spending', amount(valueOf(details, 'average_spending', 'average_spending_inr'))],
    ['Previous amount', amount(valueOf(details, 'previous_transaction_amount', 'previous_transaction_amount_inr'))],
    ['Distance from previous transaction', valueOf(details, 'distance_from_previous_location', 'distance_from_previous_location_km')]
  ]

  return (
    <div className="flex min-h-screen bg-[#070d18] text-white">
      <Sidebar />
      <div className="flex-1 min-h-screen flex flex-col">
        <Navbar title="Transaction Details" />
        <main className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
          <PageNavigation
            breadcrumbs={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: state?.batchId ? 'Bulk Analysis' : 'Transaction History', to: state?.batchId ? '/bulk' : '/history', state: state?.returnState },
              { label: 'Transaction Details' }
            ]}
            fallback={state?.batchId ? '/bulk' : '/history'}
            fallbackLabel={state?.batchId ? 'Back to Bulk Analysis' : 'Back to Transaction History'}
          />

          {loading && <div className="card text-sm text-cyan-300">Loading transaction details...</div>}
          {error && <div className="card text-sm text-rose-300">{error}</div>}
          {details && (
            <>
              <section className="card">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    {details.prediction === 'Fraud' ? <ShieldAlert className="text-rose-400" /> : <CheckCircle2 className="text-emerald-400" />}
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500">Transaction</p>
                      <p className="font-mono text-cyan-300 mt-1">{valueOf(details, 'transaction_id')}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${details.prediction === 'Fraud' ? 'text-rose-300 bg-rose-500/10' : 'text-emerald-300 bg-emerald-500/10'}`}>
                    {valueOf(details, 'prediction')}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-[#070d18] p-4 border border-white/5"><p className="text-[10px] uppercase text-gray-500">Risk score</p><p className="text-2xl font-mono font-bold mt-1">{valueOf(details, 'risk_score')}</p></div>
                  <div className="rounded-xl bg-[#070d18] p-4 border border-white/5"><p className="text-[10px] uppercase text-gray-500">Confidence</p><p className="text-2xl font-mono font-bold mt-1">{details.confidence !== undefined ? `${(Number(details.confidence) * 100).toFixed(1)}%` : 'N/A'}</p></div>
                  <div className="rounded-xl bg-[#070d18] p-4 border border-white/5"><p className="text-[10px] uppercase text-gray-500">SHAP factors</p><p className="text-2xl font-mono font-bold mt-1">{details.shap?.length || 0}</p></div>
                  <div className="rounded-xl bg-[#070d18] p-4 border border-white/5"><p className="text-[10px] uppercase text-gray-500">Amount</p><p className="text-2xl font-mono font-bold mt-1">{amount(valueOf(details, 'amount', 'amount_inr'))}</p></div>
                </div>
              </section>
              <section className="card">
                <div className="flex items-center gap-2 mb-4"><Database size={17} className="text-cyan-400" /><h3 className="font-bold text-sm">Transaction Information</h3></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {fields.map(([label, value]) => <div key={label} className="rounded-lg bg-[#070d18] border border-white/5 p-3 min-w-0"><p className="text-[10px] uppercase text-gray-500">{label}</p><p className="text-xs text-gray-200 truncate mt-1" title={String(value)}>{value}</p></div>)}
                </div>
              </section>
              <div>
                <button
                  onClick={() => navigate('/shap', {
                    state: {
                      batchId: state?.batchId,
                      transaction: details,
                      transactionId,
                      shap: details.shap || [],
                      shap_metadata: details.shap_metadata,
                      returnTo: `/transactions/${encodeURIComponent(transactionId)}`,
                      returnState: { ...(state || {}), returnTo: parentPath, returnState: parentState }
                    }
                  })}
                  className="btn-bright-cyan inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  Open SHAP Explainability <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
