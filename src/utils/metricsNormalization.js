function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

// Accuracy is expected as a ratio in [0, 1].
// Legacy/bad rows may store percentages (e.g. 83) or larger invalid values.
export function normalizeAccuracy(value) {
  let accuracy = toNumber(value, 0)
  if (accuracy > 1 && accuracy <= 100) accuracy /= 100
  return Math.max(0, Math.min(1, accuracy))
}

export function normalizeSeries(values = []) {
  if (!Array.isArray(values)) return []
  return values.map((value) => normalizeAccuracy(value))
}

export function normalizeScore(value) {
  const score = Math.round(toNumber(value, 0))
  return Math.max(-500, Math.min(3000, score))
}
