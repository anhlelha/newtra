import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '../lib/api';
import { Background } from './Background';
import { Panel } from './Panel';
import { ClockIcon } from './icons';
import { formatShortDateTimeGMT7 } from '../utils/timeFormat';
import './PendingSignalsPage.css';

export default function PendingSignalsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>(
    'pending'
  );

  // Fetch pending signals
  const { data: signals = [], isLoading } = useQuery({
    queryKey: ['pendingSignals', filter],
    queryFn: () =>
      apiClient.getPendingSignals(
        filter === 'all' ? {} : { status: filter as any }
      ),
    refetchInterval: 5000, // Refresh every 5s for pending signals
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: apiClient.approvePendingSignal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingSignals'] });
      queryClient.invalidateQueries({ queryKey: ['pendingSignalsCount'] });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: apiClient.rejectPendingSignal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingSignals'] });
      queryClient.invalidateQueries({ queryKey: ['pendingSignalsCount'] });
    },
  });

  const handleApprove = (id: string) => {
    if (confirm('Approve this signal and execute the order?')) {
      approveMutation.mutate(id);
    }
  };

  const handleReject = (id: string) => {
    if (confirm('Reject this signal? The order will not be executed.')) {
      rejectMutation.mutate(id);
    }
  };

  return (
    <>
      <Background />

      <div className="dashboard-container">
        <Panel
          title="Pending Signals"
          icon={<ClockIcon />}
          action={
            <div className="filter-tabs">
              {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`filter-button ${filter === status ? 'active' : ''}`}
                >
                  {status.toUpperCase()}
                </button>
              ))}
            </div>
          }
          delay={0.1}
        >
          {isLoading ? (
            <div className="signals-loading">
              <div className="loading-text">LOADING...</div>
            </div>
          ) : (
            <div className="signals-table-container">
              <table className="signals-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Strategy</th>
                    <th>Action</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Created (GMT+7)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((signal, index) => {
                    const signalData = JSON.parse(signal.signal_data);
                    return (
                      <motion.tr
                        key={signal.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                      >
                        <td className="signal-symbol">{signal.symbol}</td>
                        <td className="signal-strategy">
                          {signal.strategy_name || 'Unknown'}
                        </td>
                        <td>
                          <span className={`action-badge ${signal.action}`}>
                            {signal.action.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span className="type-badge">
                            {signal.order_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="signal-price">
                          {signal.price ? `$${signal.price.toLocaleString()}` : '-'}
                        </td>
                        <td className="signal-quantity">
                          {signal.quantity || '-'}
                        </td>
                        <td>
                          <span className={`status-badge ${signal.status}`}>
                            {signal.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="signal-date">
                          {formatShortDateTimeGMT7(signal.created_at)}
                        </td>
                        <td className="signal-actions">
                          {signal.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(signal.id)}
                                disabled={approveMutation.isPending}
                                className="action-button approve-button"
                                title="Approve and execute"
                              >
                                APPROVE
                              </button>
                              <button
                                onClick={() => handleReject(signal.id)}
                                disabled={rejectMutation.isPending}
                                className="action-button reject-button"
                                title="Reject signal"
                              >
                                REJECT
                              </button>
                            </>
                          )}
                          {signal.status !== 'pending' && (
                            <span className="no-actions">
                              {signal.reviewed_at && formatShortDateTimeGMT7(signal.reviewed_at)}
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
              {signals.length === 0 && (
                <div className="empty-state">
                  <p>
                    {filter === 'pending'
                      ? 'No pending signals. All clear!'
                      : `No ${filter} signals.`}
                  </p>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
