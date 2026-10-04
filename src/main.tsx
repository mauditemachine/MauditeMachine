import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
// Ecran d'accueil (2026-10-04) : beforeinstallprompt est ecoute des le depart,
// il peut partir avant le chunk de la v4 (src/v4/state/install.ts)
import './v4/state/install'


const container = document.getElementById('root')!
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)


