import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CompletedProvider } from './context/CompletedContext'
import { BookmarkedProvider } from './context/BookmarkedContext'
import { useNetworkMonitor } from './hooks/useNetworkMonitor'

import Navbar from './components/Layout/Navbar'
import Sidebar from './components/Layout/Sidebar'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import ResourcesPage from './pages/ResourcesPage'
import ResourceDetailPage from './pages/ResourceDetailPage'
import RecommendationsPage from './pages/RecommendationsPage'
import ProfilePage from './pages/ProfilePage'
import BookmarksPage from './pages/BookmarksPage'
import UploadResourcePage from './pages/UploadResourcePage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import FeedbackPage from './pages/FeedbackPage'
import NotFoundPage from './pages/NotFoundPage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return user ? <Navigate to="/" replace /> : children
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f3ef' }}>
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function AppLayout({ children }) {
  useNetworkMonitor()
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f4f3ef' }}>
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-5 md:px-8 lg:px-12 py-8 md:py-10 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

      {/* Authenticated */}
      <Route path="/" element={
        <PrivateRoute><AppLayout><HomePage /></AppLayout></PrivateRoute>
      } />
      <Route path="/resources" element={
        <PrivateRoute><AppLayout><ResourcesPage /></AppLayout></PrivateRoute>
      } />
      <Route path="/resources/:id" element={
        <PrivateRoute><AppLayout><ResourceDetailPage /></AppLayout></PrivateRoute>
      } />
      <Route path="/recommendations" element={
        <PrivateRoute><AppLayout><RecommendationsPage /></AppLayout></PrivateRoute>
      } />
      <Route path="/profile" element={
        <PrivateRoute><AppLayout><ProfilePage /></AppLayout></PrivateRoute>
      } />
      <Route path="/bookmarks" element={
        <PrivateRoute><AppLayout><BookmarksPage /></AppLayout></PrivateRoute>
      } />
      <Route path="/upload" element={
        <PrivateRoute><AppLayout><UploadResourcePage /></AppLayout></PrivateRoute>
      } />

      {/* Admin only */}
      <Route path="/admin" element={
        <AdminRoute><AppLayout><AdminDashboardPage /></AppLayout></AdminRoute>
      } />
      <Route path="/feedback" element={
        <AdminRoute><AppLayout><FeedbackPage /></AppLayout></AdminRoute>
      } />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CompletedProvider>
      <BookmarkedProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.875rem' },
        }}
      />
      </BookmarkedProvider>
      </CompletedProvider>
    </AuthProvider>
  )
}
