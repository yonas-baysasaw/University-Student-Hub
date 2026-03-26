import { FaGoogle } from 'react-icons/fa';
import { useState } from 'react';

const SignIn = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setError('Enter your username/email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier: trimmedIdentifier, password })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Invalid credentials');
      }

      setStatus('Signed in, redirecting…');
      setTimeout(() => {
        window.location.href = '/';
      }, 400);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className="w-[380px] bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-gray-600">USH</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800">University Student Hub</h2>
          <p className="text-sm text-gray-500">Sign in to continue</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="text-xs font-semibold tracking-wide text-gray-500">Username or email</label>
          <input
            type="text"
            placeholder="example@uni.edu"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3d5661] focus:border-transparent"
          />

          <label className="text-xs font-semibold tracking-wide text-gray-500">Password</label>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3d5661] focus:border-transparent"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 bg-[#3d5661] text-xl hover:bg-[#324952] transition-colors text-white flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          {(error || status) && (
            <p className={`text-center text-sm ${error ? 'text-rose-500' : 'text-emerald-500'}`}>
              {error || status}
            </p>
          )}
        </form>

        <div className="flex justify-between items-center text-sm text-gray-500 mt-4">
          <a href="/password/reset" className="hover:text-gray-700 hover:underline">Forgot password?</a>
          <a href="/signup" className="hover:text-gray-700 hover:underline">Create account</a>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">or continue with</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="flex justify-center gap-4">
          <a
            href="/api/auth/google"
            className="w-12 h-12 flex items-center justify-center border border-gray-300 rounded-full hover:bg-gray-100 transition"
            aria-label="Continue with Google"
          >
            <FaGoogle className="text-gray-600 text-lg" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
