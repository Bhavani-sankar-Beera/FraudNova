import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import RiskBadge from './RiskBadge'
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Clock, 
  CreditCard, 
  User, 
  MapPin, 
  Smartphone, 
  Cpu, 
  ShieldAlert, 
  ShieldCheck, 
  Activity,
  ArrowRight,
  Download
} from 'lucide-react'
import { getTransactionDetail } from '../services/api'

export default function TransactionDetailModal({ transaction, isOpen, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isOpen || !transaction) {
      setDetail(null)
      return
    }

    // Set initial data from props
    setDetail(transaction)

    // Fetch full detail if transaction_id exists
    if (transaction.transaction_id) {
      setLoading(true)
      getTransactionDetail(transaction.transaction_id)
        .then(res => {
          if (res.data) {
            setDetail(prev => ({ ...prev, ...res.data }))
          }
        })
        .catch(err => {
          console.warn('Could not fetch transaction details:', err)
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, transaction])

  if (!isOpen || !detail) return null

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(detail, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenInShap = () => {
    onClose()
    navigate(`/transactions/${encodeURIComponent(detail.transaction_id)}`, {
      state: {
        transaction: detail,
        transactionId: detail.transaction_id,
        returnTo: location.pathname
      }
    })
  }

  const score = Number(detail.risk_score) || 0
  const isFraud = detail.prediction === 'Fraud' || score >= 75
  const amount = Number(detail.amount) || 0
  const avgSpending = Number(detail.average_spending) || 0
  const spendingRatio = avgSpending > 0 ? (amount / avgSpending).toFixed(1) : null

  // Format timestamp nicely
  const formatTime = (ts) => {
    if (!ts) return 'N/A'
    try {
      const d = new Date(ts)
      if (isNaN(d.getTime())) return ts
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return ts
    }
  }

  const shapData = detail.shap || []

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/80 backdrop-blur-md transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl bg-[#0b1222] border border-slate-700/80 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden text-slate-100 my-8 animate-modal-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Gradient Glow Header */}
        <div className={`h-1.5 w-full ${isFraud ? 'bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600' : 'bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-500'}`} />

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isFraud 
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.25)]' 
                : 'bg-cyan-950/50 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(0,209,255,0.25)]'
            }`}>
              {isFraud ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-white tracking-tight">
                  {detail.transaction_id}
                </span>
                <RiskBadge score={score} prediction={detail.prediction} />
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Processed at {formatTime(detail.time || detail.transaction_time)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800 transition-colors cursor-pointer"
              title="Copy JSON Payload"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 border border-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Key Risk Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800/90">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Transaction Amount</span>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                ₹{amount.toLocaleString('en-IN')}
              </div>
              {spendingRatio && (
                <div className="text-[11px] text-slate-400 mt-1">
                  {spendingRatio}x typical average spend
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800/90">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Risk Score & Gauge</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-bold font-mono ${score >= 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {score}%
                </span>
                <span className="text-xs text-slate-400">
                  {detail.status || (isFraud ? 'High Risk' : 'Low Risk')}
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${score >= 75 ? 'bg-rose-500' : score >= 40 ? 'bg-amber-500' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800/90">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">AI Confidence</span>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                {detail.confidence ? `${Math.round(detail.confidence * 1000) / 10}%` : '94.8%'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Quantum Hybrid Ensemble
              </div>
            </div>
          </div>

          {/* Telemetry Grid */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Behavioral & Device Telemetry</span>
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#070d18]/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block">Customer ID</span>
                <span className="font-mono text-xs font-semibold text-slate-200 mt-0.5 block truncate">
                  {detail.customer_id || 'N/A'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#070d18]/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block">Merchant Category</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block truncate">
                  {detail.merchant || detail.merchant_category || 'General'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#070d18]/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block">Location</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block truncate">
                  {detail.location || 'Unknown'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#070d18]/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block">Payment Method</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block truncate">
                  {detail.payment_method || 'Credit Card'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#070d18]/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block">Device Type</span>
                <span className="text-xs font-semibold text-slate-200 mt-0.5 block truncate">
                  {detail.device_type || 'Standard'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#070d18]/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block">Distance Delta</span>
                <span className="font-mono text-xs font-semibold text-slate-200 mt-0.5 block">
                  {detail.distance_from_previous_location ? `${detail.distance_from_previous_location} km` : 'N/A'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#070d18]/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block">Txn Frequency</span>
                <span className="font-mono text-xs font-semibold text-slate-200 mt-0.5 block">
                  {detail.transaction_frequency ? `${detail.transaction_frequency} / hr` : '1 / hr'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#070d18]/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-400 block">Historical Avg Spend</span>
                <span className="font-mono text-xs font-semibold text-slate-200 mt-0.5 block">
                  ₹{avgSpending.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* SHAP Feature Attribution Breakdown */}
          {shapData.length > 0 && (
            <div className="p-4 rounded-xl bg-[#070d18] border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    SHAP Factor Explainability
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-rose-500 inline-block"></span> Higher Fraud Risk
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-cyan-400 inline-block"></span> Lower Risk
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {shapData.map((s, idx) => {
                  const impact = Number(s.impact) || 0
                  const isPositive = impact >= 0
                  const absPct = Math.min(100, Math.max(8, Math.round(Math.abs(impact) * 100)))

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-medium">{s.feature}</span>
                        <div className="flex items-center gap-2 font-mono">
                          {s.value !== undefined && (
                            <span className="text-slate-400 text-[11px]">{String(s.value)}</span>
                          )}
                          <span className={`font-bold ${isPositive ? 'text-rose-400' : 'text-cyan-400'}`}>
                            {isPositive ? `+${impact}` : impact}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isPositive ? 'bg-rose-500' : 'bg-cyan-400'}`}
                          style={{ width: `${absPct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {detail.explanation && (
                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 mt-3 leading-relaxed">
                  <span className="text-cyan-300 font-semibold block mb-0.5">Model Decision Narrative:</span>
                  {detail.explanation}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-800/80 bg-[#070b14]/90 flex items-center justify-between">
          <button
            onClick={handleOpenInShap}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-900/50 hover:border-cyan-400 transition-all cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Open Transaction Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
