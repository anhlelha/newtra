import { motion } from 'framer-motion';
import { format } from 'date-fns';
import './SignalsList.css';

interface Signal {
  id: string;
  action: string;
  symbol: string;
  payload: string;
  processed: boolean;
  received_at: string;
  error_message?: string;
  order_id?: string;
}

interface SignalsListProps {
  signals: Signal[];
}

export const SignalsList = ({ signals }: SignalsListProps) => {
  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm:ss');
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (signal: Signal) => {
    if (signal.error_message) {
      return <span className="status-badge-small status-error">ERROR</span>;
    }
    if (signal.processed && signal.order_id) {
      return <span className="status-badge-small status-success">EXECUTED</span>;
    }
    if (signal.processed) {
      return <span className="status-badge-small status-processed">PROCESSED</span>;
    }
    return <span className="status-badge-small status-pending">PENDING</span>;
  };

  const parsePayload = (payload: string) => {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  };

  return (
    <div className="signals-list">
      {signals.slice(0, 6).map((signal, index) => {
        const data = parsePayload(signal.payload);

        return (
          <motion.div
            key={signal.id}
            className="signal-item"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
          >
            <div className="signal-info">
              <div className="signal-header">
                <span className="signal-symbol">{signal.symbol}</span>
                <span className={`signal-action action-${signal.action}`}>
                  {signal.action.toUpperCase()}
                </span>
              </div>
              {data && (
                <div className="signal-details">
                  {data.orderType && <span>{data.orderType.toUpperCase()}</span>}
                  {data.price && <span>@ ${data.price.toLocaleString()}</span>}
                  {data.quantity && <span>Qty: {data.quantity}</span>}
                </div>
              )}
              {signal.error_message && (
                <div className="signal-error" title={signal.error_message}>
                  {signal.error_message.substring(0, 50)}...
                </div>
              )}
            </div>
            <div className="signal-status">
              <span className="signal-time">{formatTime(signal.received_at)}</span>
              {getStatusBadge(signal)}
            </div>
          </motion.div>
        );
      })}
      {signals.length === 0 && (
        <div className="empty-state">
          <p>No signals received yet</p>
          <p className="empty-state-hint">Waiting for TradingView alerts...</p>
        </div>
      )}
    </div>
  );
};
