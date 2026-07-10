import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { App } from './App'
import './index.css'

// El admin se sirve bajo /admin (base de Vite). El router usa esa misma base.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  </StrictMode>,
)
