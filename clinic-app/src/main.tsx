import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Auto-reload resilience for stale asset bundles
window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('Loading chunk') || e.message.includes('CSS') || e.message.includes('MIME type'))) {
    const lastReload = sessionStorage.getItem('last_asset_reload');
    if (!lastReload || Date.now() - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('last_asset_reload', String(Date.now()));
      window.location.reload();
    }
  }
}, true);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
