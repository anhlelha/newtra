import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './PnLChart.css';

// Mock data - will be replaced with real data from API
const generateMockData = () => {
  const data = [];
  let value = 24000;
  for (let i = 0; i < 24; i++) {
    value += (Math.random() - 0.4) * 500;
    data.push({
      time: `${i.toString().padStart(2, '0')}:00`,
      value: Math.max(value, 23000),
    });
  }
  return data;
};

export const PnLChart = () => {
  const data = generateMockData();

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.8} />
              <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity={0.8} />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 146, 168, 0.1)" />
          <XAxis
            dataKey="time"
            stroke="var(--text-muted)"
            style={{ fontSize: '0.75rem' }}
          />
          <YAxis
            stroke="var(--text-muted)"
            style={{ fontSize: '0.75rem' }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(19, 24, 35, 0.95)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Balance']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="url(#lineGradient)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: 'var(--accent-primary)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
