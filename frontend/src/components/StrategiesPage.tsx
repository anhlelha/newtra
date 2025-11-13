import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../lib/api';
import type { Strategy, CreateStrategyInput } from '../types';

export default function StrategiesPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [formData, setFormData] = useState<CreateStrategyInput>({
    name: '',
    type: 'automatic',
    description: '',
    enabled: true,
  });

  // Fetch strategies
  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: apiClient.getStrategies,
    refetchInterval: 10000, // Refresh every 10s
  });

  // Create strategy mutation
  const createMutation = useMutation({
    mutationFn: apiClient.createStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      setShowCreateModal(false);
      resetForm();
    },
  });

  // Update strategy mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.updateStrategy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      setEditingStrategy(null);
      resetForm();
    },
  });

  // Delete strategy mutation
  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
    },
  });

  // Toggle strategy mutation
  const toggleMutation = useMutation({
    mutationFn: apiClient.toggleStrategy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'automatic',
      description: '',
      enabled: true,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingStrategy) {
      updateMutation.mutate({ id: editingStrategy.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setFormData({
      name: strategy.name,
      type: strategy.type,
      description: strategy.description,
      enabled: strategy.enabled,
    });
    setShowCreateModal(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this strategy?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggle = (id: string) => {
    toggleMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono">
      {/* Debug indicator */}
      <div className="fixed top-4 left-4 bg-red-500 text-white px-3 py-1 text-xs z-[100]">
        Modal: {showCreateModal ? 'OPEN' : 'CLOSED'}
      </div>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-cyan-400">
            STRATEGY_MANAGEMENT
          </h1>
          <p className="text-green-500 opacity-70">
            Configure automatic and manual trading strategies
          </p>
        </div>
        <button
          onClick={() => {
            console.log('Create button clicked');
            resetForm();
            setEditingStrategy(null);
            setShowCreateModal(true);
            console.log('showCreateModal set to true');
          }}
          className="px-6 py-3 bg-cyan-500/20 border border-cyan-500 text-cyan-400 hover:bg-cyan-500/30 transition-all duration-300 relative group"
        >
          <span className="relative z-10">+ NEW_STRATEGY</span>
          <div className="absolute inset-0 bg-cyan-500/10 blur group-hover:blur-md transition-all" />
        </button>
      </div>

      {/* Strategies List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-cyan-400 text-xl animate-pulse">LOADING...</div>
        </div>
      ) : (
        <div className="grid gap-6">
          {strategies.map((strategy) => (
            <motion.div
              key={strategy.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/50 border border-green-500/30 p-6 relative group hover:border-cyan-500/50 transition-all duration-300"
            >
              {/* Scanline effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              <div className="flex items-start justify-between relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <h3 className="text-2xl font-bold text-cyan-400">
                      {strategy.name}
                    </h3>
                    <span
                      className={`px-3 py-1 text-xs border ${
                        strategy.type === 'automatic'
                          ? 'border-green-500 text-green-400 bg-green-500/10'
                          : 'border-yellow-500 text-yellow-400 bg-yellow-500/10'
                      }`}
                    >
                      {strategy.type.toUpperCase()}
                    </span>
                    <span
                      className={`px-3 py-1 text-xs border ${
                        strategy.enabled
                          ? 'border-green-500 text-green-400 bg-green-500/10'
                          : 'border-red-500 text-red-400 bg-red-500/10'
                      }`}
                    >
                      {strategy.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  {strategy.description && (
                    <p className="text-green-500/70 mb-4">{strategy.description}</p>
                  )}
                  <div className="text-sm text-green-500/50">
                    Created: {new Date(strategy.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggle(strategy.id)}
                    className={`px-4 py-2 border text-sm transition-all duration-300 ${
                      strategy.enabled
                        ? 'border-yellow-500 text-yellow-400 hover:bg-yellow-500/20'
                        : 'border-green-500 text-green-400 hover:bg-green-500/20'
                    }`}
                  >
                    {strategy.enabled ? 'DISABLE' : 'ENABLE'}
                  </button>
                  <button
                    onClick={() => handleEdit(strategy)}
                    className="px-4 py-2 border border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 transition-all duration-300 text-sm"
                  >
                    EDIT
                  </button>
                  <button
                    onClick={() => handleDelete(strategy.id)}
                    className="px-4 py-2 border border-red-500 text-red-400 hover:bg-red-500/20 transition-all duration-300 text-sm"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {strategies.length === 0 && (
            <div className="text-center py-16 text-green-500/50">
              No strategies configured. Create your first strategy to get started.
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
            onClick={() => {
              setShowCreateModal(false);
              setEditingStrategy(null);
              resetForm();
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-black border border-cyan-500 p-8 max-w-2xl w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-cyan-500/5 blur-xl" />

              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-6 text-cyan-400">
                  {editingStrategy ? 'EDIT_STRATEGY' : 'CREATE_STRATEGY'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name */}
                  <div>
                    <label className="block text-green-400 mb-2">NAME</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full bg-black border border-green-500/50 text-green-400 px-4 py-3 focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="My Strategy"
                      required
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-green-400 mb-2">TYPE</label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          type: e.target.value as 'automatic' | 'manual',
                        })
                      }
                      className="w-full bg-black border border-green-500/50 text-green-400 px-4 py-3 focus:border-cyan-500 focus:outline-none transition-colors"
                    >
                      <option value="automatic">Automatic (Execute Immediately)</option>
                      <option value="manual">Manual (Requires Approval)</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-green-400 mb-2">
                      DESCRIPTION (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full bg-black border border-green-500/50 text-green-400 px-4 py-3 focus:border-cyan-500 focus:outline-none transition-colors resize-none"
                      rows={3}
                      placeholder="Strategy description..."
                    />
                  </div>

                  {/* Enabled */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={formData.enabled}
                      onChange={(e) =>
                        setFormData({ ...formData, enabled: e.target.checked })
                      }
                      className="w-5 h-5"
                    />
                    <label htmlFor="enabled" className="text-green-400">
                      ENABLED
                    </label>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      className="flex-1 px-6 py-3 bg-cyan-500/20 border border-cyan-500 text-cyan-400 hover:bg-cyan-500/30 transition-all duration-300 disabled:opacity-50"
                    >
                      {createMutation.isPending || updateMutation.isPending
                        ? 'SAVING...'
                        : editingStrategy
                        ? 'UPDATE'
                        : 'CREATE'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setEditingStrategy(null);
                        resetForm();
                      }}
                      className="flex-1 px-6 py-3 border border-red-500 text-red-400 hover:bg-red-500/20 transition-all duration-300"
                    >
                      CANCEL
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
