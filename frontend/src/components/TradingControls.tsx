import { motion } from 'framer-motion';
import './TradingControls.css';

interface TradingControlsProps {
  tradingEnabled: boolean;
  onToggleTrading: () => void;
  onEmergencyStop: () => void;
}

export const TradingControls = ({
  tradingEnabled,
  onToggleTrading,
  onEmergencyStop,
}: TradingControlsProps) => {
  return (
    <div className="trading-controls">
      <motion.button
        className={`control-button ${tradingEnabled ? 'control-enabled' : 'control-disabled'}`}
        onClick={onToggleTrading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span>{tradingEnabled ? '✓ Trading Enabled' : '⏸ Trading Paused'}</span>
      </motion.button>

      <motion.button
        className="control-button control-danger"
        onClick={onEmergencyStop}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span>⚠ Emergency Stop</span>
      </motion.button>
    </div>
  );
};
