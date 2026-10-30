import React, { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Search, UploadCloud, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'
import PageNavigation from '../components/PageNavigation'
import { useBulkAnalysis } from '../context/BulkAnalysisContext'
import { analyzeBulk, bulkExportUrl, bulkTemplateUrl, bulkValidationReportUrl, getBulkResults, getToken } from '../services/api'

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

export default function BulkAnalysis() {
  const navigate = useNavigate()
  const { state: navigationState } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const inputRef = useRef(null)
  const { file, batch, search, filter, setFile, setBatch, setSearch, setFilter } = useBulkAnalysis()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  React.useEffect(() => {
    if (navigationState?.returnState?.search !== undefined) setSearch(navigationState.returnState.search)
    else if (searchParams.get('search') !== null) setSearch(searchParams.get('search'))
    if (navigationState?.returnState?.filter !== undefined) setFilter(navigationState.returnState.filter)
    else if (searchParams.get('filter')) setFilter(searchParams.get('filter'))
  }, [navigationState, searchParams, setFilter, setSearch])

  React.useEffect(() => {
    if (batch || !searchParams.get('batch')) return
    let active = true
    getBulkResults(searchParams.get('batch'))
      .then(({ data }) => {
        if (!active) return
        setBatch(data)
        setFile({ name: data.filename || 'Restored analysis dataset', size: data.file_size || 0 })
      })
      .catch(err => {
        if (active) setError(err.response?.data?.message || 'The previous bulk analysis could not be restored.')
      })
    return () => { active = false }
  }, [batch, searchParams, setBatch, setFile])

  React.useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (batch?.batch_id) next.set('batch', batch.batch_id)
    if (search) next.set('search', search)
    else next.delete('search')
    if (filter !== 'All') next.set('filter', filter)
    else next.delete('filter')
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
  }, [batch?.batch_id, filter, search, searchParams, setSearchParams])

  const chooseFile = (candidate) => {
    if (!candidate) return
    const extension = candidate.name.toLowerCase().split('.').pop()
    if (!['csv', 'xlsx', 'xls'].includes(extension)) {
      setError('Choose a CSV, XLSX, or XLS file.')
      return
    }
    setError('')
    setFile(candidate)
    setBatch(null)
  }

  const runAnalysis = async () => {
    if (!file || loading) return
    setLoading(true)
    setError('')
    try {
      const response = await analyzeBulk(file)
      setBatch(response.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk analysis failed. Check the file and backend status.')
    } finally {
      setLoading(false)
    }
  }

  const filteredResults = useMemo(() => {
    const rows = batch?.results || []
    return rows.filter((row) => {
      const matchesFilter = filter === 'All' || row.prediction === filter
      const query = search.trim().toLowerCase()
      return matchesFilter && (!query || JSON.stringify(row).toLowerCase().includes(query))
    })
  }, [batch, filter, search])

  const download = async (url, filename) => {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
    if (!response.ok) {
      setError('The download could not be generated.')
      return
    }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(await response.blob())
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="flex min-h-screen bg-[#070d18] text-white">
      <Sidebar />
      <div className="flex-1 min-h-screen">
        <Navbar title="Bulk Transaction Analysis" />
        <main className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
          <section className="card space-y-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Analyze a transaction dataset</h2>
                <p className="text-xs text-gray-400 mt-1">Validate every row, then run the existing FraudNova prediction pipeline.</p>
              </div>
              <button onClick={() => download(bulkTemplateUrl(), 'fraudnova_bulk_template.xlsx')} className="text-xs text-cyan-300 flex items-center gap-2">
                <Download size={15} /> Download template
              </button>
            </div>
            <PageNavigation
              breadcrumbs={[
                { label: 'Dashboard', to: '/dashboard' },
                { label: 'Bulk Analysis' }
              ]}
              fallback="/dashboard"
              fallbackLabel="Back to Dashboard"
            />
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]) }}
              className="border border-dashed border-cyan-500/40 rounded-2xl p-8 text-center bg-cyan-500/5"
            >
              <UploadCloud className="mx-auto text-cyan-300 mb-3" size={32} />
              <p className="text-sm font-semibold">Drop your CSV or Excel file here</p>
              <p className="text-xs text-gray-500 mt-1">Maximum 10 MB and 10,000 transaction records</p>
              <button onClick={() => inputRef.current?.click()} className="btn-bright-cyan px-4 py-2 mt-4 text-xs">Browse files</button>
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => chooseFile(event.target.files[0])} />
            </div>
            {file && (
              <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 text-xs">
                <span className="flex items-center gap-2"><FileSpreadsheet size={16} className="text-cyan-300" /> {file.name} <span className="text-gray-500">{formatBytes(file.size)}</span></span>
                <button onClick={() => { setFile(null); setBatch(null) }} className="text-gray-400 hover:text-white"><X size={16} /></button>
              </div>
            )}
            {error && <div className="text-sm text-rose-300 flex gap-2"><AlertCircle size={17} /> {error}</div>}
            <button disabled={!file || loading} onClick={runAnalysis} className="btn-bright-cyan px-5 py-3 text-sm disabled:opacity-40">
              {loading ? 'Validating and analyzing...' : 'Validate and analyze dataset'}
            </button>
          </section>

          {batch && (
            <>
              <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  ['Total', batch.total_records, 'text-white'],
                  ['Valid', batch.valid_records, 'text-emerald-300'],
                  ['Fraud', batch.fraud_count, 'text-rose-300'],
                  ['Genuine', batch.genuine_count, 'text-emerald-300'],
                  ['Detection rate', `${batch.detection_rate}%`, 'text-cyan-300']
                ].map(([label, value, color]) => <div className="card" key={label}><p className="text-[11px] text-gray-500">{label}</p><p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p></div>)}
              </section>
              {!batch.model_mode || batch.model_mode === 'unavailable' ? <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">Trained model artifacts are unavailable, so predictions are marked as unavailable-model fallback results. SHAP is not fabricated.</div> : null}
              <section className="card">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex gap-2">
                    {['All', 'Fraud', 'Genuine', 'Invalid'].map((value) => <button key={value} onClick={() => setFilter(value)} className={`px-3 py-1.5 rounded-lg text-xs ${filter === value ? 'bg-cyan-500/20 text-cyan-200' : 'bg-white/5 text-gray-400'}`}>{value}</button>)}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative"><Search size={14} className="absolute left-2.5 top-2.5 text-gray-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search results" className="bg-white/5 rounded-lg py-2 pl-8 pr-3 text-xs outline-none" /></div>
                    <button onClick={() => download(bulkExportUrl(batch.batch_id, 'csv'), `${batch.batch_id}_results.csv`)} className="text-xs text-cyan-300"><Download size={15} /></button>
                    <button onClick={() => download(bulkExportUrl(batch.batch_id, 'xlsx'), `${batch.batch_id}_results.xlsx`)} className="text-xs text-cyan-300">XLSX</button>
                    {batch.invalid_records > 0 && <button onClick={() => download(bulkValidationReportUrl(batch.batch_id), `${batch.batch_id}_validation_errors.csv`)} className="text-xs text-rose-300">Errors</button>}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs"><thead className="text-gray-500 border-b border-white/10"><tr><th className="p-3">Transaction ID</th><th className="p-3">Amount</th><th className="p-3">Payment</th><th className="p-3">Location</th><th className="p-3">Result</th><th className="p-3">Score</th><th /></tr></thead>
                    <tbody>{filteredResults.map((row, index) => <tr key={`${row.transaction_id}-${index}`} className="border-b border-white/5 hover:bg-white/5"><td className="p-3 font-mono">{row.transaction_id}</td><td className="p-3">{row.amount_inr ?? '-'}</td><td className="p-3">{row.payment_method ?? '-'}</td><td className="p-3">{row.location ?? '-'}</td><td className={`p-3 font-semibold ${row.prediction === 'Fraud' ? 'text-rose-300' : row.prediction === 'Genuine' ? 'text-emerald-300' : 'text-gray-400'}`}>{row.prediction}</td><td className="p-3">{row.risk_score ?? '-'}</td><td className="p-3"><button onClick={() => navigate(`/transactions/${encodeURIComponent(row.transaction_id)}`, { state: { batchId: batch.batch_id, transactionId: String(row.transaction_id), transaction: row, returnTo: '/bulk', returnState: { search, filter } } })} className="text-cyan-300">Details</button></td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
