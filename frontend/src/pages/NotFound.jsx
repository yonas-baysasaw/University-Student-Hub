import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="page-surface flex items-center justify-center px-4 py-10">
      <div className="panel-card w-full max-w-lg rounded-3xl p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">404</p>
        <h1 className="mt-2 font-display text-3xl text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">The page you are looking for does not exist or has been moved.</p>
        <div className="mt-6">
          <Link to="/" className="btn-primary px-6 py-2.5 text-sm">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
