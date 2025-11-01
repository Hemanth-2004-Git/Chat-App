import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/authcontext.jsx'
import { ChatProvider } from '../context/chatcontext.jsx' // ✅ Import ChatProvider

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ChatProvider> {/* ✅ Wrap with ChatProvider */}
        <App />
      </ChatProvider>
    </AuthProvider>
  </BrowserRouter>,
)