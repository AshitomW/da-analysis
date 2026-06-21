import { useEffect, useState } from 'react'
import { api } from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { BarChart3, TrendingUp, MessageSquareText, Globe } from 'lucide-react'
import { Skeleton } from '../components/Skeleton'

const TAB_COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED']

export default function Comparisons() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ results: any[] }>('/results').then((res) => {
      setResults(res.results || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-4 w-[560px]" />
      <Skeleton className="h-48 w-full" />
    </div>
  )

  const regResults = results.filter((r) => r.run_type === 'ml_model')

  if (results.length === 0) return (
    <div className="space-y-4">
      <h1>Comparisons</h1>
      <p className="text-sm text-text-muted">No analysis results yet. Run the pipeline first.</p>
    </div>
  )

  if (regResults.length === 0) return (
    <div className="space-y-4">
      <h1>Comparisons</h1>
      <p className="text-sm text-text-muted">No regression results available for comparison.</p>
    </div>
  )

  const chartData = regResults.map((r) => ({
    name: r.target_col?.replace(/_/g, ' '),
    r2: r.test_metrics?.r2 ?? 0,
    rmse: r.test_metrics?.rmse ?? 0,
    mae: r.test_metrics?.mae ?? 0,
    id: r.id,
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1>Comparisons</h1>
          <p className="text-sm text-text-muted">Comparing regression performance across prediction targets</p>
        </div>
      </div>

      <div className="lifted p-6 space-y-4">
        <h3>R² Score Comparison</h3>
        <p className="text-xs text-text-muted">Higher is better. Random Forest predictions grouped by target.</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} />
            <Tooltip formatter={(v: number) => v.toFixed(4)} />
            <Bar dataKey="r2" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={TAB_COLORS[i % TAB_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="lifted p-6 space-y-3">
        <h3>Metrics Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="table-header text-left">Target</th>
                <th className="table-header text-right">R²</th>
                <th className="table-header text-right">RMSE</th>
                <th className="table-header text-right">MAE</th>
                <th className="table-header text-right">MSE</th>
                <th className="table-header text-right">Features</th>
                <th className="table-header text-right">Train</th>
                <th className="table-header text-right">Test</th>
                <th className="table-header text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {regResults.map((r, i) => (
                <tr key={r.id} className="border-b border-border hover:bg-surface">
                  <td className="py-2 px-3 font-medium">{r.target_col?.replace(/_/g, ' ')}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.test_metrics?.r2?.toFixed(4) ?? '-'}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.test_metrics?.rmse?.toFixed(2) ?? '-'}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.test_metrics?.mae?.toFixed(2) ?? '-'}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.test_metrics?.mse?.toFixed(2) ?? '-'}</td>
                  <td className="py-2 px-3 text-right">{r.num_features ?? '-'}</td>
                  <td className="py-2 px-3 text-right">{r.train_size ?? '-'}</td>
                  <td className="py-2 px-3 text-right">{r.test_size ?? '-'}</td>
                  <td className="py-2 px-3 text-right font-mono">{r.training_time?.toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lifted p-6 space-y-3">
        <h3>Analysis Overview</h3>
        <p className="text-xs text-text-muted">All completed analyses from the training pipeline</p>
        <div className="grid grid-cols-4 gap-4 mt-3">
          {[
            { type: 'time_series', label: 'Time-Series', icon: TrendingUp, color: 'bg-blue-500' },
            { type: 'ml_model', label: 'Regression', icon: BarChart3, color: 'bg-emerald-500' },
            { type: 'nlp', label: 'NLP', icon: MessageSquareText, color: 'bg-purple-500' },
            { type: 'sdg_analysis', label: 'SDG', icon: Globe, color: 'bg-amber-500' },
          ].map((t) => {
            const count = results.filter((r) => r.run_type === t.type).length
            return (
              <div key={t.type} className="surface rounded-lg p-4 text-center space-y-2 border border-border/40">
                <div className={`w-8 h-8 rounded-full ${t.color} flex items-center justify-center mx-auto`}>
                  <t.icon size={14} className="text-white" />
                </div>
                <div className="text-lg font-light text-text-primary">{count}</div>
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">{t.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
