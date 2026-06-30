import type { SkillRatings, SkillKey } from '../../types/auth'
import { SKILL_LABELS } from '../../types/auth'

interface SkillsRadarProps {
  ratings: SkillRatings
  size?: number
}

const MAX = 5

function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

export default function SkillsRadar({ ratings, size = 280 }: SkillsRadarProps) {
  const keys = Object.keys(ratings) as SkillKey[]
  const n = keys.length
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.38
  const labelR = size * 0.48

  // Grid rings
  const rings = [1, 2, 3, 4, 5]

  function ringPoints(value: number): string {
    return keys
      .map((_, i) => {
        const angle = (360 / n) * i
        const r = (value / MAX) * maxR
        const { x, y } = polarToXY(angle, r, cx, cy)
        return `${x},${y}`
      })
      .join(' ')
  }

  // Data polygon
  const dataPoints = ringPoints(1) // placeholder shape
  const filledPoints = keys
    .map((k, i) => {
      const angle = (360 / n) * i
      const val = Math.max(0, Math.min(MAX, ratings[k] || 0))
      const r = (val / MAX) * maxR
      const { x, y } = polarToXY(angle, r, cx, cy)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {rings.map(ring => (
        <polygon
          key={ring}
          points={ringPoints(ring)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={ring === MAX ? 1.5 : 0.8}
        />
      ))}

      {/* Spokes */}
      {keys.map((_, i) => {
        const angle = (360 / n) * i
        const { x, y } = polarToXY(angle, maxR, cx, cy)
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={0.8} />
        )
      })}

      {/* Data fill */}
      <polygon
        points={filledPoints}
        fill="rgba(37,99,235,0.15)"
        stroke="#2563eb"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {keys.map((k, i) => {
        const angle = (360 / n) * i
        const val = Math.max(0, Math.min(MAX, ratings[k] || 0))
        const r = (val / MAX) * maxR
        const { x, y } = polarToXY(angle, r, cx, cy)
        return val > 0 ? (
          <circle key={k} cx={x} cy={y} r={3} fill="#2563eb" />
        ) : null
      })}

      {/* Labels */}
      {keys.map((k, i) => {
        const angle = (360 / n) * i
        const { x, y } = polarToXY(angle, labelR, cx, cy)
        const label = SKILL_LABELS[k]
        // Anchor based on position
        const anchor = x < cx - 4 ? 'end' : x > cx + 4 ? 'start' : 'middle'
        return (
          <text
            key={k}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={size > 250 ? 9 : 7.5}
            fill="#64748b"
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
          >
            {label}
          </text>
        )
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2} fill="#94a3b8" />
    </svg>
  )
}
