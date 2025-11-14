import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '../lib/api';
import type { RiskConfig } from '../types';
import { Background } from './Background';
import { Panel } from './Panel';
import { GridIcon } from './icons';
import './RiskManagementPage.css';

interface RiskParameter {
  key: keyof RiskConfig;
  name: string;
  description: string;
  format: (value: any) => string;
  valueClass: (value: any) => string;
}

const riskParameters: RiskParameter[] = [
  {
    key: 'defaultPositionSizePercent',
    name: 'Default Position Size',
    description: 'Percentage of balance used for each trade',
    format: (value: number) => `${value}%`,
    valueClass: () => 'value-normal',
  },
  {
    key: 'maxPositionSizePercent',
    name: 'Max Position Size',
    description: 'Maximum position size allowed',
    format: (value: number) => `${value}%`,
    valueClass: (value: number) => (value > 10 ? 'value-warning' : 'value-normal'),
  },
  {
    key: 'maxTotalExposurePercent',
    name: 'Max Total Exposure',
    description: 'Maximum total exposure across all positions',
    format: (value: number) => `${value}%`,
    valueClass: (value: number) => (value > 50 ? 'value-danger' : 'value-warning'),
  },
  {
    key: 'maxDailyLoss',
    name: 'Max Daily Loss',
    description: 'Trading stops when daily loss exceeds this amount',
    format: (value: number) => `$${value.toLocaleString()}`,
    valueClass: (value: number) => (value > 1000 ? 'value-danger' : 'value-warning'),
  },
  {
    key: 'enableStopLoss',
    name: 'Enable Stop Loss',
    description: 'Automatically set stop loss on all positions',
    format: (value: boolean) => value ? 'ENABLED' : 'DISABLED',
    valueClass: () => '',
  },
  {
    key: 'defaultStopLossPercent',
    name: 'Default Stop Loss',
    description: 'Percentage below entry price for stop loss',
    format: (value: number) => `${value}%`,
    valueClass: () => 'value-normal',
  },
];

export default function RiskManagementPage() {
  const queryClient = useQueryClient();
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState<RiskConfig | null>(null);

  // Fetch risk config
  const { data: riskConfig, isLoading, error } = useQuery({
    queryKey: ['riskConfig'],
    queryFn: apiClient.getRiskConfig,
    refetchInterval: 10000,
  });

  console.log('RiskManagementPage render:', { riskConfig, isLoading, error });

  // Update risk config mutation
  const updateMutation = useMutation({
    mutationFn: apiClient.updateRiskConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riskConfig'] });
      setShowEditModal(false);
      setFormData(null);
    },
  });

  const handleEdit = () => {
    if (riskConfig) {
      setFormData({ ...riskConfig });
      setShowEditModal(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    updateMutation.mutate({
      defaultPositionSizePercent: formData.defaultPositionSizePercent,
      maxPositionSizePercent: formData.maxPositionSizePercent,
      maxTotalExposurePercent: formData.maxTotalExposurePercent,
      maxDailyLoss: formData.maxDailyLoss,
      enableStopLoss: formData.enableStopLoss,
      defaultStopLossPercent: formData.defaultStopLossPercent,
    });
  };

  const resetForm = () => {
    setFormData(null);
  };

  return (
    <>
      <Background />

      <div className="dashboard-container">
        {/* Panel with table */}
        <Panel
          title="Risk Management"
          icon={<GridIcon />}
          action={
            <button
              onClick={handleEdit}
              className="panel-action-button"
            >
              ⚙ EDIT SETTINGS
            </button>
          }
          delay={0.1}
        >
          {isLoading ? (
            <div className="risk-loading">
              <div className="loading-text">LOADING...</div>
            </div>
          ) : error ? (
            <div className="risk-loading">
              <div className="loading-text" style={{ color: 'var(--accent-danger)' }}>
                ERROR: {error instanceof Error ? error.message : 'Failed to load risk config'}
              </div>
            </div>
          ) : !riskConfig ? (
            <div className="risk-loading">
              <div className="loading-text" style={{ color: 'var(--text-muted)' }}>
                No risk configuration found
              </div>
            </div>
          ) : (
            <>
              <div className="risk-table-container">
                <table className="risk-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Current Value</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskParameters.map((param, index) => (
                      <motion.tr
                        key={param.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                      >
                        <td className="risk-param-name">{param.name}</td>
                        <td>
                          {param.key === 'enableStopLoss' ? (
                            <span
                              className={`risk-status-badge ${
                                riskConfig?.[param.key] ? 'enabled' : 'disabled'
                              }`}
                            >
                              {param.format(riskConfig?.[param.key])}
                            </span>
                          ) : (
                            <span
                              className={`risk-param-value ${param.valueClass(
                                riskConfig?.[param.key]
                              )}`}
                            >
                              {param.format(riskConfig?.[param.key])}
                            </span>
                          )}
                        </td>
                        <td className="risk-param-description">
                          {param.description}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Warning Message */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="risk-warning"
              >
                <div className="risk-warning-icon">⚠</div>
                <div className="risk-warning-content">
                  <h3>RISK WARNING</h3>
                  <p>
                    These settings directly affect your trading risk. Changes take effect
                    immediately and apply to all new trades. Make sure you understand the
                    implications before modifying risk parameters.
                  </p>
                </div>
              </motion.div>
            </>
          )}
        </Panel>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && formData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => {
              setShowEditModal(false);
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
                <h2 className="modal-title">Edit Risk Settings</h2>
              </div>

              <form onSubmit={handleSubmit} className="modal-form">
                {/* Default Position Size */}
                <div className="form-group">
                  <label>Default Position Size (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.defaultPositionSizePercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultPositionSizePercent: parseFloat(e.target.value),
                      })
                    }
                    className="form-input"
                    required
                  />
                </div>

                {/* Max Position Size */}
                <div className="form-group">
                  <label>Max Position Size (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.maxPositionSizePercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxPositionSizePercent: parseFloat(e.target.value),
                      })
                    }
                    className="form-input"
                    required
                  />
                </div>

                {/* Max Total Exposure */}
                <div className="form-group">
                  <label>Max Total Exposure (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={formData.maxTotalExposurePercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxTotalExposurePercent: parseFloat(e.target.value),
                      })
                    }
                    className="form-input"
                    required
                  />
                </div>

                {/* Max Daily Loss */}
                <div className="form-group">
                  <label>Max Daily Loss (USD)</label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={formData.maxDailyLoss}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxDailyLoss: parseFloat(e.target.value),
                      })
                    }
                    className="form-input"
                    required
                  />
                </div>

                {/* Enable Stop Loss */}
                <div className="form-group-checkbox">
                  <input
                    type="checkbox"
                    id="enableStopLoss"
                    checked={formData.enableStopLoss}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        enableStopLoss: e.target.checked,
                      })
                    }
                    className="form-checkbox"
                  />
                  <label htmlFor="enableStopLoss">Enable Stop Loss</label>
                </div>

                {/* Default Stop Loss % */}
                <div className="form-group">
                  <label>Default Stop Loss (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.defaultStopLossPercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultStopLossPercent: parseFloat(e.target.value),
                      })
                    }
                    className="form-input"
                    disabled={!formData.enableStopLoss}
                    required={formData.enableStopLoss}
                  />
                </div>

                {/* Buttons */}
                <div className="modal-buttons">
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="modal-button primary"
                  >
                    {updateMutation.isPending ? 'SAVING...' : 'SAVE'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
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
