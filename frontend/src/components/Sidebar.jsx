import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  ShieldAlert, 
  History, 
  Cpu, 
  LogOut,
  Zap
  , UploadCloud
} from 'lucide-react'
import { logout, getModelInfo, getStoredUser } from '../services/api'
import FraudNovaLogo from './FraudNovaLogo'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
  { to: '/detect', label: 'Fraud Detection', icon: ShieldAlert, badge: 'AI' },
  { to: '/history', label: 'Transaction History', icon: History, badge: null },
  { to: '/shap', label: 'SHAP Explainability', icon: Cpu, badge: null }
  , { to: '/bulk', label: 'Bulk Analysis', icon: UploadCloud, badge: 'NEW' }
]

export default function Sidebar() {
  const navigate = useNavigate()
  const [modelInfo, setModelInfo] = useState(null)
  const user = getStoredUser()
  const displayName = user?.full_name || user?.username || 'Security Analyst'
  const role = (user?.role || 'analyst').toUpperCase()

  useEffect(() => {
    let active = true
    getModelInfo()
      .then(({ data }) => {
        if (active) setModelInfo(data)
      })
      .catch(() => {
        if (active) setModelInfo({ ml_loaded: false })
      })
    return () => { active = false }
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (e) {
      console.error(e)
    }
    navigate('/login')
  }

  return (
    <aside className="w-72 min-h-screen bg-[#091122] border-r border-white/10 flex flex-col justify-between p-5 select-none shrink-0 sticky top-0 h-screen overflow-y-auto">
      {/* Top Branding */}
      <div>
        <div className="px-2 py-3 mb-6">
          <FraudNovaLogo size="sm" />
        </div>

        {/* Navigation Items */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 mb-2">
            Platform Modules
          </div>
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] font-semibold'
                        : 'text-gray-400 hover:text-gray-100 hover:bg-white/5 border border-transparent'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          size={18}
                          className={`transition-colors ${
                            isActive
                              ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]'
                              : 'text-gray-400 group-hover:text-gray-200'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            item.badge === 'LIVE'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* System telemetry card */}
        <button
          type="button"
          onClick={() => navigate('/model-intelligence')}
          className="mt-6 w-full text-left p-3.5 rounded-xl bg-[#0e1930] border border-cyan-500/20 text-xs text-gray-300 hover:border-cyan-400/50 hover:bg-cyan-500/5 transition-all"
          aria-label="Open FraudNova AI Model Intelligence"
        >
          <div className="flex items-center justify-between font-semibold text-gray-200 mb-1">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <Zap size={14} className="text-cyan-400" /> Quantum Node
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              modelInfo?.ml_loaded
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {modelInfo?.ml_loaded && typeof modelInfo.metrics?.experimental_performance?.cnn_lstm_qaoa_vqe_qsvm?.accuracy === 'number'
                ? `${(modelInfo.metrics.experimental_performance.cnn_lstm_qaoa_vqe_qsvm.accuracy * 100).toFixed(2)}%`
                : 'N/A'}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 leading-snug">
            CNN-LSTM + QAOA + VQE + QSVM
          </p>
          <p className={`text-[10px] mt-2 ${modelInfo?.ml_loaded ? 'text-emerald-300' : 'text-amber-300'}`}>
            {modelInfo?.ml_loaded ? 'Verified pipeline available · View workflow' : 'Model status unavailable · View details'}
          </p>
        </button>
      </div>

      {/* User Profile & Logout Bottom Bar */}
      <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center font-bold text-sm text-slate-950 shadow-md">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{displayName}</div>
            <div className="text-[10px] font-mono text-cyan-400 tracking-wide font-medium">
              {role}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-semibold transition cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
