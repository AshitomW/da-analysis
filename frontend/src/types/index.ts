export interface DataStatus {
  loaded: boolean
  filename: string | null
  rows: number
  columns: number
  column_names: string[]
  dtypes: Record<string, string>
  null_counts: Record<string, number>
  null_pct: number
}

export interface ColumnInfo {
  name: string
  dtype: string
  nulls: number
  null_pct: number
  unique: number
  min?: number | null
  max?: number | null
  mean?: number | null
  median?: number | null
  std?: number | null
  top_values?: Record<string, number>
}

export interface Summary {
  total_rows: number
  total_columns: number
  numeric_columns: number
  categorical_columns: number
  total_nulls: number
  null_pct: number
  memory_mb: number
  numeric_cols: string[]
  categorical_cols: string[]
}

export interface Distribution {
  column: string
  distribution: { value: string; count: number }[]
}

export interface ModelInfo {
  name: string
  description: string
  category: string
  default_params: Record<string, unknown>
}

export interface TrainResult {
  model_name: string
  category: string
  feature_cols: string[]
  train_size: number
  test_size: number
  train_metrics: Record<string, number>
  test_metrics: Record<string, number>
  training_time: number
  cv_scores: number[]
  actual_vs_predicted: { actual: number[]; predicted: number[] }
  feature_importance?: { names: string[]; values: number[] }
  history?: Record<string, number[]>
}

export interface NNBuildResult {
  status: string
  input_shape: number
  total_params: number
  layers: { name: string; type: string; output_shape: string; params: number }[]
  train_size: number
  test_size: number
}

export interface NNTrainResult {
  status: string
  train_metrics: Record<string, number>
  test_metrics: Record<string, number>
  history: Record<string, number[]>
  total_params: number
  train_size: number
  test_size: number
  layer_details: { name: string; type: string; output_shape: string; params: number }[]
}

export interface BoxPlotGroup {
  group: string
  q1: number
  q2: number
  q3: number
  whisker_low: number
  whisker_high: number
  outliers: number[]
  count: number
}

export interface BoxPlotData {
  column: string
  group: string
  groups: BoxPlotGroup[]
}

export interface ScatterPoint {
  x: number
  y: number
  color?: string
}

export interface ScatterData {
  x: string
  y: string
  color: string | null
  points: ScatterPoint[]
}

export interface DensityGroup {
  group: string
  x: number[]
  density: number[]
  count: number
}

export interface DensityData {
  column: string
  group: string
  groups: DensityGroup[]
}

export interface ParallelCoordRow {
  [key: string]: number | string | undefined
}

export interface ParallelCoordData {
  dimensions: string[]
  data: ParallelCoordRow[]
}

export interface RadarGroup {
  group: string
  [metric: string]: number | string | undefined
}

export interface RadarData {
  group: string
  metrics: string[]
  groups: RadarGroup[]
}
