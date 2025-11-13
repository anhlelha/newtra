import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../lib/api';
import type { Strategy, CreateStrategyInput } from '../types';
import { Background } from './Background';
import { Panel } from './Panel';
import { GridIcon } from './icons';
import './StrategiesPage.css';

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
      setShowCreateModal(false);
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
      description: strategy.description || '',
      enabled: Boolean(strategy.enabled), // Ensure boolean conversion
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
    <>
      <Background />

      <div className="dashboard-container">
        {/* Panel with table */}
        <Panel
          title="Strategy Management"
          icon={<GridIcon />}
          action={
            <button
              onClick={() => {
                resetForm();
                setEditingStrategy(null);
                setShowCreateModal(true);
              }}
              className="panel-action-button"
            >
              + NEW STRATEGY
            </button>
          }
          delay={0.1}
        >
          {isLoading ? (
            <div className="strategies-loading">
              <div className="loading-text">LOADING...</div>
            </div>
          ) : (
            <div className="strategies-table-container">
              <table className="strategies-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {strategies.map((strategy, index) => (
                    <motion.tr
                      key={strategy.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.05 }}
                    >
                      <td className="strategy-name">{strategy.name}</td>
                      <td>
                        <span
                          className={`type-badge ${strategy.type === 'automatic' ? 'automatic' : 'manual'}`}
                        >
                          {strategy.type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${strategy.enabled ? 'enabled' : 'disabled'}`}
                        >
                          {strategy.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="strategy-description">
                        {strategy.description || '-'}
                      </td>
                      <td className="strategy-date">
                        {new Date(strategy.created_at).toLocaleDateString()}
                      </td>
                      <td className="strategy-actions">
                        <button
                          onClick={() => handleToggle(strategy.id)}
                          className="action-button toggle-button"
                          title={strategy.enabled ? 'Disable' : 'Enable'}
                        >
                          {strategy.enabled ? 'DISABLE' : 'ENABLE'}
                        </button>
                        <button
                          onClick={() => handleEdit(strategy)}
                          className="action-button edit-button"
                          title="Edit"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleDelete(strategy.id)}
                          className="action-button delete-button"
                          title="Delete"
                        >
                          DELETE
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {strategies.length === 0 && (
                <div className="empty-state">
                  <p>No strategies configured. Create your first strategy to get started.</p>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
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
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title">
                  {editingStrategy ? 'Edit Strategy' : 'Create Strategy'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="modal-form">
                {/* Name */}
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="form-input"
                    placeholder="My Strategy"
                    required
                  />
                </div>

                {/* Type */}
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as 'automatic' | 'manual',
                      })
                    }
                    className="form-select"
                  >
                    <option value="automatic">Automatic (Execute Immediately)</option>
                    <option value="manual">Manual (Requires Approval)</option>
                  </select>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label>Description (Optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="form-textarea"
                    rows={3}
                    placeholder="Strategy description..."
                  />
                </div>

                {/* Enabled */}
                <div className="form-group-checkbox">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={(e) =>
                      setFormData({ ...formData, enabled: e.target.checked })
                    }
                    className="form-checkbox"
                  />
                  <label htmlFor="enabled">Enabled</label>
                </div>

                {/* Buttons */}
                <div className="modal-buttons">
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="modal-button primary"
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
                    className="modal-button secondary"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
