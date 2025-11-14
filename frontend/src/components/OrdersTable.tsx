import { motion } from 'framer-motion';
import { format } from 'date-fns';
import type { Order } from '../types';
import './OrdersTable.css';

interface OrdersTableProps {
  orders: Order[];
}

export const OrdersTable = ({ orders }: OrdersTableProps) => {
  const formatPrice = (price?: number) =>
    price ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';

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

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'status-filled';
      case 'PARTIALLY_FILLED':
        return 'status-partial';
      case 'CANCELED':
        return 'status-canceled';
      case 'REJECTED':
        return 'status-rejected';
      default:
        return 'status-new';
    }
  };

  const getRiskStatusClass = (riskPassed?: boolean) => {
    if (riskPassed === undefined || riskPassed === null) return 'risk-unknown';
    return riskPassed ? 'risk-passed' : 'risk-failed';
  };

  const getRiskStatusText = (riskPassed?: boolean) => {
    if (riskPassed === undefined || riskPassed === null) return 'N/A';
    return riskPassed ? 'PASSED' : 'FAILED';
  };

  return (
    <div className="orders-table-container">
      <table className="orders-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Strategy</th>
            <th>Side</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>Avg Price</th>
            <th>Status</th>
            <th>Risk</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {orders.slice(0, 10).map((order, index) => (
            <motion.tr
              key={order.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <td className="symbol-cell">{order.symbol}</td>
              <td className="strategy-cell">
                {order.strategy_name || <span className="no-strategy">N/A</span>}
              </td>
              <td>
                <span className={`side-badge ${order.side.toLowerCase()}`}>
                  {order.side}
                </span>
              </td>
              <td className="type-cell">{order.type}</td>
              <td className="quantity-cell">
                {order.filled_quantity || order.quantity}{' '}
                {order.symbol.replace(/USDT|BUSD/, '')}
              </td>
              <td className="price-cell">
                {formatPrice(order.avg_fill_price || order.price)}
              </td>
              <td>
                <span className={`status-badge ${getStatusClass(order.status)}`}>
                  {order.status}
                </span>
              </td>
              <td>
                <span className={`risk-badge ${getRiskStatusClass(order.risk_passed)}`}>
                  {getRiskStatusText(order.risk_passed)}
                </span>
              </td>
              <td className="time-cell">{formatTime(order.created_at)}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <div className="empty-state">
          <p>No orders</p>
        </div>
      )}
    </div>
  );
};
