import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { formatNumber } from '../utils/format'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, AreaChart, Area,
} from 'recharts'
import {
  TrendingUp, BarChart3, MessageSquareText, GitCompare,
  Target, DollarSign, Layers, Globe, FileText, Award, Clock, Sparkles
} from 'lucide-react'
import { Skeleton } from '../components/Skeleton'

type RunType = 'time_series' | 'ml_model' | 'nlp' | 'sdg_analysis'

const TABS: { id: RunType; label: string; icon: any }[] = [
  { id: 'time_series', label: 'Time-Series', icon: TrendingUp },
  { id: 'ml_model', label: 'Regression', icon: Target },
  { id: 'nlp', label: 'NLP', icon: MessageSquareText },
  { id: 'sdg_analysis', label: 'SDG', icon: Globe },
]

const TECH_COLORS = [
  '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#CA8A04', '#EA580C',
  '#4F46E5', '#0D9488', '#9333EA', '#15803D', '#1D4ED8',
]

export default function MLModels() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<RunType>('time_series')

  useEffect(() => {
    api.get<{ results: any[] }>('/results').then((res) => {
      setResults(res.results || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const byRunType = (type: RunType) => results.filter((r) => r.run_type === type)

  const timeSeriesData = byRunType('time_series')
  const regressionData = byRunType('ml_model')
  const nlpData = byRunType('nlp')
  const sdgData = byRunType('sdg_analysis')

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-4 w-[560px]" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  )

  if (results.length === 0) return (
    <div className="space-y-4">
      <h1>ML Models</h1>
      <p className="text-sm text-text-muted">No analysis results yet.</p>
      <div className="lifted p-6 text-center space-y-3">
        <BarChart3 size={32} className="mx-auto text-text-muted" />
        <p className="text-sm text-text-muted">Run the analysis pipeline:</p>
        <pre className="text-xs bg-surface-alt px-4 py-2 rounded-md inline-block text-text-muted font-mono">python backend/scripts/train_all.py</pre>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1>ML Models</h1>
          <p className="text-sm text-text-muted">Domain-specific analyses: time-series trends, regression, topic modeling, and SDG alignment</p>
        </div>
      </div>

      <div className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'time_series' && <TimeSeriesSection data={timeSeriesData[timeSeriesData.length - 1]} />}
      {activeTab === 'ml_model' && <RegressionSection data={regressionData} />}
      {activeTab === 'nlp' && <NLPSection data={nlpData[nlpData.length - 1]} />}
      {activeTab === 'sdg_analysis' && <SDGSection data={sdgData[sdgData.length - 1]} />}
    </div>
  )
}

/* ─── Time-Series ─────────────────────────────────────── */

function TimeSeriesSection({ data }: { data: any }) {
  if (!data) return <div className="lifted p-6 text-sm text-text-muted">No time-series data.</div>

  const rows: { year: number; ai_technique: string; count: number; share: number }[] = data.data || []
  if (rows.length === 0) return <div className="lifted p-6 text-sm text-text-muted">No time-series data.</div>

  const years = [...new Set(rows.map((r) => r.year))].sort()
  const topTechs = data.top_5_techniques || []

  // Build per-technique series for the top 5
  const seriesData = years.map((year) => {
    const point: any = { year }
    for (const tech of topTechs) {
      const match = rows.find((r) => r.year === year && r.ai_technique === tech)
      point[tech] = match ? match.share : 0
    }
    return point
  })

  return (
    <div className="space-y-5">
      <div className="lifted p-6 space-y-4">
        <h3>AI Technique Adoption Rate (2016–2026)</h3>
        <p className="text-xs text-text-muted">Share of projects using each AI technique per year. Top 5 techniques shown.</p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={seriesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} />
            <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
            <Legend />
            {topTechs.map((tech: string, i: number) => (
              <Line key={tech} type="monotone" dataKey={tech} stroke={TECH_COLORS[i % TECH_COLORS.length]}
                strokeWidth={2} dot={{ r: 3 }} name={tech} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="lifted p-5 text-center space-y-1">
          <div className="text-xl font-light text-text-primary">{data.unique_techniques}</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Unique Techniques</div>
        </div>
        <div className="lifted p-5 text-center space-y-1">
          <div className="text-xl font-light text-text-primary">{data.total_rows}</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Year-Technique Pairs</div>
        </div>
        <div className="lifted p-5 text-center space-y-1">
          <div className="text-xl font-light text-text-primary">{data.years_covered?.length || '-'}</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Years</div>
        </div>
      </div>

      <div className="lifted p-6 space-y-3">
        <h3>Year-Technique Breakdown</h3>
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="table-header text-left">Year</th>
                <th className="table-header text-left">AI Technique</th>
                <th className="table-header text-right">Count</th>
                <th className="table-header text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border hover:bg-surface">
                  <td className="py-1.5 px-3">{r.year}</td>
                  <td className="py-1.5 px-3">{r.ai_technique}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{r.count}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{(r.share * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ─── Regression ──────────────────────────────────────── */

const MODEL_COLORS: Record<string, string> = {
  'Linear Regression': '#3B82F6',
  'Ridge Regression': '#84CC16',
  'Decision Tree': '#F59E0B',
  'Random Forest': '#6366F1',
  'Gradient Boosting': '#8B5CF6',
  'XGBoost': '#10B981',
  'Neural Network': '#EC4899',
  'Ensemble (Voting)': '#F43F5E',
}

function RegressionSection({ data }: { data: any[] }) {
  const [selectedTarget, setSelectedTarget] = useState<string>('')
  const targets = [...new Set(data.map((r) => r.target_col).filter(Boolean))]

  useEffect(() => {
    if (!selectedTarget && targets.length > 0) setSelectedTarget(targets[0])
  }, [data])

  if (data.length === 0) return <div className="lifted p-6 text-sm text-text-muted">No regression results.</div>

  const models = data.filter((r) => r.target_col === selectedTarget)

  // Deduplicate model entries by keeping only the latest run for each model_name
  const latestModelsMap: Record<string, any> = {}
  models.forEach((m) => {
    const name = m.model_name
    if (!latestModelsMap[name] || new Date(m.timestamp) > new Date(latestModelsMap[name].timestamp)) {
      latestModelsMap[name] = m
    }
  })
  const latestModels = Object.values(latestModelsMap)

  const best = [...latestModels].sort((a, b) => (b.test_metrics?.r2 ?? -999) - (a.test_metrics?.r2 ?? -999))[0]

  const r2Data = latestModels.map((m) => ({
    name: m.model_name,
    r2: m.test_metrics?.r2 ?? 0,
    rmse: m.test_metrics?.rmse ?? 0,
    rmse_pct: m.test_metrics?.rmse_pct ?? 0,
    mae: m.test_metrics?.mae ?? 0,
    mae_pct: m.test_metrics?.mae_pct ?? 0,
  })).sort((a, b) => b.r2 - a.r2)

  const formatMetric = (val: number | undefined, target: string, isPct: boolean = false) => {
    if (val === undefined) return '-';
    if (isPct) return `${val.toFixed(1)}%`;
    if (target === 'funding_usd') {
      return `$${val.toFixed(2)}M`;
    }
    return val.toFixed(3);
  };

  const getFitData = (bestModel: any) => {
    if (!bestModel || !bestModel.actual_vs_predicted) return [];
    const actuals = bestModel.actual_vs_predicted.actual || [];
    const predicted = bestModel.actual_vs_predicted.predicted || [];
    
    // Slice a subset for clear visual rendering
    const pointsToShow = Math.min(80, actuals.length);
    const mapped = actuals.slice(0, pointsToShow).map((act: number, i: number) => ({
      index: i,
      actual: act,
      predicted: predicted[i] ?? 0,
    }));
    
    // Sort by actual value so actuals form a smooth line/curve
    return mapped.sort((a: any, b: any) => a.actual - b.actual);
  };

  const fitData = getFitData(best);

  return (
    <div className="space-y-6">
      {/* Target Selector */}
      {targets.length > 1 && (
        <div className="flex gap-1.5 bg-surface-alt rounded-md p-1 w-fit border border-border/60">
          {targets.map((t) => (
            <button
              key={t}
              className={`px-4 py-2 text-xs font-semibold rounded-sm transition-all duration-150 ${
                selectedTarget === t
                  ? 'bg-bg shadow-2 text-text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              onClick={() => setSelectedTarget(t)}
            >
              {t === 'funding_usd' ? 'Project Funding (USD)' : 'Project Impact Score'}
            </button>
          ))}
        </div>
      )}

      {/* KPI Stats Cards */}
      {best && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="lifted p-4 flex items-center gap-4 hover:shadow-2 transition-shadow">
            <div className="w-10 h-10 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
              <Award size={20} />
            </div>
            <div>
              <span className="text-micro text-text-muted uppercase block tracking-wider font-semibold">Best Regressor</span>
              <span className="text-sm font-semibold text-text-primary block mt-0.5">{best.model_name}</span>
            </div>
          </div>
          <div className="lifted p-4 flex items-center gap-4 hover:shadow-2 transition-shadow">
            <div className="w-10 h-10 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600 flex items-center justify-center">
              <Target size={20} />
            </div>
            <div>
              <span className="text-micro text-text-muted uppercase block tracking-wider font-semibold">Best R² Metric</span>
              <span className="text-sm font-bold text-text-primary block mt-0.5 font-mono">{(best.test_metrics?.r2 ?? 0).toFixed(4)}</span>
            </div>
          </div>
          <div className="lifted p-4 flex items-center gap-4 hover:shadow-2 transition-shadow">
            <div className="w-10 h-10 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-micro text-text-muted uppercase block tracking-wider font-semibold">Training Time</span>
              <span className="text-sm font-bold text-text-primary block mt-0.5 font-mono">{best.training_time?.toFixed(2)}s</span>
            </div>
          </div>
          <div className="lifted p-4 flex items-center gap-4 hover:shadow-2 transition-shadow">
            <div className="w-10 h-10 rounded-md bg-orange-50 dark:bg-orange-900/20 text-orange-600 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <span className="text-micro text-text-muted uppercase block tracking-wider font-semibold">Model Features</span>
              <span className="text-sm font-semibold text-text-primary block mt-0.5">{best.num_features ?? 0} Features</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Model Comparison Chart */}
        <div className="lifted p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h3 className="text-sm font-semibold">Model Comparison (R²)</h3>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-mono">Higher is Better</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={r2Data} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
              <YAxis tick={{ fontSize: 9 }} domain={[0, 1]} />
              <Tooltip formatter={(v: number) => v.toFixed(4)} />
              <Bar dataKey="r2" radius={[4, 4, 0, 0]}>
                {r2Data.map((d) => (
                  <Cell key={d.name} fill={MODEL_COLORS[d.name] || '#888'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Actual vs Predicted Fit Chart */}
        <div className="lifted p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h3 className="text-sm font-semibold">Regression Predictions Fit</h3>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-mono">Best Model ({best?.model_name})</span>
          </div>
          {fitData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={fitData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="index" tick={false} label={{ value: 'Test Samples (Sorted)', position: 'insideBottom', offset: -4, fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} unit={selectedTarget === 'funding_usd' ? 'M' : ''} />
                <Tooltip formatter={(v: number) => [v.toFixed(3), '']} />
                <Legend verticalAlign="top" height={36} iconSize={8} wrapperStyle={{ fontSize: 9 }} />
                <Line type="monotone" dataKey="actual" stroke="#3B82F6" strokeWidth={2} dot={false} name="Actual" />
                <Line type="monotone" dataKey="predicted" stroke="#EF4444" strokeWidth={1.5} dot={{ r: 1.5 }} activeDot={{ r: 3.5 }} name="Predicted" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-xs text-text-muted">No fit data available</div>
          )}
        </div>
      </div>

      {/* Metrics Table */}
      <div className="lifted p-5 space-y-3">
        <h3 className="text-sm font-semibold border-b border-border/40 pb-2">Performance Metrics Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 text-left">Model Name</th>
                <th className="py-2.5 px-3 text-right">R² Score</th>
                <th className="py-2.5 px-3 text-right">RMSE</th>
                <th className="py-2.5 px-3 text-right">RMSE (% of Mean)</th>
                <th className="py-2.5 px-3 text-right">MAE</th>
                <th className="py-2.5 px-3 text-right">MAE (% of Mean)</th>
                <th className="py-2.5 px-3 text-right">Train Time</th>
              </tr>
            </thead>
            <tbody>
              {r2Data.map((m) => (
                <tr key={m.name} className="border-b border-border hover:bg-surface transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-text-primary flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MODEL_COLORS[m.name] || '#888' }} />
                    {m.name}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-medium">{m.r2.toFixed(4)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatMetric(m.rmse, selectedTarget)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-text-muted">{formatMetric(m.rmse_pct, selectedTarget, true)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatMetric(m.mae, selectedTarget)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-text-muted">{formatMetric(m.mae_pct, selectedTarget, true)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-text-muted">{models.find((e) => e.model_name === m.name)?.training_time?.toFixed(2)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Importance Chart */}
      {best?.feature_importance?.names?.length > 0 && (
        <div className="lifted p-5 space-y-4">
          <h3 className="text-sm font-semibold border-b border-border/40 pb-2">
            Top Feature Importance ({best.model_name})
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={best.feature_importance.names.slice(0, 8).map((n: string, i: number) => ({
                name: n.length > 35 ? n.slice(0, 32) + '...' : n,
                importance: best.feature_importance.values[i] ?? 0,
              }))}
              layout="vertical"
              margin={{ left: 20, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis type="number" tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 8.5 }} />
              <Tooltip formatter={(v: number) => v.toFixed(4)} />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {best.feature_importance.names.slice(0, 8).map((_: string, i: number) => (
                  <Cell key={i} fill={i < 2 ? '#6366F1' : i < 5 ? '#8B5CF6' : '#A78BFA'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/* ─── NLP ─────────────────────────────────────────────── */

function NLPSection({ data }: { data: any }) {
  if (!data) return <div className="lifted p-6 text-sm text-text-muted">No NLP results.</div>

  const topics = data.topics || []
  const topicDist = data.topic_distribution || []
  const clusters = data.cluster_geo_profile || []

  return (
    <div className="space-y-6">
      {/* NLP KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="lifted p-5 text-center space-y-1 hover:shadow-2 transition-shadow">
          <div className="text-xl font-light text-text-primary">{data.n_topics}</div>
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-label">LDA Topics</div>
        </div>
        <div className="lifted p-5 text-center space-y-1 hover:shadow-2 transition-shadow">
          <div className="text-xl font-light text-text-primary">{formatNumber(data.n_documents)}</div>
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-label">Analyzed Documents</div>
        </div>
        <div className="lifted p-5 text-center space-y-1 hover:shadow-2 transition-shadow">
          <div className="text-xl font-light text-text-primary">{data.vocabulary_size?.toLocaleString() || '-'}</div>
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-label">Vocabulary Size</div>
        </div>
      </div>

      {/* Topics Grid */}
      <div className="lifted p-6 space-y-4">
        <h3 className="text-sm font-semibold border-b border-border/40 pb-2">Extracted Topic Clusters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topics.map((t: any) => (
            <div key={t.topic} className="surface rounded-lg p-4 border border-border/30 hover:border-border transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-blue-700 bg-blue-50/80 px-2.5 py-0.5 rounded-full border border-blue-100">
                  Topic {t.topic}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.top_10_terms.map((term: string, i: number) => (
                  <span
                    key={term}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                      i < 3 ? 'bg-blue-50 text-blue-700 border-blue-100' :
                      i < 6 ? 'bg-slate-50 text-slate-600 border-slate-200/60' :
                      'bg-gray-50/80 text-gray-500 border-gray-200/40'
                    }`}
                  >
                    {term}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topic Distribution Chart */}
      {topicDist.length > 0 && (
        <div className="lifted p-6 space-y-4">
          <h3 className="text-sm font-semibold border-b border-border/40 pb-2">Topic Document Distribution</h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicDist.map((d: any) => ({ topic: `Topic ${d.topic}`, share: d.share }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="topic" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                <Bar dataKey="share" radius={[4, 4, 0, 0]}>
                  {topicDist.map((_: any, i: number) => (
                    <Cell key={i} fill={TECH_COLORS[i % TECH_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Cluster Profiles */}
      {clusters.length > 0 && (
        <div className="lifted p-6 space-y-4">
          <h3 className="text-sm font-semibold border-b border-border/40 pb-2">Regional Cluster Profiles</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {clusters.map((c: any) => (
              <div key={c.cluster} className="surface rounded-lg p-5 border border-border/30 hover:border-border transition-all flex flex-col justify-between space-y-3.5 shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layers size={15} className="text-blue-600" />
                      <span className="text-sm font-bold text-text-primary">{c.cluster_name || `Cluster ${c.cluster}`}</span>
                      <span className="text-[10px] text-text-muted">({c.size} documents)</span>
                    </div>
                  </div>
                  
                  {/* Auto-generated Cluster Description */}
                  <p className="text-xs text-text-body leading-relaxed italic mt-1 mb-3.5">
                    {c.description || 'Focuses on regional deployments and collaborative frameworks.'}
                  </p>

                  {/* Dominant Cluster Tags */}
                  {c.top_terms && c.top_terms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.top_terms.map((term: string) => (
                        <span key={term} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100/60 px-2 py-0.5 rounded-sm font-semibold">
                          {term}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Regional Innovation Distribution */}
                <div className="border-t border-border/40 pt-3">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Primary Innovation Hubs</span>
                  {c.top_regions && Object.keys(c.top_regions).length > 0 ? (
                    <div className="space-y-1">
                      {Object.entries(c.top_regions).slice(0, 3).map(([region, count]) => (
                        <div key={region} className="flex justify-between text-xs">
                          <span className="text-text-muted">{region}</span>
                          <span className="font-mono font-semibold">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-text-muted">No region data</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── SDG ─────────────────────────────────────────────── */

function SDGSection({ data }: { data: any }) {
  if (!data) return <div className="lifted p-6 text-sm text-text-muted">No SDG analysis data.</div>

  const results = data.results || {}
  const categories = Object.keys(results)

  if (categories.length === 0) return <div className="lifted p-6 text-sm text-text-muted">No SDG correlation data.</div>

  return (
    <div className="space-y-5">
      {categories.map((cat) => {
        const r = results[cat]
        if (!r) return null
        const cats = r.categories || {}
        const catNames = Object.keys(cats)

        // Chart data: for each category, show primary SDG share
        const chartData = catNames.map((name) => ({
          name: name.length > 25 ? name.slice(0, 25) + '…' : name,
          fullName: name,
          primaryShare: cats[name]?.primary_share || 0,
          primarySdg: cats[name]?.primary_sdg || '',
        })).sort((a, b) => b.primaryShare - a.primaryShare)

        return (
          <div key={cat} className="lifted p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3>{cat} × SDG Alignment</h3>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                r.significant ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {r.significant ? 'Significant' : 'Not Significant'} (p={r.p_value?.toFixed(4)})
              </span>
            </div>
            <p className="text-xs text-text-muted">
              χ² = {r.chi2_statistic}, p = {r.p_value?.toFixed(4)}, df = {r.degrees_of_freedom}
            </p>

            <ResponsiveContainer width="100%" height={Math.max(200, catNames.length * 28)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 1]} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                <Bar dataKey="primaryShare" radius={[0, 3, 3, 0]}>
                  {chartData.map((_: any, i: number) => (
                    <Cell key={i} fill={TECH_COLORS[i % TECH_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="table-header text-left">{cat}</th>
                    <th className="table-header text-left">Primary SDG</th>
                    <th className="table-header text-right">Share</th>
                    <th className="table-header text-left">Top 3 SDGs</th>
                  </tr>
                </thead>
                <tbody>
                  {catNames.map((name) => {
                    const c = cats[name]
                    return (
                      <tr key={name} className="border-b border-border hover:bg-surface">
                        <td className="py-1.5 px-3 font-medium">{name}</td>
                        <td className="py-1.5 px-3">{c?.primary_sdg}</td>
                        <td className="py-1.5 px-3 text-right font-mono">
                          {c?.primary_share ? `${(c.primary_share * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-text-muted">
                          {c?.top_3?.slice(0, 3).map((t: [string, number]) => t[0]).join(', ') || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
