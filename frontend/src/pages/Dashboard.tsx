import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { formatNumber } from '../utils/format'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Database, Globe, Cpu, DollarSign, Target, Leaf, Droplets, Zap, TrendingUp } from 'lucide-react'
import { Skeleton } from '../components/Skeleton'

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null)
  const [fundingOverTime, setFundingOverTime] = useState<any[]>([])
  const [techniques, setTechniques] = useState<any[]>([])
  const [countries, setCountries] = useState<any[]>([])
  const [numStats, setNumStats] = useState<any>({})
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<any>('/analysis/summary'),
      api.get<any>('/analysis/temporal?group=year'),
      api.get<any>('/data/status'),
    ]).then(([s, temporal, st]) => {
      setSummary(s)
      setStatus(st)

      const fundingByYear = (temporal.data || temporal || []).map((d: any) => ({
        year: d.year || d.group,
        count: d.count,
      }))
      setFundingOverTime(fundingByYear)

      api.get<any>('/analysis/numeric-overview').then((num) => {
        setNumStats(num?.columns || {})
      })

      api.get<any>('/analysis/distribution?column=ai_technique').then((d) => {
        setTechniques((d.distribution || []).slice(0, 10))
      })

      api.get<any>('/analysis/distribution?column=country').then((d) => {
        setCountries((d.distribution || []).slice(0, 8))
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-12">
      <div className="space-y-2">
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-4 w-[560px]" />
      </div>
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="lifted p-4 space-y-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="lifted p-6 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[240px] w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="lifted p-6 space-y-4">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="lifted p-6 space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  )
  if (!summary) return <div className="text-text-muted py-16 text-center text-sm">No data loaded.</div>

  const fundingStats = numStats['funding_usd'] || {}
  const impactStats = numStats['impact_score'] || {}
  const co2Stats = numStats['co2_reduction_tons'] || {}
  const waterStats = numStats['water_savings_liters'] || {}
  const energyStats = numStats['energy_savings_kwh'] || {}
  const roiStats = numStats['investment_roi'] || {}
  const activeDs = status?.active_dataset || 'original'

  return (
    <div className="space-y-12">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1>Water-Energy Nexus Dashboard</h1>
          <p className="text-sm text-text-muted max-w-[560px]">
            Overview of the AI for Water-Energy Nexus dataset. Displays {summary.total_rows.toLocaleString()} entries across {summary.total_columns} dimensions covering funding, environmental impact, AI techniques, and geographic distribution.
          </p>
        </div>
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-label bg-surface px-3 py-1.5 rounded-xs">
          {activeDs}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="kpi">
          <Database size={16} className="text-text-muted" />
          <span className="kpi-value">{summary.total_rows.toLocaleString()}</span>
          <span className="kpi-label">Total Entries</span>
        </div>
        <div className="kpi">
          <Globe size={16} className="text-text-muted" />
          <span className="kpi-value">{summary.categorical_cols?.length || 0}</span>
          <span className="kpi-label">Categorical</span>
        </div>
        <div className="kpi">
          <Cpu size={16} className="text-text-muted" />
          <span className="kpi-value">{summary.numeric_columns}</span>
          <span className="kpi-label">Numeric</span>
        </div>
        <div className="kpi">
          <DollarSign size={16} className="text-text-muted" />
          <span className="kpi-value">{formatNumber(fundingStats.mean)}</span>
          <span className="kpi-label">Avg Funding</span>
        </div>
        <div className="kpi">
          <Target size={16} className="text-text-muted" />
          <span className="kpi-value">{impactStats.mean?.toFixed(2) || '-'}</span>
          <span className="kpi-label">Avg Impact</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="lifted p-6 space-y-4">
          <h3>Entries by Year</h3>
          {fundingOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={fundingOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#888888' }} />
                <YAxis tick={{ fontSize: 12, fill: '#888888' }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={{ r: 3, fill: '#2563EB' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-text-muted py-8 text-center">No temporal data</p>}
        </div>

        <div className="lifted p-6 space-y-4">
          <h3>Top AI Techniques</h3>
          {techniques.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={techniques} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#888888' }} />
                <YAxis type="category" dataKey="value" width={130} tick={{ fontSize: 10, fill: '#888888' }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {techniques.map((_, i) => (
                    <Cell key={i} fill={['#2563EB','#059669','#D97706','#DC2626','#7C3AED','#0891B2','#DB2777','#65A30D','#CA8A04','#EA580C'][i] || '#888888'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-text-muted py-8 text-center">No technique data</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="lifted p-6 space-y-4">
          <h3>Funding (USD)</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-muted">Mean</span>
              <span className="font-medium text-text-primary">{formatNumber(fundingStats.mean)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-muted">Min</span>
              <span className="font-medium text-text-primary">{formatNumber(fundingStats.min)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-muted">Max</span>
              <span className="font-medium text-text-primary">{formatNumber(fundingStats.max)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-text-muted">Std Dev</span>
              <span className="font-medium text-text-primary">{formatNumber(fundingStats.std)}</span>
            </div>
          </div>
        </div>

        <div className="lifted p-6 space-y-4">
          <h3>Environmental Impact</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 surface rounded-md">
              <Leaf size={16} className="text-text-muted flex-shrink-0" />
              <div>
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">CO₂ Reduction</div>
                <div className="font-medium text-sm text-text-primary">{formatNumber(co2Stats.mean)} tons</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 surface rounded-md">
              <Droplets size={16} className="text-text-muted flex-shrink-0" />
              <div>
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Water Savings</div>
                <div className="font-medium text-sm text-text-primary">{formatNumber(waterStats.mean)} L</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 surface rounded-md">
              <Zap size={16} className="text-text-muted flex-shrink-0" />
              <div>
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Energy Savings</div>
                <div className="font-medium text-sm text-text-primary">{formatNumber(energyStats.mean)} kWh</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 surface rounded-md">
              <TrendingUp size={16} className="text-text-muted flex-shrink-0" />
              <div>
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Renewable Share</div>
                <div className="font-medium text-sm text-text-primary">
                  {numStats['renewable_energy_share_pct']?.mean?.toFixed(1) || '-'}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lifted p-6 space-y-4">
          <h3>Impact & Investment</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-muted">Impact Score</span>
              <span className="font-medium text-text-primary">{impactStats.mean?.toFixed(2) || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-muted">Innovation Index</span>
              <span className="font-medium text-text-primary">{numStats['innovation_index']?.mean?.toFixed(2) || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-muted">Investment ROI</span>
              <span className="font-medium text-text-primary">{roiStats.mean?.toFixed(2) || '-'}%</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-text-muted">Population Served</span>
              <span className="font-medium text-text-primary">{formatNumber(numStats['population_served']?.mean)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-text-muted">Citations</span>
              <span className="font-medium text-text-primary">{formatNumber(numStats['citation_count']?.mean)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lifted p-6 space-y-4">
        <h3>Top Countries</h3>
        {countries.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={countries} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#888888' }} />
              <YAxis type="category" dataKey="value" width={140} tick={{ fontSize: 11, fill: '#888888' }} interval={0} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {countries.map((_, i) => (
                  <Cell key={i} fill={['#0D9488','#0891B2','#059669','#D97706','#DC2626','#7C3AED','#DB2777','#65A30D','#CA8A04','#EA580C','#2563EB','#4F46E5','#9333EA','#15803D','#1D4ED8'][i] || '#888888'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-text-muted py-4 text-center">No geographic data</p>}
      </div>
    </div>
  )
}
