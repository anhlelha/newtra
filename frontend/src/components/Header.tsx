import { motion } from 'framer-motion';
import { LogoIcon, SettingsIcon, BellIcon, InfoIcon } from './icons';
import './Header.css';

interface HeaderProps {
  tradingActive: boolean;
}

export const Header = ({ tradingActive }: HeaderProps) => {
  return (
    <motion.header
      className="header"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="logo">
        <div className="logo-icon">
          <LogoIcon />
        </div>
        <span className="logo-text">NeXTra</span>
      </div>

      <div className="header-controls">
        <motion.div
          className="status-badge"
          animate={{ opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="status-dot" />
          <span>{tradingActive ? 'TRADING ACTIVE' : 'TRADING PAUSED'}</span>
        </motion.div>

        <button className="icon-button">
          <SettingsIcon />
        </button>

        <button className="icon-button">
          <BellIcon />
        </button>

        <button className="icon-button">
          <InfoIcon />
        </button>
      </div>
    </motion.header>
  );
};
