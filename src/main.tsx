import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import unmuteIosAudio from 'unmute-ios-audio'
import './index.css'
import App from './App.tsx'

// Enable Web Audio playback even when iOS mute switch is on
// Works on iOS Safari & Chrome (both use WebKit)
unmuteIosAudio()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
