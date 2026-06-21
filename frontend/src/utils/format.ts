export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '-'

  if (Math.abs(n) >= 1_000_000_000) {
    return (n / 1_000_000_000).toFixed(1) + 'B'
  }
  if (Math.abs(n) >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + 'M'
  }
  if (Math.abs(n) >= 1_000) {
    return (n / 1_000).toFixed(1) + 'K'
  }
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toFixed(4)
}
