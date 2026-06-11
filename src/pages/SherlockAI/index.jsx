import React, { useState, useEffect } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useNSELiveData } from '../../hooks/useNSELiveData';
import { refreshManager } from '../../services/DataRefreshManager';
import HolmesChat from '../../components/HolmesChat';

export default function SherlockAI() {
  const [selectedAsset, setSelectedAsset] = usePersistedState('symbol', '^NSEI');
  
  const nseSymbolMap = {
    '^NSEI': 'NIFTY', '^NSEBANK': 'BANKNIFTY', 'RELIANCE.NS': 'RELIANCE',
    'HDFCBANK.NS': 'HDFCBANK', 'TCS.NS': 'TCS', 'INFY.NS': 'INFY',
    'ICICIBANK.NS': 'ICICIBANK', 'SBIN.NS': 'SBIN', 'BHARTIARTL.NS': 'BHARTIARTL',
    'ITC.NS': 'ITC', 'LT.NS': 'LT', 'KOTAKBANK.NS': 'KOTAKBANK',
  };
  const nseSymbol = nseSymbolMap[selectedAsset] || selectedAsset.replace('.NS','').replace('.BO','');
  const nseData = useNSELiveData(nseSymbol);

  const [indicators, setIndicators] = useState({
    spot_price: 23664.35,
    rsi: 57.4,
    ema_status: 'Bullish Alignment (9 > 21)',
    vwap_position: 'above vwap',
    vwap_val: 23610.20,
    vwapValid: true,
    vwap: 23610.20,
    vwapPosition: 'ABOVE',
    pcr: 1.43,
    max_pain: 23500.0,
    price_change_pct: 0.85
  });

  const [fiiDiiToday, setFiiDiiToday] = useState(null);
  const [fiiDiiData, setFiiDiiData] = useState([]);
  const [deepClueData, setDeepClueData] = useState({
    deliveryPct: null,
    institutionalBuy: null,
    institutionalSell: null,
    vixPrice: null,
    vixChangePct: null,
    globalCues: null,
    sectorFlow: null,
    loading: false
  });

  const fetchFiiDii = async () => {
    try {
      const todayRes = await fetch(`/api/fiidii/today?_t=${Date.now()}`);
      if (todayRes.ok) {
        const todayData = await todayRes.json();
        if (!todayData.error) {
          setFiiDiiToday(todayData);
        }
      }
    } catch (e) {
      console.warn('FII/DII today fetch failed:', e);
    }

    try {
      const historyRes = await fetch(`/api/fiidii/history?_t=${Date.now()}`);
      if (historyRes.ok) {
        const resJson = await historyRes.json();
        const rawHistory = Array.isArray(resJson) ? resJson : (resJson.data || []);
        if (Array.isArray(rawHistory)) {
          const historyData = rawHistory.map(item => {
            const fBuy  = parseFloat(item.fii_buy  || item.fiiBuy  || item.buyValue  || 0);
            const fSell = parseFloat(item.fii_sell || item.fiiSell || item.sellValue || 0);
            const fNet  = parseFloat(item.fii_net  || item.fiiNet  || item.netValue  || (fBuy - fSell));
            const dBuy  = parseFloat(item.dii_buy  || item.diiBuy  || item.buyValue  || 0);
            const dSell = parseFloat(item.dii_sell || item.diiSell || item.sellValue || 0);
            const dNet  = parseFloat(item.dii_net  || item.diiNet  || item.netValue  || (dBuy - dSell));
            return {
              date: item.date || item.tradeDate || '',
              fii_buy: fBuy, fii_sell: fSell, fii_net: fNet,
              dii_buy: dBuy, dii_sell: dSell, dii_net: dNet
            };
          }).filter(item => item.date);
          setFiiDiiData(historyData);
        }
      }
    } catch (e) {
      console.warn('FII/DII history fetch failed:', e);
    }
  };

  const fetchDeepClueBoard = async () => {
    setDeepClueData(prev => ({ ...prev, loading: true }));
    try {
      const ticker = selectedAsset;
      const cleanSymbol = nseSymbolMap[ticker] || ticker.replace('.NS','').replace('.BO','');
      
      const [delRes, bulkRes, vixRes, cuesRes, sectorRes] = await Promise.all([
        fetch(`/api/nse/delivery-percent?symbol=${cleanSymbol}&_t=${Date.now()}`),
        fetch(`/api/nse/bulk-block-deals?symbol=${cleanSymbol}&_t=${Date.now()}`),
        fetch(`/api/nse/india-vix?_t=${Date.now()}`),
        fetch(`/api/nse/global-cues?_t=${Date.now()}`),
        fetch(`/api/nse/sector-flow?_t=${Date.now()}`)
      ]);
      
      const [deliveryPercent, bulkBlockDeals, indiaVix, globalCues, sectorFlow] = await Promise.all([
        delRes.ok ? delRes.json() : null,
        bulkRes.ok ? bulkRes.json() : null,
        vixRes.ok ? vixRes.json() : null,
        cuesRes.ok ? cuesRes.json() : null,
        sectorRes.ok ? sectorRes.json() : null
      ]);
      
      setDeepClueData({
        deliveryPct: deliveryPercent?.deliveryPct ?? null,
        institutionalBuy: bulkBlockDeals?.institutionalBuy ?? null,
        institutionalSell: bulkBlockDeals?.institutionalSell ?? null,
        vixPrice: indiaVix?.price ?? null,
        vixChangePct: indiaVix?.changePct ?? null,
        globalCues: globalCues ?? null,
        sectorFlow: sectorFlow ?? null,
        loading: false
      });
    } catch (err) {
      console.error('Error fetching deep clue board data:', err);
      setDeepClueData(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchMarketData = async () => {
    try {
      const res = await fetch(`/api/market-data?ticker=${selectedAsset}&period=5d&interval=15m&_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.indicators) {
          const cleanSymbol = selectedAsset.replace('.NS', '').replace('.BO', '');
          try {
            const indRes = await fetch(`/api/indicators?symbol=${cleanSymbol}`);
            if (indRes.ok) {
              const indJson = await indRes.json();
              const mergedIndicators = {
                spot_price:       indJson.spot || json.indicators.spot_price,
                rsi:              indJson.rsi14 || json.indicators.rsi,
                ema_status:       indJson.ema9 > indJson.ema21 ? 'Bullish Alignment (9 > 21)' : 'Bearish Alignment (9 < 21)',
                vwap_position:    indJson.vwapPosition === 'ABOVE' ? 'above vwap' : indJson.vwapPosition === 'BELOW' ? 'below vwap' : 'neutral',
                vwap_val:         indJson.vwap || json.indicators.vwap_val,
                vwapValid:        indJson.vwapValid,
                vwap:             indJson.vwap,
                vwapPosition:     indJson.vwapPosition,
                pcr:              json.indicators.pcr,
                max_pain:         json.indicators.max_pain,
                price_change_pct: json.indicators.price_change_pct,
                spot_below_ema21: indJson.spot < indJson.ema21,
                is_restricted:    json.indicators.is_restricted,
                deduced_direction: json.indicators.deduced_direction
              };
              setIndicators(mergedIndicators);
              return;
            }
          } catch (err) {
            console.error('Error merging real indicators:', err);
          }
          
          const fallbackIndicators = {
            ...json.indicators,
            vwapValid: false,
            vwap: null,
            vwapPosition: 'UNKNOWN'
          };
          setIndicators(fallbackIndicators);
        }
      }
    } catch (e) {
      console.error('Error fetching market data:', e);
    }
  };

  useEffect(() => {
    fetchFiiDii();
    fetchDeepClueBoard();
    fetchMarketData();
  }, [selectedAsset]);

  // Interval-based refresh
  useEffect(() => {
    refreshManager.register('sherlock-ai-market-data', fetchMarketData, 15000);
    return () => refreshManager.unregister('sherlock-ai-market-data');
  }, [selectedAsset]);

  return (
    <HolmesChat
      nseData={nseData}
      nseSymbol={nseSymbol}
      indicators={indicators}
      fiiDiiToday={fiiDiiToday}
      fiiDiiData={fiiDiiData}
      deepClueData={deepClueData}
    />
  );
}
