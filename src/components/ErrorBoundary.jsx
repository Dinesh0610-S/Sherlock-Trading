import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#0A0C10', color: '#E0E0E0',
          minHeight: '100vh', display: 'flex',
          flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace',
          gap: '16px', padding: '32px',
        }}>
          <div style={{ color: '#FFB800', fontSize: '24px' }}>
            ⚠ Module Crashed
          </div>
          <div style={{ color: '#666', fontSize: '13px', maxWidth: '480px', textAlign: 'center' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '8px 20px', background: '#FFFFFF', color: '#000',
                border: 'none', borderRadius: '4px', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: '12px',
              }}>
              ↺ Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 20px', background: 'transparent',
                color: '#888', border: '1px solid #333', borderRadius: '4px',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
              }}>
              ⟳ Reload Page
            </button>
          </div>
          {(typeof process !== 'undefined' && process.env?.NODE_ENV === 'development' || import.meta.env?.DEV) && (
            <pre style={{
              color: '#444', fontSize: '10px', maxWidth: '600px',
              overflow: 'auto', marginTop: '16px', textAlign: 'left',
            }}>
              {this.state.errorInfo?.componentStack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
