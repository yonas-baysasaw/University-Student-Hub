import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Requires an authenticated user with administrator role.
 * @param {{ children: import('react').ReactNode }} props
 */
export default function AdminRoute({ children }) {
  const { user, checkingAuth } = useAuth();

  if (checkingAuth) {
    return (
      <div className="page-surface flex min-h-[calc(100vh-5.5rem)] items-center justify-center px-3 py-6 md:px-6 md:py-10">
        <div className="panel-card w-full max-w-md rounded-3xl p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Admin portal
          </p>
          <h2 className="mt-2 font-display text-2xl text-slate-900 dark:text-white">
            Loading…
          </h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login?next=/admin" replace />;
  }

  if (!user.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
