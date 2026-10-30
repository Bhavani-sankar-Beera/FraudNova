import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Cpu, Layers, Sparkles, ShieldCheck, Download, Share2 } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import PageNavigation from '../components/PageNavigation'
import PredictionCard from '../components/PredictionCard'
import ShapChart from '../components/ShapChart'

function buildTextExplanation(shap) {
  if (!shap || !shap.length) return 'No detailed SHAP feature attribution data available.'
  const positives = shap.filter(s => s.impact > 0).sort((a, b) => b.impact - a.impact)
  const negatives = shap.filter(s => s.impact < 0).sort((a, b) => a.impact - b.impact)
  const topPos = positives.slice(0, 3).map(p => `"${p.feature}"`)
  const topNeg = negatives.slice(0, 2).map(p => `"${p.feature}"`)
  let parts = []
  if (topPos.length) parts.push(`The probability of fraud was increased primarily by ${topPos.join(', ')}.`)
  if (topNeg.length) parts.push(`Normalizing attributes that favored a genuine verdict included ${topNeg.join(', ')}.`)
  return parts.join(' ')
}

export default function PredictionResult() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const result = state?.result

  if (!result) {
    return (
      <div className="flex min-h-screen bg-[#070d18] text-white">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#0e172a] border border-white/10 p-8 text-center space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">No Prediction Loaded</h3>
            <p className="text-xs text-gray-400">
              Please analyze a transaction first to generate a full quantum telemetry report.
            </p>
            <button
              onClick={() => navigate('/detect')}
              className="btn-bright-cyan px-5 py-2.5 rounded-xl font-bold text-xs"
            >
              Go to Transaction Scanner
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#070d18] text-white">
      <Sidebar />
      <div className="flex-1 min-h-screen flex flex-col">
        <Navbar title={`Audit Report — ${result.transaction_id || 'Assessment'}`} />
        <main className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          <PageNavigation
            breadcrumbs={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Fraud Detection', to: '/detect' },
              { label: 'Prediction Result' }
            ]}
            fallback="/detect"
            fallbackLabel="Back to Fraud Detection"
          />
          
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="text-xs font-semibold text-gray-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={15} />
              <span>Back to Analysis</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-gray-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-1.5"
              >
                <Download size={13} />
                <span>Export PDF Report</span>
              </button>
            </div>
          </div>

          {/* Primary Assessment Hero */}
          <PredictionCard result={result} />

          {/* Model Breakdown & Optimization */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-6 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Cpu size={18} />
                <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                  Quantum-Classical Hybrid Ensemble
                </h4>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                The inference verdict incorporates feature maps extracted by classical 1D CNNs & LSTMs, coupled into a 8-qubit variational Quantum Convolutional Neural Network (QCNN) and Quantum Support Vector Machine (QSVM) kernel.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  CNN + LSTM
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  Qiskit QCNN
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-pink-500/10 text-pink-300 border border-pink-500/20">
                  Hilbert QSVM
                </span>
              </div>
            </div>

            <div className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-6 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles size={18} />
                <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                  Variational Optimization & Thresholding
                </h4>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Decision boundaries are dynamically tuned using the Variational Quantum Eigensolver (VQE) and Quantum Approximate Optimization Algorithm (QAOA) to minimize false positive risk.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  VQE Ground State
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  QAOA Combinatorial
                </span>
              </div>
            </div>
          </div>

          {/* SHAP Visualizer */}
          <div className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-6 shadow-xl space-y-4">
            <div>
              <h4 className="text-base font-bold text-white tracking-wide">
                Feature Attribution & SHAP Waterfall
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                {buildTextExplanation(result.shap || [])}
              </p>
            </div>

            <div className="pt-2">
              <ShapChart data={result.shap || []} />
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
