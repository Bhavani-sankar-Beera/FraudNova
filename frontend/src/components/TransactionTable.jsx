import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import RiskBadge from './RiskBadge'
import { Search, Filter, ArrowUpRight, ShieldCheck, AlertTriangle } from 'lucide-react'

export default function TransactionTable({ rows = [] }) {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Status filter
      if (filterStatus === 'High Risk' && !(r.risk_score >= 75 || r.prediction === 'Fraud')) return false
      if (filterStatus === 'Medium Risk' && !(r.risk_score >= 40 && r.risk_score < 75)) return false
      if (filterStatus === 'Low Risk' && !(r.risk_score < 40 || r.prediction === 'Genuine')) return false

      // Search filter
      if (searchTerm) {
        const query = searchTerm.toLowerCase()
        const matchId = r.transaction_id?.toLowerCase().includes(query)
        const matchCust = r.customer_id?.toLowerCase().includes(query)
        const matchMerchant = r.merchant?.toLowerCase().includes(query)
        const matchLocation = r.location?.toLowerCase().includes(query)
        if (!matchId && !matchCust && !matchMerchant && !matchLocation) return false
      }
      return true
    })
  }, [rows, searchTerm, filterStatus])

  const handleInspect = (txn) => {
    navigate(`/transactions/${encodeURIComponent(txn.transaction_id)}`, {
      state: {
        transaction: txn,
        transactionId: txn.transaction_id,
        returnTo: '/history'
      }
    })
  }

  return (
    <div className="card space-y-4">
      {/* Search & Filter Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Txn ID, Customer, Merchant, City..."
            className="w-full pl-9 pr-3 py-2 bg-[#09101d] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {['All', 'High Risk', 'Medium Risk', 'Low Risk'].map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer shrink-0 ${
                filterStatus === filter
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10 border border-transparent'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-gray-400 font-semibold border-b border-white/10">
              <th className="py-3 px-3">Transaction ID</th>
              <th className="py-3 px-3">Customer</th>
              <th className="py-3 px-3">Amount</th>
              <th className="py-3 px-3">Merchant Category</th>
              <th className="py-3 px-3">Location</th>
              <th className="py-3 px-3">Risk Assessment</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredRows.length > 0 ? (
              filteredRows.map((r) => {
                const amountFormatted = Number(r.amount || 0).toLocaleString('en-IN')
                return (
                  <tr
                    key={r.transaction_id}
                    className="hover:bg-white/2 transition duration-150 group"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-cyan-300">
                      {r.transaction_id}
                    </td>
                    <td className="py-3 px-3 font-medium text-gray-300">
                      {r.customer_id}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      ₹{amountFormatted}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 text-gray-300 font-medium">
                        {r.merchant || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-400">
                      {r.location || 'Online'}
                    </td>
                    <td className="py-3 px-3">
                      <RiskBadge score={r.risk_score} prediction={r.prediction} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleInspect(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold transition cursor-pointer"
                      >
                        <span>Details</span>
                        <ArrowUpRight size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldCheck size={28} className="text-gray-500" />
                    <span>No transactions matching filter criteria</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-white/5">
        <span>Showing {filteredRows.length} of {rows.length} transactions</span>
        <span>Quantum neural classification active</span>
      </div>
    </div>
  )
}
