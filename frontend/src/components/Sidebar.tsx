import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../api/client'
import {
  LayoutDashboard, Table, BarChart3, Brain,
  FlaskConical, Sparkles, Droplets, Database
} from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/explore', label: 'Explore', icon: Table },
  { to: '/quality', label: 'Quality', icon: FlaskConical },
  { to: '/clean', label: 'Clean', icon: Sparkles },
  { to: '/analyze', label: 'Analyze', icon: BarChart3 },
  { to: '/ml-models', label: 'ML Models', icon: Brain },
]

export default function Sidebar() {
  const [activeDataset, setActiveDataset] = useState<string>('original')

  useEffect(() => {
    api.get<{ active_dataset: string }>('/data/status')
      .then((res) => {
        if (res?.active_dataset) {
          setActiveDataset(res.active_dataset)
        }
      })
      .catch(() => {})
  }, [])

  const handleDatasetChange = (val: string) => {
    setActiveDataset(val)
    api.post('/data/set-active', { dataset: val })
      .then(() => {
        window.location.reload()
      })
      .catch((err) => {
        console.error("Failed to change dataset", err)
      })
  }

  return (
    <aside className="w-56 flex-shrink-0 border-r border-border bg-bg flex flex-col h-screen">
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center">
            <Droplets size={16} className="text-white" />
          </div>
          <div>
            <span className="font-medium text-sm text-text-primary block leading-tight">Nexus</span>
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-label">Dashboard</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-surface text-text-primary font-medium'
                  : 'text-text-muted hover:bg-surface hover:text-text-primary'
              }`
            }
          >
            <l.icon size={16} className="text-text-muted" />
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-border space-y-2">
        <label className="text-[10px] font-semibold text-text-muted uppercase tracking-label flex items-center gap-1.5">
          <Database size={11} /> Dataset
        </label>
        <select
          value={activeDataset}
          onChange={(e) => handleDatasetChange(e.target.value)}
          className="w-full text-xs bg-surface border border-border rounded px-2.5 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
        >
          <option value="original">Original (Raw)</option>
          <option value="cleaned">Cleaned (Filtered)</option>
          <option value="extended">Extended (Synthetic)</option>
        </select>
      </div>
      <div className="px-5 py-3 border-t border-border">
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-label">Nexus v1.0</span>
      </div>
    </aside>
  )
}
