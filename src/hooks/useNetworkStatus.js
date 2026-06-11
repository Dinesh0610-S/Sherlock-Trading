import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  setWasOffline(true); };
    const onOffline = () => { setIsOnline(false); };
    
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
