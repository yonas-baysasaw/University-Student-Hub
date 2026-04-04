import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const STORAGE_KEY = 'ush_frontend_notes_v1';

const initialTasks = [
  { id: 'task-1', label: 'Review this week schedule', done: false },
  { id: 'task-2', label: 'Check library resources', done: false },
  { id: 'task-3', label: 'Update account security settings', done: false }
];

const highlights = [
  {
    title: 'Smart navigation',
    description: 'Jump between sections quickly with a clean and responsive layout.'
  },
  {
    title: 'Persistent notes',
    description: 'Keep quick reminders saved in your browser while you study.'
  },
  {
    title: 'Smooth interactions',
    description: 'Consistent transitions and motion feedback improve usability.'
  }
];

function Home() {
  const { user } = useAuth();
  const name = user?.displayName ?? user?.username ?? 'Student';
  const [tasks, setTasks] = useState(initialTasks);
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setNotes(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load notes from localStorage', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  const completedCount = useMemo(() => tasks.filter((task) => task.done).length, [tasks]);

  const toggleTask = (id) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  };

  const addNote = () => {
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    setNotes((prev) => [{ id: `${Date.now()}`, text: trimmed }, ...prev.slice(0, 4)]);
    setNoteInput('');
  };

  const clearNotes = () => {
    setNotes([]);
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="panel-card fade-in-up rounded-3xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Dashboard</p>
          <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">{name}, your workspace is ready.</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
            Stay on top of your priorities with quick notes, progress tracking, and faster access to account actions.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/classroom" className="btn-primary px-5 py-2.5 text-sm">
              Open classrooms
            </Link>
            <Link to="/library" className="btn-primary px-5 py-2.5 text-sm">
              Open library
            </Link>
            <Link to="/password/reset" className="btn-secondary px-5 py-2.5 text-sm">
              Reset password
            </Link>
            <a href="/api/auth/logout" className="rounded-full px-2 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
              Sign out
            </a>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <article className="panel-card rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl text-slate-900">Quick checklist</h2>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                {completedCount}/{tasks.length} complete
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {tasks.map((task) => (
                <label
                  key={task.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-cyan-200"
                >
                  <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={task.done} onChange={() => toggleTask(task.id)} />
                  <span className={`text-sm ${task.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{task.label}</span>
                </label>
              ))}
            </div>
          </article>

          <article className="panel-card rounded-2xl p-5">
            <h2 className="font-display text-xl text-slate-900">Quick notes</h2>
            <p className="mt-1 text-xs text-slate-500">Saved in your browser for fast reminders.</p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNote();
                  }
                }}
                placeholder="Add a short note..."
                className="input-field h-10 text-sm"
              />
              <button type="button" className="btn-primary px-4 text-sm" onClick={addNote}>
                Add
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {notes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">No notes yet.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {note.text}
                  </div>
                ))
              )}
            </div>
            {notes.length > 0 && (
              <button type="button" className="mt-3 text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={clearNotes}>
                Clear notes
              </button>
            )}
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="panel-card rounded-2xl p-5">
              <h3 className="font-display text-lg text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

export default Home;
