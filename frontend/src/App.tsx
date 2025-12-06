import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import FloatingCallOverlay from './components/FloatingCallOverlay';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import CallRoom from './pages/CallRoom';
import History from './pages/History';
import CallDetail from './pages/CallDetail';
import Messages from './pages/Messages';
import Network from './pages/Network';
import PrivateMessages from './pages/PrivateMessages';
import Friends from './pages/Friends';
import FriendChat from './pages/FriendChat';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { loadStoredAuth } = useAuthStore();

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  return (
    <ErrorBoundary>
      <ToastContainer />
      <FloatingCallOverlay />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/call/:roomId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <CallRoom />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history/:id"
          element={
            <ProtectedRoute>
              <CallDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/call-detail/:id"
          element={
            <ProtectedRoute>
              <CallDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/network"
          element={
            <ProtectedRoute>
              <Network />
            </ProtectedRoute>
          }
        />
        <Route
          path="/private-messages"
          element={
            <ProtectedRoute>
              <PrivateMessages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <Friends />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends/chat/:conversationId"
          element={
            <ProtectedRoute>
              <FriendChat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends/chat/user/:userId"
          element={
            <ProtectedRoute>
              <FriendChat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
