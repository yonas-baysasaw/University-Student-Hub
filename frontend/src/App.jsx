import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/login';
import Navbar from './components/Navbar';
import About from './pages/About';
import Home from './pages/Home';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Nav from './components/Nav';
import Signup from './pages/Signup';
import PasswordReset from './pages/PasswordReset';
import Reset from './pages/Reset';

function AppRoutes() {
  const { user, checkingAuth } = useAuth();

  if (checkingAuth) {
    return <div>Checking authentication…</div>;
  }

  const defaultRedirect = '/';

  return (
    <>
      {user ? <Navbar />: <Nav/>}
      <Routes>
        
        <Route path="/" element={user ? <Home /> : <About />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
         <Route path="/password/reset" element={user ? <Navigate to="/" replace /> : <PasswordReset />} />
          <Route path="/reset-password/:token" element={ <Reset /> } />
        <Route path="*" element={<Navigate to={defaultRedirect} replace />} />
      </Routes>
    </>
  );
}


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
