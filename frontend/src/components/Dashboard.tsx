import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Background } from './Background';
import { Header } from './Header';
import { StatCard } from './StatCard';
import { Panel } from './Panel';
import { PnLChart } from './PnLChart';
import { PositionsTable } from './PositionsTable';
import { OrdersTable } from './OrdersTable';
import { TradingControls } from './TradingControls';
import {
  WalletIcon,
  TrendingUpIcon,
  TargetIcon,
  ClockIcon,
  ChartLineIcon,
  GridIcon,
  TableIcon,
  ControlIcon,
} from './icons';
import { apiClient } from '../lib/api';
import './Dashboard.css';

export const Dashboard = () => {
  const queryClient = useQueryClient();
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);

  // Fetch data with React Query
  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: apiClient.getStatus,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: () => apiClient.getPositions('OPEN'),
    refetchInterval: 5000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => apiClient.getOrders({ limit: 20 }),
    refetchInterval: 5000,
  });

  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: () => apiClient.getBalance('USDT'),
    refetchInterval: 10000,
  });

  const { data: pendingSignalsCount } = useQuery({
    queryKey: ['pendingSignalsCount'],
    queryFn: apiClient.getPendingSignalsCount,
    refetchInterval: 5000,
  });

  // Close position mutation
  const closePositionMutation = useMutation({
    mutationFn: (positionId: string) => apiClient.closePosition(positionId),
    onSuccess: () => {
      // Refresh positions and orders list
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['status'] });
      setClosingPositionId(null);
    },
    onError: (error) => {
      console.error('Failed to close position:', error);
      alert('Failed to close position: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setClosingPositionId(null);
    },
  });

  const handleClosePosition = async (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    const currentPrice = position.currentPrice || position.entry_price;
    const pnl = position.unrealizedPnL || 0;
    const pnlPercent = ((currentPrice - position.entry_price) / position.entry_price) * 100;
    const pnlSign = pnl >= 0 ? '+' : '';

    const confirmMessage = `Close Position: ${position.symbol}

Quantity: ${position.quantity} ${position.symbol.replace(/USDT|BUSD/, '')}
Entry Price: $${position.entry_price.toFixed(2)}
Current Price: $${currentPrice.toFixed(2)}
Est. P&L: ${pnlSign}$${Math.abs(pnl).toFixed(2)} (${pnlSign}${pnlPercent.toFixed(2)}%)

This will create a MARKET SELL order immediately.
Are you sure you want to close this position?`;

    if (confirm(confirmMessage)) {
      setClosingPositionId(positionId);
      closePositionMutation.mutate(positionId);
    }
  };

  const handleToggleTrading = async () => {
    try {
      await apiClient.updateConfig({
        'trading.enabled': !status?.tradingEnabled,
      });
    } catch (error) {
      console.error('Failed to toggle trading:', error);
    }
  };

  const handleEmergencyStop = async () => {
    if (confirm('Are you sure you want to emergency stop all trading?')) {
      try {
        await apiClient.updateConfig({
          'trading.enabled': false,
        });
      } catch (error) {
        console.error('Failed to emergency stop:', error);
      }
    }
  };

  // Calculate stats
  const totalBalance = balance ? parseFloat(balance.free) + parseFloat(balance.locked) : 0;
  const todayPnL = status?.todayPnL || 0;
  const openPositionsCount = positions.length;
  const totalExposure = status?.currentExposure || 0;
  const exposurePercent = totalBalance > 0 ? (totalExposure / totalBalance) * 100 : 0;

  return (
    <>
      <Background />

      <div className="dashboard-container">
        <Header tradingActive={status?.tradingEnabled || false} />

        {/* Stats Grid */}
        <div className="stats-grid">
          <StatCard
            label="Total Balance"
            value={`$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={todayPnL >= 0 ? `+${((todayPnL / totalBalance) * 100).toFixed(2)}% today` : `${((todayPnL / totalBalance) * 100).toFixed(2)}% today`}
            changeType={todayPnL >= 0 ? 'positive' : 'negative'}
            icon={<WalletIcon />}
            delay={0.1}
          />

          <StatCard
            label="Today's P&L"
            value={`${todayPnL >= 0 ? '+' : ''}$${Math.abs(todayPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change={`${orders.filter((o) => o.status === 'FILLED').length} trades executed`}
            changeType={todayPnL >= 0 ? 'positive' : 'negative'}
            icon={<TrendingUpIcon />}
            delay={0.2}
          />

          <StatCard
            label="Pending Signals"
            value={(pendingSignalsCount?.count || 0).toString()}
            change="Awaiting manual approval"
            changeType={pendingSignalsCount?.count && pendingSignalsCount.count > 0 ? 'neutral' : 'positive'}
            icon={<ClockIcon />}
            delay={0.3}
          />

          <StatCard
            label="Open Positions"
            value={openPositionsCount.toString()}
            change={
              positions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0) >= 0
                ? `+$${Math.abs(positions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0)).toFixed(2)} unrealized`
                : `-$${Math.abs(positions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0)).toFixed(2)} unrealized`
            }
            changeType={positions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0) >= 0 ? 'positive' : 'negative'}
            icon={<TargetIcon />}
            delay={0.4}
          />

          <StatCard
            label="Exposure"
            value={`${exposurePercent.toFixed(1)}%`}
            change={`$${totalExposure.toLocaleString()} / $${totalBalance.toLocaleString()}`}
            changeType="neutral"
            icon={<GridIcon />}
            delay={0.5}
          />
        </div>

        {/* Main Content Grid */}
        <div className="main-grid">
          <Panel title="Performance Chart" icon={<ChartLineIcon />} delay={0.5}>
            <PnLChart />
          </Panel>

          <Panel title="System Controls" icon={<ControlIcon />} delay={0.5}>
            <TradingControls
              tradingEnabled={status?.tradingEnabled || false}
              onToggleTrading={handleToggleTrading}
              onEmergencyStop={handleEmergencyStop}
            />
          </Panel>
        </div>

        {/* Order List */}
        <Panel
          title="Order List"
          icon={<TableIcon />}
          action={<span className="panel-meta">{orders.length} total</span>}
          delay={0.55}
        >
          <OrdersTable orders={orders} />
        </Panel>

        {/* Open Positions */}
        <Panel
          title="Open Positions"
          icon={<TableIcon />}
          action={<span className="panel-meta">{openPositionsCount} active</span>}
          delay={0.6}
        >
          <PositionsTable positions={positions} onClose={handleClosePosition} closingPositionId={closingPositionId} />
        </Panel>

        {/* Footer */}
        <footer className="dashboard-footer">
          <p>NeXTra Trading Terminal • v1.0.0 • Connected to Binance API</p>
          <p style={{ marginTop: '0.5rem', opacity: 0.5 }}>
            Risk Disclaimer: Cryptocurrency trading involves substantial risk of loss
          </p>
        </footer>
      </div>
    </>
  );
};
