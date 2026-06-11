import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8501,
    strictPort: true,
    proxy: {
      // Direct proxy for pre-market scans to Node server on port 3001
      '/api/premarket': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Direct proxy for NSE quote / option chain to Node server on port 3001
      '/api/nse': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Direct proxy for BSE quote / option chain to Node server on port 3001
      '/api/bse': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Direct proxy for health check to Node server on port 3001
      '/api/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Direct proxy for indicators to Node server on port 3001
      '/api/indicators': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Direct proxy for candles to Node server on port 3001
      '/api/candles': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Direct proxy for FII/DII to Node server on port 3001
      '/api/fiidii': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Morning market data (Yahoo Finance via Node proxy, port 3001)
      '/api/morning/': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Direct proxy for Sherlock Verdict endpoints to Node server on port 3001
      '/api/verdict': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Direct proxy for Claude Chat to Node server on port 3001
      '/api/chat': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      // Flask Python backend (port 5000) — trading engine, indicators, backtest, etc.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // Node.js NSE Proxy (port 3001) — real NSE/Yahoo data
      '/nse': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/nse/, '/api/nse'),
      },
      // SSE live stream from Node.js proxy
      '/live-stream': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => '/api/live-stream' + path.replace('/live-stream', ''),
      },
      // TradingView UDF endpoints (port 3001)
      '/udf': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    }
  }
})
