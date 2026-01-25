import './style.css'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import { StrictMode } from 'react'

createRoot(document.querySelector('#root')).render(<StrictMode><App /></StrictMode>)