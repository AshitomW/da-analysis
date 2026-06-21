import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import DataExplorer from './pages/DataExplorer'
import DataQuality from './pages/DataQuality'
import Clean from './pages/Clean'
import Analyze from './pages/Analyze'
import MLModels from './pages/MLModels'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/explore" element={<DataExplorer />} />
          <Route path="/quality" element={<DataQuality />} />
          <Route path="/clean" element={<Clean />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/ml-models" element={<MLModels />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
