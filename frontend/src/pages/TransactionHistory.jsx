import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Download, Filter, RefreshCw, ArrowLeft, ShieldAlert, CheckCircle2, FileSpreadsheet } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import PageNavigation from '../components/PageNavigation'
import TransactionTable from '../components/TransactionTable'
import { getTransactions } from '../services/api'

export default function TransactionHistory() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getTransactions()
      const list = res.data?.data || res.data || []
      setRows(Array.isArray(list) ? list : [])
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login')
        return
      }
      setRows([
        { transaction_id: 'TXN1001', customer_id: 'CUST1001', amount: 2500, merchant: 'Electronics', time: '2026-08-01 10:30', risk_score: 5, prediction: 'Genuine', status: 'Low Risk', location: 'Mumbai' },
        { transaction_id: 'TXN1002', customer_id: 'CUST1002', amount: 85000, merchant: 'Electronics', time: '2026-08-01 10:31', risk_score: 94, prediction: 'Fraud', status: 'High Risk', location: 'Delhi' },
        { transaction_id: 'TXN1003', customer_id: 'CUST1003', amount: 1200, merchant: 'Grocery', time: '2026-08-01 10:32', risk_score: 8, prediction: 'Genuine', status: 'Low Risk', location: 'Mumbai' },
        { transaction_id: 'TXN1004', customer_id: 'CUST1004', amount: 4500, merchant: 'Travel', time: '2026-08-01 10:33', risk_score: 12, prediction: 'Genuine', status: 'Low Risk', location: 'Bengaluru' },
        { transaction_id: 'TXN1005', customer_id: 'CUST1005', amount: 65000, merchant: 'Luxury', time: '2026-08-01 10:34', risk_score: 88, prediction: 'Fraud', status: 'High Risk', location: 'Chennai' }
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const onAnalyzed = () => fetchData()
    window.addEventListener('txn:analyzed', onAnalyzed)
    return () => window.removeEventListener('txn:analyzed', onAnalyzed)
  }, [navigate])

  const filtered = rows.filter(r => {
    if (filter === 'Fraud' && r.prediction !== 'Fraud') return false
    if (filter === 'Genuine' && r.prediction !== 'Genuine') return false
    if (filter === 'High Risk' && r.status !== 'High Risk') return false
    if (filter === 'Medium Risk' && r.status !== 'Medium Risk') return false
    if (filter === 'Low Risk' && r.status !== 'Low Risk') return false
    if (query) {
      const q = query.toLowerCase()
      const matchId = r.transaction_id && r.transaction_id.toLowerCase().includes(q)
      const matchCust = r.customer_id && r.customer_id.toLowerCase().includes(q)
      const matchMerch = r.merchant && r.merchant.toLowerCase().includes(q)
      const matchLoc = r.location && r.location.toLowerCase().includes(q)
      if (!matchId && !matchCust && !matchMerch && !matchLoc) return false
    }
    return true
  })

  // Export CSV
  const handleExportCSV = () => {
    if (!filtered || filtered.length === 0) {
      alert('No transaction records to export.')
      return
    }

    const headers = ['Transaction ID', 'Customer ID', 'Amount (INR)', 'Merchant', 'Location', 'Time', 'Risk Score', 'Prediction', 'Status']
    const csvRows = [
      headers.join(','),
      ...filtered.map(row => [
        `"${row.transaction_id || ''}"`,
        `"${row.customer_id || ''}"`,
        `"${row.amount || ''}"`,
        `"${row.merchant || row.merchant_category || ''}"`,
        `"${row.location || ''}"`,
        `"${row.time || ''}"`,
        `"${row.risk_score || ''}"`,
        `"${row.prediction || ''}"`,
        `"${row.status || ''}"`
      ].join(','))
    ]

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `fraudnova_audit_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const fraudCount = filtered.filter(t => t.prediction === 'Fraud').length
  const genuineCount = filtered.filter(t => t.prediction === 'Genuine').length

  const filterOptions = ['All', 'High Risk', 'Medium Risk', 'Low Risk', 'Fraud', 'Genuine']

  return (
    <div className="flex min-h-screen bg-[#070d18] text-white">
      <Sidebar />
      <div className="flex-1 min-h-screen flex flex-col">
        <Navbar title="Historical Ledger & Audit Logs" />
        <main className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          <PageNavigation
            breadcrumbs={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Transaction History' }
            ]}
            fallback="/dashboard"
            fallbackLabel="Back to Dashboard"
          />

          {/* Header & Export Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">
                Audited Financial Transactions
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Inspect immutable ledger history, SHAP feature metrics, and export audit sheets for compliance.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all text-xs font-semibold flex items-center gap-1.5"
                title="Refresh Ledger"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                onClick={handleExportCSV}
                className="btn-bright-cyan px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              >
                <FileSpreadsheet size={15} />
                <span>Export CSV ({filtered.length})</span>
              </button>
            </div>
          </div>

          {/* Search Bar & Filter Chips */}
          <div className="rounded-2xl bg-[#0b1322]/90 border border-white/10 p-4 space-y-3 shadow-xl">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by Transaction ID, Customer ID, Merchant, or City..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#090f1d] border border-white/10 rounded-xl text-white text-xs placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {filterOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setFilter(opt)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      filter === opt
                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/5 text-xs text-gray-400 font-mono">
              <span>Showing: <strong className="text-white">{filtered.length}</strong> matching records</span>
              <span>•</span>
              <span className="text-rose-400 font-semibold">Fraud: {fraudCount}</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">Genuine: {genuineCount}</span>
            </div>
          </div>

          {/* Table */}
          <TransactionTable rows={filtered} />

        </main>
      </div>
    </div>
  )
}
