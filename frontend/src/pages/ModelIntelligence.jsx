import React, { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowLeft, ChevronRight, HelpCircle, Cpu, Database, FlaskConical, Gauge, GitBranch, Layers, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import PageNavigation from '../components/PageNavigation'
import { getModelInfo } from '../services/api'

const STAGES = [
  { id: 'dataset', title: 'Financial Transaction Dataset', icon: Database, purpose: 'The source transaction population used to train and evaluate the fraud detection pipeline.', input: 'Financial transaction records', method: 'Dataset ingestion and schema validation.', output: 'Validated transaction records', details: ['Dataset size: 50,000 samples when reported by the model artifact.', 'Fraud/Genuine class counts are not present in the saved artifact metadata.'] },
  { id: 'preprocessing', title: 'Data Preprocessing', icon: Layers, purpose: 'Makes raw transactions compatible with the learned model.', input: 'Raw numeric and categorical transaction fields', method: 'Cleaning, missing-value handling, categorical encoding, and normalization.', output: 'Standardized model input', details: ['The saved preprocessor accepts 34 raw features.', 'One-hot encoded features are transformed into the model input space.'] },
  { id: 'features', title: 'Feature Engineering', icon: GitBranch, purpose: 'Creates behavioural, statistical, time-based, and derived signals.', input: 'Standardized transaction fields', method: 'Ratios, temporal signals, spending deviation, frequency, and location-change features.', output: 'Behaviour-rich feature matrix', details: ['Feature engineering is executed by the ML service before preprocessing.'] },
  { id: 'cnn', title: 'CNN-LSTM Feature Extraction', icon: Activity, purpose: 'Learns local transaction patterns and temporal relationships.', input: '67 preprocessed features', method: 'Saved CNN plus bidirectional LSTM inference followed by the feature extractor.', output: 'Learned transaction representation', details: ['The saved CNN-LSTM test accuracy is shown from model_config.json.', 'The artifact does not expose a separately named 32-feature output metric.'] },
  { id: 'pca', title: 'PCA Dimensionality Reduction', icon: Target, purpose: 'Compresses the learned representation before quantum processing.', input: 'Learned feature representation', method: 'Saved PCA transformer.', output: '8 principal components', details: ['PCA component count is read from the saved model configuration.'] },
  { id: 'qaoa', title: 'QAOA Feature Selection', icon: Sparkles, purpose: 'Selects the principal components used by the quantum classifier.', input: '8 principal components', method: 'Validated QAOA selection experiment.', output: '5 selected principal components', details: ['Selected features: PC1, PC2, PC3, PC5, PC7.', 'The 97.17% QAOA metric is validation accuracy; the test data remains untouched.'] },
  { id: 'vqe', title: 'VQE Variational Optimization', icon: FlaskConical, purpose: 'Optimizes variational parameters used by the quantum feature workflow.', input: 'Variational circuit parameters', method: 'Variational energy optimization over 100 iterations.', output: 'Optimized variational parameters with shape (2, 5, 2)', details: ['Energy changes from -0.000008 initially to -0.999375 finally.', 'Energy is an optimization value, not classification accuracy.'] },
  { id: 'qsvm', title: 'QSVM Classification', icon: Cpu, purpose: 'Classifies the transaction using quantum feature encoding and a precomputed kernel.', input: 'Selected principal components', method: 'Quantum state encoding, kernel computation, and QSVM probability inference.', output: 'Fraud/Genuine decision score', details: ['QSVM metrics are read from the saved model configuration.', 'The hybrid model combines CNN-LSTM and QSVM outputs.'] },
  { id: 'prediction', title: 'Final Fraud/Genuine Prediction', icon: ShieldCheck, purpose: 'Combines the learned model outputs into the application decision.', input: 'CNN-LSTM and QSVM fraud scores', method: 'Hybrid aggregation and configured decision threshold.', output: 'Fraud/Genuine classification and risk score', details: ['The application risk score is a decision ranking from 1 to 99, not a calibrated probability.'] },
  { id: 'shap', title: 'SHAP Explainability', icon: HelpCircle, purpose: 'Explains how transformed features moved the actual model output.', input: 'The selected transaction and the loaded hybrid pipeline', method: 'Model-agnostic SHAP KernelExplainer with additivity validation.', output: 'Feature contributions and narrative explanation', details: ['SHAP values are calculated for the selected transaction only.', 'The API reports the fraud-class output, baseline, and reconstruction error.'] }
]

const metricRows = [
  { name: 'CNN-LSTM', key: 'cnn_lstm', accent: 'cyan' },
  { name: 'CNN-LSTM + QSVM (Without Optimization)', key: 'cnn_lstm_qsvm_without_optimization', accent: 'violet' },
  { name: 'CNN-LSTM + QAOA + VQE + QSVM (With Optimization)', key: 'cnn_lstm_qaoa_vqe_qsvm', accent: 'green' }
]
const metricLabels = [
  ['Accuracy', 'accuracy'],
  ['Precision', 'precision'],
  ['Recall', 'recall'],
  ['F1-score', 'f1'],
  ['ROC-AUC', 'roc_auc']
]

function percentage(value) {
  return typeof value === 'number' ? `${(value * 100).toFixed(2)}%` : 'Not Available'
}

function metricValue(metrics, row, key) {
  return percentage(metrics?.experimental_performance?.[row.key]?.[key])
}

function StageDetails({ stage, info, onClose }) {
  if (!stage) return null
  const metrics = info?.metrics || {}
  const stageMetric = stage.id === 'cnn' ? percentage(metrics.experimental_performance?.cnn_lstm?.accuracy)
    : stage.id === 'qaoa' ? percentage(metrics.qaoa_experimental_results?.validation_accuracy)
      : stage.id === 'vqe' ? (metrics.vqe_experimental_results?.final_energy ?? 'Not Available')
        : stage.id === 'qsvm' ? percentage(metrics.experimental_performance?.cnn_lstm_qaoa_vqe_qsvm?.accuracy)
          : 'Not Available'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-[#0b1322] p-6 shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[11px] uppercase tracking-wider text-cyan-300">Workflow stage</p><h2 className="text-xl font-bold mt-1">{stage.title}</h2></div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">Close</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
          {[['Purpose', stage.purpose], ['Input', stage.input], ['Processing method', stage.method], ['Output', stage.output], ['Available metric', stageMetric]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#070d18] border border-white/5 p-4"><p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p><p className="text-gray-200 mt-2 leading-relaxed">{value}</p></div>)}
        </div>
        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.03] p-4">
          <p className="text-xs font-semibold text-cyan-300 mb-2">Technical notes</p>
          {stage.details.map(detail => <p key={detail} className="text-xs text-gray-400 leading-relaxed mb-1">• {detail}</p>)}
        </div>
      </div>
    </div>
  )
}

export default function ModelIntelligence() {
  const navigate = useNavigate()
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [selectedStage, setSelectedStage] = useState(null)

  useEffect(() => {
    let active = true
    getModelInfo()
      .then(({ data }) => { if (active) setInfo(data) })
      .catch(err => { if (active) setError(err.response?.data?.message || 'Model intelligence could not be loaded.') })
    return () => { active = false }
  }, [])

  const metrics = info?.metrics || {}
  const architecture = info?.architecture || {}
  const qaoa = metrics.qaoa_experimental_results || {}
  const vqe = metrics.vqe_experimental_results || {}
  const selectedFeatures = qaoa.selected_features || []
  const verifiedAccuracy = percentage(metrics.experimental_performance?.cnn_lstm_qaoa_vqe_qsvm?.accuracy)
  const insight = useMemo(() => 'The integration of QAOA and VQE into the CNN-LSTM + QSVM pipeline improved test accuracy, recall, and F1-score compared with the baseline QSVM configuration. The optimized hybrid model achieved 96.79% accuracy and 96.76% F1-score.', [])

  return (
    <div className="flex min-h-screen bg-[#070d18] text-white">
      <Sidebar />
      <div className="flex-1 min-h-screen flex flex-col">
        <Navbar title="FraudNova AI Model Intelligence" />
        <main className="p-5 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          <PageNavigation breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Model Intelligence' }]} fallback="/dashboard" fallbackLabel="Back to Dashboard" />
          <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-[#101d34] to-[#0b1322] p-6 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div><p className="text-xs uppercase tracking-widest text-cyan-300">FraudNova AI</p><h1 className="text-2xl font-bold mt-2">Model Architecture & Performance Intelligence</h1><p className="text-sm text-gray-400 mt-2 max-w-3xl">Explore the verified model workflow, saved evaluation metrics, and the explainability path used for transaction decisions.</p></div>
              <div className="rounded-2xl border border-white/10 bg-[#070d18] p-4 min-w-[190px]"><p className="text-[10px] uppercase text-gray-500">Pipeline status</p><p className={`text-sm font-bold mt-2 ${info?.ml_loaded ? 'text-emerald-300' : 'text-amber-300'}`}>{info?.ml_loaded ? 'Verified artifacts loaded' : 'Model unavailable'}</p><p className="text-xs text-gray-500 mt-1">Test accuracy: {verifiedAccuracy}</p></div>
            </div>
          </section>

          {error && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}

          <section className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="text-lg font-bold">Interactive Model Workflow</h2><p className="text-xs text-gray-500 mt-1">Select a stage for its purpose, inputs, processing method, outputs, and verified metrics.</p></div><span className="text-xs font-mono text-gray-500">{info?.version || 'Loading model version'}</span></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {STAGES.map((stage, index) => {
                const Icon = stage.icon
                return <React.Fragment key={stage.id}><button onClick={() => setSelectedStage(stage)} className="text-left rounded-xl border border-white/10 bg-[#070d18] p-4 hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all"><div className="flex items-center justify-between"><Icon size={18} className="text-cyan-300" /><span className="text-[10px] font-mono text-gray-600">{String(index + 1).padStart(2, '0')}</span></div><p className="text-xs font-semibold text-gray-200 mt-4">{stage.title}</p><p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{stage.purpose}</p></button>{index < STAGES.length - 1 && <div className="hidden lg:flex items-center justify-center text-cyan-500/50"><ChevronRight size={18} /></div>}</React.Fragment>
              })}
            </div>
          </section>

          <section className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-4"><Gauge size={18} className="text-cyan-300" /><div><h2 className="text-lg font-bold">Experimental Performance Comparison</h2><p className="text-xs text-gray-500 mt-1">Test metrics from the supplied experimental results.</p></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="text-gray-500 border-b border-white/10"><tr><th className="p-3">Performance Metric</th>{metricRows.map(row => <th key={row.key} className="p-3">{row.name}</th>)}</tr></thead><tbody>{metricLabels.map(([label, key]) => <tr key={key} className="border-b border-white/5"><td className="p-3 font-semibold text-gray-200">{label === 'F1-score' ? 'F1-Score' : label}</td>{metricRows.map(row => <td key={row.key} className={`p-3 font-mono ${row.key === 'cnn_lstm_qaoa_vqe_qsvm' ? 'text-emerald-300' : 'text-cyan-300'}`}>{metricValue(metrics, row, key)}</td>)}</tr>)}</tbody></table></div>
            <div className="mt-6 space-y-3">{metricLabels.map(([label, key]) => <div key={key}><div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>{label}</span><span>Grouped comparison</span></div><div className="grid grid-cols-3 gap-1 h-7">{metricRows.map(row => { const value = Number.parseFloat(metricValue(metrics, row, key)); return <div key={row.key} title={`${row.name}: ${metricValue(metrics, row, key)}`} className={`rounded-sm ${row.key === 'cnn_lstm_qaoa_vqe_qsvm' ? 'bg-emerald-400' : row.key === 'cnn_lstm_qsvm_without_optimization' ? 'bg-violet-400' : 'bg-cyan-400'}`} style={{ opacity: 0.35 + (value / 100) * 0.65, width: `${Math.max(value, 1)}%` }} /> })}</div></div>)}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6 text-xs"><p className="rounded-xl bg-cyan-500/10 border border-cyan-400/20 p-3 text-cyan-100">Accuracy improvement after quantum optimization: <strong>6.54 percentage points</strong>.</p><p className="rounded-xl bg-cyan-500/10 border border-cyan-400/20 p-3 text-cyan-100">Recall improvement: <strong>15.16 percentage points</strong>.</p><p className="rounded-xl bg-cyan-500/10 border border-cyan-400/20 p-3 text-cyan-100">F1-score improvement: <strong>7.54 percentage points</strong>.</p><p className="rounded-xl bg-violet-500/10 border border-violet-400/20 p-3 text-violet-100">Baseline QSVM has higher precision: <strong>99.78%</strong>. CNN-LSTM has the highest ROC-AUC: <strong>99.45%</strong>.</p></div>
            <p className="text-xs text-gray-300 mt-5 leading-relaxed">{insight}</p>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#0b1322]/90 border border-violet-400/20 p-5 shadow-xl"><div className="flex items-center gap-2 text-violet-300"><Sparkles size={18} /><h2 className="font-bold">QAOA Feature Selection Results</h2></div><div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">{[['Features Before QAOA', qaoa.features_before], ['Features After QAOA', qaoa.features_after], ['Training Dataset', qaoa.training_dataset], ['Testing Dataset', qaoa.testing_dataset], ['Validation Accuracy', percentage(qaoa.validation_accuracy)], ['Test Data', qaoa.test_data]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#070d18] border border-white/5 p-3"><p className="text-[10px] text-gray-500">{label}</p><p className="text-sm font-bold text-violet-200 mt-2">{value}</p></div>)}</div><div className="mt-5"><p className="text-xs text-gray-400 mb-2">Feature selection: 8 input components → 5 selected components</p><div className="flex flex-wrap gap-2">{Array.from({ length: 8 }, (_, index) => <span key={index} className={`px-2 py-1 rounded text-[10px] font-mono ${selectedFeatures.includes(`PC${index + 1}`) ? 'bg-violet-400 text-slate-950' : 'bg-white/10 text-gray-500'}`}>PC{index + 1}</span>)}</div><p className="text-xs text-violet-200 mt-3">Selected: {selectedFeatures.join(', ')}</p></div></div>
            <div className="rounded-2xl bg-[#0b1322]/90 border border-cyan-400/20 p-5 shadow-xl"><div className="flex items-center gap-2 text-cyan-300"><FlaskConical size={18} /><h2 className="font-bold">VQE Variational Optimization Results</h2></div><div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">{[['Initial Energy', vqe.initial_energy], ['Iterations', vqe.iterations], ['Final Energy', vqe.final_energy], ['Energy Reduction', `approximately ${vqe.energy_reduction}`], ['Optimized Parameter Shape', vqe.optimized_parameter_shape]].map(([label, value]) => <div key={label} className="rounded-xl bg-[#070d18] border border-white/5 p-3"><p className="text-[10px] text-gray-500">{label}</p><p className="text-sm font-bold text-cyan-200 mt-2">{value}</p></div>)}</div><div className="mt-6"><div className="flex items-center justify-between text-[10px] text-gray-500"><span>Initial energy</span><span>Final energy</span></div><div className="relative h-12 mt-2 rounded-xl bg-gradient-to-r from-cyan-400/20 via-cyan-400/50 to-emerald-400/80 border border-cyan-400/20"><div className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]" /><div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.9)]" /><div className="absolute left-4 right-4 top-1/2 h-px bg-white/50" /></div><p className="text-xs text-gray-400 mt-3">Optimization energy decreased from -0.000008 to -0.999375 over 100 iterations.</p></div></div>
          </section>

          <section className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5 text-xs text-amber-100/80"><p className="font-semibold text-amber-200">Metric integrity note</p><p className="mt-2 leading-relaxed">The comparison table uses the supplied experimental results from the backend metadata. Risk scores are transaction decision rankings, QAOA accuracy is a validation metric, and VQE energy is an optimization value—not classification accuracy. The test dataset is explicitly marked untouched.</p></section>
          <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-cyan-300"><ArrowLeft size={15} /> Back to Dashboard</button>
        </main>
      </div>
      <StageDetails stage={selectedStage} info={info} onClose={() => setSelectedStage(null)} />
    </div>
  )
}
