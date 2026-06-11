class DataRefreshManager {
  constructor() {
    this.subscribers = new Map();
    this.ticker = null;
  }

  // Register a callback at a given interval:
  register(id, callback, intervalMs) {
    this.subscribers.set(id, { callback, interval: intervalMs, lastRun: 0 });
    if (!this.ticker) this.start();
  }

  unregister(id) {
    this.subscribers.delete(id);
    if (this.subscribers.size === 0) this.stop();
  }

  start() {
    // One ticker that runs every 5 seconds and dispatches subscribers:
    this.ticker = setInterval(() => {
      const now = Date.now();
      this.subscribers.forEach((sub, id) => {
        if (now - sub.lastRun >= sub.interval) {
          sub.lastRun = now;
          try {
            const res = sub.callback();
            if (res instanceof Promise) {
              res.catch(e => console.error(`Refresh async error [${id}]:`, e));
            }
          } catch (e) {
            console.error(`Refresh error [${id}]:`, e);
          }
        }
      });
    }, 5000); // check every 5s, dispatch based on each sub's interval
  }

  stop() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  // Pause all fetching (e.g. tab is hidden):
  pause() {
    this.stop();
  }

  resume() {
    if (this.subscribers.size > 0 && !this.ticker) {
      this.start();
    }
  }
}

export const refreshManager = new DataRefreshManager();

// Pause when tab hidden — saves API calls:
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) refreshManager.pause();
    else refreshManager.resume();
  });
}
