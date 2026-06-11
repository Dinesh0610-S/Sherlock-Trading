import React from 'react';
import TradingViewChart from './TradingViewChart';

// QuantitativeFootprintPanel
// Wrapper that feeds the TradingViewChart component with props from ClueBoardTab.
// The TradingViewChart handles its own timeframe buttons, OHLC readout,
// and datafeed connection — no duplicate UI needed here.
export default function QuantitativeFootprintPanel({
  candles = [],
  optionChain = null,
  spotPrice = null,
  selectedAsset = '',
  timeframe = '15m',
  onIntervalChange,
  onCandlesUpdate,
  onTickUpdate,
}) {
  return (
    <div className="cb-card" style={{ padding: 0, overflow: 'hidden' }}>
      <TradingViewChart
        selectedAsset={selectedAsset}
        timeframe={timeframe}
        onIntervalChange={onIntervalChange}
        spotPrice={spotPrice}
        onCandlesUpdate={onCandlesUpdate}
        onTickUpdate={onTickUpdate}
      />
    </div>
  );
}
