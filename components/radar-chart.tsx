type RadarPoint = { label: string; value: number }

type Props = {
  data: RadarPoint[]
  size?: number
  maxValue?: number
}

export function RadarChart({ data, size = 260, maxValue = 100 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 40
  const n = data.length

  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const point = (i: number, r: number) => [
    cx + r * Math.cos(angleFor(i)),
    cy + r * Math.sin(angleFor(i)),
  ]

  const grid = [0.25, 0.5, 0.75, 1].map((scale) =>
    data
      .map((_, i) => point(i, radius * scale).join(','))
      .join(' '),
  )

  const valuesPath = data
    .map((d, i) => point(i, radius * (d.value / maxValue)).join(','))
    .join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* grid pentagons */}
      {grid.map((points, idx) => (
        <polygon
          key={idx}
          points={points}
          fill="none"
          stroke="hsl(var(--outline-variant))"
          strokeWidth="1"
        />
      ))}
      {/* axes */}
      {data.map((_, i) => {
        const [x, y] = point(i, radius)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="hsl(var(--outline-variant))"
            strokeWidth="1"
          />
        )
      })}
      {/* value polygon */}
      <polygon
        points={valuesPath}
        fill="hsl(var(--foreground) / 0.08)"
        stroke="hsl(var(--foreground))"
        strokeWidth="1.5"
      />
      {/* labels */}
      {data.map((d, i) => {
        const [x, y] = point(i, radius + 20)
        return (
          <text
            key={d.label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fill="hsl(var(--foreground-variant))"
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}
