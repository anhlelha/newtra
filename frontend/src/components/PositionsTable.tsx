import { motion } from 'framer-motion';
import { format } from 'date-fns';
import type { Position } from '../types';
import './PositionsTable.css';

interface PositionsTableProps {
  positions: Position[];
  onClose?: (positionId: string) => void;
  closingPositionId?: string | null;
}

export const PositionsTable = ({ positions, onClose, closingPositionId }: PositionsTableProps) => {
  const formatPrice = (price: number) => `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPnL = (pnl: number, percent?: number) => {
    const sign = pnl >= 0 ? '+' : '';
    const percentStr = percent !== undefined ? ` (${sign}${percent.toFixed(2)}%)` : '';
    return `${sign}${formatPrice(pnl)}${percentStr}`;
  };

  const formatTime = (dateString: string) => {
    try {
      // Convert to GMT+7 (Vietnam timezone)
      const date = new Date(dateString);
      const gmt7Date = new Date(date.getTime() + (7 * 60 * 60 * 1000));
      return format(gmt7Date, 'HH:mm:ss');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="positions-table-container">
      <table className="positions-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Trading</th>
            <th>Leverage</th>
            <th>Entry Price</th>
            <th>Liquidation</th>
            <th>Current Price</th>
            <th>Quantity</th>
            <th>P&L</th>
            <th>Time</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position, index) => {
            const pnlPercent = position.currentPrice
              ? ((position.currentPrice - position.entry_price) / position.entry_price) * 100 * (position.side === 'LONG' ? 1 : -1)
              : 0;

            return (
              <motion.tr
                key={position.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <td className="symbol-cell">{position.symbol}</td>
                <td>
                  <span className={`side-badge ${position.side.toLowerCase()}`}>
                    {position.side}
                  </span>
                </td>
                <td>
                  <span className={`trading-badge ${position.trading_type === 'FUTURE' ? 'future' : 'spot'}`}>
                    {position.trading_type || 'SPOT'}
                  </span>
                </td>
                <td>
                  {position.trading_type === 'FUTURE' && position.leverage ? `${position.leverage}x` : '-'}
                </td>
                <td>{formatPrice(position.entry_price)}</td>
                <td>
                  {position.trading_type === 'FUTURE' && position.liquidation_price
                    ? formatPrice(position.liquidation_price)
                    : '-'}
                </td>
                <td>{position.currentPrice ? formatPrice(position.currentPrice) : '-'}</td>
                <td>
                  {position.quantity} {position.symbol.replace(/USDT|BUSD/, '')}
                </td>
                <td className={position.unrealizedPnL && position.unrealizedPnL >= 0 ? 'pnl-positive' : 'pnl-negative'}>
                  {position.unrealizedPnL !== undefined
                    ? formatPnL(position.unrealizedPnL, pnlPercent)
                    : '-'}
                </td>
                <td className="time-cell">{formatTime(position.opened_at)}</td>
                <td>
                  {onClose && (
                    <button
                      className="action-button"
                      onClick={() => onClose(position.id)}
                      disabled={closingPositionId === position.id}
                    >
                      {closingPositionId === position.id ? 'CLOSING...' : 'CLOSE'}
                    </button>
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
      {positions.length === 0 && (
        <div className="empty-state">
          <p>No open positions</p>
        </div>
      )}
    </div>
  );
};
