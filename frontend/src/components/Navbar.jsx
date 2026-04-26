import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import defaultProfile from '../assets/profile.png';
import { useAuth } from '../contexts/AuthContext';

const menuWidth = 256;

function Navbar({ children }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const photoUrl = user?.photo || defaultProfile;
  const displayName = user
    ? (user.displayName ?? user.username ?? 'Profile')
    : 'Profile';
  const email = user?.email ?? '';

  const [byokOpen, setByokOpen] = useState(false);
  const [apiKey, setApiKey] = useState(user?.geminiApiKey ?? '');
  const [modelId, setModelId] = useState(user?.geminiModelId ?? '');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [byokMsg, setByokMsg] = useState('');

  const byokActive = !!user?.geminiApiKey;

  useEffect(() => {
    setApiKey(user?.geminiApiKey ?? '');
    setModelId(user?.geminiModelId ?? '');
  }, [user?.geminiApiKey, user?.geminiModelId]);

  useEffect(() => {
    if (!menuOpen) return;

    const updateMenuPosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const maxLeft = window.innerWidth - menuWidth - 8;
      setMenuPosition({
        top: rect.bottom + 12,
        left: Math.max(8, Math.min(rect.right - menuWidth, maxLeft)),
      });
    };

    const handleOutsideClick = (event) => {
      const clickedButton = buttonRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);
      if (!clickedButton && !clickedMenu) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    updateMenuPosition();
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [menuOpen]);

  async function testKey() {
    if (!apiKey.trim()) return;
    setTesting(true);
    setByokMsg('');
    try {
      const res = await fetch(
        `/api/ai/models?apiKey=${encodeURIComponent(apiKey.trim())}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to list models');
      setModels(data.models || []);
      setByokMsg('✓ Key is valid');
    } catch (err) {
      setByokMsg(`✗ ${err.message}`);
      setModels([]);
    } finally {
      setTesting(false);
    }
  }

  async function saveByok() {
    setSaving(true);
    setByokMsg('');
    try {
      const res = await fetch('/api/profile/api-key', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: apiKey.trim(),
          geminiModelId: modelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      setByokMsg('Saved!');
    } catch (err) {
      setByokMsg(`✗ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function clearByok() {
    setSaving(true);
    setByokMsg('');
    try {
      const res = await fetch('/api/profile/api-key', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to clear');
      setApiKey('');
      setModelId('');
      setModels([]);
      setByokMsg('Cleared.');
    } catch (err) {
      setByokMsg(`✗ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-8">
      <header className="relative z-50 px-3 pt-3 sm:px-4">
        <div className="glass-nav mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl px-3 py-2 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-700 to-slate-900 text-xs font-bold text-cyan-100">
              USH
            </span>
            <span className="hidden font-display text-lg font-semibold text-slate-900 sm:inline sm:text-xl">
              University Student Hub
            </span>
            <span className="font-display text-sm font-semibold text-slate-900 sm:hidden">
              USH
            </span>
          </div>

          <div className="flex items-center gap-2">
            <nav className="max-w-[calc(100vw-7.75rem)] overflow-x-auto">
              <ul className="flex min-w-max items-center gap-1">
                {[
                  { to: '/', label: 'Dashboard' },
                  { to: '/classroom', label: 'Classroom' },
                  { to: '/library', label: 'Library' },
                  { to: '/liqu-ai', label: 'Liqu AI' },
                  { to: '/profile', label: 'Profile' },
                ].map(({ to, label }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={to === '/'}
                      className={({ isActive }) =>
                        `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                          isActive
                            ? 'bg-gradient-to-r from-slate-900 to-cyan-700 text-white'
                            : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                        }`
                      }
                    >
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="relative">
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="btn btn-ghost btn-circle avatar"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Open profile menu"
              >
                <div className="relative h-10 w-10 overflow-hidden rounded-full border border-slate-200">
                  <img alt={`${displayName} avatar`} src={photoUrl} />
                  {byokActive && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>

      {menuOpen &&
        createPortal(
          <ul
            ref={menuRef}
            className="menu menu-sm fixed z-[2147483647] rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-2xl"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              width: `${menuWidth}px`,
            }}
          >
            <li>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                <img
                  src={photoUrl}
                  alt=""
                  className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {displayName}
                  </p>
                  {email ? (
                    <p className="truncate text-xs text-slate-500">{email}</p>
                  ) : null}
                </div>
              </div>
            </li>
            <li className="my-1 h-px bg-slate-100" />
            <li>
              <button
                type="button"
                onClick={() => {
                  setByokOpen(true);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>Liqu AI Settings</span>
                {byokActive ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    BYOK
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">API key</span>
                )}
              </button>
            </li>
            <li>
              <a
                href="/profile"
                className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                My profile
              </a>
            </li>
            <li>
              <a
                href="/password/reset"
                className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Reset password
              </a>
            </li>
            <li className="my-1 h-px bg-slate-100" />
            <li>
              <a
                href="/api/auth/logout"
                className="block rounded-xl border border-rose-100 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Logout
              </a>
            </li>
          </ul>,
          document.body,
        )}

      {byokOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/40"
            onClick={() => setByokOpen(false)}
            aria-label="Close modal"
          />
          <div className="relative z-10 panel-card w-full max-w-md rounded-3xl p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg text-slate-900">
                Liqu AI Settings
              </h2>
              <button
                type="button"
                onClick={() => setByokOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p className="mb-4 text-xs text-slate-500">
              Provide your own Gemini API key (BYOK) to bypass the shared rate
              limits and choose a model.
            </p>

            <label
              htmlFor="byok-api-key"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Gemini API Key
            </label>
            <div className="mb-3 flex gap-2">
              <div className="relative flex-1">
                <input
                  id="byok-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="input-field w-full pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <button
                type="button"
                onClick={testKey}
                disabled={testing || !apiKey.trim()}
                className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"
              >
                {testing ? '…' : 'Test'}
              </button>
            </div>

            <label
              htmlFor="byok-model"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Model
            </label>
            <select
              id="byok-model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="input-field mb-4 w-full text-sm"
            >
              <option value="">Default (server model)</option>
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.displayName || m.name}
                </option>
              ))}
            </select>

            {byokMsg ? (
              <p
                className={`mb-3 text-xs font-medium ${
                  byokMsg.startsWith('✓') ||
                  byokMsg === 'Saved!' ||
                  byokMsg === 'Cleared.'
                    ? 'text-emerald-600'
                    : 'text-rose-600'
                }`}
              >
                {byokMsg}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveByok}
                disabled={saving}
                className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={clearByok}
                disabled={saving}
                className="btn-secondary px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Navbar;
