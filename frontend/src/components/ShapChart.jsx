import React, { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatFeatureName, formatImpact, getSignificantShap } from '../utils/shap'

const DEFAULT_THRESHOLD = 0.0005
const DEFAULT_VISIBLE = 10

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  const fraudDirection = data.impact >= 0
  return (
    <div className="rounded-xl bg-[#090f1d]/95 border border-cyan-500/30 p-3 shadow-2xl backdrop-blur-xl text-xs">
      <div className="font-semibold text-white mb-1">{data.name}</div>
      <div className="font-mono text-sm font-bold text-white">{formatImpact(data.impact)}</div>
      <div className={`mt-1 ${fraudDirection ? 'text-rose-300' : 'text-cyan-300'}`}>
        {fraudDirection ? 'Pushes the model toward Fraud' : 'Pushes the model toward Genuine'}
      </div>
      <div className="text-[10px] text-gray-500 mt-1">
        Absolute influence: {Math.abs(data.impact).toFixed(3)}
      </div>
    </div>
  )
}

function ContributionLabel({ x, y, width, height, value }) {
  const isPositive = Number(value) >= 0
  const labelX = isPositive ? x + width + 6 : x - 6
  return (
    <text
      x={labelX}
      y={y + height / 2}
      textAnchor={isPositive ? 'start' : 'end'}
      dominantBaseline="middle"
      fill={isPositive ? '#fda4af' : '#67e8f9'}
      fontSize={11}
      fontFamily="monospace"
      fontWeight="700"
    >
      {formatImpact(value)}
    </text>
  )
}

export default function ShapChart({ data = [], threshold = DEFAULT_THRESHOLD }) {
  const [showMore, setShowMore] = useState(false)
  const significant = useMemo(() => getSignificantShap(data, threshold), [data, threshold])
  const visible = showMore ? significant : significant.slice(0, DEFAULT_VISIBLE)
  const chartData = visible.map(item => ({
    ...item,
    name: formatFeatureName(item.feature)
  }))
  const maxImpact = Math.max(...chartData.map(item => Math.abs(item.impact)), 0.01)
  const domain = [-maxImpact * 1.25, maxImpact * 1.25]

  if (!significant.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#08101e] px-5 py-10 text-center">
        <p className="text-sm text-gray-300">No significant SHAP contributions were returned.</p>
        <p className="text-xs text-gray-500 mt-2">
          The model returned zero or negligible feature effects for this transaction.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <p className="text-gray-300 font-semibold">Feature contribution to the fraud-class model output</p>
          <p className="text-gray-500 mt-1">Positive values push toward Fraud; negative values push toward Genuine.</p>
        </div>
        <span className="font-mono text-gray-500">{significant.length} significant of {data.length}</span>
      </div>

      <div className="h-[min(60vh,520px)] min-h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 68, left: 10, bottom: 8 }}
          >
            <XAxis
              type="number"
              domain={domain}
              tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={value => Number(value).toFixed(2)}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={205}
              tick={{ fill: '#cbd5e1', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
            <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.06)' }} content={<CustomTooltip />} />
            <Bar dataKey="impact" radius={3} barSize={18}>
              <LabelList dataKey="impact" content={<ContributionLabel />} />
              {chartData.map((entry, index) => (
                <Cell key={`${entry.feature}-${index}`} fill={entry.impact >= 0 ? '#f43f5e' : '#06b6d4'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="flex flex-wrap gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-rose-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Increases Fraud direction
          </span>
          <span className="flex items-center gap-1.5 text-cyan-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" /> Supports Genuine direction
          </span>
        </div>
        {significant.length > DEFAULT_VISIBLE && (
          <button
            onClick={() => setShowMore(value => !value)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-100"
          >
            {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showMore ? 'Show fewer' : `Show ${significant.length - DEFAULT_VISIBLE} more`}
          </button>
        )}
      </div>
    </div>
  )
}
