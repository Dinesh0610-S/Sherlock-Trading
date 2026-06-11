import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import { refreshManager } from '../../services/DataRefreshManager';
import ExpectedMovePanel from '../../components/ExpectedMovePanel';
import IVRankPanel from '../../components/IVRankPanel';
import UnusualOIDetector from '../../components/UnusualOIDetector';
import MultiExpiryComparison from '../../components/MultiExpiryComparison';
import GreeksDisplay from '../../components/GreeksDisplay';

export default function OptionChain() {
  const [selectedAsset, setSelectedAsset] = usePersistedState('symbol', '^NSEI');
  const [selectedExpiry, setSelectedExpiry] = usePersistedState('selectedExpiry', '');
  const [optionChainData, setOptionChainData] = useState(null);
  const [optionsChain, setOptionsChain] = useState([]);
  const [indicators, setIndicators] = useState({ spot_price: 24000, max_pain: 24000, pcr: 1.0 });

  // Option LTP Flashing Effect states & refs
  const [optionFlashClasses, setOptionFlashClasses] = useState({});
  const prevOptionsLTPRef = useRef({});

  // Reset selectedExpiry on asset change
  useEffect(() => {
    setSelectedExpiry('');
  }, [selectedAsset]);

  const fetchOptionsChain = async () => {
    try {
      const cleanSymbol = selectedAsset.replace('.NS', '').replace('.BO', '');
      const sym = cleanSymbol === '^NSEI' ? 'NIFTY' : cleanSymbol === '^NSEBANK' ? 'BANKNIFTY' : cleanSymbol;
      const res = await fetch(`/api/nse/option-chain?symbol=${encodeURIComponent(sym)}&expiry=${selectedExpiry}&_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setOptionChainData(json);
        setOptionsChain(json.strikewise || []);
      }

      // Fetch indicators for backup spot/maxPain/pcr
      const indRes = await fetch(`/api/indicators?symbol=${encodeURIComponent(cleanSymbol)}`);
      if (indRes.ok) {
        const indJson = await indRes.json();
        setIndicators(prev => ({
          ...prev,
          spot_price: indJson.rsiValid ? (indJson.spot_price || prev.spot_price) : prev.spot_price,
          max_pain: indJson.max_pain || prev.max_pain,
          pcr: indJson.pcr || prev.pcr
        }));
      }
    } catch (e) {
      console.error('Error fetching options chain:', e);
    }
  };

  // Centralized refreshing via DataRefreshManager
  useEffect(() => {
    fetchOptionsChain();
    refreshManager.register('option-chain', fetchOptionsChain, 3000);
    return () => {
      refreshManager.unregister('option-chain');
    };
  }, [selectedAsset, selectedExpiry]);

  // Option LTP Flashing Effect
  useEffect(() => {
    if (!optionsChain || optionsChain.length === 0) return;

    const newClasses = {};
    let hasChanges = false;

    optionsChain.forEach(item => {
      const strike = item.strike;
      const prevData = prevOptionsLTPRef.current[strike] || {};
      const prevCall = prevData.callLtp;
      const prevPut = prevData.putLtp;

      let callClass = '';
      let putClass = '';

      if (prevCall !== undefined && item.call_ltp !== prevCall) {
        callClass = item.call_ltp > prevCall ? 'flash-green-text' : 'flash-red-text';
        hasChanges = true;
      }
      if (prevPut !== undefined && item.put_ltp !== prevPut) {
        putClass = item.put_ltp > prevPut ? 'flash-green-text' : 'flash-red-text';
        hasChanges = true;
      }

      newClasses[strike] = { call: callClass, put: putClass };
      prevOptionsLTPRef.current[strike] = { callLtp: item.call_ltp, putLtp: item.put_ltp };
    });

    if (hasChanges) {
      setOptionFlashClasses(newClasses);
      const timer = setTimeout(() => {
        setOptionFlashClasses({});
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [optionsChain]);

  // Dynamic Option Chain Calculations
  const optionMetrics = React.useMemo(() => {
    const spot = optionChainData?.spot || indicators.spot_price || 24000;
    const maxPainVal = optionChainData?.maxPain?.strike || indicators.max_pain || 24000;
    const pcrVal = optionChainData?.pcr || indicators.pcr || 1.0;

    if (!optionsChain || optionsChain.length === 0) {
      return {
        maxPain: maxPainVal,
        pcr: pcrVal,
        atmIv: '13.2%',
        callPeakOiStrike: '24,000'
      };
    }
    
    // Call Peak OI
    let peakCallOi = -1;
    let peakCallStrike = null;
    optionsChain.forEach(item => {
      if (item.ce && item.ce.oi > peakCallOi) {
        peakCallOi = item.ce.oi;
        peakCallStrike = item.strike;
      }
    });

    // ATM IV: closest strike to spot price
    let minDiff = Infinity;
    let atmItem = null;
    optionsChain.forEach(item => {
      const diff = Math.abs(item.strike - spot);
      if (diff < minDiff) {
        minDiff = diff;
        atmItem = item;
      }
    });

    const ceIV = atmItem?.ce?.iv || 0;
    const peIV = atmItem?.pe?.iv || 0;
    const atmIvAvg = ceIV > 0 && peIV > 0 ? ((ceIV + peIV) / 2).toFixed(1) : ceIV || peIV || 13.2;

    return {
      maxPain: maxPainVal,
      pcr: pcrVal,
      atmIv: atmItem ? `${atmIvAvg}%` : '13.2%',
      callPeakOiStrike: peakCallStrike ? peakCallStrike.toLocaleString() : '24,000'
    };
  }, [optionChainData, optionsChain, indicators.spot_price, indicators.max_pain, indicators.pcr]);

  return (
    <div>
      {/* Expiry Selector Dropdown */}
      {optionChainData?.allExpiries && optionChainData.allExpiries.length > 0 && (
        <div className="expiry-selector-wrapper" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Select Expiry:</span>
          <select
            value={selectedExpiry || optionChainData.expiry || ''}
            onChange={(e) => setSelectedExpiry(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {optionChainData.allExpiries.map(exp => (
              <option key={exp} value={exp}>{exp}</option>
            ))}
          </select>
        </div>
      )}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Max Pain Strike</div>
          <div className="metric-value">₹{(optionMetrics.maxPain || 0).toLocaleString('en-IN')}</div>
          <div className="metric-sub">Balanced call/put pain index</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Put-Call Ratio (PCR)</div>
          <div className="metric-value metric-val-green">{(optionMetrics.pcr || 0).toFixed(2)}</div>
          <div className="metric-sub">
            {optionMetrics.pcr > 1.2 ? 'Bullish Write support' : optionMetrics.pcr < 0.8 ? 'Bearish Call resistance' : 'Balanced Sentiment'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Atm IV</div>
          <div className="metric-value metric-val-gold">{optionMetrics.atmIv}</div>
          <div className="metric-sub">Low implied volatility regime</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Call Peak OI Strike</div>
          <div className="metric-value" style={{ color: 'var(--red)' }}>₹{optionMetrics.callPeakOiStrike}</div>
          <div className="metric-sub">Major overhead resistance</div>
        </div>
      </div>

      {/* Premium Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 w-full box-border">
        <div className="flex flex-col gap-4 w-full box-border">
          <ExpectedMovePanel symbol={selectedAsset} expiry={selectedExpiry || optionChainData?.expiry} />
          <IVRankPanel symbol={selectedAsset} />
        </div>
        <div className="flex flex-col gap-4 w-full box-border">
          <UnusualOIDetector symbol={selectedAsset} />
          <MultiExpiryComparison symbol={selectedAsset} selectedExpiry={selectedExpiry} setSelectedExpiry={setSelectedExpiry} />
        </div>
      </div>

      {/* Greeks Dashboard Panel */}
      <div className="mb-4 w-full box-border">
        <GreeksDisplay strikewise={optionsChain} spot={optionChainData?.spot || indicators.spot_price} expiry={selectedExpiry || optionChainData?.expiry} />
      </div>

      {/* Real Option Chain Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📊 Live Strike Expiry Option Chain - {selectedAsset === '^NSEI' ? 'NIFTY 50' : selectedAsset === '^NSEBANK' ? 'BANK NIFTY' : selectedAsset.replace('.NS', '')}</div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CE BUILTUP</th>
                  <th>Call OI</th>
                  <th>Call LTP</th>
                  <th>Call IV</th>
                  <th style={{ textAlign: 'center' }}>Strike Price</th>
                  <th>Put IV</th>
                  <th>Put LTP</th>
                  <th>Put OI</th>
                  <th>PE BUILTUP</th>
                </tr>
              </thead>
              <tbody>
                {optionsChain.length > 0 ? (
                  optionsChain.map((item, idx) => {
                    const spot = optionChainData?.spot || indicators.spot_price || 24000;
                    const isCallItm = item.strike < spot;
                    const isPutItm = item.strike > spot;
                    
                    const callFlash = optionFlashClasses[item.strike]?.call || '';
                    const putFlash = optionFlashClasses[item.strike]?.put || '';

                    const getBuildupClass = (b) => {
                      if (!b) return '';
                      return b.toLowerCase().replace('_', '-');
                    };
                    
                    return (
                      <tr key={idx} className={item.isATM ? 'atm-strike-row' : ''}>
                        {/* CE Buildup */}
                        <td style={{ background: isCallItm ? 'rgba(0, 201, 167, 0.04)' : 'transparent', fontSize: 10 }}>
                          <span className={`buildup-mini-tag ${getBuildupClass(item.ce?.buildupType)}`}>
                            {(item.ce?.buildupType || 'NEUTRAL').replace('_', ' ')}
                          </span>
                        </td>
                        {/* Call Columns */}
                        <td style={{ background: isCallItm ? 'rgba(0, 201, 167, 0.04)' : 'transparent' }}>
                          {item.ce?.oi?.toLocaleString() || '0'}
                          <span style={{ fontSize: 9, color: item.ce?.oiChange >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 4 }}>
                            ({item.ce?.oiChange >= 0 ? '+' : ''}{(item.ce?.oiChange / 1000).toFixed(0)}K)
                          </span>
                        </td>
                        <td style={{ background: isCallItm ? 'rgba(0, 201, 167, 0.04)' : 'transparent' }} className={callFlash}>
                          ₹{item.ce?.ltp?.toFixed(2) || '0.00'}
                        </td>
                        <td style={{ background: isCallItm ? 'rgba(0, 201, 167, 0.04)' : 'transparent' }}>
                          {item.ce?.iv?.toFixed(1) || '0.0'}%
                        </td>
                        
                        {/* Strike */}
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--gold-bright)', background: item.isATM ? 'rgba(245,166,35,0.08)' : 'transparent' }}>
                          {item.strike.toLocaleString()}
                          {item.isATM && <span style={{ fontSize: 8, color: 'var(--gold)', marginLeft: 4, background: 'rgba(245,166,35,0.15)', padding: '1px 3px', borderRadius: 2 }}>ATM</span>}
                        </td>
                        
                        {/* Put Columns */}
                        <td style={{ background: isPutItm ? 'rgba(255, 77, 77, 0.04)' : 'transparent' }}>
                          {item.pe?.iv?.toFixed(1) || '0.0'}%
                        </td>
                        <td style={{ background: isPutItm ? 'rgba(255, 77, 77, 0.04)' : 'transparent' }} className={putFlash}>
                          ₹{item.pe?.ltp?.toFixed(2) || '0.00'}
                        </td>
                        <td style={{ background: isPutItm ? 'rgba(255, 77, 77, 0.04)' : 'transparent' }}>
                          {item.pe?.oi?.toLocaleString() || '0'}
                          <span style={{ fontSize: 9, color: item.pe?.oiChange >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 4 }}>
                            ({item.pe?.oiChange >= 0 ? '+' : ''}{(item.pe?.oiChange / 1000).toFixed(0)}K)
                          </span>
                        </td>
                        {/* PE Buildup */}
                        <td style={{ background: isPutItm ? 'rgba(255, 77, 77, 0.04)' : 'transparent', fontSize: 10 }}>
                          <span className={`buildup-mini-tag ${getBuildupClass(item.pe?.buildupType)}`}>
                            {(item.pe?.buildupType || 'NEUTRAL').replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                      No option chain data available for expiry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
