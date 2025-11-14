import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { apiClient } from '../lib/api';
import type { RiskConfig } from '../types';

export default function RiskManagementPage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<RiskConfig | null>(null);

  // Fetch risk config
  const { data: riskConfig, isLoading } = useQuery({
    queryKey: ['riskConfig'],
    queryFn: apiClient.getRiskConfig,
    refetchInterval: 10000,
  });

  // Update risk config mutation
  const updateMutation = useMutation({
    mutationFn: apiClient.updateRiskConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riskConfig'] });
      setIsEditing(false);
      setFormData(null);
    },
  });

  const handleEdit = () => {
    if (riskConfig) {
      setFormData({ ...riskConfig });
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData(null);
  };

  const handleSave = () => {
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

  const displayData = isEditing && formData ? formData : riskConfig;

  return (
    <div className="min-h-screen bg-black text-green-400 p-8 font-mono">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-cyan-400">
            RISK_MANAGEMENT
          </h1>
          <p className="text-green-500 opacity-70">
            Configure risk parameters and position sizing
          </p>
        </div>

        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="px-6 py-3 bg-cyan-500/20 border border-cyan-500 text-cyan-400 hover:bg-cyan-500/30 transition-all duration-300 relative group"
          >
            <span className="relative z-10">⚙ EDIT_SETTINGS</span>
            <div className="absolute inset-0 bg-cyan-500/10 blur group-hover:blur-md transition-all" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-6 py-3 bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30 transition-all duration-300 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'SAVING...' : '✓ SAVE'}
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-3 border border-red-500 text-red-400 hover:bg-red-500/20 transition-all duration-300"
            >
              ✗ CANCEL
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-cyan-400 text-xl animate-pulse">LOADING...</div>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Position Sizing Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/50 border border-green-500/30 p-6 relative group hover:border-cyan-500/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-3">
                <span className="text-green-500">■</span>
                POSITION SIZING
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Default Position Size */}
                <div>
                  <label className="block text-green-400 mb-2 text-sm">
                    DEFAULT POSITION SIZE (%)
                  </label>
                  <div className="flex items-center gap-4">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData?.defaultPositionSizePercent || 0}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  defaultPositionSizePercent: parseFloat(
                                    e.target.value
                                  ),
                                }
                              : null
                          )
                        }
                        className="flex-1 bg-black border border-green-500/50 text-green-400 px-4 py-3 focus:border-cyan-500 focus:outline-none transition-colors"
                      />
                    ) : (
                      <div className="flex-1 text-3xl font-bold text-green-400">
                        {displayData?.defaultPositionSizePercent}%
                      </div>
                    )}
                  </div>
                  <p className="text-green-500/50 text-xs mt-2">
                    Percentage of balance used for each trade
                  </p>
                </div>

                {/* Max Position Size */}
                <div>
                  <label className="block text-green-400 mb-2 text-sm">
                    MAX POSITION SIZE (%)
                  </label>
                  <div className="flex items-center gap-4">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData?.maxPositionSizePercent || 0}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  maxPositionSizePercent: parseFloat(
                                    e.target.value
                                  ),
                                }
                              : null
                          )
                        }
                        className="flex-1 bg-black border border-green-500/50 text-green-400 px-4 py-3 focus:border-cyan-500 focus:outline-none transition-colors"
                      />
                    ) : (
                      <div className="flex-1 text-3xl font-bold text-yellow-400">
                        {displayData?.maxPositionSizePercent}%
                      </div>
                    )}
                  </div>
                  <p className="text-green-500/50 text-xs mt-2">
                    Maximum position size allowed
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Exposure & Loss Limits Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-black/50 border border-green-500/30 p-6 relative group hover:border-cyan-500/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-3">
                <span className="text-red-500">■</span>
                EXPOSURE & LOSS LIMITS
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Max Total Exposure */}
                <div>
                  <label className="block text-green-400 mb-2 text-sm">
                    MAX TOTAL EXPOSURE (%)
                  </label>
                  <div className="flex items-center gap-4">
                    {isEditing ? (
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={formData?.maxTotalExposurePercent || 0}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  maxTotalExposurePercent: parseFloat(
                                    e.target.value
                                  ),
                                }
                              : null
                          )
                        }
                        className="flex-1 bg-black border border-green-500/50 text-green-400 px-4 py-3 focus:border-cyan-500 focus:outline-none transition-colors"
                      />
                    ) : (
                      <div className="flex-1 text-3xl font-bold text-red-400">
                        {displayData?.maxTotalExposurePercent}%
                      </div>
                    )}
                  </div>
                  <p className="text-green-500/50 text-xs mt-2">
                    Maximum total exposure across all positions
                  </p>
                </div>

                {/* Max Daily Loss */}
                <div>
                  <label className="block text-green-400 mb-2 text-sm">
                    MAX DAILY LOSS (USD)
                  </label>
                  <div className="flex items-center gap-4">
                    {isEditing ? (
                      <input
                        type="number"
                        step="10"
                        min="0"
                        value={formData?.maxDailyLoss || 0}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  maxDailyLoss: parseFloat(e.target.value),
                                }
                              : null
                          )
                        }
                        className="flex-1 bg-black border border-green-500/50 text-green-400 px-4 py-3 focus:border-cyan-500 focus:outline-none transition-colors"
                      />
                    ) : (
                      <div className="flex-1 text-3xl font-bold text-red-400">
                        ${displayData?.maxDailyLoss.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <p className="text-green-500/50 text-xs mt-2">
                    Trading stops when daily loss exceeds this amount
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stop Loss Configuration Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-black/50 border border-green-500/30 p-6 relative group hover:border-cyan-500/50 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-3">
                <span className="text-yellow-500">■</span>
                STOP LOSS CONFIGURATION
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Enable Stop Loss */}
                <div>
                  <label className="block text-green-400 mb-2 text-sm">
                    ENABLE STOP LOSS
                  </label>
                  <div className="flex items-center gap-4">
                    {isEditing ? (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData?.enableStopLoss || false}
                          onChange={(e) =>
                            setFormData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    enableStopLoss: e.target.checked,
                                  }
                                : null
                            )
                          }
                          className="w-6 h-6"
                        />
                        <span className="text-green-400">
                          {formData?.enableStopLoss ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </label>
                    ) : (
                      <div
                        className={`text-2xl font-bold ${
                          displayData?.enableStopLoss
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {displayData?.enableStopLoss ? '✓ ENABLED' : '✗ DISABLED'}
                      </div>
                    )}
                  </div>
                  <p className="text-green-500/50 text-xs mt-2">
                    Automatically set stop loss on all positions
                  </p>
                </div>

                {/* Default Stop Loss % */}
                <div>
                  <label className="block text-green-400 mb-2 text-sm">
                    DEFAULT STOP LOSS (%)
                  </label>
                  <div className="flex items-center gap-4">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={formData?.defaultStopLossPercent || 0}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  defaultStopLossPercent: parseFloat(
                                    e.target.value
                                  ),
                                }
                              : null
                          )
                        }
                        className="flex-1 bg-black border border-green-500/50 text-green-400 px-4 py-3 focus:border-cyan-500 focus:outline-none transition-colors"
                        disabled={!formData?.enableStopLoss}
                      />
                    ) : (
                      <div className="flex-1 text-3xl font-bold text-yellow-400">
                        {displayData?.defaultStopLossPercent}%
                      </div>
                    )}
                  </div>
                  <p className="text-green-500/50 text-xs mt-2">
                    Percentage below entry price for stop loss
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Warning Message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="border border-yellow-500/30 bg-yellow-500/5 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="text-yellow-500 text-2xl">⚠</span>
              <div>
                <h3 className="text-yellow-400 font-bold mb-1">
                  RISK WARNING
                </h3>
                <p className="text-yellow-500/70 text-sm">
                  These settings directly affect your trading risk. Changes take effect
                  immediately and apply to all new trades. Make sure you understand the
                  implications before modifying risk parameters.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
