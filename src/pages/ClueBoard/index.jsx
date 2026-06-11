import React from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import AssetSearch from '../../components/AssetSearch';
import ClueBoardTab from '../../components/clueboard/ClueBoardTab';

export default function ClueBoard() {
  const [selectedAsset, setSelectedAsset] = usePersistedState('symbol', '^NSEI');
  const [period, setPeriod] = usePersistedState('period', '5d');
  const [chartInterval, setChartInterval] = usePersistedState('chartInterval', '15m');
  const [rrForm, setRrForm] = usePersistedState('rrForm', {
    direction: 'LONG',
    entry: '',
    target1: '',
    target2: '',
    sl: '',
    lots: 1,
    capital: 100000,
  });

  const handleSelectAsset = (assetSymbolOrObj, legacyLabel) => {
    if (typeof assetSymbolOrObj === 'object' && assetSymbolOrObj !== null) {
      const asset = assetSymbolOrObj;
      const ticker = asset.yf_ticker || asset.symbol;
      setSelectedAsset(ticker);
      const label = asset.symbol;
      setRrForm(prev => ({ ...prev, asset: label }));
    } else {
      setSelectedAsset(assetSymbolOrObj);
      const label = legacyLabel || assetSymbolOrObj;
      setRrForm(prev => ({ ...prev, asset: label }));
    }
  };

  const rrRatio = parseFloat(rrForm.target1) && parseFloat(rrForm.entry) && parseFloat(rrForm.sl)
    ? Math.abs(parseFloat(rrForm.target1) - parseFloat(rrForm.entry)) / (Math.abs(parseFloat(rrForm.entry) - parseFloat(rrForm.sl)) || 1)
    : 2.0;

  return (
    <div>
      {/* Asset Search + Quick Picks Row */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: '12px 20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Full Universe Search */}
          <AssetSearch
            value={selectedAsset}
            onSelect={handleSelectAsset}
            placeholder="Search Nifty 500, F&O, Options…"
            className="clue-board-search"
          />
          <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 11, marginLeft: 8 }}>Quick:</span>
          {/* SENSEX — BSE index, blue theme */}
          <button
            className={`btn btn-sm btn-blue ${selectedAsset === '^BSESN' ? 'btn-active' : ''}`}
            onClick={() => handleSelectAsset('^BSESN', 'SENSEX')}
            title="BSE Sensex — No F&O/PCR data available"
          >
            SENSEX<span className="exchange-badge-bse">BSE</span>
          </button>
          <button className={`btn btn-sm ${selectedAsset === '^NSEI' ? 'btn-gold' : 'btn-secondary'}`} onClick={() => handleSelectAsset('^NSEI', 'NIFTY')}>
            NIFTY 50
          </button>
          <button className={`btn btn-sm ${selectedAsset === '^NSEBANK' ? 'btn-gold' : 'btn-secondary'}`} onClick={() => handleSelectAsset('^NSEBANK', 'BANK NIFTY')}>
            BANK NIFTY
          </button>
          <button className={`btn btn-sm ${selectedAsset === 'RELIANCE.NS' ? 'btn-gold' : 'btn-secondary'}`} onClick={() => handleSelectAsset('RELIANCE.NS', 'RELIANCE')}>
            RELIANCE
          </button>
          <button className={`btn btn-sm ${selectedAsset === 'HDFCBANK.NS' ? 'btn-gold' : 'btn-secondary'}`} onClick={() => handleSelectAsset('HDFCBANK.NS', 'HDFC BANK')}>
            HDFC BANK
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 80, padding: '4px 8px' }}>
              <option value="5d">5 Days</option>
              <option value="1mo">1 Month</option>
              <option value="3mo">3 Months</option>
            </select>
            <select value={chartInterval} onChange={(e) => setChartInterval(e.target.value)} style={{ width: 80, padding: '4px 8px' }}>
              <option value="15m">15 Min</option>
              <option value="30m">30 Min</option>
              <option value="1h">1 Hour</option>
              <option value="1d">1 Day</option>
            </select>
          </div>
        </div>
      </div>

      <ClueBoardTab
        selectedAsset={selectedAsset}
        period={period}
        chartInterval={chartInterval}
        direction={rrForm.direction}
        rrRatio={rrRatio}
      />
    </div>
  );
}
