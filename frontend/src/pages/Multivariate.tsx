import { useEffect, useState, useRef } from 'react'
import Plot from 'react-plotly.js'
import { api } from '../api/client'
import { colLabel } from '../utils/columns'
import { Skeleton } from '../components/Skeleton'
import {
  ScatterChart, Box, Activity,
  Grid3X3, Check, ChevronDown,
} from 'lucide-react'

const NUMERIC_COLS = [
  'funding_usd', 'investment_roi', 'population_served', 'citation_count',
  'impact_score', 'innovation_index', 'model_performance_value',
  'co2_reduction_tons', 'water_savings_liters', 'energy_savings_kwh',
  'renewable_energy_share_pct', 'venue_h_index', 'patent_family_size',
  'policy_stringency_score',
]

const CATEGORICAL_COLS = [
  'ai_technique', 'region', 'sector', 'deployment_scale', 'water_stress_level',
  'climate_zone', 'entry_type', 'status', 'nexus_focus', 'collaboration_type',
  'sdg_alignment',
]

const COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4F46E5',
  '#0D9488', '#BE123C', '#52525B', '#A21CAF', '#15803D',
]

export default function Multivariate() {
  const [activeTab, setActiveTab] = useState('scatter')
  const [summary, setSummary] = useState<any>(null)
  const [corr, setCorr] = useState<any>(null)

  useEffect(() => {
    api.get<any>('/analysis/summary').then(setSummary)
    api.get<any>('/analysis/correlation').then(setCorr)
  }, [])

  const tabs = [
    { id: 'scatter', label: 'Scatter', icon: ScatterChart },
    { id: 'box', label: 'Box Plots', icon: Box },
    { id: 'violin', label: 'Violin Plots', icon: Activity },
    { id: 'heatmap', label: 'Heatmap', icon: Grid3X3 },
  ]

  const [nCols, setNCols] = useState<string[]>([...NUMERIC_COLS])
  const [cCols, setCCols] = useState<string[]>([...CATEGORICAL_COLS])
  useEffect(() => {
    if (summary) {
      setNCols(summary.numeric_cols || NUMERIC_COLS)
      setCCols(summary.categorical_cols || CATEGORICAL_COLS)
    }
  }, [summary])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-text-primary">Multivariate Analysis</h1>
      </div>

      <div className="flex gap-0.5 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-all duration-150 border-b-2 ${
              activeTab === t.id
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'scatter' && <ScatterTab nCols={nCols} cCols={cCols} />}
      {activeTab === 'box' && <BoxTab nCols={nCols} cCols={cCols} />}
      {activeTab === 'violin' && <ViolinTab nCols={nCols} cCols={cCols} />}
      {activeTab === 'heatmap' && <HeatmapTab corr={corr} />}
    </div>
  )
}

/* ── Shared axis / chart-kind selector ────────────────────────── */

function AxisSelector({
  xCol, setXCol, yCol, setYCol, colorCol, setColorCol,
  nCols, cCols, chartKind, setChartKind, chartKindOptions,
}: {
  xCol: string; setXCol: (v: string) => void
  yCol: string; setYCol: (v: string) => void
  colorCol: string; setColorCol: (v: string) => void
  nCols: string[]; cCols: string[]
  chartKind: string; setChartKind: (v: string) => void
  chartKindOptions: string[]
}) {
  return (
    <div className="lifted p-3 flex flex-wrap items-end gap-x-4 gap-y-2">
      <CompactSelect label="X Axis" value={xCol} onChange={setXCol} options={nCols} />
      <CompactSelect label="Y Axis" value={yCol} onChange={setYCol} options={nCols} />
      <CompactSelect label="Color" value={colorCol} onChange={setColorCol} options={cCols} />
      <CompactSelect label="Kind" value={chartKind} onChange={setChartKind} options={chartKindOptions} />
    </div>
  )
}

function GroupSelect({
  col, setCol, group, setGroup, nCols, cCols,
}: {
  col: string; setCol: (v: string) => void
  group: string; setGroup: (v: string) => void
  nCols: string[]; cCols: string[]
}) {
  return (
    <div className="lifted p-3 flex flex-wrap items-end gap-x-4 gap-y-2">
      <CompactSelect label="Numeric" value={col} onChange={setCol} options={nCols} />
      <CompactSelect label="Group By" value={group} onChange={setGroup} options={cCols} />
    </div>
  )
}

function CompactSelect({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-text-muted whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-bg border border-border rounded px-2 py-1 text-xs text-text-primary max-w-[150px]"
      >
        {options.map((o) => (
          <option key={o} value={o}>{colLabel(o)}</option>
        ))}
      </select>
    </div>
  )
}

function MultiSelect({
  label, selected, onChange, options, minCount = 2,
}: {
  label: string
  selected: string[]
  onChange: (v: string[]) => void
  options: string[]
  minCount?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt]
    if (next.length >= minCount) onChange(next)
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-text-muted whitespace-nowrap">{label}</span>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 bg-bg border border-border rounded px-2 py-1 text-xs text-text-primary min-w-[140px]"
        >
          <span className="flex-1 text-left">{selected.length} selected</span>
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 bg-surface border border-border rounded shadow-lg p-1 min-w-[180px] max-h-60 overflow-y-auto">
          {options.map((opt) => {
            const sel = selected.includes(opt)
            return (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-text-primary hover:bg-bg rounded"
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${sel ? 'bg-accent border-accent' : 'border-border'}`}>
                  {sel && <Check size={10} className="text-white" />}
                </div>
                {colLabel(opt)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Scatter / Bubble ─────────────────────────────────────────── */

function ScatterTab({ nCols, cCols }: { nCols: string[]; cCols: string[] }) {
  const [xCol, setXCol] = useState('funding_usd')
  const [yCol, setYCol] = useState('impact_score')
  const [colorCol, setColorCol] = useState('region')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [chartKind, setChartKind] = useState('Scatter')
  const chartKindOptions = ['Scatter', 'Bubble']

  useEffect(() => {
    setLoading(true)
    api.get<any>(`/analysis/scatter?x=${xCol}&y=${yCol}&color=${colorCol}&limit=2000`)
      .then(setData).catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [xCol, yCol, colorCol])

  if (loading) return <Skeleton className="h-[500px] w-full" />
  if (!data?.points?.length) return <div className="py-12 text-center text-sm text-text-muted">No data</div>

  const colorGroups = [...new Set(data.points.map((p: any) => p.color))].filter(Boolean) as string[]
  const traces = colorGroups.map((g, i) => ({
    x: data.points.filter((p: any) => p.color === g).map((p: any) => p.x),
    y: data.points.filter((p: any) => p.color === g).map((p: any) => p.y),
    mode: 'markers',
    type: 'scatter' as const,
    name: g,
    marker: {
      color: COLORS[i % COLORS.length],
      size: chartKind === 'Bubble' ? 10 : 6,
      sizemode: chartKind === 'Bubble' ? 'area' : undefined,
      sizeref: chartKind === 'Bubble' ? 0.1 : undefined,
      sizemin: chartKind === 'Bubble' ? 3 : undefined,
      opacity: 0.7,
    },
    hovertemplate: `${colLabel(xCol)}: %{x}<br>${colLabel(yCol)}: %{y}<br>${colLabel(colorCol)}: ${g}<extra></extra>`,
  }))

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
        This scatter plot displays the relationship between two numeric columns. Each point represents a project in the database. You can spot patterns or correlations by looking at the trend of the dots, while the colors represent the categorical groups to show how different regions or sectors are distributed.
      </p>
      <AxisSelector
        xCol={xCol} setXCol={setXCol}
        yCol={yCol} setYCol={setYCol}
        colorCol={colorCol} setColorCol={setColorCol}
        nCols={nCols} cCols={cCols}
        chartKind={chartKind} setChartKind={setChartKind}
        chartKindOptions={chartKindOptions}
      />
      <div className="lifted p-4" style={{ height: 500 }}>
        <Plot
          data={traces}
          layout={{
            autosize: true,
            height: 460,
            margin: { l: 60, r: 20, b: 60, t: 20, pad: 4 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { size: 11, color: '#6B7280' },
            xaxis: { title: colLabel(xCol), gridcolor: '#E5E7EB' },
            yaxis: { title: colLabel(yCol), gridcolor: '#E5E7EB' },
            hovermode: 'closest',
            showlegend: true,
            legend: { orientation: 'h', y: 1.08, x: 0, font: { size: 10 } },
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

/* ── Box Plots ────────────────────────────────────────────────── */

function BoxTab({ nCols, cCols }: { nCols: string[]; cCols: string[] }) {
  const [col, setCol] = useState('funding_usd')
  const [group, setGroup] = useState('deployment_scale')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get<any>(`/analysis/boxplot?column=${col}&group=${group}&top_k=12`)
      .then(setData).catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [col, group])

  if (loading) return <Skeleton className="h-[500px] w-full" />
  if (!data?.groups?.length) return <div className="py-12 text-center text-sm text-text-muted">No data</div>

  const traces: any[] = data.groups.map((g: any, i: number) => ({
    type: 'box',
    y: [g.q1, g.q2, g.q3, g.whisker_low, g.whisker_high],
    name: g.group,
    q1: [g.q1],
    median: [g.q2],
    q3: [g.q3],
    lowerfence: [g.whisker_low],
    upperfence: [g.whisker_high],
    boxpoints: 'outliers',
    marker: { color: COLORS[i % COLORS.length] },
    hovertemplate: `%{y0}<br>Min: %{lowerfence}<br>Q1: %{q1}<br>Median: %{median}<br>Q3: %{q3}<br>Max: %{upperfence}<br>N: ${g.count}<extra></extra>`,
    orientation: 'v',
  }))

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
        This box plot shows the distribution of your selected numeric column split by categories. It helps you compare groups side-by-side by looking at the median, the middle fifty percent range (indicated by the box bounds), the general range of typical values (indicated by the vertical whiskers), and any extreme anomalies plotted as individual outlier points.
      </p>
      <GroupSelect col={col} setCol={setCol} group={group} setGroup={setGroup} nCols={nCols} cCols={cCols} />
      <div className="lifted p-4 overflow-x-auto" style={{ height: 500 }}>
        <Plot
          data={traces}
          layout={{
            autosize: true,
            height: 460,
            margin: { l: 120, r: 20, b: 80, t: 20, pad: 4 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { size: 11, color: '#6B7280' },
            xaxis: { title: colLabel(group), gridcolor: '#E5E7EB' },
            yaxis: { title: colLabel(col), gridcolor: '#E5E7EB' },
            hovermode: 'closest',
            showlegend: false,
            boxmode: 'group',
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler
          style={{ minWidth: '800px', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

/* ── Violin Plots ─────────────────────────────────────────────── */

function ViolinTab({ nCols, cCols }: { nCols: string[]; cCols: string[] }) {
  const [col, setCol] = useState('co2_reduction_tons')
  const [group, setGroup] = useState('sector')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get<any>(`/analysis/density?column=${col}&group=${group}&top_k=6&grid_size=100`)
      .then(setData).catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [col, group])

  if (loading) return <Skeleton className="h-[500px] w-full" />
  if (!data?.groups?.length) return <div className="py-12 text-center text-sm text-text-muted">No data</div>

  const traces: any[] = data.groups.map((g: any, i: number) => ({
    type: 'violin',
    x: g.density.map(() => g.group),
    y: g.x,
    name: g.group,
    side: 'positive',
    line: { color: COLORS[i % COLORS.length] },
    meanline: { visible: true },
    points: false,
    bandwidth: 0,
    scalemode: 'count',
    hovertemplate: `%{x}<br>Value: %{y:.2f}<br>Density: %{customdata:.4f}<extra></extra>`,
    customdata: g.density,
  }))

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
        This violin plot shows the probability density of your chosen numerical column across the selected categories. Unlike a standard box plot, it displays the actual shape of the data distribution, which helps you see if projects are clustered around multiple peaks, if the data is skewed toward higher or lower values, and how wide the overall spread of values is.
      </p>
      <GroupSelect col={col} setCol={setCol} group={group} setGroup={setGroup} nCols={nCols} cCols={cCols} />
      <div className="lifted p-4 overflow-x-auto" style={{ height: 500 }}>
        <Plot
          data={traces}
          layout={{
            autosize: true,
            height: 460,
            margin: { l: 60, r: 20, b: 80, t: 20, pad: 4 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { size: 11, color: '#6B7280' },
            xaxis: { title: colLabel(group), gridcolor: '#E5E7EB' },
            yaxis: { title: colLabel(col), gridcolor: '#E5E7EB' },
            hovermode: 'closest',
            showlegend: false,
            violingap: 0.4,
            violinmode: 'group',
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler
          style={{ minWidth: '800px', width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

/* ── Heatmap ──────────────────────────────────────────────────── */

function HeatmapTab({ corr }: { corr: any }) {
  const [dataReady, setDataReady] = useState(false)
  const [matrix, setMatrix] = useState<number[][]>([])
  const [labels, setLabels] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!corr?.columns?.length || !corr?.correlation?.length) {
      if (corr !== null) setError('No correlation data available')
      return
    }
    try {
      const cols = corr.columns
      const m: number[][] = cols.map(() => cols.map(() => NaN))
      for (const c of corr.correlation) {
        const i = cols.indexOf(c.x)
        const j = cols.indexOf(c.y)
        if (i >= 0 && j >= 0) {
          m[i][j] = c.value
          m[j][i] = c.value
        }
      }
      for (let k = 0; k < cols.length; k++) m[k][k] = 1
      setMatrix(m)
      setLabels(cols.map(colLabel))
      setDataReady(true)
    } catch (e) {
      setError('Failed to build heatmap')
    }
  }, [corr])

  if (!corr) return <Skeleton className="h-[500px] w-full" />
  if (error) return <div className="py-12 text-center text-sm text-text-muted">{error}</div>
  if (!dataReady) return <Skeleton className="h-[500px] w-full" />

  const dims = labels.length
  const trace = {
    z: matrix,
    x: labels,
    y: labels,
    type: 'heatmap' as const,
    colorscale: [
      [0, '#DC2626'],
      [0.25, '#FCA5A5'],
      [0.45, '#FEF3C7'],
      [0.55, '#DCFCE7'],
      [0.75, '#86EFAC'],
      [1, '#16A34A'],
    ] as [number, string][],
    zmin: -1,
    zmax: 1,
    text: matrix.map((row) => row.map((v) => (v == null || isNaN(v) ? '' : v.toFixed(3)))),
    texttemplate: '%{text}',
    textfont: { size: Math.min(9, Math.max(7, 180 / dims)), color: '#1F2937' },
    hovertemplate: '%{x} vs %{y}<br>Correlation: %{z:.3f}<extra></extra>',
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted p-3 surface rounded-md leading-relaxed">
        Correlation matrix heatmap. Red = negative correlation, green = positive. Hover for exact values.
      </p>
      <div className="lifted p-4" style={{ height: Math.max(400, dims * 40 + 80) }}>
        <Plot
          data={[trace]}
          layout={{
            autosize: true,
            height: Math.max(360, dims * 40),
            margin: { l: dims * 9, r: 20, b: dims * 9, t: 20, pad: 4 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { size: Math.min(11, Math.max(8, 180 / dims)), color: '#6B7280' },
            xaxis: { tickangle: 45, side: 'bottom', automargin: true },
            yaxis: { autorange: 'reversed', automargin: true },
          }}
          config={{ responsive: true, displayModeBar: false }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}


