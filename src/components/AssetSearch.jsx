import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';

/**
 * AssetSearch — Debounced searchable dropdown for the full asset universe.
 *
 * Props:
 *   value        (string)   current yf_ticker or symbol
 *   onSelect     (fn)       called with { symbol, yf_ticker, label, type, lot_size, ... }
 *   placeholder  (string)   input placeholder text
 *   className    (string)   extra CSS class for the wrapper
 *
 * The dropdown renders via ReactDOM.createPortal into document.body so it
 * is NEVER trapped inside a parent stacking context (z-index, transform,
 * filter, will-change, etc.).  Position is kept in sync via
 * getBoundingClientRect + scroll/resize listeners.
 */
export default function AssetSearch({ value, onSelect, placeholder = 'Search symbol or company…', className = '' }) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [displayValue, setDisplayValue] = useState(value || '');
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });

  const wrapperRef  = useRef(null);
  const inputRef    = useRef(null);
  const debounceRef = useRef(null);

  // ── Compute dropdown position from the input bounding rect ──────────────────
  const updateDropdownPos = useCallback(() => {
    const el = inputRef.current || wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownRect({
      top:   rect.bottom + window.scrollY + 4,
      left:  rect.left   + window.scrollX,
      width: rect.width,
    });
  }, []);

  // Re-position on scroll and resize while dropdown is open
  useEffect(() => {
    if (!open) return;
    updateDropdownPos();
    window.addEventListener('scroll', updateDropdownPos, true);
    window.addEventListener('resize', updateDropdownPos);
    return () => {
      window.removeEventListener('scroll', updateDropdownPos, true);
      window.removeEventListener('resize', updateDropdownPos);
    };
  }, [open, updateDropdownPos]);

  // Group results by type for display
  const TYPE_ORDER  = ['INDEX', 'FO_EQUITY', 'EQUITY', 'OPTION', 'FUTURE'];
  const TYPE_LABELS = {
    INDEX:     '📈 Indices',
    FO_EQUITY: '⚡ F&O Stocks',
    EQUITY:    '🏢 Nifty 500',
    OPTION:    '🎯 Options',
    FUTURE:    '📅 Futures',
  };

  const groupedResults = TYPE_ORDER.reduce((acc, type) => {
    const items = results.filter(r => r.type === type);
    if (items.length) acc.push({ type, label: TYPE_LABELS[type], items });
    return acc;
  }, []);

  // Flat list for keyboard navigation
  const flatResults = results;

  // ── Fetch from API ──────────────────────────────────────────────────────────
  const fetchResults = useCallback(async (q) => {
    if (!q || q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/asset-universe?q=${encodeURIComponent(q)}&limit=60`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
        setHighlighted(0);
        updateDropdownPos();
      }
    } catch (e) {
      console.error('AssetSearch fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [updateDropdownPos]);

  // ── Debounce on input change ────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(q), 220);
  };

  // ── Keyboard navigation ─────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[highlighted]) handleSelect(flatResults[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  // ── Select an item ──────────────────────────────────────────────────────────
  const handleSelect = (item) => {
    setDisplayValue(item.symbol);
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect && onSelect(item);
  };

  // ── Click outside to close ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Close if click is outside the wrapper AND outside the portal dropdown
      const isInsideWrapper  = wrapperRef.current?.contains(e.target);
      const isInsidePortal   = e.target.closest?.('[data-asset-search-portal]');
      if (!isInsideWrapper && !isInsidePortal) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Sync external value changes ─────────────────────────────────────────────
  useEffect(() => { setDisplayValue(value || ''); }, [value]);

  // ── Cleanup debounce on unmount ─────────────────────────────────────────────
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const typeColorMap = {
    INDEX:     '#7c83fd',
    FO_EQUITY: '#f5a623',
    EQUITY:    '#4caf50',
    OPTION:    '#e91e63',
    FUTURE:    '#00bcd4',
  };

  // ── Portal dropdown — renders on document.body, above ALL stacking contexts ──
  const portalDropdown = open && (results.length > 0 || (query.length >= 1 && !loading)) && ReactDOM.createPortal(
    <div
      data-asset-search-portal="true"
      style={{
        position:        'fixed',
        top:             dropdownRect.top - window.scrollY,
        left:            dropdownRect.left - window.scrollX,
        width:           Math.max(dropdownRect.width, 360),
        maxWidth:        520,
        maxHeight:       420,
        overflowY:       'auto',
        background:      'var(--bg-elevated, #1a2035)',
        border:          '1px solid var(--border-bright, rgba(201,168,76,0.3))',
        borderRadius:    10,
        boxShadow:       '0 16px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(201,168,76,0.12)',
        zIndex:          99999,
        scrollbarWidth:  'thin',
        scrollbarColor:  'rgba(201,168,76,0.4) transparent',
      }}
    >
      {results.length > 0 ? (
        groupedResults.map(group => {
          const flatOffset = flatResults.indexOf(group.items[0]);
          return (
            <div key={group.type}>
              <div style={{
                padding:         '6px 14px 4px',
                fontSize:        10,
                fontWeight:      700,
                textTransform:   'uppercase',
                letterSpacing:   '0.8px',
                color:           'var(--text-muted, #6b7a99)',
                background:      'rgba(0,0,0,0.25)',
                borderBottom:    '1px solid var(--border, rgba(255,255,255,0.07))',
                position:        'sticky',
                top:             0,
                zIndex:          1,
              }}>
                {group.label}
              </div>
              {group.items.map((item, idx) => {
                const globalIdx = flatOffset + idx;
                const isHL = globalIdx === highlighted;
                const typeColor = typeColorMap[item.type] || '#aaa';
                return (
                  <button
                    key={item.symbol + (item.strike || '') + (item.expiry || '')}
                    data-asset-search-portal="true"
                    style={{
                      display:         'flex',
                      alignItems:      'center',
                      gap:             8,
                      width:           '100%',
                      padding:         '7px 14px',
                      background:      isHL ? 'rgba(201,168,76,0.1)' : 'transparent',
                      border:          'none',
                      borderBottom:    '1px solid rgba(255,255,255,0.03)',
                      cursor:          'pointer',
                      textAlign:       'left',
                      color:           'var(--text-primary, #e8dfc8)',
                      fontFamily:      'var(--font-mono, monospace)',
                      fontSize:        12,
                      transition:      'background 0.1s ease',
                    }}
                    onMouseEnter={() => setHighlighted(globalIdx)}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', minWidth: 90, whiteSpace: 'nowrap' }}>
                      {item.symbol}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary, #8a9ab0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.type === 'OPTION' || item.type === 'FUTURE'
                        ? item.label
                        : item.label.split('—')[1]?.trim() || ''}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, border: `1px solid ${typeColor}`, color: typeColor, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', opacity: 0.85 }}>
                      {item.type === 'FO_EQUITY' ? 'F&O' : item.type}
                    </span>
                    {item.sector && item.type !== 'OPTION' && item.type !== 'FUTURE' && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.sector}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })
      ) : (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          No assets found for "<strong>{query}</strong>"
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <div className={`asset-search-wrapper ${className}`} ref={wrapperRef}>
      {/* Current value chip */}
      {!open && displayValue && (
        <button
          className="asset-search-chip"
          onClick={() => {
            setOpen(true);
            setQuery('');
            updateDropdownPos();
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          title="Click to change asset"
        >
          <span className="chip-symbol">{displayValue}</span>
          <span className="chip-caret">▾</span>
        </button>
      )}

      {/* Search input */}
      {(open || !displayValue) && (
        <div className="asset-search-input-wrap">
          <span className="asset-search-icon">🔍</span>
          <input
            ref={inputRef}
            className="asset-search-input"
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.length >= 1) {
                setOpen(true);
                updateDropdownPos();
              }
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck="false"
          />
          {loading && <span className="asset-search-spinner">⟳</span>}
          {displayValue && (
            <button className="asset-search-close-btn" onClick={() => { setOpen(false); setQuery(''); }}>✕</button>
          )}
        </div>
      )}

      {/* Dropdown rendered as portal — OUTSIDE all stacking contexts */}
      {portalDropdown}
    </div>
  );
}
