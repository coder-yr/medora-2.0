import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initDemoInterceptor } from './config/demo-interceptor'

// Enable resilient client-side demo fallback for static cloud deployments (e.g. Vercel)
initDemoInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
