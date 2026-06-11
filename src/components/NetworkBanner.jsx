import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

function NetworkBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();
  if (isOnline && !wasOffline) return null;
  
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      padding: '6px 16px', textAlign: 'center',
      fontSize: '12px', fontFamily: 'JetBrains Mono, monospace',
      background: isOnline ? '#00FF8820' : '#FF444420',
      borderBottom: `1px solid ${isOnline ? '#00FF88' : '#FF4444'}`,
      color: isOnline ? '#00FF88' : '#FF4444',
      transition: 'all 0.3s ease',
    }}>
      {isOnline
        ? '✅ Connection restored — refreshing data...'
        : '⚠ No internet connection — showing last known data'}
    </div>
  );
}

export default NetworkBanner;
