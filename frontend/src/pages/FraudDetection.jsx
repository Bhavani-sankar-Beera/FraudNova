import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, AlertCircle } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import PageNavigation from '../components/PageNavigation'
import TransactionForm from '../components/TransactionForm'
import PredictionCard from '../components/PredictionCard'
import ShapChart from '../components/ShapChart'
import { predict } from '../services/api'

export default function FraudDetection() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [lastPayload, setLastPayload] = useState(null)

  function backendUnavailableError() {
    return 'FraudNova AI backend is unreachable. Ensure the Python Flask server is running on http://127.0.0.1:5000'
  }

  const handleSubmit = async (payload) => {
    setLoading(true)
    setError(null)
    setResult(null)

    const body = { ...payload }
    setLastPayload(body)

    try {
      const res = await predict(body)
      const data = res.data
      setResult(data)
      try {
        window.dispatchEvent(new CustomEvent('txn:analyzed', { detail: data }))
      } catch (e) {}
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login')
        return
      }
      if (!err.response) {
        setError(backendUnavailableError())
      } else {
        setError(err.response?.data?.message || 'An error occurred while analyzing the transaction.')
      }
    } finally {
      setLoading(false)
    }
  }

  function buildShapText(shap) {
    if (!shap || !shap.length) return 'No SHAP explanation features returned.'
    const pos = shap.filter(s => s.impact > 0).sort((a, b) => b.impact - a.impact)
    const neg = shap.filter(s => s.impact < 0).sort((a, b) => a.impact - b.impact)
    const strongest = pos[0]
    let sentences = []
    if (strongest) {
      sentences.push(`The strongest anomaly trigger was "${strongest.feature}", which significantly drove the probability towards high risk.`)
    }
    if (pos.length > 1) {
      sentences.push(`Secondary risk indicators: ${pos.slice(1, 4).map(p => `"${p.feature}"`).join(', ')}.`)
    }
    if (neg.length) {
      sentences.push(`Mitigating genuine factors: ${neg.map(n => `"${n.feature}"`).join(', ')}.`)
    }
    return sentences.join(' ')
  }

  return (
    <div className="flex min-h-screen bg-[#070d18] text-white">
      <Sidebar />
      <div className="flex-1 min-h-screen flex flex-col">
        <Navbar title="Analyze Transaction Security" />
        <main className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
          
          <PageNavigation
            breadcrumbs={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Fraud Detection' }
            ]}
            fallback="/dashboard"
            fallbackLabel="Back to Dashboard"
          />

          <div className="space-y-6">
            <TransactionForm onSubmit={handleSubmit} loading={loading} />

            {/* Error Alert */}
            {error && (
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-5 space-y-3">
                <div className="flex items-center gap-3 text-rose-400 font-bold text-sm">
                  <AlertCircle size={18} />
                  <span>Analysis Error</span>
                </div>
                <p className="text-xs text-rose-300">{error}</p>
                <button
                  onClick={() => { if (lastPayload) handleSubmit(lastPayload) }}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold hover:bg-rose-500/30 transition-all"
                >
                  Retry Analysis
                </button>
              </div>
            )}

            {/* Result Container */}
            {result && (
              <div className="space-y-6 animate-fade-in">
                <PredictionCard result={result} />

                {/* SHAP Explanation Section */}
                <div className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                    <div>
                      <h4 className="text-base font-bold text-white tracking-wide">
                        SHAP Feature Contribution Breakdown
                      </h4>
                      <p className="text-xs text-gray-400">
                        Explains mathematically how each feature shifted the classification decision boundary.
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/result', { state: { result } })}
                      className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 shrink-0"
                    >
                      <span>Deep Diagnostic View</span>
                      <ArrowUpRight size={13} />
                    </button>
                  </div>

                  <div className="pt-2">
                    <ShapChart data={result.shap || []} />
                  </div>

                  <div className="rounded-xl bg-black/40 border border-white/5 p-4 text-xs leading-relaxed text-gray-300">
                    <span className="font-bold text-cyan-300 block mb-1">
                      AI Reasoning & Narrative:
                    </span>
                    {result.explanation || buildShapText(result.shap || [])}
                  </div>
                </div>
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  )
}
