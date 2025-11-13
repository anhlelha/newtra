import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '../lib/api';

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

  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy':
        return 'text-green-400 border-green-500 bg-green-500/10';
      case 'sell':
        return 'text-red-400 border-red-500 bg-red-500/10';
      case 'close':
        return 'text-yellow-400 border-yellow-500 bg-yellow-500/10';
      default:
        return 'text-gray-400 border-gray-500 bg-gray-500/10';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-400 border-yellow-500 bg-yellow-500/10';
      case 'approved':
        return 'text-green-400 border-green-500 bg-green-500/10';
      case 'rejected':
        return 'text-red-400 border-red-500 bg-red-500/10';
      default:
        return 'text-gray-400 border-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-cyan-400">
          PENDING_SIGNALS
        </h1>
        <p className="text-green-500 opacity-70">
          Review and approve manual strategy signals
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-8 flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-6 py-2 border transition-all duration-300 ${
              filter === status
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/20'
                : 'border-green-500/30 text-green-500 hover:border-green-500/50'
            }`}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Signals List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-cyan-400 text-xl animate-pulse">LOADING...</div>
        </div>
      ) : (
        <div className="grid gap-6">
          {signals.map((signal) => {
            const signalData = JSON.parse(signal.signal_data);
            return (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/50 border border-green-500/30 p-6 relative group hover:border-cyan-500/50 transition-all duration-300"
              >
                {/* Scanline effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-cyan-400">
                        {signal.symbol}
                      </h3>
                      <span
                        className={`px-3 py-1 text-xs border ${getActionColor(
                          signal.action
                        )}`}
                      >
                        {signal.action.toUpperCase()}
                      </span>
                      <span
                        className={`px-3 py-1 text-xs border ${getStatusColor(
                          signal.status
                        )}`}
                      >
                        {signal.status.toUpperCase()}
                      </span>
                      <span className="px-3 py-1 text-xs border border-blue-500 text-blue-400 bg-blue-500/10">
                        {signal.order_type.toUpperCase()}
                      </span>
                    </div>

                    {signal.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(signal.id)}
                          disabled={approveMutation.isPending}
                          className="px-6 py-2 border border-green-500 text-green-400 hover:bg-green-500/20 transition-all duration-300 disabled:opacity-50"
                        >
                          ✓ APPROVE
                        </button>
                        <button
                          onClick={() => handleReject(signal.id)}
                          disabled={rejectMutation.isPending}
                          className="px-6 py-2 border border-red-500 text-red-400 hover:bg-red-500/20 transition-all duration-300 disabled:opacity-50"
                        >
                          ✗ REJECT
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Signal Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {signal.price && (
                      <div>
                        <div className="text-green-500/50 text-sm">PRICE</div>
                        <div className="text-green-400 font-bold">
                          ${signal.price.toLocaleString()}
                        </div>
                      </div>
                    )}
                    {signal.quantity && (
                      <div>
                        <div className="text-green-500/50 text-sm">QUANTITY</div>
                        <div className="text-green-400 font-bold">
                          {signal.quantity}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-green-500/50 text-sm">RECEIVED</div>
                      <div className="text-green-400 text-sm">
                        {new Date(signal.created_at).toLocaleString()}
                      </div>
                    </div>
                    {signal.reviewed_at && (
                      <div>
                        <div className="text-green-500/50 text-sm">REVIEWED</div>
                        <div className="text-green-400 text-sm">
                          {new Date(signal.reviewed_at).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional Signal Data */}
                  {signalData.stopLoss && (
                    <div className="mb-2">
                      <span className="text-green-500/50">Stop Loss: </span>
                      <span className="text-red-400 font-bold">
                        ${signalData.stopLoss.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {signalData.message && (
                    <div className="mb-2">
                      <span className="text-green-500/50">Message: </span>
                      <span className="text-green-400">{signalData.message}</span>
                    </div>
                  )}

                  {/* Strategy Info */}
                  <div className="text-sm text-green-500/50 mt-4">
                    Signal ID: {signal.signal_id}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {signals.length === 0 && (
            <div className="text-center py-16 text-green-500/50">
              {filter === 'pending'
                ? 'No pending signals. All clear!'
                : `No ${filter} signals.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
