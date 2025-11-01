import React, { useContext, useState, useEffect } from 'react'
import assets from '../assets/assets'
import { authcontext } from '../../context/authcontext'
import { useNavigate } from 'react-router-dom'

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true) // true for login, false for signup
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    bio: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { login, authuser } = useContext(authcontext)
  const navigate = useNavigate()

  // Redirect if already authenticated
  useEffect(() => {
    if (authuser) {
      navigate('/home')
    }
  }, [authuser, navigate])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      // Basic validation
      if (!formData.email || !formData.password) {
        setError('Email and password are required')
        return
      }

      if (!isLogin && !formData.fullName) {
        setError('Full name is required for signup')
        return
      }

      const mode = isLogin ? 'login' : 'signup'
      
      const credentials = isLogin 
        ? { email: formData.email, password: formData.password }
        : { 
            fullName: formData.fullName, 
            email: formData.email, 
            password: formData.password, 
            bio: formData.bio 
          }

      const success = await login(mode, credentials)
      
      if (success) {
        if (isLogin) {
          // Login successful - navigation will happen automatically via useEffect
          console.log('Login successful')
        } else {
          // Signup successful - show message and switch to login
          setIsLogin(true)
          setFormData(prev => ({ ...prev, password: '' })) // Clear password only
          setError('')
          // Show success message (you can use toast or state)
        }
      }

    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = () => {
    setIsLogin(!isLogin)
    setError('')
    // Clear form when switching modes
    setFormData({
      fullName: '',
      email: '',
      password: '',
      bio: ''
    })
  }

  return (
    <div className='min-h-screen bg-cover bg-center flex items-center justify-center gap-8 sm:justify-evenly max-sm:flex-col backdrop-blur-2xl p-4'>
      {/* Left Side - Brand/Logo */}
      <div className='flex flex-col items-center text-center'>
        <img src={assets.logo_big} alt="Logo" className='w-[min(30vw,250px)] mb-4' />
        <h1 className='text-3xl font-bold text-white mb-2'>Welcome to ChatApp</h1>
        <p className='text-gray-300 max-w-md'>
          {isLogin 
            ? 'Sign in to continue your conversations' 
            : 'Create an account to start chatting'
          }
        </p>
      </div>

      {/* Right Side - Form */}
      <div className='bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 w-full max-w-md'>
        <div className='text-center mb-6'>
          <h2 className='text-2xl font-bold text-white'>
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <p className='text-gray-300 mt-2'>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type='button'
              onClick={switchMode}
              className='text-violet-300 hover:text-violet-200 font-medium underline'
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Error Message */}
          {error && (
            <div className='bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-lg text-sm'>
              {error}
            </div>
          )}

          {/* Sign Up Fields */}
          {!isLogin && (
            <div>
              <label htmlFor='fullName' className='block text-sm font-medium text-gray-300 mb-1'>
                Full Name
              </label>
              <input
                id='fullName'
                name='fullName'
                type='text'
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder='Enter your full name'
                required={!isLogin}
                className='w-full px-4 py-3 bg-white/5 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'
              />
            </div>
          )}

          {/* Email Field */}
          <div>
            <label htmlFor='email' className='block text-sm font-medium text-gray-300 mb-1'>
              Email Address
            </label>
            <input
              id='email'
              name='email'
              type='email'
              value={formData.email}
              onChange={handleInputChange}
              placeholder='Enter your email'
              required
              className='w-full px-4 py-3 bg-white/5 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor='password' className='block text-sm font-medium text-gray-300 mb-1'>
              Password
            </label>
            <input
              id='password'
              name='password'
              type='password'
              value={formData.password}
              onChange={handleInputChange}
              placeholder='Enter your password'
              required
              minLength={6}
              className='w-full px-4 py-3 bg-white/5 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all'
            />
          </div>

          {/* Bio Field (Sign Up Only) */}
          {!isLogin && (
            <div>
              <label htmlFor='bio' className='block text-sm font-medium text-gray-300 mb-1'>
                Bio (Optional)
              </label>
              <textarea
                id='bio'
                name='bio'
                value={formData.bio}
                onChange={handleInputChange}
                placeholder='Tell us about yourself...'
                rows={3}
                className='w-full px-4 py-3 bg-white/5 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none'
              />
            </div>
          )}

          {/* Remember Me & Forgot Password (Login Only) */}
          {isLogin && (
            <div className='flex items-center justify-between'>
              <label className='flex items-center text-sm text-gray-300'>
                <input type='checkbox' className='rounded border-gray-300 text-violet-600 focus:ring-violet-500' />
                <span className='ml-2'>Remember me</span>
              </label>
              <button type='button' className='text-sm text-violet-300 hover:text-violet-200'>
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type='submit'
            disabled={isLoading}
            className={`w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-violet-600 text-white font-medium rounded-lg transition-all ${
              isLoading 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:from-purple-600 hover:to-violet-700 hover:shadow-lg transform hover:-translate-y-0.5'
            }`}
          >
            {isLoading ? (
              <div className='flex items-center justify-center'>
                <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2'></div>
                {isLogin ? 'Signing In...' : 'Creating Account...'}
              </div>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>

          {/* Terms Agreement (Sign Up Only) */}
          {!isLogin && (
            <p className='text-xs text-gray-400 text-center'>
              By creating an account, you agree to our{' '}
              <button type='button' className='text-violet-300 hover:text-violet-200 underline'>
                Terms of Service
              </button>{' '}
              and{' '}
              <button type='button' className='text-violet-300 hover:text-violet-200 underline'>
                Privacy Policy
              </button>
            </p>
          )}

          {/* Social Login (Optional) */}
          <div className='relative my-6'>
            <div className='absolute inset-0 flex items-center'>
              <div className='w-full border-t border-gray-600'></div>
            </div>
            <div className='relative flex justify-center text-sm'>
              <span className='px-2 bg-transparent text-gray-400'>Or continue with</span>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <button
              type='button'
              className='w-full inline-flex justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm bg-white/5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors'
            >
              Google
            </button>
            <button
              type='button'
              className='w-full inline-flex justify-center py-2 px-4 border border-gray-600 rounded-md shadow-sm bg-white/5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors'
            >
              GitHub
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage