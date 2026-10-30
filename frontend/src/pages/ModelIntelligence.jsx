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
  { id: 'qaoa', title: 'QAOA Feature Selection', icon: Sparkles, purpose: 'Selects the principal components used by the quantum classifier.', input: '8 principal components', method: 'Validated QAOA selection artifact.', output: 'Selected principal components', details: ['Selected components are read from the saved artifact: PC1, PC2, PC4, PC5, PC7, PC8.', 'The saved QAOA metric is validation accuracy, not test accuracy.'] },
  { id: 'vqe', title: 'VQE Variational Optimization', icon: FlaskConical, purpose: 'Optimizes variational parameters used by the quantum feature workflow.', input: 'Variational circuit parameters', method: 'Saved VQE coefficients and optimal weights.', output: 'Optimized variational parameters', details: ['The saved final energy is reported as an optimization value, not classification accuracy.', 'Iteration count is not available in the saved model metadata.'] },
  { id: 'qsvm', title: 'QSVM Classification', icon: Cpu, purpose: 'Classifies the transaction using quantum feature encoding and a precomputed kernel.', input: 'Selected principal components', method: 'Quantum state encoding, kernel computation, and QSVM probability inference.', output: 'Fraud/Genuine decision score', details: ['QSVM metrics are read from the saved model configuration.', 'The hybrid model combines CNN-LSTM and QSVM outputs.'] },
  { id: 'prediction', title: 'Final Fraud/Genuine Prediction', icon: ShieldCheck, purpose: 'Combines the learned model outputs into the application decision.', input: 'CNN-LSTM and QSVM fraud scores', method: 'Hybrid aggregation and configured decision threshold.', output: 'Fraud/Genuine classification and risk score', details: ['The application risk score is a decision ranking from 1 to 99, not a calibrated probability.'] },
  { id: 'shap', title: 'SHAP Explainability', icon: HelpCircle, purpose: 'Explains how transformed features moved the actual model output.', input: 'The selected transaction and the loaded hybrid pipeline', method: 'Model-agnostic SHAP KernelExplainer with additivity validation.', output: 'Feature contributions and narrative explanation', details: ['SHAP values are calculated for the selected transaction only.', 'The API reports the fraud-class output, baseline, and reconstruction error.'] }
]

const metricRows = [
  { name: 'CNN-LSTM', source: 'Artifact test metrics', keys: ['cnn_lstm_test_accuracy', 'cnn_lstm_precision', 'cnn_lstm_recall', 'cnn_lstm_f1', 'cnn_lstm_roc_auc'] },
  { name: 'CNN-LSTM + QSVM (without quantum optimization)', source: 'Not available in saved artifacts', keys: [] },
  { name: 'CNN-LSTM + QAOA + VQE + QSVM', source: 'Artifact QSVM test metrics', keys: ['qsvm_test_accuracy', 'qsvm_test_precision', 'qsvm_test_recall', 'qsvm_test_f1', 'qsvm_test_roc_auc'] }
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
  const suffix = row.name === 'CNN-LSTM' ? `cnn_lstm_${key}` : `qsvm_test_${key}`
  return row.keys.length ? percentage(metrics?.[suffix]) : 'Not Available'
}

function StageDetails({ stage, info, onClose }) {
  if (!stage) return null
  const metrics = info?.metrics || {}
  const stageMetric = stage.id === 'cnn' ? percentage(metrics.cnn_lstm_test_accuracy)
    : stage.id === 'qaoa' ? percentage(metrics.qaoa_validation_accuracy)
      : stage.id === 'vqe' ? (typeof metrics.vqe_final_energy === 'number' ? metrics.vqe_final_energy : 'Not Available')
        : stage.id === 'qsvm' ? percentage(metrics.qsvm_test_accuracy)
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
  const selectedFeatures = architecture.selected_features || metrics.final_selected_features || []
  const verifiedAccuracy = percentage(metrics.qsvm_test_accuracy)
  const insight = useMemo(() => {
    const cnn = metrics.cnn_lstm_test_accuracy
    const qsvm = metrics.qsvm_test_accuracy
    if (typeof cnn !== 'number' || typeof qsvm !== 'number') return 'Comparison insight is not available from the saved evaluation artifacts.'
    return `The artifact-verified QSVM test accuracy is ${(qsvm * 100).toFixed(2)}%, compared with ${(cnn * 100).toFixed(2)}% for the CNN-LSTM test metric. This page does not infer a baseline comparison that is absent from the saved evaluation results.`
  }, [metrics.cnn_lstm_test_accuracy, metrics.qsvm_test_accuracy])

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
            <div className="flex items-center gap-2 mb-4"><Gauge size={18} className="text-cyan-300" /><div><h2 className="text-lg font-bold">Experimental Performance Comparison</h2><p className="text-xs text-gray-500 mt-1">Only metrics present in the saved model evaluation metadata are displayed.</p></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="text-gray-500 border-b border-white/10"><tr><th className="p-3">Configuration</th>{metricLabels.map(([label]) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{metricRows.map(row => <tr key={row.name} className="border-b border-white/5"><td className="p-3"><p className="font-semibold text-gray-200">{row.name}</p><p className="text-[10px] text-gray-500 mt-1">{row.source}</p></td>{metricLabels.map(([label, key]) => <td key={label} className="p-3 font-mono text-cyan-300">{metricValue(metrics, row, key)}</td>)}</tr>)}</tbody></table></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">{metricLabels.map(([label, key]) => { const value = metricValue(metrics, metricRows[2], key); const width = value === 'Not Available' ? 0 : Number.parseFloat(value); return <div key={label} className="rounded-xl bg-[#070d18] border border-white/5 p-3"><p className="text-[10px] uppercase text-gray-500">{label}</p><p className="text-lg font-bold font-mono text-white mt-1">{value}</p><div className="h-1.5 rounded-full bg-white/10 mt-2"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(width, 100)}%` }} /></div></div> })}</div>
            <p className="text-xs text-gray-400 mt-5">{insight}</p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[['QAOA', 'Feature selection', `${selectedFeatures.length || 'Not Available'} selected components`, percentage(metrics.qaoa_validation_accuracy), Sparkles], ['VQE', 'Variational optimization', `${metrics.vqe_final_energy ?? 'Not Available'} final energy`, 'Classification accuracy: Not Available', FlaskConical], ['QSVM', 'Quantum kernel classification', `${architecture.qsvm_reference_states?.[0] || 'Not Available'} reference states`, percentage(metrics.qsvm_test_accuracy), Cpu]].map(([title, subtitle, detail, metric, Icon]) => <div key={title} className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-5 shadow-xl"><div className="flex items-center gap-2 text-cyan-300"><Icon size={18} /><h3 className="font-bold">{title}</h3></div><p className="text-xs text-gray-500 mt-3">{subtitle}</p><p className="text-sm text-gray-200 mt-2">{detail}</p><p className="font-mono text-cyan-300 text-sm mt-3">{metric}</p></div>)}
          </section>

          <section className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5 text-xs text-amber-100/80"><p className="font-semibold text-amber-200">Metric integrity note</p><p className="mt-2 leading-relaxed">The sidebar and this page use artifact-verified model metadata. Risk scores are transaction decision rankings, QAOA values are validation metrics, VQE energy is an optimization value, and unavailable comparison metrics are not inferred from uploaded transaction predictions.</p></section>
          <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-cyan-300"><ArrowLeft size={15} /> Back to Dashboard</button>
        </main>
      </div>
      <StageDetails stage={selectedStage} info={info} onClose={() => setSelectedStage(null)} />
    </div>
  )
}
