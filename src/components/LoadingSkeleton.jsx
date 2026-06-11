import React from 'react';

function LoadingSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[200, 160, 280, 120, 200].map((w, i) => (
        <div key={i} className="ds-skeleton" style={{ width: w, height: 16 }} />
      ))}
    </div>
  );
}

export default LoadingSkeleton;
