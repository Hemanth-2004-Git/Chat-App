import React, { useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProfilePage from './pages/ProfilePage'
import {Toaster} from "react-hot-toast"
import { authcontext } from '../context/authcontext.jsx'
import IncomingCallModal from './components/IncomingCallModal'
import ActiveCallModal from './components/ActiveCallModal'

const App = () => {
  const { authuser, isLoading } = useContext(authcontext)

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-white">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1f2937',
            color: 'white',
            border: '1px solid #374151'
          }
        }}
      />

      {/* VoIP Call Modals */}
      {authuser && (
        <>
          <IncomingCallModal />
          <ActiveCallModal />
        </>
      )}

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={!authuser ? <LoginPage /> : <Navigate to="/home" replace />} />
        <Route path="/signup" element={!authuser ? <SignupPage /> : <Navigate to="/home" replace />} />
        
        {/* Protected routes */}
        <Route path="/home" element={authuser ? <HomePage /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={authuser ? <ProfilePage /> : <Navigate to="/login" replace />} />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to={authuser ? "/home" : "/login"} replace />} />
        
        {/* 404 page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App