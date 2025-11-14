import { motion } from 'framer-motion';

interface NavigationProps {
  currentPage: 'dashboard' | 'strategies' | 'pending-signals' | 'risk-management';
  onNavigate: (page: 'dashboard' | 'strategies' | 'pending-signals' | 'risk-management') => void;
  pendingCount?: number;
}

export function Navigation({ currentPage, onNavigate, pendingCount = 0 }: NavigationProps) {
  const menuItems = [
    { id: 'dashboard' as const, label: 'DASHBOARD', icon: '▶', badge: undefined },
    { id: 'strategies' as const, label: 'STRATEGIES', icon: '⚡', badge: undefined },
    { id: 'pending-signals' as const, label: 'PENDING_SIGNALS', icon: '⏱', badge: pendingCount },
    { id: 'risk-management' as const, label: 'RISK_MANAGEMENT', icon: '⚠', badge: undefined },
  ];

  return (
    <nav className="fixed top-8 right-8 z-50">
      <div className="bg-black/90 border border-cyan-500/50 backdrop-blur-sm p-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`
              w-full px-6 py-3 text-left font-mono transition-all duration-300 relative group
              ${
                currentPage === item.id
                  ? 'bg-cyan-500/20 text-cyan-400 border-l-4 border-cyan-500'
                  : 'text-green-400 hover:bg-green-500/10 hover:text-cyan-400 border-l-4 border-transparent'
              }
            `}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="px-2 py-1 text-xs bg-yellow-500/20 border border-yellow-500 text-yellow-400"
                >
                  {item.badge}
                </motion.span>
              )}
            </div>
            {currentPage === item.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-cyan-500/10 pointer-events-none"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
