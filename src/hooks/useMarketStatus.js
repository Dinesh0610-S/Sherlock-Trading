import { useState, useEffect } from 'react';

/**
 * Helper function to calculate market status based on IST (Asia/Kolkata)
 */
export function calculateMarketStatus(date = new Date()) {
  try {
    // Format to parts in Asia/Kolkata timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'long'
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type) => parts.find(p => p.type === type).value;

    const weekday = getPart('weekday'); // "Monday", "Tuesday", etc.
    const year = getPart('year');       // e.g. "2026"
    const month = getPart('month');     // e.g. "05"
    const day = getPart('day');         // e.g. "22"
    const hour = parseInt(getPart('hour'), 10);
    const minute = parseInt(getPart('minute'), 10);
    const second = parseInt(getPart('second'), 10);

    const dateStr = `${year}-${month}-${day}`;

    // Standard Indian Market (NSE/BSE) Holidays for 2026 (weekdays only)
    const holidays2026 = [
      '2026-01-26', // Republic Day
      '2026-03-03', // Holi
      '2026-03-26', // Shri Ram Navami
      '2026-03-31', // Shri Mahavir Jayanti
      '2026-04-03', // Good Friday
      '2026-04-14', // Dr. Baba Saheb Ambedkar Jayanti
      '2026-05-01', // Maharashtra Day
      '2026-05-28', // Bakri Id
      '2026-06-26', // Muharram
      '2026-09-14', // Ganesh Chaturthi
      '2026-10-02', // Mahatma Gandhi Jayanti
      '2026-10-20', // Dussehra
      '2026-11-10', // Diwali Balipratipada
      '2026-11-24', // Sri Guru Nanak Dev Jayanti
      '2026-12-25', // Christmas
    ];

    // 1. Day of the Week Rule (Monday through Friday)
    const isTradingDay = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday);
    if (!isTradingDay) {
      return { status: 'CLOSED', color: '#f44336' };
    }

    // 2. Holiday Rule
    if (holidays2026.includes(dateStr)) {
      return { status: 'CLOSED', color: '#f44336' };
    }

    // 3. Timings Rule (09:15:00 to 15:30:00 IST)
    const timeInSeconds = hour * 3600 + minute * 60 + second;
    const marketOpenSeconds = 9 * 3600 + 15 * 60; // 09:15:00
    const marketCloseSeconds = 15 * 3600 + 30 * 60; // 15:30:00

    if (timeInSeconds >= marketOpenSeconds && timeInSeconds < marketCloseSeconds) {
      return { status: 'OPEN', color: '#4caf50' };
    } else {
      return { status: 'CLOSED', color: '#f44336' };
    }
  } catch (error) {
    console.error('Error calculating market status:', error);
    // Fallback safe defaults
    return { status: 'CLOSED', color: '#f44336' };
  }
}

/**
 * React hook that returns { status: 'OPEN' | 'CLOSED', color: string }
 * Updates in real-time every second.
 */
export function useMarketStatus() {
  const [marketStatus, setMarketStatus] = useState(() => calculateMarketStatus());

  useEffect(() => {
    const update = () => {
      setMarketStatus(calculateMarketStatus());
    };

    update();
    const intervalId = setInterval(update, 1000);
    return () => clearInterval(intervalId);
  }, []);

  return marketStatus;
}
