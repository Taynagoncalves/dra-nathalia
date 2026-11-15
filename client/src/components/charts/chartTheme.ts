/**
 * Cores dos gráficos (Recharts) ligadas às variáveis CSS do tema.
 * Como são `var(--…)`, os gráficos trocam de cor sozinhos junto com o tema.
 */
export const chartColors = {
  /** série principal: roxo no claro, rosa no escuro */
  primary: 'var(--chart-1)',
  series: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'],
  success: 'var(--success)',
  error: 'var(--error)',
  axis: 'var(--text-muted)',
  grid: 'var(--border)',
} as const;

/** Props comuns de eixo: <XAxis {...axisProps} /> */
export const axisProps = {
  stroke: 'var(--border)',
  tick: { fill: 'var(--text-muted)', fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

/** Props comuns de grade: <CartesianGrid {...gridProps} /> */
export const gridProps = {
  stroke: 'var(--border)',
  strokeDasharray: '3 3',
  vertical: false,
} as const;

/** Props do tooltip: <Tooltip {...tooltipProps} /> */
export const tooltipProps = {
  contentStyle: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    color: 'var(--text)',
    boxShadow: 'var(--shadow)',
    fontSize: 13,
  },
  labelStyle: { color: 'var(--text)', fontWeight: 600 },
  itemStyle: { color: 'var(--text)' },
  cursor: { fill: 'var(--primary-soft)' },
} as const;
