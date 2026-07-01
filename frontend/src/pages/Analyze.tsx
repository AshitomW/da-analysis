import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { formatNumber } from '../utils/format'
import { colLabel, colUnit } from '../utils/columns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell, ComposedChart, Legend,
} from 'recharts'
import { DollarSign, Target, Leaf, Cpu, Globe, Calendar, BarChart3, BookOpen } from 'lucide-react'
import { Skeleton } from '../components/Skeleton'

const TECH_COLS = ['ai_technique', 'water_application', 'energy_application', 'nexus_focus', 'deployment_scale', 'sector', 'model_performance_metric']
const GEO_COLS = ['country', 'region', 'climate_zone', 'water_stress_level']

export default function Analyze() {
  const [activeTab, setActiveTab] = useState('funding')
  const [summary, setSummary] = useState<any>(null)
  const [numOverview, setNumOverview] = useState<any>({})
  const [temporalData, setTemporalData] = useState<any[]>([])
  const [histogram, setHistogram] = useState<any>(null)
  const [selectedCol, setSelectedCol] = useState('funding_usd')
  const [corr, setCorr] = useState<any>(null)
  const [distributions, setDistributions] = useState<Record<string, any[]>>({})
  const [fundingByYear, setFundingByYear] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      const [s, num, temp, corrData, fByYear] = await Promise.all([
        api.get<any>('/analysis/summary'),
        api.get<any>('/analysis/numeric-overview'),
        api.get<any>('/analysis/temporal?group=year'),
        api.get<any>('/analysis/correlation'),
        api.get<any>('/analysis/funding-by-year'),
      ])
      setSummary(s)
      setNumOverview(num?.columns || {})
      setTemporalData(temp.data || [])
      setCorr(corrData)
      setFundingByYear(fByYear.data || [])

      const dists: Record<string, any[]> = {}
      const allCols = [...TECH_COLS, ...GEO_COLS, 'entry_type', 'sdg_alignment', 'status', 'quarter']
      const results = await Promise.allSettled(
        allCols.map((col) => api.get<any>(`/analysis/distribution?column=${col}`).then((r) => ({ col, data: r.distribution })))
      )
      for (const r of results) {
        if (r.status === 'fulfilled') {
          dists[r.value.col] = r.value.data
        }
      }
      setDistributions(dists)
    }
    load()
  }, [])

  useEffect(() => {
    if (selectedCol) {
      api.get<any>(`/analysis/numeric-histogram?column=${selectedCol}&bins=20`)
        .then(setHistogram).catch(() => setHistogram(null))
    }
  }, [selectedCol])

  const numKeys = Object.keys(numOverview)
  const fundingStats = numOverview['funding_usd']

  const tabs = [
    { id: 'funding', label: 'Funding', icon: DollarSign },
    { id: 'impact', label: 'Impact', icon: Target },
    { id: 'environmental', label: 'Environmental', icon: Leaf },
    { id: 'techniques', label: 'Techniques', icon: Cpu },
    { id: 'geographic', label: 'Geographic', icon: Globe },
    { id: 'temporal', label: 'Temporal', icon: Calendar },
    { id: 'numeric', label: 'Numeric', icon: BarChart3 },
    { id: 'research', label: 'Research', icon: BookOpen },
  ]

  const renderFunding = () => (
    <div className="space-y-4">
      <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
        Overview of funding distribution across projects. The histogram shows how funding amounts are spread across bins, while the sector breakdown highlights which sectors receive the most funding.
      </p>
      <div className="grid grid-cols-4 gap-4">
        <div className="lifted p-6 text-center space-y-1.5">
          <div className="text-xl font-light text-text-primary tracking-heading">{fundingStats ? formatNumber(fundingStats.total || fundingStats.mean * (summary?.total_rows || 1)) : '-'}</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Total (USD)</div>
        </div>
        <div className="lifted p-6 text-center space-y-1.5">
          <div className="text-xl font-light text-text-primary tracking-heading">{fundingStats ? formatNumber(fundingStats.mean) : '-'}</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Average (USD)</div>
        </div>
        <div className="lifted p-6 text-center space-y-1.5">
          <div className="text-xl font-light text-text-primary tracking-heading">{fundingStats ? formatNumber(fundingStats.median) : '-'}</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Median (USD)</div>
        </div>
        <div className="lifted p-6 text-center space-y-1.5">
          <div className="text-xl font-light text-text-primary tracking-heading">{fundingStats ? formatNumber(fundingStats.max) : '-'}</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Maximum (USD)</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="lifted p-6 space-y-4">
          <h3 className="mb-3">Distribution</h3>
          <p className="text-[11px] text-text-muted mb-3 leading-relaxed">How funding amounts are spread. Each bar groups projects within a value range, showing the count of projects falling in that specific budget bucket.</p>
          {histogram && selectedCol === 'funding_usd' ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={histogram.edges.slice(0, -1).map((e: number, i: number) => ({ range: formatNumber(e), count: histogram.histogram[i] }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563EB" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="py-8"><Skeleton className="h-[280px] w-full" /></div>}
        </div>

        <div className="lifted p-6 space-y-4">
          <h3 className="mb-3">By Sector</h3>
          <p className="text-[11px] text-text-muted mb-3 leading-relaxed">Number of projects per sector, highlighting which industries receive the highest volume of initiatives.</p>
          {distributions['sector']?.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distributions['sector'].slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="value" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {distributions['sector'].slice(0, 10).map((_: any, i: number) => (
                    <Cell key={i} fill={['#2563EB','#059669','#D97706','#DC2626','#7C3AED','#0891B2','#DB2777','#65A30D','#CA8A04','#EA580C'][i] || '#888'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-text-muted py-8 text-center">No data</p>}
        </div>
      </div>

      <div className="lifted p-6 space-y-4">
        <h3 className="mb-3">Funding Trend by Year</h3>
        <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
          Annual total and average funding. The blue bars represent total funding ($M) on the left axis, and the green line represents average funding ($M) on the right axis.
        </p>
        {fundingByYear && fundingByYear.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={fundingByYear} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                tick={{ fontSize: 10 }}
                label={{ value: 'Total Funding ($M)', angle: -90, position: 'insideLeft', offset: 0, style: { textAnchor: 'middle', fontSize: 10, fill: '#64748b', fontWeight: 500 } }} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                tick={{ fontSize: 10 }}
                label={{ value: 'Average Funding ($M)', angle: 90, position: 'insideRight', offset: 0, style: { textAnchor: 'middle', fontSize: 10, fill: '#64748b', fontWeight: 500 } }} 
              />
              <Tooltip formatter={(value: any, name: string) => {
                if (name === 'total_funding_m') return [`$${value}M`, 'Total Funding'];
                if (name === 'average_funding_m') return [`$${value}M`, 'Average Funding'];
                return [value, name];
              }} />
              <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="total_funding_m" fill="#2563EB" radius={[2, 2, 0, 0]} name="Total Funding" />
              <Line yAxisId="right" type="monotone" dataKey="average_funding_m" stroke="#059669" strokeWidth={2} dot={{ r: 4 }} name="Average Funding" />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-text-muted py-8 text-center">No temporal funding data</p>}
      </div>

      <div className="lifted p-6 space-y-4">
        <h3 className="mb-3">Statistics</h3>
        <p className="text-[11px] text-text-muted mb-3 leading-relaxed">Aggregate metrics for funding_usd, showing the total capital, average, median, and variance.</p>
        {fundingStats ? (
          <div className="grid grid-cols-4 gap-3 text-sm">
            {Object.entries(fundingStats).filter(([k]) => !['histogram', 'hist_edges'].includes(k)).map(([k, v]) => (
              <div key={k} className="p-3 surface rounded-md">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">{k.replace(/_/g, ' ')}</div>
                <div className="font-medium">{formatNumber(v as number)}</div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-text-muted">No data</p>}
      </div>
    </div>
  )

  const renderImpact = () => {
    const cols = ['impact_score', 'innovation_index', 'investment_roi', 'population_served', 'citation_count', 'model_performance_value']
    return (
      <div className="space-y-4">
        <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
          Key impact indicators across projects. Each card displays the distribution statistics for a metric. Higher impact scores and innovation indices indicate more influential projects.
        </p>
        <div className="grid grid-cols-3 gap-4">
        {cols.map((col) => {
          const s = numOverview[col]
          if (!s) return null
          return (
            <div key={col} className="lifted p-6 space-y-4">
              <h3 className="mb-2">{colLabel(col)}</h3>
              <p className="text-[11px] text-text-muted mb-2 leading-relaxed">{col === 'impact_score' ? 'Overall impact rating. Higher values indicate greater real-world impact.' : col === 'innovation_index' ? 'How novel the project approach is.' : col === 'investment_roi' ? 'Return on investment percentage.' : col === 'population_served' ? 'Number of people benefiting.' : col === 'citation_count' ? 'Total academic citations received.' : col === 'model_performance_value' ? 'Reported model accuracy or performance metric.' : ''}</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Mean</span><span className="font-medium">{formatNumber(s.mean)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Median</span><span className="font-medium">{formatNumber(s.median)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Min</span><span className="font-medium">{formatNumber(s.min)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Max</span><span className="font-medium">{formatNumber(s.max)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Std Dev</span><span className="font-medium">{formatNumber(s.std)}</span></div>
              </div>
            </div>
          )
        })}
        </div>
      </div>
    )
  }

  const renderEnvironmental = () => {
    const cols = ['co2_reduction_tons', 'water_savings_liters', 'energy_savings_kwh', 'renewable_energy_share_pct']
    return (
      <div className="space-y-4">
        <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
          Environmental performance metrics per project. CO₂ reduction, water savings, energy savings, and renewable energy share. Each card shows average, maximum, and distribution stats side by side.
        </p>
        <div className="grid grid-cols-2 gap-4">
        {cols.map((col) => {
          const s = numOverview[col]
          if (!s) return null
          return (
            <div key={col} className="lifted p-6 space-y-4">
              <h3 className="mb-2">{colLabel(col)}</h3>
              <p className="text-[11px] text-text-muted mb-2 leading-relaxed">{col === 'co2_reduction_tons' ? 'CO₂ saved per project in metric tons.' : col === 'water_savings_liters' ? 'Water conserved per project in liters.' : col === 'energy_savings_kwh' ? 'Energy saved per project in kWh.' : col === 'renewable_energy_share_pct' ? 'Percentage of energy from renewable sources.' : ''}</p>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="p-3 surface rounded-md text-center">
                  <div className="text-lg font-light text-text-primary">{formatNumber(s.mean)}</div>
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Average</div>
                </div>
                <div className="p-3 surface rounded-md text-center">
                  <div className="text-lg font-light text-text-primary">{formatNumber(s.max)}</div>
                  <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Max</div>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-text-muted">Min</span><span className="font-medium">{formatNumber(s.min)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Median</span><span className="font-medium">{formatNumber(s.median)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Std Dev</span><span className="font-medium">{formatNumber(s.std)}</span></div>
              </div>
            </div>
          )
        })}
        </div>
      </div>
    )
  }

  const renderTechniques = () => (
    <div className="space-y-4">
      <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
        Distribution of AI techniques, deployment scales, application domains, and model performance metrics. Each bar chart shows the top 10 most frequent values for a categorical attribute.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {TECH_COLS.map((col) => {
        const data = distributions[col]
        if (!data?.length) return <div key={col} className="lifted p-6 space-y-4"><h3 className="mb-2">{colLabel(col)}</h3><p className="text-sm text-text-muted py-4 text-center">No data</p></div>
        return (
          <div key={col} className="lifted p-6 space-y-4">
            <h3 className="mb-3">{colLabel(col)}</h3>
            <p className="text-[11px] text-text-muted mb-2 leading-relaxed">Top 10 most frequent {colLabel(col).toLowerCase()} values across projects.</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="value" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {data.slice(0, 10).map((_: any, i: number) => (
                    <Cell key={i} fill={['#2563EB','#059669','#D97706','#DC2626','#7C3AED','#0891B2','#DB2777','#65A30D','#CA8A04','#EA580C'][i] || '#888'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      })}
      </div>
    </div>
  )

  const renderGeographic = () => (
    <div className="space-y-4">
      <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
        Geographic distribution of projects by country, region, climate zone, and water stress level. Longer bars indicate more projects in that location or classification.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {GEO_COLS.map((col) => {
        const data = distributions[col]
        if (!data?.length) return <div key={col} className="lifted p-6 space-y-4"><h3 className="mb-2">{colLabel(col)}</h3><p className="text-sm text-text-muted py-4 text-center">No data</p></div>
        return (
          <div key={col} className="lifted p-6 space-y-4">
            <h3 className="mb-3">{colLabel(col)}</h3>
            <p className="text-[11px] text-text-muted mb-2 leading-relaxed">Top 15 most common {colLabel(col).toLowerCase()} entries, where longer bars indicate more projects.</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.slice(0, 15)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="value" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {data.slice(0, 15).map((_: any, i: number) => (
                    <Cell key={i} fill={['#2563EB','#0D9488','#D97706','#7C3AED','#DC2626','#0891B2','#DB2777','#059669','#CA8A04','#EA580C','#4F46E5','#65A30D','#9333EA','#1D4ED8','#15803D'][i] || '#888'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      })}
      </div>
    </div>
  )

  const renderTemporal = () => (
    <div className="space-y-4">
      <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
        Trends over time. The line chart shows the overall project count per year, and the bar chart breaks down entries by quarter to reveal seasonal patterns in the dataset.
      </p>
      <div className="lifted p-6 space-y-4">
        <h3 className="mb-3">Entries by Year</h3>
        <p className="text-[11px] text-text-muted mb-3 leading-relaxed">Project count per year, revealing growth trends and publication activity over time.</p>
        {temporalData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={temporalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey={temporalData[0]?.year ? 'year' : 'group'} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#2563EB" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-text-muted py-8 text-center">No temporal data</p>}
      </div>
      <div className="lifted p-6 space-y-4">
        <h3 className="mb-3">Quarterly</h3>
        <p className="text-[11px] text-text-muted mb-3 leading-relaxed">Seasonal breakdown representing project count grouped by calendar quarter.</p>
        {distributions['quarter']?.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distributions['quarter']}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="value" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {distributions['quarter'].map((_: any, i: number) => (
                    <Cell key={i} fill={['#D97706','#2563EB','#059669','#7C3AED','#DC2626','#0891B2','#DB2777','#65A30D','#CA8A04','#EA580C','#4F46E5','#15803D'][i] || '#888'} />
                  ))}
                </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-text-muted py-4 text-center">No data</p>}
      </div>
    </div>
  )

  const renderNumeric = () => (
    <div className="space-y-4">
      <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
        Explore any numeric column in detail. Pick a column to view its stats, histogram distribution, and correlation with other numeric columns in the dataset.
      </p>
      <div className="lifted p-6 space-y-4">
        <h3 className="mb-3">Column Explorer</h3>
        <p className="text-[11px] text-text-muted mb-3 leading-relaxed">Pick a numeric column to view its summary statistics and histogram distribution.</p>
        <select className="select w-64 mb-4" value={selectedCol} onChange={(e) => setSelectedCol(e.target.value)}>
          {numKeys.map((c) => <option key={c} value={c}>{colLabel(c)}{colUnit(c) ? ` (${colUnit(c)})` : ''}</option>)}
        </select>
        {selectedCol && numOverview[selectedCol] && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 text-sm">
              {Object.entries(numOverview[selectedCol]).filter(([k]) => k !== 'histogram' && k !== 'hist_edges').map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-border last:border-0">
                  <span className="text-text-muted capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{formatNumber(v as number)}</span>
                </div>
              ))}
            </div>
            {histogram && (
              <div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={histogram.edges.slice(0, -1).map((e: number, i: number) => ({ range: e.toFixed(1), count: histogram.histogram[i] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="range" tick={{ fontSize: 8 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563EB" radius={[1, 1, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  )

  const renderResearch = () => {
    const catCols = ['sdg_alignment', 'entry_type', 'status']
    const numCols = ['citation_count', 'patent_family_size', 'venue_h_index', 'policy_stringency_score']
    return (
      <div className="space-y-4">
        <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
          Research-related attributes, covering the distribution of SDG alignment, entry types, and statuses. It also includes statistics on citations, patent families, venue influence, and policy relevance.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {catCols.map((col) => {
            const data = distributions[col]
            if (!data?.length) return null
            return (
              <div key={col} className="lifted p-6 space-y-4">
                <h3 className="mb-3">{colLabel(col)}</h3>
                <p className="text-[11px] text-text-muted mb-2 leading-relaxed">Top 10 {colLabel(col).toLowerCase()} categories by project count.</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="value" width={120} tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {data.slice(0, 10).map((_: any, i: number) => (
                        <Cell key={i} fill={['#2563EB','#059669','#D97706','#DC2626','#7C3AED','#0891B2','#DB2777','#65A30D','#CA8A04','#EA580C'][i] || '#888'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {numCols.map((col) => {
            const s = numOverview[col]
            if (!s) return null
            return (
              <div key={col} className="lifted p-6 space-y-4">
                <h3 className="mb-2">{colLabel(col)}</h3>
                <p className="text-[11px] text-text-muted mb-2 leading-relaxed">{col === 'citation_count' ? 'Total citations across publications.' : col === 'patent_family_size' ? 'Number of patents filed per project.' : col === 'venue_h_index' ? 'H-index of the publication venue, reflecting how influential the publishing journal is.' : col === 'policy_stringency_score' ? 'How strict relevant policies are, where higher values indicate stricter regulations.' : ''}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-text-muted">Mean:</span> <span className="font-medium">{formatNumber(s.mean)}</span></div>
                  <div><span className="text-text-muted">Median:</span> <span className="font-medium">{formatNumber(s.median)}</span></div>
                  <div><span className="text-text-muted">Min:</span> <span className="font-medium">{formatNumber(s.min)}</span></div>
                  <div><span className="text-text-muted">Max:</span> <span className="font-medium">{formatNumber(s.max)}</span></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1>Analysis</h1>
      <p className="text-sm text-text-muted">
        Explore funding distributions, environmental metrics, AI techniques, geographic patterns, temporal trends, and research impact across the Nexus dataset
      </p>
      <div className="tab-bar">
        {tabs.map((t) => (
          <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {activeTab === 'funding' && renderFunding()}
      {activeTab === 'impact' && renderImpact()}
      {activeTab === 'environmental' && renderEnvironmental()}
      {activeTab === 'techniques' && renderTechniques()}
      {activeTab === 'geographic' && renderGeographic()}
      {activeTab === 'temporal' && renderTemporal()}
      {activeTab === 'numeric' && renderNumeric()}
      {activeTab === 'research' && renderResearch()}
    </div>
  )
}
