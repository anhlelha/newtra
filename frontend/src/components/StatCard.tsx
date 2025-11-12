import { motion } from 'framer-motion';
import './StatCard.css';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  delay?: number;
}

export const StatCard = ({ label, value, change, changeType = 'neutral', icon, delay = 0 }: StatCardProps) => {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -4, borderColor: 'var(--accent-primary)' }}
    >
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        <div className="stat-icon">{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
      {change && (
        <div className={`stat-change ${changeType}`}>
          {changeType === 'positive' && <span>▲</span>}
          {changeType === 'negative' && <span>▼</span>}
          <span>{change}</span>
        </div>
      )}
    </motion.div>
  );
};
