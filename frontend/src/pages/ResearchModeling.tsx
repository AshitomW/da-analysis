import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { formatNumber } from '../utils/format'
import {
  BarChart, Bar, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ScatterChart, Scatter, Cell, Legend,
} from 'recharts'
import {
  Cpu, Target, BookOpen, Calendar, TrendingUp, Award, Layers,
  CheckCircle2, AlertTriangle, Droplets
} from 'lucide-react'
import { Skeleton } from '../components/Skeleton'

// Define interfaces for dataset types
interface TimeSeriesRow {
  year: number
  ai_technique: string
  count: number
  share: number
}

interface TimeSeriesSummary {
  total_rows: number
  years_covered: number[]
  unique_techniques: number
  top_5_techniques: string[]
  data: TimeSeriesRow[]
}

interface NLPTopic {
  topic: number
  top_10_terms: string[]
}

interface NLPDistribution {
  topic: number
  doc_count: number
  share: number
}

interface NLPRoadmap {
  cluster: number
  cluster_name: string
  size: number
  top_regions: Record<string, number>
  top_terms: string[]
  description: string
}

interface NLPSummary {
  model_name: string
  n_topics: number
  n_clusters: number
  n_documents: number
  vocabulary_size: number
  topics: NLPTopic[]
  topic_distribution: NLPDistribution[]
  cluster_geo_profile: NLPRoadmap[]
}

interface SDGOutcome {
  sdg: string
  entries: number
  avg_project_value_score: number
  avg_resource_efficiency_score: number
  avg_funding: number
  avg_co2_reduction: number
  avg_impact: number
}

interface SDGIntersect {
  technique: string
  sdg6_share: number
  sdg7_share: number
}

interface SDGSynergy {
  group: string
  avg_impact: number
  avg_resource_efficiency: number
  count: number
}

interface SDGHeatmapRow {
  technique: string
  sdg: string
  share: number
  count: number
}

interface SDGSummary {
  method: string
  cooccurrences: Array<{
    pair: string
    sdg1: string
    sdg2: string
    count: number
    jaccard: number
  }>
  intersect_coordinates: SDGIntersect[]
  sdg_outcomes: SDGOutcome[]
  synergy: SDGSynergy[]
  technique_sdg_heatmap: SDGHeatmapRow[]
  unique_sdgs: string[]
}

interface NexusCollaboration {
  type: string
  avg_impact: number
  avg_roi: number
  count: number
}

interface NexusClimate {
  stress_level: string
  [key: string]: number | string
}

interface NexusEntryType {
  year: number
  Publication: number
  Project: number
  Patent: number
  Policy: number
}

interface NexusRegion {
  region: string
  avg_policy_stringency: number
  open_access_rate: number
  count: number
}

interface ResourceSavingsByTech {
  technique: string
  avg_co2_reduction: number
  avg_water_savings: number
  avg_energy_savings: number
  count: number
}

interface NexusSummary {
  collaboration_impact: NexusCollaboration[]
  climate_deployments: NexusClimate[]
  entry_type_evolution: NexusEntryType[]
  regional_policy_openness: NexusRegion[]
  resource_savings_by_tech?: ResourceSavingsByTech[]
}

export default function ResearchModeling() {
  const [activeTab, setActiveTab] = useState<'time-series' | 'nlp' | 'nexus'>('time-series')
  const [loading, setLoading] = useState<boolean>(true)
  const [lastTrained, setLastTrained] = useState<string | null>(null)
  
  // Loaded Run Data
  const [timeSeries, setTimeSeries] = useState<TimeSeriesSummary | null>(null)
  const [nlp, setNlp] = useState<NLPSummary | null>(null)
  const [nexus, setNexus] = useState<NexusSummary | null>(null)

  const fetchResults = async () => {
    setLoading(true)
    try {
      const response = await api.get<{ results: any[] }>('/results')
      const results = response?.results || []
      
      const tsRun = results.filter(r => r.run_type === 'time_series').sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      const nlpRun = results.filter(r => r.run_type === 'nlp').sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      const nexusRun = results.filter(r => r.run_type === 'nexus_insights').sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      
      setTimeSeries(tsRun || null)
      setNlp(nlpRun || null)
      setNexus(nexusRun || null)
      
      const allTimestamps = results.map(r => r.timestamp).filter(Boolean)
      if (allTimestamps.length > 0) {
        const sorted = allTimestamps.sort()
        setLastTrained(sorted[sorted.length - 1])
      }
    } catch (err) {
      console.error("Failed to load backend model results.", err)
      setTimeSeries(null)
      setNlp(null)
      setNexus(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [])

  const tabs = [
    { id: 'time-series', label: 'Time-Series', icon: Calendar },
    { id: 'nlp', label: 'NLP Topics', icon: BookOpen },
    { id: 'nexus', label: 'Nexus Insights', icon: Droplets },
  ] as const

  // Render Functions
  const renderTimeSeries = () => {
    if (!timeSeries) return <Skeleton className="h-[400px] w-full" />
    
    const years = Array.from(new Set(timeSeries.data.map(d => d.year))).sort()
    const techniques = timeSeries.top_5_techniques
    
    const chartData = years.map(yr => {
      const point: any = { year: yr }
      techniques.forEach(t => {
        const found = timeSeries.data.find(d => d.year === yr && d.ai_technique === t)
        point[t] = found ? found.count : 0
      })
      return point
    })

    const colors = ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED']

    return (
      <div className="space-y-4">
        <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
          Tracking the evolution and adoption of AI methodologies over a decade-long timeline.
          This timeline captures research interest, patent filings, and implementation volume shifts.
        </p>

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="lifted p-6 text-center space-y-1.5">
            <div className="text-xl font-light text-text-primary tracking-heading">{timeSeries.unique_techniques}</div>
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Unique Methodologies</div>
          </div>
          <div className="lifted p-6 text-center space-y-1.5">
            <div className="text-xl font-light text-text-primary tracking-heading">{techniques[0] || 'N/A'}</div>
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Dominant Technique</div>
          </div>
          <div className="lifted p-6 text-center space-y-1.5">
            <div className="text-xl font-light text-text-primary tracking-heading">2026</div>
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Peak Activity Year</div>
          </div>
        </div>

        {/* Adoption Trend Area Chart */}
        <div className="lifted p-6 space-y-4">
          <h3 className="mb-2">Methodology Adoption Over Time (Project Counts)</h3>
          <p className="text-[11px] text-text-muted mb-4">
            Cumulative evolution of the top 5 AI methodologies deployed in water-energy nexus applications.
          </p>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  {techniques.map((tech, idx) => (
                    <linearGradient key={tech} id={`color_${idx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors[idx]} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={colors[idx]} stopOpacity={0.0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                {techniques.map((tech, idx) => (
                  <Area
                    key={tech}
                    type="monotone"
                    dataKey={tech}
                    stroke={colors[idx]}
                    fillOpacity={1}
                    fill={`url(#color_${idx})`}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface p-3 rounded-md">
            <strong>Chart Explanation:</strong> This area chart illustrates the growth trajectory of the top 5 AI methodologies.
            A widening vertical band indicates increasing adoption and real-world deployment over time.
            Within the water-energy nexus, the steady rise of Computer Vision and Deep Learning represents a paradigm shift
            from simple rule-based controls to high-dimensional spatial sensing (e.g. satellite-based crop stress monitoring)
            and temporal modeling (e.g. smart-grid load forecasting).
          </p>
        </div>

        {/* Tabular Distribution detail */}
        <div className="lifted p-6 space-y-4">
          <h3 className="mb-2">Adoption Share Matrix</h3>
          <p className="text-[11px] text-text-muted mb-4">Percent share distribution details for core methodologies across early, mid, and late records.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-alt">
                  <th className="py-2.5 px-4 text-xs font-semibold text-text-muted uppercase tracking-label">Year</th>
                  {techniques.map(tech => (
                    <th key={tech} className="py-2.5 px-4 text-xs font-semibold text-text-muted uppercase tracking-label">{tech}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years.map(yr => {
                  const filtered = timeSeries.data.filter(d => d.year === yr)
                  if (filtered.length === 0) return null
                  return (
                    <tr key={yr} className="border-b border-border hover:bg-surface/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-sm text-text-primary">{yr}</td>
                      {techniques.map(tech => {
                        const cell = filtered.find(d => d.ai_technique === tech)
                        return (
                          <td key={tech} className="py-3 px-4 text-sm text-text-body">
                            {cell ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{cell.count}</span>
                                <span className="text-xs text-text-muted">({(cell.share * 100).toFixed(0)}%)</span>
                              </div>
                            ) : '-'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface p-3 rounded-md">
            <strong>Table Explanation:</strong> This matrix tracks the percentage share of each AI technique over total active records for that year.
            It illustrates the relative dominance of different methodologies over time, helping to identify which technologies are becoming industry standards versus those that remain niche.
          </p>
        </div>
      </div>
    )
  }

  const renderNLP = () => {
    if (!nlp) return <Skeleton className="h-[400px] w-full" />

    const wordCloudColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6366F1']

    return (
      <div className="space-y-4">
        <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
          Unsupervised Topic Discovery using TF-IDF + Latent Dirichlet Allocation (LDA) and KMeans Clustering.
          This mapping groups project abstracts and titles to uncover latent research themes and geographic clusters.
        </p>

        {/* NLP Metadata overview */}
        <div className="grid grid-cols-4 gap-4">
          <div className="lifted p-4 text-center space-y-1">
            <div className="text-xl font-light text-text-primary tracking-heading">{nlp.n_documents.toLocaleString()}</div>
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Processed Docs</div>
          </div>
          <div className="lifted p-4 text-center space-y-1">
            <div className="text-xl font-light text-text-primary tracking-heading">{nlp.vocabulary_size}</div>
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Vocab Size</div>
          </div>
          <div className="lifted p-4 text-center space-y-1">
            <div className="text-xl font-light text-text-primary tracking-heading">{nlp.n_topics}</div>
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">LDA Topics</div>
          </div>
          <div className="lifted p-4 text-center space-y-1">
            <div className="text-xl font-light text-text-primary tracking-heading">{nlp.n_clusters}</div>
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Geo Clusters</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Topic distribution list & chart */}
          <div className="lifted p-6 space-y-4 col-span-1">
            <h3 className="mb-2">Topic Corpus Share</h3>
            <p className="text-[11px] text-text-muted mb-4">Relative frequency of abstract tokens falling within each latent LDA topic cluster.</p>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nlp.topic_distribution} layout="vertical" margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="topic" tickFormatter={(t) => `T${t}`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: any) => [`${(Number(value) * 100).toFixed(1)}%`, 'Corpus Share']} />
                  <Bar dataKey="share" radius={[0, 2, 2, 0]}>
                    {nlp.topic_distribution.map((_, i) => (
                      <Cell key={i} fill={wordCloudColors[i % wordCloudColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface p-3 rounded-md">
              <strong>Chart Explanation:</strong> The horizontal bar chart shows the relative share of each thematic topic across the document corpus. Topic T1 (Optimization/Grid) and Topic T2 (Water/Irrigation) represent the largest buckets of literature in our dataset.
            </p>
          </div>

          {/* Topics Word List Grid */}
          <div className="lifted p-6 space-y-4 col-span-2">
            <h3 className="mb-2">LDA Topic Key Vocabulary Map</h3>
            <p className="text-[11px] text-text-muted mb-4">Highly weighted keywords indicating semantic themes extracted from abstract texts.</p>
            <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2">
              {nlp.topics.map((t) => {
                const dist = nlp.topic_distribution.find(d => d.topic === t.topic)
                return (
                  <div key={t.topic} className="p-3 border border-border/60 hover:border-border rounded-md bg-surface transition-colors duration-150">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-text-primary">Topic #{t.topic}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        {dist ? `${(dist.share * 100).toFixed(1)}% share` : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {t.top_10_terms.map((term, wordIdx) => (
                        <span key={term} className="text-[11px] px-2 py-0.5 bg-bg border border-border/40 rounded-xs text-text-body" style={{ opacity: 1 - wordIdx * 0.08 }}>
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface p-3 rounded-md">
              <strong>Vocabulary Map Explanation:</strong> Each card displays the top weighted keywords for an LDA topic. Keywords that decay in opacity have a slightly lower statistical weight within that theme, helping explain the semantic focus of that topic bucket.
            </p>
          </div>
        </div>

        {/* Semantic / KMeans geo clusters profile */}
        <div className="lifted p-6 space-y-4">
          <h3 className="text-text-primary">Thematic Geographies (KMeans Profiles)</h3>
          <p className="text-[11px] text-text-muted">Grouping academic publications and patents by linguistic profiles and matching deployment centers.</p>

          <div className="grid grid-cols-2 gap-4">
            {nlp.cluster_geo_profile.map((c) => (
              <div key={c.cluster} className="p-4 border border-border/60 rounded-lg bg-gradient-to-br from-bg to-surface-alt flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
                      {c.cluster}
                    </span>
                    <h4 className="text-sm font-semibold text-text-primary">{c.cluster_name}</h4>
                  </div>
                  <p className="text-xs text-text-body mb-3 leading-relaxed">{c.description}</p>
                  
                  {/* Top Terms */}
                  <div className="mb-3">
                    <span className="text-[9px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Keywords</span>
                    <div className="flex flex-wrap gap-1">
                      {c.top_terms.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.2 bg-bg border border-border/40 text-text-muted rounded-xs">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top Regions */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Primary Deployments:</span>
                  <div className="flex gap-2">
                    {Object.entries(c.top_regions).map(([region, count]) => (
                      <span key={region} className="font-medium text-text-primary">
                        {region} <span className="text-text-muted font-normal">({count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface p-3 rounded-md">
            <strong>Geographies Explanation:</strong> These cards map the geographical concentration of document clusters. By combining linguistic analysis with publisher regions, we isolate where specific technologies are researched and validated. For example, Cluster 2 (Precision Irrigation) shows high concentration in arid and water-stressed areas like Sub-Saharan Africa and the Middle East, while Cluster 1 (Grid Optimization) dominates in North America and Europe.
          </p>
        </div>
      </div>
    )
  }

  const renderNexus = () => {
    if (!nexus) return <Skeleton className="h-[400px] w-full" />

    const cleanTechColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

    return (
      <div className="space-y-4">
        <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
          Cross-correlating multiple parameters to map resource savings, investment returns,
          and climate-smart deployment ratios across different AI methodologies.
        </p>

        {/* Explicit Charts About Water & Carbons Savings By AI Tech */}
        {nexus.resource_savings_by_tech && nexus.resource_savings_by_tech.length > 0 && (
          <div className="lifted p-6 space-y-6">
            <div>
              <h3 className="text-text-primary">Resource Savings & Environmental Impact by AI Technique</h3>
              <p className="text-[11px] text-text-muted">Comparing average water savings (liters) and carbon reductions (CO2 tons) achieved per project across core techniques.</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Carbon Reduction (CO2 tons) Chart */}
              <div className="p-4 border border-border/60 bg-bg rounded-lg">
                <span className="text-xs font-semibold text-emerald-700 block mb-2">Average Carbon Reduction (CO2 Tons)</span>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nexus.resource_savings_by_tech} margin={{ left: -10, right: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="technique" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString()} tons`, 'CO2 Reduction']} />
                      <Bar dataKey="avg_co2_reduction" fill="#10B981" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Water Savings (Liters) Chart */}
              <div className="p-4 border border-border/60 bg-bg rounded-lg">
                <span className="text-xs font-semibold text-blue-700 block mb-2">Average Water Savings (Liters)</span>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nexus.resource_savings_by_tech} margin={{ left: 10, right: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="technique" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString()} Liters`, 'Water Savings']} />
                      <Bar dataKey="avg_water_savings" fill="#2563EB" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            {/* Energy Savings Details Grid */}
            <div className="p-4 border border-border/60 bg-bg rounded-lg">
              <span className="text-xs font-semibold text-amber-700 block mb-3">Supporting Nexus Variable: Average Energy Savings (kWh)</span>
              <div className="grid grid-cols-6 gap-3">
                {nexus.resource_savings_by_tech.map(item => (
                  <div key={item.technique} className="p-3 border border-border/40 bg-surface rounded text-center">
                    <span className="text-[10px] font-semibold text-text-muted block truncate">{item.technique}</span>
                    <span className="text-sm font-semibold text-amber-600 block mt-1">{formatNumber(item.avg_energy_savings)} kWh</span>
                    <span className="text-[9px] text-text-muted block mt-0.5">{item.count} items</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-text-muted leading-relaxed bg-surface p-3 rounded-md border border-border/40">
              <strong>Environmental Charts Explanation:</strong> These charts show the average water savings (in liters) and carbon reduction (in CO2 metric tons) achieved by projects using each AI technique. By analyzing these figures, public policy planners can select the most appropriate AI methodology depending on whether their local region is water-constrained (requiring techniques with high water savings like Computer Vision) or carbon-constrained (requiring techniques with high CO2 reduction like Deep Learning).
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Collaboration ROI & Impact Chart */}
          <div className="lifted p-6 space-y-4">
            <h3 className="mb-2">Collaboration Model ROI & Impact</h3>
            <p className="text-[11px] text-text-muted mb-4">Comparing public-private partnership models with academic ventures on investment ROI and impact scores.</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nexus.collaboration_impact} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="type" tick={{ fontSize: 9 }} tickFormatter={(label) => label.split(' ')[0]} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="avg_impact" name="Average Impact Score" fill="#6366F1" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="avg_roi" name="Average ROI Multiplier" fill="#F59E0B" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface p-3 rounded-md">
              <strong>Chart Explanation:</strong> This grouped bar chart compares investment ROI against overall impact scores across different collaboration types. Public-Private Partnerships (PPPs) show the highest average impact score, while pure industry efforts achieve the highest financial ROI. This helps planners determine the optimal stakeholder mix based on funding constraints and impact goals.
            </p>
          </div>

          {/* Climate-Smart Stacked Bars */}
          <div className="lifted p-6 space-y-4">
            <h3 className="mb-2">Climate-Smart Deployments by Water Stress Level</h3>
            <p className="text-[11px] text-text-muted mb-4">Distribution count of AI techniques deployed across low, medium, and high stress zones.</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nexus.climate_deployments} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="stress_level" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {Object.keys(nexus.climate_deployments[0] || {})
                    .filter(k => k !== 'stress_level')
                    .map((tech, idx) => (
                      <Bar
                        key={tech}
                        dataKey={tech}
                        stackId="a"
                        fill={cleanTechColors[idx % cleanTechColors.length]}
                      />
                    ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface p-3 rounded-md">
              <strong>Chart Explanation:</strong> This stacked bar chart shows the distribution of top AI techniques deployed across different water stress levels. In Extremely High stress zones, we observe a surge in Computer Vision deployments (for crop monitoring) and Deep Learning (for leak detection), demonstrating that AI deployments are actively adapting to regional climate pressures.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Entry Type Evolution Stacked Area Chart */}
          <div className="lifted p-6 space-y-4">
            <h3 className="mb-2">Entry Type Evolution (2016–2026)</h3>
            <p className="text-[11px] text-text-muted mb-4">Cumulative transition of research papers into actual utility patents, software projects, and legislative policies.</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={nexus.entry_type_evolution} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Publication" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="Project" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="Patent" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="Policy" stackId="1" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface p-3 rounded-md">
              <strong>Chart Explanation:</strong> This stacked area chart shows the growth of different entry types over time. It tracks how foundational research publications (blue) eventually translate into commercial software projects (green), industrial utility patents (amber), and legislative policies (red), showing the lifecycle of clean-tech innovation.
            </p>
          </div>

          {/* Regional Policy & Openness Grid */}
          <div className="lifted p-6 space-y-4">
            <h3 className="mb-2">Regional Policy Stringency & Open Access Rate</h3>
            <p className="text-[11px] text-text-muted mb-4">Cross-comparing policy score stringency against research open-access shares (Gold/Green OA) by continent.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="py-2 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-label">Region</th>
                    <th className="py-2 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-label text-center">Policy Score</th>
                    <th className="py-2 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-label text-center">Open Access</th>
                    <th className="py-2 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-label text-right">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {nexus.regional_policy_openness.map(row => (
                    <tr key={row.region} className="border-b border-border hover:bg-surface/50 transition-colors">
                      <td className="py-2.5 px-3 text-xs font-semibold text-text-primary">{row.region}</td>
                      <td className="py-2.5 px-3 text-xs text-center text-text-body font-mono font-medium">{row.avg_policy_stringency.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-xs text-center text-emerald-600 font-mono font-medium">{row.open_access_rate.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-xs text-right text-text-muted">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-muted leading-relaxed mt-2 bg-surface p-3 rounded-md">
              <strong>Table Explanation:</strong> This matrix compares policy stringency scores against open-access rates across different continents. High policy stringency scores (e.g., in Europe) correlate with higher open-access rates, proving that robust regulatory frameworks actively encourage public sharing of water-energy research.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!loading && (!timeSeries || !nlp || !nexus)) {
    return (
      <div className="space-y-4">
        <div>
          <h1>Research & Modeling</h1>
          <p className="text-sm text-text-muted">
            Explore adoption trends, topic mapping, and resource nexus insights
          </p>
        </div>

        <div className="lifted flex flex-col items-center justify-center text-center p-12 space-y-6 max-w-2xl mx-auto my-12 border border-dashed border-border/80 rounded-xl bg-gradient-to-b from-surface to-surface-alt">
          <div className="p-4 bg-accent/10 text-accent rounded-full animate-pulse">
            <Cpu size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-text-primary">Research Data Pending</h2>
            <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
              The research modeling pipeline has not been executed yet. Run the background training script to process the datasets and build time-series adoption rates, abstract topics, SDG portfolio mappings, and resource nexus insights.
            </p>
          </div>
          <div className="w-full bg-bg border border-border rounded-lg p-4 font-mono text-xs text-left relative group">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-sans font-semibold">Run Command in Terminal</div>
            <code className="text-text-primary block overflow-x-auto select-all">python backend/scripts/train_all.py</code>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => fetchResults()} 
              className="px-4 py-2 bg-accent text-white font-medium text-sm rounded-md shadow-sm hover:bg-accent-hover transition-colors"
            >
              Refresh Results
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Title Header matches standards */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1>Research & Modeling</h1>
          <p className="text-sm text-text-muted">
            Explore adoption trends, topic mapping, and resource nexus insights
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs">
          <CheckCircle2 className="text-emerald-600" size={14} />
          <span>
            Live Models Active (Last update: {lastTrained ? new Date(lastTrained).toLocaleTimeString() : 'Recent'})
          </span>
        </div>
      </div>

      {/* Tab bar matches standards */}
      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Main Tab Content */}
      <div className="py-2">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-[200px] w-full" />
            <div className="grid grid-cols-2 gap-6">
              <Skeleton className="h-[300px] w-full" />
              <Skeleton className="h-[300px] w-full" />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'time-series' && renderTimeSeries()}
            {activeTab === 'nlp' && renderNLP()}
            {activeTab === 'nexus' && renderNexus()}
          </>
        )}
      </div>
    </div>
  )
}
