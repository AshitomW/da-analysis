import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { ColumnInfo } from '../types'
import { colLabel, colUnit, colDescription } from '../utils/columns'
import { formatNumber } from '../utils/format'
import { Search, ChevronLeft, ChevronRight, Columns2, X } from 'lucide-react'
import { Skeleton } from '../components/Skeleton'

export default function DataExplorer() {
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedCol, setSelectedCol] = useState<string | null>(null)
  const [visibleCols, setVisibleCols] = useState<string[]>([])
  const [showColPicker, setShowColPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const limit = 50

  useEffect(() => {
    api.get<{ columns: ColumnInfo[] }>('/data/columns').then((r) => {
      setColumns(r.columns)
      const names = r.columns.map((c) => c.name)
      setVisibleCols(names.slice(0, 12))
    })
  }, [])

  useEffect(() => {
    api.get<any>(`/data/rows?offset=${offset}&limit=${limit}`).then((r) => {
      setRows(r.rows)
      setTotal(r.total)
      setLoading(false)
    })
  }, [offset])

  const toggleColumn = (name: string) => {
    setVisibleCols((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    )
  }

  const selectAll = () => setVisibleCols(columns.map((c) => c.name))
  const deselectAll = () => setVisibleCols([])

  const filtered = search
    ? rows.filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
      )
    : rows

  const colProfile = columns.find((c) => c.name === selectedCol)
  const displayCols = columns.filter((c) => visibleCols.includes(c.name))

  if (loading) return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-[480px]" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-64 w-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="mb-1">
        <h1>Data Explorer</h1>
        <p className="text-sm text-text-muted">
          Browse raw data from the Water-Energy Nexus dataset, consisting of {total.toLocaleString()} entries across {columns.length} columns
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-[480px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            className="input pl-8"
            placeholder="Search rows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <button className="btn-secondary" onClick={() => setShowColPicker(!showColPicker)}>
            <Columns2 size={14} /> Columns ({visibleCols.length})
          </button>
          {showColPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColPicker(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-bg border border-border rounded-lg shadow-2 max-h-80 overflow-y-auto">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-bg">
                  <span className="label">Select Columns</span>
                  <div className="flex gap-1">
                    <button className="text-[11px] text-accent hover:underline" onClick={selectAll}>All</button>
                    <span className="text-slate-300">|</span>
                    <button className="text-[11px] text-text-muted hover:underline" onClick={deselectAll}>None</button>
                  </div>
                </div>
                {columns.map((c) => (
                  <label key={c.name} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(c.name)}
                      onChange={() => toggleColumn(c.name)}
                      className="accent-accent"
                    />
                    <span className="truncate">{colLabel(c.name)}</span>
                    <span className="text-text-muted ml-auto text-[10px]">{c.dtype}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <span className="text-xs text-text-muted">{total.toLocaleString()} entries</span>
      </div>

      {visibleCols.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {displayCols.slice(0, 20).map((c) => (
            <span key={c.name} className="inline-flex items-center gap-1 text-[11px] bg-surface-alt text-text-body px-2 py-0.5 rounded-full">
              {colLabel(c.name)}
              <button onClick={() => toggleColumn(c.name)} className="hover:text-red-500"><X size={12} /></button>
            </span>
          ))}
          {visibleCols.length > 20 && (
            <span className="text-[11px] text-text-muted px-1 self-center">+{visibleCols.length - 20} more</span>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1 overflow-x-auto">
          {displayCols.length === 0 ? (
            <div className="text-center py-12 text-sm text-text-muted">Select columns to display</div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  {displayCols.map((c) => (
                    <th
                      key={c.name}
                      className="text-left py-2 px-2 font-medium text-text-muted cursor-pointer hover:text-accent truncate max-w-[140px]"
                      onClick={() => setSelectedCol(c.name)}
                      title={colDescription(c.name) || c.name}
                    >
                      {colLabel(c.name)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={i} className="border-b border-border hover:bg-surface">
                    {displayCols.map((c) => (
                      <td key={c.name} className="py-1.5 px-2 truncate max-w-[200px]" title={String(row[c.name] ?? '')}>
                        {row[c.name] !== null && row[c.name] !== undefined
                          ? typeof row[c.name] === 'number'
                            ? formatNumber(row[c.name])
                            : String(row[c.name]).slice(0, 60)
                          : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={displayCols.length} className="py-8 text-center text-text-muted">No matching rows found</td></tr>
                )}
              </tbody>
            </table>
          )}

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-text-muted">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button className="btn-ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
                <ChevronLeft size={14} /> Prev
              </button>
              <button className="btn-ghost" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {colProfile && (
          <div className="w-72 lifted p-5 space-y-3 flex-shrink-0">
            <div>
              <h3>{colLabel(colProfile.name)}</h3>
              {colUnit(colProfile.name) && <span className="text-xs text-text-muted">Unit: {colUnit(colProfile.name)}</span>}
              {colDescription(colProfile.name) && <p className="text-xs text-text-muted mt-1">{colDescription(colProfile.name)}</p>}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-text-muted">Raw Name</span><span className="text-text-muted">{colProfile.name}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Data Type</span><span>{colProfile.dtype}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Unique Values</span><span>{colProfile.unique}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Null Count</span><span>{colProfile.nulls} ({colProfile.null_pct}%)</span></div>
              {colProfile.min !== undefined && colProfile.min !== null && (
                <>
                  <div className="flex justify-between"><span className="text-text-muted">Min</span><span>{formatNumber(colProfile.min)}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Max</span><span>{formatNumber(colProfile.max)}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Mean</span><span>{formatNumber(colProfile.mean)}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Median</span><span>{formatNumber(colProfile.median)}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Std Deviation</span><span>{formatNumber(colProfile.std)}</span></div>
                </>
              )}
            </div>
            {colProfile.top_values && (
              <div>
                <span className="label">Top Values</span>
                {Object.entries(colProfile.top_values).slice(0, 5).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs mt-1">
                    <span className="truncate max-w-[160px]">{k}</span>
                    <span className="text-text-muted">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
