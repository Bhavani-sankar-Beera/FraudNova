import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  FileText,
  HelpCircle,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import PageNavigation from '../components/PageNavigation'
import ShapChart from '../components/ShapChart'
import { getBulkTransactionShap, getTransactionDetail } from '../services/api'
import { formatFeatureName, formatImpact, getSignificantShap } from '../utils/shap'

const SIGNIFICANT_THRESHOLD = 0.0005

function formatAmount(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `₹${amount.toLocaleString('en-IN')}` : value ?? 'N/A'
}

function valueOrNA(details, primary, ...aliases) {
  return [primary, ...aliases]
    .map(key => details?.[key])
    .find(value => value !== undefined && value !== null && value !== '') ?? 'N/A'
}

function getExplanationText(prediction, positive, negative, metadata) {
  const positiveDirection = metadata?.positive_direction || 'the model positive direction'
  const negativeDirection = metadata?.negative_direction || 'the model negative direction'
  const direction = prediction === 'Fraud' ? positiveDirection : negativeDirection
  const strongest = [...positive, ...negative]
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 3)

  if (!strongest.length) {
    return `The model classified this transaction as ${prediction || 'Unknown'}, but no SHAP contribution exceeded the significance threshold. The explanation is therefore limited: no individual transformed feature had a measurable influence on the reported model output.`
  }

  const factors = strongest.map(item => `${formatFeatureName(item.feature)} (${formatImpact(item.impact)})`).join(', ')
  return `The model classified this transaction as ${prediction || 'Unknown'} because the strongest measured feature effects were ${factors}. Contributions in the positive direction move the model toward ${positiveDirection}; contributions in the negative direction move it toward ${negativeDirection}. Overall, the combined pattern aligned more closely with ${direction}. This is an explanation of model behaviour, not proof that the transaction is fraudulent.`
}

export default function ShapExplanation() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state || {}
  const transactionId = state.transactionId || state.transaction?.transaction_id
  const batchId = state.batchId
  const initialTransaction = state.transaction || null
  const initialShap = initialTransaction?.shap || state.shap || []
  const [details, setDetails] = useState(initialTransaction)
  const [shap, setShap] = useState(initialShap)
  const [metadata, setMetadata] = useState(initialTransaction?.shap_metadata || state.shap_metadata || null)
  const [loading, setLoading] = useState(Boolean(transactionId && !initialShap.length))
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const requestInitialShap = initialShap.length > 0

    setDetails(initialTransaction)
    setShap(initialShap)
    setMetadata(initialTransaction?.shap_metadata || state.shap_metadata || null)
    setError('')

    if (!transactionId || requestInitialShap) {
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    const request = batchId
      ? getBulkTransactionShap(batchId, transactionId)
      : getTransactionDetail(transactionId)

    request
      .then(({ data }) => {
        if (!active) return
        setDetails(current => ({ ...current, ...data }))
        setShap(Array.isArray(data.shap) ? data.shap : [])
        setMetadata(data.shap_metadata || null)
      })
      .catch(err => {
        if (active) setError(err.response?.data?.message || 'SHAP explanation could not be generated.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [batchId, initialShap, initialTransaction, location.key, state.shap_metadata, transactionId])

  const significant = useMemo(
    () => getSignificantShap(shap, metadata?.significant_threshold || SIGNIFICANT_THRESHOLD),
    [metadata?.significant_threshold, shap]
  )
  const positive = significant.filter(item => item.impact > 0)
  const negative = significant.filter(item => item.impact < 0)
  const topFactors = significant.slice(0, 3)
  const prediction = details?.prediction || 'Unknown'
  const isFraud = prediction === 'Fraud'
  const score = details?.risk_score
  const modelOutput = metadata?.model_output
  const detailPath = transactionId ? `/transactions/${encodeURIComponent(transactionId)}` : null

  const transactionFields = [
    ['Customer ID', valueOrNA(details, 'customer_id')],
    ['Transaction amount', formatAmount(valueOrNA(details, 'amount', 'amount_inr'))],
    ['Transaction time', valueOrNA(details, 'time', 'transaction_time')],
    ['Merchant category', valueOrNA(details, 'merchant_category', 'merchant')],
    ['Payment method', valueOrNA(details, 'payment_method')],
    ['Location', valueOrNA(details, 'location')],
    ['Device type', valueOrNA(details, 'device_type')],
    ['Network connection', valueOrNA(details, 'network_type')],
    ['Transaction frequency', valueOrNA(details, 'transaction_frequency')],
    ['Average spending', formatAmount(valueOrNA(details, 'average_spending', 'average_spending_inr'))],
    ['Previous amount', formatAmount(valueOrNA(details, 'previous_transaction_amount', 'previous_transaction_amount_inr'))],
    ['Distance from previous transaction', valueOrNA(details, 'distance_from_previous_location', 'distance_from_previous_location_km')]
  ]

  return (
    <div className="flex min-h-screen bg-[#070d18] text-white">
      <Sidebar />
      <div className="flex-1 min-h-screen flex flex-col">
        <Navbar title="Explainable AI (XAI) & SHAP Attribution" />
        <main className="p-5 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          <div>
            <PageNavigation
              breadcrumbs={[
                { label: 'Dashboard', to: '/dashboard' },
                ...(batchId ? [{ label: 'Bulk Analysis', to: '/bulk' }] : [{ label: 'Transaction History', to: '/history' }]),
                ...(detailPath ? [{ label: 'Transaction Details', to: detailPath, state: { batchId, transactionId, transaction: details, returnTo: batchId ? '/bulk' : '/history' } }] : []),
                { label: 'SHAP Explanation' }
              ]}
              fallback={batchId ? '/bulk' : '/dashboard'}
              fallbackLabel={batchId ? 'Back to Bulk Analysis' : 'Back to Dashboard'}
            />
            <h2 className="text-xl font-bold tracking-wide mt-5">Why was this transaction classified this way?</h2>
            <p className="text-xs text-gray-400 mt-1">SHAP decomposes the actual FraudNova model output for this selected transaction.</p>
          </div>

          <section className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                {isFraud ? <ShieldAlert className="text-rose-400" size={22} /> : <CheckCircle2 className="text-emerald-400" size={22} />}
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-gray-500">Transaction prediction summary</p>
                  <p className="font-mono text-cyan-300 mt-1">{valueOrNA(details, 'transaction_id')}</p>
                </div>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-bold ${isFraud ? 'bg-rose-500/15 text-rose-300 border border-rose-400/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'}`}>
                {prediction}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-[#070d18] p-3 border border-white/5">
                <p className="text-[10px] uppercase text-gray-500">Decision score</p>
                <p className="text-xl font-bold font-mono text-white mt-1">{score ?? 'N/A'}<span className="text-xs text-gray-500"> / 100</span></p>
                <p className="text-[10px] text-gray-500 mt-1">Uncalibrated model ranking, not a probability</p>
              </div>
              <div className="rounded-xl bg-[#070d18] p-3 border border-white/5">
                <p className="text-[10px] uppercase text-gray-500">Fraud-class output</p>
                <p className="text-xl font-bold font-mono text-cyan-300 mt-1">{modelOutput !== undefined ? Number(modelOutput).toFixed(3) : 'N/A'}</p>
                <p className="text-[10px] text-gray-500 mt-1">Output explained by SHAP</p>
              </div>
              <div className="rounded-xl bg-[#070d18] p-3 border border-white/5">
                <p className="text-[10px] uppercase text-gray-500">Significant factors</p>
                <p className="text-xl font-bold font-mono text-white mt-1">{significant.length}</p>
                <p className="text-[10px] text-gray-500 mt-1">Absolute SHAP ≥ {metadata?.significant_threshold || SIGNIFICANT_THRESHOLD}</p>
              </div>
              <div className="rounded-xl bg-[#070d18] p-3 border border-white/5">
                <p className="text-[10px] uppercase text-gray-500">Confidence</p>
                <p className="text-xl font-bold font-mono text-white mt-1">{details?.confidence !== undefined ? `${(Number(details.confidence) * 100).toFixed(1)}%` : 'N/A'}</p>
                <p className="text-[10px] text-gray-500 mt-1">Model confidence signal</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="text-cyan-400" />
                <h3 className="font-bold text-sm">SHAP Feature Contribution</h3>
              </div>
              <div className="text-right text-[10px] text-gray-500">
                <p>{metadata?.explainer || 'SHAP explainer metadata unavailable'}</p>
                <p>{metadata?.space || 'Actual model feature space'}</p>
                {metadata?.samples && <p>{metadata.samples} bounded samples for interactive response</p>}
              </div>
            </div>
            {error ? <p className="rounded-xl bg-rose-500/10 border border-rose-400/20 p-5 text-sm text-rose-300">{error}</p> : loading ? (
              <div className="py-12 text-center">
                <p className="text-sm text-cyan-300">Calculating the exact SHAP explanation...</p>
                <p className="text-xs text-gray-500 mt-2">The selected transaction is being evaluated through the actual FraudNova pipeline.</p>
              </div>
            ) : <ShapChart data={shap} threshold={metadata?.significant_threshold || SIGNIFICANT_THRESHOLD} />}
            {metadata?.reconstruction_error !== undefined && (
              <p className="text-[10px] text-gray-500 mt-3">
                Additivity check: baseline + contributions reconstruct the explained output within {metadata.reconstruction_error}.
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={17} className="text-cyan-400" />
              <h3 className="font-bold text-sm">AI-Powered Transaction Explanation</h3>
            </div>
            {loading ? <p className="text-sm text-gray-400">The natural-language explanation will appear when SHAP calculation completes.</p> : (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2"><TrendingUp size={15} /> Factors Increasing Fraud Prediction</div>
                  {positive.length ? <div className="space-y-2">{positive.slice(0, 5).map(item => (
                    <div key={item.feature} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-500/5 border border-rose-400/10 px-3 py-2 text-xs">
                      <span className="text-gray-200">{formatFeatureName(item.feature)}</span>
                      <span className="font-mono font-bold text-rose-300">{formatImpact(item.impact)} toward {metadata?.positive_direction || 'Fraud'}</span>
                    </div>
                  ))}</div> : <p className="text-xs text-gray-500">No significant feature pushed the model toward Fraud.</p>}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-2"><TrendingDown size={15} /> Factors Supporting Genuine Behaviour</div>
                  {negative.length ? <div className="space-y-2">{negative.slice(0, 5).map(item => (
                    <div key={item.feature} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cyan-500/5 border border-cyan-400/10 px-3 py-2 text-xs">
                      <span className="text-gray-200">{formatFeatureName(item.feature)}</span>
                      <span className="font-mono font-bold text-cyan-300">{formatImpact(item.impact)} toward {metadata?.negative_direction || 'Genuine'}</span>
                    </div>
                  ))}</div> : <p className="text-xs text-gray-500">No significant feature pushed the model toward Genuine.</p>}
                </div>
                <div className="rounded-xl bg-[#070d18] border border-white/5 p-4">
                  <p className="text-xs font-bold text-white mb-2">Overall Model Interpretation</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{getExplanationText(prediction, positive, negative, metadata)}</p>
                </div>
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              ['Strongest Fraud Indicator', positive[0], TrendingUp, 'text-rose-300'],
              ['Strongest Genuine Indicator', negative[0], TrendingDown, 'text-cyan-300'],
              ['Significant Contributing Features', { feature: `${significant.length} features`, impact: significant.length }, Target, 'text-violet-300']
            ].map(([label, item, Icon, color]) => (
              <div key={label} className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-5 shadow-xl">
                <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${color}`}><Icon size={16} /> {label}</div>
                <p className="text-sm text-white font-semibold mt-4">{item ? (label.includes('Features') ? item.feature : formatFeatureName(item.feature)) : 'None above threshold'}</p>
                {item && !label.includes('Features') && <p className={`font-mono text-xs mt-1 ${color}`}>{formatImpact(item.impact)}</p>}
              </div>
            ))}
          </section>

          <section className="rounded-2xl bg-gradient-to-br from-[#101d34] to-[#0b1322] border border-cyan-500/20 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4"><Database size={17} className="text-cyan-400" /><h3 className="font-bold text-sm">FraudNova AI Decision Intelligence</h3></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div><p className="text-[10px] uppercase text-gray-500">Predicted classification</p><p className={`text-lg font-bold mt-1 ${isFraud ? 'text-rose-300' : 'text-emerald-300'}`}>{prediction}</p></div>
              <div><p className="text-[10px] uppercase text-gray-500">Top three contributors</p><p className="text-xs text-gray-200 mt-1">{topFactors.length ? topFactors.map(item => formatFeatureName(item.feature)).join(', ') : 'None above threshold'}</p></div>
              <div><p className="text-[10px] uppercase text-gray-500">Model methodology</p><p className="text-xs text-gray-300 mt-1">{metadata?.methodology || 'Model-agnostic SHAP metadata was not returned.'}</p></div>
            </div>
            <p className="text-xs text-amber-200/80 mt-5 border-t border-white/10 pt-4">SHAP explains how the trained model used this transaction’s features. It does not establish proof of fraud, identity, intent, or wrongdoing.</p>
          </section>

          <section className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4"><HelpCircle size={16} className="text-cyan-400" /><h3 className="font-bold text-sm">Transaction Details</h3></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {transactionFields.map(([label, value]) => <div key={label} className="rounded-lg bg-[#070d18] border border-white/5 p-3 min-w-0"><p className="text-[10px] uppercase text-gray-500">{label}</p><p className="text-xs text-gray-200 truncate mt-1" title={String(value)}>{value}</p></div>)}
            </div>
          </section>

          <div className="flex justify-start border-t border-white/10 pt-5">
            <button
              onClick={() => detailPath
                ? navigate(detailPath, { state: { batchId, transactionId, transaction: details, returnTo: batchId ? '/bulk' : '/history' } })
                : navigate(batchId ? '/bulk' : '/history')}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-2.5 text-xs font-semibold text-cyan-200 hover:border-cyan-400 hover:bg-cyan-900/50"
            >
              <ArrowLeft size={15} /> {detailPath ? 'Back to transaction details' : batchId ? 'Back to bulk results' : 'Back to transaction history'}
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
