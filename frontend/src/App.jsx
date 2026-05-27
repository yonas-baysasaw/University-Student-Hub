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
import AdminRoute from './components/AdminRoute';
import SupportChatWidget from './components/SupportChatWidget';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { ProcessingProvider } from './contexts/ProcessingContext';
import { SocketProvider } from './contexts/SocketContext';
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx';
import AdminDepartments from './pages/admin/AdminDepartments.jsx';
import AdminInstructors from './pages/admin/AdminInstructors.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminLibrary from './pages/admin/AdminLibrary.jsx';
import AdminLogin from './pages/admin/AdminLogin.jsx';
import AdminLogs from './pages/admin/AdminLogs.jsx';
import AdminNotifications from './pages/admin/AdminNotifications.jsx';
import AdminProfile from './pages/admin/AdminProfile.jsx';
import AdminReports from './pages/admin/AdminReports.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';
import AdminSignup from './pages/admin/AdminSignup.jsx';
import AdminStudents from './pages/admin/AdminStudents.jsx';
import AdminWelcome from './pages/admin/AdminWelcome.jsx';
import BookDetail from './pages/BookDetail';
import Calendar from './pages/Calendar';
import ChatRoom from './pages/ChatRoom';
import ClassRoom from './pages/ClassRoom';
import ClassroomAnnouncements from './pages/ClassroomAnnouncements';
import ClassroomResources from './pages/ClassroomResources';
import EventDetail from './pages/EventDetail';
import Events from './pages/Events';
import ExamPractice from './pages/ExamPractice';
import Exams from './pages/Exams';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Library from './pages/Library';
import LiquAI from './pages/LiquAI';
import CampusAuthRoute from './components/auth/CampusAuthRoute';
import Login from './pages/login';
import NotFound from './pages/NotFound';
import Notifications from './pages/Notifications';
import PasswordReset from './pages/PasswordReset';
import Profile from './pages/Profile';
import PublicProfile from './pages/PublicProfile';
import Reset from './pages/Reset';
import Settings from './pages/Settings';
import Signup from './pages/Signup';
import StudyBuddy from './pages/StudyBuddy';
import VerifyEmail from './pages/VerifyEmail';

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
      <div className="page-surface flex items-center justify-center px-3 py-6 md:px-6 md:py-10">
        <div className="panel-card w-full max-w-md rounded-2xl p-5 text-center sm:rounded-3xl sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-700 sm:text-xs">
            University Student Hub
          </p>
          <h2 className="mt-2 font-display text-xl text-slate-900 sm:text-2xl dark:text-slate-50">
            Loading your session
          </h2>
          <p className="mt-2 text-xs text-slate-500 sm:text-sm">
            Please wait while we set up your workspace.
          </p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <NotificationsProvider>
        <Navbar>
        <SupportChatWidget />
        <div key={location.pathname} className="route-fade">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/calendar" element={<Calendar />} />
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
            <Route path="/events" element={<Events />} />
            <Route path="/events/:eventId" element={<EventDetail />} />
            <Route path="/liqu-ai" element={<LiquAI />} />
            <Route path="/liqu-ai/study-buddy" element={<StudyBuddy />} />
            <Route
              path="/liqu-ai/did-exit"
              element={<Navigate to="/liqu-ai/exams" replace />}
            />
            <Route path="/liqu-ai/exams" element={<Exams />} />
            <Route
              path="/exams"
              element={<Navigate to="/liqu-ai/exams" replace />}
            />
            <Route path="/exams/:examId" element={<ExamPractice />} />
            <Route path="/profile" element={<Profile />} />
            <Route
              path="/admin/signup"
              element={
                user.isAdmin ? (
                  <Navigate to="/admin" replace />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/admin/login"
              element={
                user.isAdmin ? (
                  <Navigate to="/admin" replace />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminWelcome />} />
              <Route path="instructors" element={<AdminInstructors />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="departments" element={<AdminDepartments />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route path="library" element={<AdminLibrary />} />
            </Route>
            <Route path="/settings" element={<Settings />} />
            <Route path="/users/:userId" element={<PublicProfile />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/signup" element={<Navigate to="/" replace />} />
            <Route path="/password/reset" element={<PasswordReset />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password/:token" element={<Reset />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Navbar>
      </NotificationsProvider>
    );
  }

  const campusAuthPaths = [
    '/login',
    '/signup',
    '/password/reset',
    '/verify-email',
  ];
  const isCampusAuthPage =
    campusAuthPaths.includes(location.pathname) ||
    location.pathname.startsWith('/reset-password/');
  const hideGlobalNav =
    location.pathname === '/' || isCampusAuthPage;
  const campusAuthTabPaths = ['/login', '/signup'];
  const routeFadeKey = campusAuthTabPaths.includes(location.pathname)
    ? 'campus-auth'
    : location.pathname;

  return (
    <>
      {!hideGlobalNav && <Nav />}
      <div key={routeFadeKey} className="route-fade">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/admin/signup" element={<AdminSignup />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={<Navigate to="/admin/login?next=/admin" replace />}
          />
          <Route element={<CampusAuthRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>
          <Route path="/password/reset" element={<PasswordReset />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password/:token" element={<Reset />} />
          <Route path="/classroom" element={<RedirectToLogin />} />
          <Route path="/calendar" element={<RedirectToLogin />} />
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
          <Route path="/events" element={<RedirectToLogin />} />
          <Route path="/events/:eventId" element={<EventDetail />} />
          <Route path="/liqu-ai" element={<RedirectToLogin />} />
          <Route path="/liqu-ai/study-buddy" element={<RedirectToLogin />} />
          <Route path="/liqu-ai/did-exit" element={<RedirectToLogin />} />
          <Route path="/liqu-ai/exams" element={<RedirectToLogin />} />
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
