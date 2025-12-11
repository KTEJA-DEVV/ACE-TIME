import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import FloatingCallOverlay from './components/FloatingCallOverlay';
import GlobalCallHandler from './components/GlobalCallHandler';
import NotificationSystem from './components/NotificationSystem';
import { useNotifications } from './hooks/useNotifications';
import NotificationBell from './components/NotificationBell';
import Onboarding from './components/Onboarding';
import MobileNavigation from './components/MobileNavigation';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Home = lazy(() => import('./pages/Home'));
const CallRoom = lazy(() => import('./pages/CallRoom'));
const PrivateCall = lazy(() => import('./pages/PrivateCall'));
const FaceTimeCallInterface = lazy(() => import('./components/FaceTimeCallInterface'));
const History = lazy(() => import('./pages/History'));
const CallHistoryEnhanced = lazy(() => import('./pages/CallHistoryEnhanced'));
const CallDetail = lazy(() => import('./pages/CallDetail'));
const CallSummary = lazy(() => import('./pages/CallSummary'));
const Messages = lazy(() => import('./pages/Messages'));
const Network = lazy(() => import('./pages/Network'));
const PrivateMessages = lazy(() => import('./pages/PrivateMessages'));
const FriendsEnhanced = lazy(() => import('./pages/FriendsEnhanced'));
const FriendChat = lazy(() => import('./pages/FriendChat'));
const Contacts = lazy(() => import('./pages/Contacts'));
const ContactChat = lazy(() => import('./pages/ContactChat'));
const AIChat = lazy(() => import('./pages/AIChat'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));

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
  useNotifications(); // Set up Socket.IO notification listeners

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  return (
    <ErrorBoundary>
      <Onboarding />
      <ToastContainer />
      <NotificationSystem />
      <NotificationBell />
      <FloatingCallOverlay />
      <GlobalCallHandler />
      <MobileNavigation />
      <Suspense fallback={<LoadingSpinner fullScreen text="Loading..." />}>
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
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
          path="/private-call/:roomId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <PrivateCall />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/call/private/:callId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <FaceTimeCallInterface />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <CallHistoryEnhanced />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history-old"
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
          path="/call/:callId/summary"
          element={
            <ProtectedRoute>
              <CallSummary />
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
              <FriendsEnhanced />
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
          path="/contacts"
          element={
            <ProtectedRoute>
              <Contacts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/:contactId/chat"
          element={
            <ProtectedRoute>
              <ContactChat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-chat"
          element={
            <ProtectedRoute>
              <AIChat />
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
          path="/profile/:userId"
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
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
