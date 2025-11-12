import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../context/authcontext.jsx'
import { ChatProvider } from '../context/chatcontext.jsx' // ✅ Import ChatProvider
import { CallContextProvider } from '../context/callcontext.jsx' // ✅ Import CallContextProvider

// Inner component to access auth context for call provider
const AppWithCallContext = () => {
  const { socket } = useAuth();
  
  return (
    <CallContextProvider socket={socket}>
      <App />
    </CallContextProvider>
  );
};

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ChatProvider> {/* ✅ Wrap with ChatProvider */}
        <AppWithCallContext />
      </ChatProvider>
    </AuthProvider>
  </BrowserRouter>,
)