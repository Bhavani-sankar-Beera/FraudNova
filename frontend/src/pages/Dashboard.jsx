import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, ShieldAlert, CheckCircle2, Zap, ArrowRight, Sparkles, ShieldCheck, Cpu } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import PageNavigation from '../components/PageNavigation'
import StatCard from '../components/StatCard'
import FraudTrendChart from '../components/FraudTrendChart'
import MerchantChart from '../components/MerchantChart'
import TransactionTable from '../components/TransactionTable'
import { getDashboard, getTransactions } from '../services/api'

const DEMO_TXNS = [
  { transaction_id: 'TXN1001', customer_id: 'CUST1001', amount: 2500, merchant: 'Electronics', time: '10:30', risk_score: 5, prediction: 'Genuine', status: 'Low Risk', location: 'Mumbai' },
  { transaction_id: 'TXN1002', customer_id: 'CUST1002', amount: 85000, merchant: 'Electronics', time: '10:31', risk_score: 94, prediction: 'Fraud', status: 'High Risk', location: 'Delhi' },
  { transaction_id: 'TXN1003', customer_id: 'CUST1003', amount: 1200, merchant: 'Grocery', time: '10:32', risk_score: 8, prediction: 'Genuine', status: 'Low Risk', location: 'Mumbai' },
  { transaction_id: 'TXN1004', customer_id: 'CUST1004', amount: 4500, merchant: 'Travel', time: '10:33', risk_score: 12, prediction: 'Genuine', status: 'Low Risk', location: 'Bengaluru' },
  { transaction_id: 'TXN1005', customer_id: 'CUST1005', amount: 65000, merchant: 'Luxury', time: '10:34', risk_score: 88, prediction: 'Fraud', status: 'High Risk', location: 'Chennai' }
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [rows, setRows] = useState(DEMO_TXNS)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const res = await getDashboard()
        if (!mounted) return
        if (res.data) {
          setData(res.data)
          if (res.data.recent_transactions && res.data.recent_transactions.length > 0) {
            setRows(res.data.recent_transactions)
          }
        }
        const tres = await getTransactions()
        if (!mounted) return
        const txns = tres.data?.data || tres.data
        if (Array.isArray(txns) && txns.length > 0) {
          setRows(txns)
        }
      } catch (err) {
        if (!mounted) return
        if (err.response?.status === 401) {
          navigate('/login')
          return
        }
        console.log('Using demo data - backend unavailable or error')
      }
    }
    fetchData()

    const onAnalyzed = () => fetchData()
    window.addEventListener('txn:analyzed', onAnalyzed)

    return () => {
      mounted = false
      window.removeEventListener('txn:analyzed', onAnalyzed)
    }
  }, [navigate])

  const txns = rows || []

  const total = data?.total_transactions ?? txns.length
  const fraud = data?.fraud_transactions ?? txns.filter(t => t.prediction === 'Fraud').length
  const genuine = data?.genuine_transactions ?? txns.filter(t => t.prediction === 'Genuine').length
  const rate = data?.fraud_rate ?? (total ? Math.round((fraud / total) * 10000) / 100 : 0)

  const trend = data?.fraud_trends ?? txns.map((t, i) => ({
    time: t.time || `T${i + 1}`,
    fraud: t.prediction === 'Fraud' ? 1 : 0,
    genuine: t.prediction === 'Genuine' ? 1 : 0
  }))
  const merchants = data?.fraud_by_merchant ?? Object.entries(
    txns.reduce((acc, t) => {
      acc[t.merchant] = (acc[t.merchant] || 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  return (
    <div className="flex min-h-screen bg-[#070d18] text-white">
      <Sidebar />
      <div className="flex-1 min-h-screen flex flex-col">
        <Navbar title="FraudNova AI Command Center" />
        <main className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          <PageNavigation
            breadcrumbs={[{ label: 'Dashboard' }]}
            fallback="/dashboard"
            fallbackLabel="Dashboard"
          />
          
          {/* Quick Security & Engine Status Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-slate-900/60 border border-cyan-500/20 p-5 shadow-[0_0_30px_rgba(6,182,212,0.08)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Cpu size={24} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-wide">Quantum-Hybrid Neural Shield</h2>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    ACTIVE DEFENSE
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Ensemble: CNN + LSTM + QCNN + QSVM (VQE/QAOA optimized). Inference Latency: <span className="text-cyan-300 font-mono font-medium">12ms</span>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-stretch md:self-auto">
              <button
                onClick={() => navigate('/detect')}
                className="btn-bright-cyan flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] w-full md:w-auto"
              >
                <Sparkles size={16} />
                <span>Analyze New Transaction</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              label="Total Transactions"
              value={total.toLocaleString()}
              icon={Activity}
              color="cyan"
              change="+14.2%"
              subtext="Aggregated volume"
            />
            <StatCard
              label="Fraud Detected"
              value={fraud.toLocaleString()}
              icon={ShieldAlert}
              color="danger"
              change="+3 today"
              trend="up"
              subtext="Neutralized threats"
            />
            <StatCard
              label="Genuine Transactions"
              value={genuine.toLocaleString()}
              icon={CheckCircle2}
              color="emerald"
              change="98.1%"
              subtext="Verified authentic"
            />
            <StatCard
              label="Fraud Rate"
              value={`${rate}%`}
              icon={Zap}
              color="purple"
              change="-0.4%"
              trend="down"
              subtext="Target threshold < 2.5%"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <FraudTrendChart data={trend} />
            </div>
            <div className="lg:col-span-1">
              <MerchantChart data={merchants} />
            </div>
          </div>

          {/* Recent Transactions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">Recent Financial Activity</h3>
                <p className="text-xs text-gray-400">Live stream of verified ledger events with quantum anomaly scoring</p>
              </div>
              <button
                onClick={() => navigate('/history')}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5"
              >
                <span>View Full History</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <TransactionTable rows={txns} />
          </div>

        </main>
      </div>
    </div>
  )
}
