import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

/* Cloudflare Web Analytics (privacy-friendly, no cookies). Set VITE_CF_ANALYTICS_TOKEN on the Pages project to
   the token from Cloudflare → Web Analytics → the site → "JS snippet"; nothing loads without it. */
const cfToken = import.meta.env.VITE_CF_ANALYTICS_TOKEN
if (cfToken) {
  const sc = document.createElement('script')
  sc.defer = true; sc.src = 'https://static.cloudflareinsights.com/beacon.min.js'; sc.setAttribute('data-cf-beacon', JSON.stringify({ token: cfToken }))
  document.head.appendChild(sc)
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
)
