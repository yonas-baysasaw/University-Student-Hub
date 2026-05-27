import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { CampusAuthLayout, AuthInlineLink, buildAuthHref } from './campusAuth';
import { safeInternalPath } from '../../utils/safeRedirect';

export default function CampusAuthRoute() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const mode = pathname === '/signup' ? 'signup' : 'login';
  const nextSafe = safeInternalPath(searchParams.get('next'));
  const signupHref = buildAuthHref('/signup', nextSafe);

  return (
    <CampusAuthLayout
      mode={mode}
      title={mode === 'login' ? 'Sign in' : 'Create account'}
      subtitle={
        mode === 'login' ? (
          <>
            Don&apos;t have an account?{' '}
            <AuthInlineLink to={signupHref}>Create now</AuthInlineLink>
          </>
        ) : null
      }
      nextSafe={nextSafe}
      wide={mode === 'signup'}
    >
      <div key={mode} className="auth-campus-panel">
        <Outlet />
      </div>
    </CampusAuthLayout>
  );
}
