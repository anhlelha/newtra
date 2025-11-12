import { motion } from 'framer-motion';
import './Panel.css';

interface PanelProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}

export const Panel = ({ title, icon, action, children, delay = 0 }: PanelProps) => {
  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
    >
      <div className="panel-header">
        <h2 className="panel-title">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="panel-content">{children}</div>
    </motion.div>
  );
};
