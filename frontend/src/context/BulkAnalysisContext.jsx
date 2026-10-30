import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

const BulkAnalysisContext = createContext(null)

export function BulkAnalysisProvider({ children }) {
  const [session, setSession] = useState({
    file: null,
    batch: null,
    search: '',
    filter: 'All'
  })

  const setFile = useCallback(file => setSession(current => ({ ...current, file })), [])
  const setBatch = useCallback(batch => setSession(current => ({ ...current, batch })), [])
  const setSearch = useCallback(search => setSession(current => ({ ...current, search })), [])
  const setFilter = useCallback(filter => setSession(current => ({ ...current, filter })), [])
  const clearSession = useCallback(() => setSession({ file: null, batch: null, search: '', filter: 'All' }), [])
  const value = useMemo(() => ({
    ...session,
    setFile,
    setBatch,
    setSearch,
    setFilter,
    clearSession
  }), [clearSession, session, setBatch, setFile, setFilter, setSearch])

  return <BulkAnalysisContext.Provider value={value}>{children}</BulkAnalysisContext.Provider>
}

export function useBulkAnalysis() {
  const context = useContext(BulkAnalysisContext)
  if (!context) throw new Error('useBulkAnalysis must be used inside BulkAnalysisProvider')
  return context
}
