import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { colLabel } from '../utils/columns'
import { Trash2, Activity, Filter, ChevronRight, Database, Table, FileText } from 'lucide-react'
import { Skeleton } from '../components/Skeleton'

const OP_LABELS: Record<string, string> = {
  drop_columns: 'Drop Columns',
  fill_na_median: 'Fill Median',
  fill_na_mode: 'Fill Mode',
  remove_outliers_iqr: 'Remove Outliers',
}

const OP_ICONS: Record<string, any> = {
  drop_columns: Trash2,
  fill_na_median: Activity,
  fill_na_mode: Activity,
  remove_outliers_iqr: Filter,
}

const OP_COLORS: Record<string, string> = {
  drop_columns: 'border-red-400 bg-red-50 text-red-700',
  fill_na_median: 'border-emerald-400 bg-emerald-50 text-emerald-700',
  fill_na_mode: 'border-emerald-400 bg-emerald-50 text-emerald-700',
  remove_outliers_iqr: 'border-amber-400 bg-amber-50 text-amber-700',
}


export default function Clean() {
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ config: any }>('/clean/config').then((r) => {
      setConfig(r.config)
      setLoading(false)
    })
  }, [])

  const getCols = (step: any) => {
    const cols = step.columns || []
    if (cols === '__numeric__') return 'all numeric columns'
    if (cols === '__categorical__') return 'all categorical columns'
    if (Array.isArray(cols)) return cols.map((c: string) => colLabel(c)).join(', ')
    return ''
  }

  const getDetail = (step: any) => {
    const op = step.operation
    if (op === 'drop_columns') return getCols(step)
    if (op === 'fill_na_median') return `median → ${getCols(step)}`
    if (op === 'fill_na_mode') return `mode → ${getCols(step)}`
    if (op === 'remove_outliers_iqr') return `IQR × ${step.factor || 1.5} on ${getCols(step)}`
    return JSON.stringify(step)
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  const steps = config?.cleaning || []

  return (
    <div className="space-y-5">
      <div>
        <h1>Data Cleaning</h1>
        <p className="text-sm text-text-muted">
          Pipeline defined in <code className="text-xs bg-surface-alt px-1.5 py-0.5 rounded">cleaning_config.yaml</code>
        </p>
      </div>

      <div className="lifted p-6 space-y-4">
        <h3>Pipeline</h3>

        {steps.length === 0 ? (
          <p className="text-sm text-text-muted py-4 text-center">No steps defined.</p>
        ) : (
          <div className="relative flex items-start gap-0 overflow-x-auto py-4">
            {/* input node */}
            <div className="flex flex-col items-center flex-shrink-0 w-20">
              <div className="flex items-center justify-center w-16 h-16 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50 text-blue-600">
                <Database size={22} />
              </div>
              <span className="text-[10px] text-text-muted mt-1.5 font-medium whitespace-nowrap">Raw Data</span>
            </div>

            {steps.map((step: any, i: number) => {
              const Icon = OP_ICONS[step.operation] || FileText
              const colorClass = OP_COLORS[step.operation] || 'border-gray-300 bg-gray-50 text-gray-600'
              return (
                <div key={i} className="flex items-start flex-shrink-0">
                  <div className="flex items-center justify-center w-10 h-16">
                    <ChevronRight size={20} className="text-gray-300" />
                  </div>
                  <div className="flex flex-col items-center w-36">
                    <div className={`w-16 h-16 rounded-2xl border-2 ${colorClass} flex items-center justify-center shadow-sm`}>
                      <Icon size={24} />
                    </div>
                    <span className="text-xs font-semibold text-text-primary mt-2 text-center leading-tight">
                      {OP_LABELS[step.operation] || step.operation}
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5 text-center leading-tight">
                      {getDetail(step)}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* output node */}
            <div className="flex items-start flex-shrink-0">
              <div className="flex items-center justify-center w-10 h-16">
                <ChevronRight size={20} className="text-gray-300" />
              </div>
              <div className="flex flex-col items-center w-20">
                <div className="w-16 h-16 rounded-xl border-2 border-green-400 bg-green-50 flex items-center justify-center text-green-600">
                  <Table size={22} />
                </div>
                <span className="text-[10px] text-text-muted mt-1.5 font-medium whitespace-nowrap">Clean Data</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="lifted p-5 space-y-3">
        <h3>Config</h3>
        <div className="text-xs bg-surface-alt rounded-md p-3 font-mono text-text-muted leading-relaxed whitespace-pre overflow-x-auto">
          {`dataset: ${config?.dataset || 'original'}\n\ncleaning:`}
          {steps.map((s: any) => (
            `\n  - operation: ${s.operation}` +
            (s.columns ? `\n    columns: ${Array.isArray(s.columns) ? s.columns.join(', ') : s.columns}` : '') +
            (s.factor ? `\n    factor: ${s.factor}` : '')
          ))}
        </div>
      </div>
    </div>
  )
}
