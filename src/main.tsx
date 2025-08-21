import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './components/Discography/Discography.css'

const container = document.getElementById('root')!
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)


