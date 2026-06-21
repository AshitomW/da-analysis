const EXCLUDED_FROM_TRAINING = new Set([
  'entry_id',          // unique row identifier (10,800 unique)
  'title',             // free text (9,254 unique)
  'abstract_summary',  // free text (10,796 unique)
  'keywords',          // free text (10,800 unique, every row unique)
  'language',          // publication metadata, not a predictive feature
  'dataset_used',      // dataset reference metadata, not a predictor
  'publication_venue', // publication venue name, high cardinality metadata
])

export function isTrainable(col: string, dtypes?: Record<string, string>): boolean {
  if (EXCLUDED_FROM_TRAINING.has(col)) return false
  return true
}

export interface ColumnMeta {
  label: string
  unit?: string
  description: string
}

export const COLUMN_META: Record<string, ColumnMeta> = {
  entry_id: { label: 'Entry ID', description: 'Unique identifier for each entry' },
  entry_type: { label: 'Entry Type', description: 'Type of entry (project, research, policy)' },
  year: { label: 'Year', description: 'Year of the entry' },
  month: { label: 'Month', description: 'Month of the entry' },
  quarter: { label: 'Quarter', description: 'Quarter of the year' },
  title: { label: 'Title', description: 'Title of the project or research' },
  abstract_summary: { label: 'Abstract', description: 'Summary of the entry' },
  keywords: { label: 'Keywords', description: 'Associated keywords' },
  country: { label: 'Country', description: 'Country of implementation' },
  region: { label: 'Region', description: 'Geographic region' },
  climate_zone: { label: 'Climate Zone', description: 'Climate classification' },
  water_stress_level: { label: 'Water Stress Level', description: 'Level of water stress in the region' },
  organization: { label: 'Organization', description: 'Implementing organization' },
  collaboration_type: { label: 'Collaboration Type', description: 'Type of collaboration' },
  sector: { label: 'Sector', description: 'Industry sector' },
  ai_technique: { label: 'AI Technique', description: 'Primary AI technique used' },
  water_application: { label: 'Water Application', description: 'Specific water-related application' },
  energy_application: { label: 'Energy Application', description: 'Specific energy-related application' },
  nexus_focus: { label: 'Nexus Focus', description: 'Water-Energy nexus focus area' },
  deployment_scale: { label: 'Deployment Scale', description: 'Scale of deployment' },
  status: { label: 'Status', description: 'Project status' },
  sdg_alignment: { label: 'SDG Alignment', description: 'UN Sustainable Development Goals alignment' },
  funding_usd: { label: 'Funding', unit: 'USD', description: 'Total funding in US dollars' },
  investment_roi: { label: 'Investment ROI', unit: '%', description: 'Return on investment percentage' },
  population_served: { label: 'Population Served', description: 'Number of people served' },
  citation_count: { label: 'Citations', description: 'Number of academic citations' },
  impact_score: { label: 'Impact Score', unit: 'score', description: 'Overall impact assessment score' },
  innovation_index: { label: 'Innovation Index', unit: 'index', description: 'Innovation level index' },
  model_performance_metric: { label: 'Model Performance Metric', description: 'Type of performance metric used' },
  model_performance_value: { label: 'Model Performance', unit: 'value', description: 'Model performance value' },
  co2_reduction_tons: { label: 'CO₂ Reduction', unit: 'tons', description: 'CO₂ reduction in metric tons' },
  water_savings_liters: { label: 'Water Savings', unit: 'liters', description: 'Water saved in liters' },
  energy_savings_kwh: { label: 'Energy Savings', unit: 'kWh', description: 'Energy saved in kilowatt-hours' },
  renewable_energy_share_pct: { label: 'Renewable Energy Share', unit: '%', description: 'Share of renewable energy used' },
  publication_venue: { label: 'Publication Venue', description: 'Academic publication venue' },
  open_access: { label: 'Open Access', unit: 'flag', description: 'Whether the publication is open access' },
  venue_h_index: { label: 'Venue H-Index', description: 'H-index of the publication venue' },
  patent_class: { label: 'Patent Class', description: 'Patent classification code' },
  patent_family_size: { label: 'Patent Family Size', description: 'Size of the patent family' },
  policy_type: { label: 'Policy Type', description: 'Type of policy' },
  policy_level: { label: 'Policy Level', description: 'Level of policy implementation' },
  policy_stringency_score: { label: 'Policy Stringency', unit: 'score', description: 'Stringency score of the policy' },
  dataset_used: { label: 'Dataset Used', description: 'Dataset used in the entry' },
  language: { label: 'Language', description: 'Language of the entry' },
}

export function colLabel(col: string): string {
  return COLUMN_META[col]?.label || col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function colUnit(col: string): string | undefined {
  return COLUMN_META[col]?.unit
}

export function colDescription(col: string): string {
  return COLUMN_META[col]?.description || ''
}
