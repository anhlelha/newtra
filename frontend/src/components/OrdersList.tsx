import { motion } from 'framer-motion';
import { format } from 'date-fns';
import type { Order } from '../types';
import './OrdersList.css';

interface OrdersListProps {
  orders: Order[];
}

export const OrdersList = ({ orders }: OrdersListProps) => {
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
    <div className="orders-list">
      {orders.slice(0, 4).map((order, index) => (
        <motion.div
          key={order.id}
          className="order-item"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.05 }}
        >
          <div className="order-info">
            <div className="order-symbol">{order.symbol}</div>
            <div className="order-details">
              {order.side} • {order.type} • {order.quantity}{' '}
              {order.symbol.replace(/USDT|BUSD/, '')}
              {order.price && ` @ $${order.price.toLocaleString()}`}
            </div>
          </div>
          <div className="order-status">
            <span className="order-time">{formatTime(order.created_at)}</span>
            <span className={`status-badge-small status-${order.status.toLowerCase()}`}>
              {order.status}
            </span>
          </div>
        </motion.div>
      ))}
      {orders.length === 0 && (
        <div className="empty-state">
          <p>No recent orders</p>
        </div>
      )}
    </div>
  );
};
