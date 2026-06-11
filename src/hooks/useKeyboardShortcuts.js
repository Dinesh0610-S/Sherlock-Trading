import { useEffect } from 'react';

const TAB_SHORTCUTS = {
  '1': 'clueBoard',
  '2': 'sherlockAnalysis',
  '3': 'rrCalculator',
  '4': 'optionChain',
  '5': 'journal',
  '6': 'fiiDii',
  '7': 'morningBrief',
  '8': 'preMarket',
  '9': 'backtester',
  '0': 'sherlockBot',
};

export function useKeyboardShortcuts(onTabChange) {
  useEffect(() => {
    function handleKey(e) {
      // Only fire if not typing in an input:
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const tab = TAB_SHORTCUTS[e.key];
      if (tab) {
        onTabChange(tab);
      }

      // R = refresh current data:
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        window.dispatchEvent(new CustomEvent('dashboard-refresh'));
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onTabChange]);
}
