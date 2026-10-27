import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { registerSW } from 'virtual:pwa-register'
import '@styles/index.css'

// Register PWA service worker
registerSW({ immediate: true })

/**
 * VotEth 2.0 — Application Entry Point
 *
 * Mounts the React application into the #root div.
 * All providers (QueryClient, Router, Auth, Wallet) are composed in App.tsx.
 */

const root = document.getElementById('root')

if (!root) {
  throw new Error(
    '[VotEth] Fatal: #root element not found in index.html. ' +
    'The application cannot mount.'
  )
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
