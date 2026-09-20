import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SettingsProvider } from './context/SettingsContext.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { SpotifyPlayerProvider } from './context/SpotifyPlayerContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <SpotifyPlayerProvider>
            <App />
          </SpotifyPlayerProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
