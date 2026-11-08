import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

// No pinch zoom / long-press menus.
document.addEventListener('gesturestart', (e) => e.preventDefault())
document.addEventListener('contextmenu', (e) => e.preventDefault())

createRoot(document.getElementById('root')!).render(<App />)
