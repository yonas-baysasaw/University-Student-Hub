import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Toaster } from 'sonner';
import Nav from './components/Nav';
import Navbar from './components/Navbar';
import StaffRoute from './components/StaffRoute';
import SupportChatWidget from './components/SupportChatWidget';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProcessingProvider } from './contexts/ProcessingContext';
import { SocketProvider } from './contexts/SocketContext';
import Landing from './pages/Landing';
import AdminInstructors from './pages/admin/AdminInstructors.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminLibrary from './pages/admin/AdminLibrary.jsx';
import AdminStudents from './pages/admin/AdminStudents.jsx';
import AdminWelcome from './pages/admin/AdminWelcome.jsx';
import BookDetail from './pages/BookDetail';
import ChatRoom from './pages/ChatRoom';
import ClassRoom from './pages/ClassRoom';
import ClassroomAnnouncements from './pages/ClassroomAnnouncements';
import ClassroomResources from './pages/ClassroomResources';
import ExamPractice from './pages/ExamPractice';
import Exams from './pages/Exams';
import Home from './pages/Home';
import Library from './pages/Library';
import LiquAI from './pages/LiquAI';
import Login from './pages/login';
import Notifications from './pages/Notifications';
import NotFound from './pages/NotFound';
import PasswordReset from './pages/PasswordReset';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import Reset from './pages/Reset';
import Settings from './pages/Settings';
import Signup from './pages/Signup';
import StudyBuddy from './pages/StudyBuddy';

function RedirectToLogin() {
  const { pathname, search } = useLocation();
  const next = encodeURIComponent(`${pathname}${search}`);
  return <Navigate to={`/login?next=${next}`} replace />;
}

function AppRoutes() {
  const { user, checkingAuth } = useAuth();
  const location = useLocation();

  if (checkingAuth) {
    return (
      <div className="page-surface flex items-center justify-center px-4 py-10">
        <div className="panel-card w-full max-w-md rounded-3xl p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            University Student Hub
          </p>
          <h2 className="mt-2 font-display text-2xl text-slate-900">
            Loading your session
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Please wait while we set up your workspace.
          </p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <Navbar>
        <SupportChatWidget />
        <div key={location.pathname} className="route-fade">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/classroom" element={<ClassRoom />} />
            <Route path="/classroom/:chatId" element={<ChatRoom />} />
            <Route
              path="/classroom/:chatId/announcements"
              element={<ClassroomAnnouncements />}
            />
            <Route
              path="/classroom/:chatId/resources"
              element={<ClassroomResources />}
            />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/library" element={<Library />} />
            <Route path="/library/:bookId" element={<BookDetail />} />
            <Route path="/liqu-ai" element={<LiquAI />} />
            <Route path="/liqu-ai/study-buddy" element={<StudyBuddy />} />
            <Route
              path="/liqu-ai/did-exit"
              element={<Navigate to="/exams" replace />}
            />
            <Route path="/exams" element={<Exams />} />
            <Route path="/exams/:examId" element={<ExamPractice />} />
            <Route path="/profile" element={<Profile />} />
            <Route
              path="/admin"
              element={
                <StaffRoute>
                  <AdminLayout />
                </StaffRoute>
              }
            >
              <Route index element={<AdminWelcome />} />
              <Route path="instructors" element={<AdminInstructors />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="library" element={<AdminLibrary />} />
            </Route>
            <Route path="/settings" element={<Settings />} />
            <Route path="/users/:userId" element={<PublicProfile />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/signup" element={<Navigate to="/" replace />} />
            <Route path="/password/reset" element={<PasswordReset />} />
            <Route
              path="/reset-password/:token"
              element={<Navigate to="/" replace />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Navbar>
    );
  }

  const hideGlobalNavForLanding = location.pathname === '/';

  return (
    <>
      {!hideGlobalNavForLanding && <Nav />}
      <div key={location.pathname} className="route-fade">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/admin"
            element={<Navigate to="/login?next=/admin" replace />}
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/password/reset" element={<PasswordReset />} />
          <Route path="/reset-password/:token" element={<Reset />} />
          <Route path="/classroom" element={<RedirectToLogin />} />
          <Route path="/classroom/:chatId" element={<RedirectToLogin />} />
          <Route
            path="/classroom/:chatId/announcements"
            element={<RedirectToLogin />}
          />
          <Route
            path="/classroom/:chatId/resources"
            element={<RedirectToLogin />}
          />
          <Route path="/library" element={<RedirectToLogin />} />
          <Route path="/library/:bookId" element={<BookDetail />} />
          <Route path="/liqu-ai" element={<RedirectToLogin />} />
          <Route path="/liqu-ai/study-buddy" element={<RedirectToLogin />} />
          <Route path="/liqu-ai/did-exit" element={<RedirectToLogin />} />
          <Route path="/profile" element={<RedirectToLogin />} />
          <Route path="/users/:userId" element={<PublicProfile />} />
          <Route path="/exams" element={<RedirectToLogin />} />
          <Route path="/exams/:examId" element={<RedirectToLogin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SocketProvider>
          <ProcessingProvider>
            <Toaster position="top-right" richColors closeButton />
            <AppRoutes />
          </ProcessingProvider>
        </SocketProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
