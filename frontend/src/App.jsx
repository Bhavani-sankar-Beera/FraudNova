import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import FraudDetection from './pages/FraudDetection'
import PredictionResult from './pages/PredictionResult'
import TransactionHistory from './pages/TransactionHistory'
import ShapExplanation from './pages/ShapExplanation'
import BulkAnalysis from './pages/BulkAnalysis'
import TransactionDetails from './pages/TransactionDetails'
import ModelIntelligence from './pages/ModelIntelligence'
import { BulkAnalysisProvider } from './context/BulkAnalysisContext'
import { getStoredUser, getToken } from './services/api'

// Route guard to prevent unauthenticated access and endless request loops
function ProtectedRoute({ children }) {
  const user = getStoredUser()
  const token = getToken()
  if (!token || !user) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  const user = getStoredUser()
  const token = getToken()
  const isAuthenticated = Boolean(token && user)

  return (
    <BulkAnalysisProvider>
      <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/detect" element={<ProtectedRoute><FraudDetection /></ProtectedRoute>} />
      <Route path="/result" element={<ProtectedRoute><PredictionResult /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
      <Route path="/transactions/:transactionId" element={<ProtectedRoute><TransactionDetails /></ProtectedRoute>} />
      <Route path="/shap" element={<ProtectedRoute><ShapExplanation /></ProtectedRoute>} />
      <Route path="/bulk" element={<ProtectedRoute><BulkAnalysis /></ProtectedRoute>} />
      <Route path="/model-intelligence" element={<ProtectedRoute><ModelIntelligence /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </BulkAnalysisProvider>
  )
}
