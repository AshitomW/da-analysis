import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ColumnInfo } from '../types'
import { colLabel, colUnit, colDescription } from '../utils/columns'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { Skeleton } from '../components/Skeleton'

export default function DataQuality() {
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ columns: ColumnInfo[] }>('/data/columns'),
      api.get<any>('/analysis/summary'),
    ]).then(([c, s]) => {
      setColumns(c.columns)
      setSummary(s)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="lifted p-6 space-y-2 text-center">
            <Skeleton className="h-7 w-24 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>
      <div className="lifted p-6 space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="lifted p-6 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  )

  const nullCols = columns.filter((c) => c.null_pct > 0).sort((a, b) => b.null_pct - a.null_pct)

  return (
    <div className="space-y-6">
      <div className="mb-1">
        <h1>Data Quality Report</h1>
        <p className="text-sm text-text-muted">
          Completeness and health assessment of all {summary?.total_columns} columns in the Water-Energy Nexus dataset
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="lifted p-6 text-center space-y-1.5">
          <div className="text-[26px] font-light text-text-primary tracking-heading">{summary.total_rows.toLocaleString()}</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Total Entries</div>
        </div>
        <div className="lifted p-6 text-center space-y-1.5">
          <div className="text-[26px] font-light text-text-primary tracking-heading">{summary.total_columns}</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Columns</div>
        </div>
        <div className="lifted p-6 text-center space-y-1.5">
          <div className="text-[26px] font-light text-text-primary tracking-heading">{summary.null_pct}%</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Overall Null Rate</div>
        </div>
        <div className="lifted p-6 text-center space-y-1.5">
          <div className="text-[26px] font-light text-text-primary tracking-heading">{summary.memory_mb} MB</div>
          <div className="text-[11px] font-medium text-text-muted uppercase tracking-label">Memory Usage</div>
        </div>
      </div>

      <div className="lifted p-6 space-y-4">
        <h3 className="mb-1">Columns with Missing Values</h3>
        <p className="text-xs text-text-muted mb-3">
          {nullCols.length} of {columns.length} columns have missing data. Bars show the percentage of null values.
        </p>
        {nullCols.length === 0 && <p className="text-sm text-text-muted">No missing values found — the dataset is fully complete.</p>}
        {nullCols.map((c) => (
          <div key={c.name} className="flex items-center gap-3 mb-1.5">
            <span className="w-44 text-xs truncate font-medium" title={colLabel(c.name)}>{colLabel(c.name)}</span>
            <div className="flex-1 h-5 bg-surface-alt rounded overflow-hidden">
              <div className="h-full bg-accent rounded" style={{ width: `${Math.min(c.null_pct, 100)}%` }} />
            </div>
            <span className="text-[11px] font-medium text-text-muted uppercase tracking-label w-16 text-right">{c.null_pct}%</span>
            <span className="text-xs text-text-muted w-12 text-right">{c.nulls}</span>
          </div>
        ))}
      </div>

      <div className="lifted p-6 space-y-4">
        <h3 className="mb-1">Column Inventory</h3>
        <p className="text-xs text-text-muted mb-3">Full schema with data types, completeness, and health status</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium text-text-muted">Column</th>
                <th className="text-left py-2 px-2 font-medium text-text-muted">Type</th>
                <th className="text-right py-2 px-2 font-medium text-text-muted">Nulls</th>
                <th className="text-right py-2 px-2 font-medium text-text-muted">Null %</th>
                <th className="text-right py-2 px-2 font-medium text-text-muted">Unique</th>
                <th className="text-center py-2 px-2 font-medium text-text-muted">Health</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.name} className="border-b border-border" title={colDescription(c.name)}>
                  <td className="py-1.5 px-2 font-medium">
                    <span>{colLabel(c.name)}</span>
                    {colUnit(c.name) && <span className="text-text-muted ml-1">({colUnit(c.name)})</span>}
                  </td>
                  <td className="py-1.5 px-2 text-text-muted">{c.dtype}</td>
                  <td className="py-1.5 px-2 text-right">{c.nulls}</td>
                  <td className="py-1.5 px-2 text-right">{c.null_pct}%</td>
                  <td className="py-1.5 px-2 text-right">{c.unique}</td>
                  <td className="py-1.5 px-2 text-center">
                    {c.null_pct === 0 ? (
                      <CheckCircle size={14} className="text-success inline" />
                    ) : c.null_pct < 10 ? (
                      <AlertTriangle size={14} className="text-accent inline" />
                    ) : (
                      <XCircle size={14} className="text-error inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
