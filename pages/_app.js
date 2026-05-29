import '../styles/globals.css';
import { AuthProvider } from '../hooks/useAuth';
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'sans-serif', background: '#f9fafb', padding: '2rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '1rem', padding: '2rem',
            maxWidth: '500px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            border: '1px solid #fee2e2'
          }}>
            <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ color: '#dc2626', fontWeight: 800, marginBottom: '0.5rem', textAlign: 'center' }}>
              Terjadi Kesalahan
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.5rem' }}>
              {this.state.error?.message || 'Komponen gagal dimuat.'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{
                width: '100%', padding: '0.75rem', background: '#2563eb', color: 'white',
                border: 'none', borderRadius: '0.5rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem'
              }}
            >
              🔄 Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ErrorBoundary>
  );
}
