import React, { lazy, Suspense, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import NavBar from './components/NavBar';
import LoadingSkeleton from './components/LoadingSkeleton';
import NetworkBanner from './components/NetworkBanner';
import { usePersistedState } from './hooks/usePersistedState';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Lazy load each page
const ClueBoard       = lazy(() => import('./pages/ClueBoard'));
const SherlockVerdict = lazy(() => import('./pages/SherlockVerdict'));
const RRCalculator    = lazy(() => import('./pages/RRCalculator'));
const OptionChain     = lazy(() => import('./pages/OptionChain'));
const TradeJournal    = lazy(() => import('./pages/TradeJournal'));
const FiiDiiFlow      = lazy(() => import('./pages/FiiDiiFlow'));
const MorningBrief    = lazy(() => import('./pages/MorningBrief'));
const PreMarketIntel  = lazy(() => import('./pages/PreMarketIntel'));
const Backtester      = lazy(() => import('./pages/Backtester'));
const SherlockAI      = lazy(() => import('./pages/SherlockAI'));

const TABS = {
  'clueBoard':        ClueBoard,
  'sherlockAnalysis': SherlockVerdict,
  'rrCalculator':     RRCalculator,
  'optionChain':      OptionChain,
  'journal':          TradeJournal,
  'fiiDii':           FiiDiiFlow,
  'morningBrief':     MorningBrief,
  'preMarket':        PreMarketIntel,
  'backtester':       Backtester,
  'sherlockBot':      SherlockAI,
};

export default function App() {
  const [activeTab, setActiveTab] = usePersistedState('activeTab', 'clueBoard');

  // Wire keyboard shortcuts (1-9 and 0 for switching tabs)
  useKeyboardShortcuts((tab) => {
    setActiveTab(tab);
  });

  // Handle document title changes based on active tab
  useEffect(() => {
    const titles = {
      'clueBoard':        '🔍 Clue Board — Holmes',
      'sherlockAnalysis': '🕵️‍♂️ Sherlock Verdict — Holmes',
      'rrCalculator':     '🧮 R:R Calculator — Holmes',
      'optionChain':      '📋 Option Chain — Holmes',
      'journal':          '📓 Trade Journal — Holmes',
      'fiiDii':           '📊 FII/DII Flow — Holmes',
      'morningBrief':     '📅 Morning Brief — Holmes',
      'preMarket':        '🌅 Pre-Market Intel — Holmes',
      'backtester':       '⚙️ Backtester — Holmes',
      'sherlockBot':      '🤖 Sherlock AI — Holmes',
    };
    document.title = titles[activeTab] || 'Holmes Trading Dashboard';
  }, [activeTab]);

  const ActivePage = TABS[activeTab] || ClueBoard;

  return (
    <ErrorBoundary>
      <NetworkBanner />
      <NavBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-full overflow-x-hidden box-border" style={{ paddingTop: 8 }}>
        <ErrorBoundary key={activeTab}>
          <Suspense fallback={<LoadingSkeleton />}>
            <ActivePage />
          </Suspense>
        </ErrorBoundary>
      </div >
    </ErrorBoundary>
  );
}
