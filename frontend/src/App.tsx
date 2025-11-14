import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Dashboard } from './components/Dashboard';
import StrategiesPage from './components/StrategiesPage';
import PendingSignalsPage from './components/PendingSignalsPage';
import RiskManagementPage from './components/RiskManagementPage';
import { Navigation } from './components/Navigation';
import { apiClient } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

function AppContent() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'strategies' | 'pending-signals' | 'risk-management'>('dashboard');

  // Fetch pending count for navigation badge
  const { data: pendingCount } = useQuery({
    queryKey: ['pendingSignalsCount'],
    queryFn: apiClient.getPendingSignalsCount,
    refetchInterval: 5000,
  });

  return (
    <>
      <Navigation
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        pendingCount={pendingCount?.count}
      />

      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'strategies' && <StrategiesPage />}
      {currentPage === 'pending-signals' && <PendingSignalsPage />}
      {currentPage === 'risk-management' && <RiskManagementPage />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
