import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type TradingType = 'SPOT' | 'FUTURE';

interface TradingTypeContextType {
  tradingType: TradingType;
  setTradingType: (type: TradingType) => void;
}

const TradingTypeContext = createContext<TradingTypeContextType | undefined>(undefined);

export const useTradingType = () => {
  const context = useContext(TradingTypeContext);
  if (!context) {
    throw new Error('useTradingType must be used within a TradingTypeProvider');
  }
  return context;
};

interface TradingTypeProviderProps {
  children: ReactNode;
}

export const TradingTypeProvider = ({ children }: TradingTypeProviderProps) => {
  // Initialize from localStorage or default to SPOT
  const [tradingType, setTradingTypeState] = useState<TradingType>(() => {
    const stored = localStorage.getItem('tradingType');
    return (stored === 'SPOT' || stored === 'FUTURE') ? stored : 'SPOT';
  });

  // Persist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('tradingType', tradingType);
  }, [tradingType]);

  const setTradingType = (type: TradingType) => {
    setTradingTypeState(type);
  };

  return (
    <TradingTypeContext.Provider value={{ tradingType, setTradingType }}>
      {children}
    </TradingTypeContext.Provider>
  );
};
