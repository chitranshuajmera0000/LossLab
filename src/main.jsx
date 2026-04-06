import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.jsx'
import { SessionProvider } from './context/SessionContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg3)',
              color: 'var(--text0)',
              border: '1px solid var(--border2)',
            },
          }}
        />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
