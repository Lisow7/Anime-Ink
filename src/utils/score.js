export function scoreColor(score) {
  if (score >= 7.5) return 'text-[#22c55e]'
  if (score >= 6)   return 'text-[#f59e0b]'
  return 'text-[#e63946]'
}
