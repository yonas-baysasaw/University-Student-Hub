import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const highlights = [
  { title: 'Announcements', description: 'See what your departments are sharing this week.' },
  { title: 'Study rooms', description: 'Book quiet spaces, labs, and lounges with one click.' },
  { title: 'Wellness & support', description: 'Find counselors, advisors, and peer mentors near you.' }
];

function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        <section className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <p className="text-sm text-slate-500">Welcome back</p>
          <h1 className="text-3xl font-semibold text-slate-900">
            {user?.displayName ?? user?.username ?? 'Student'} — your dashboard is ready.
          </h1>
          <p className="text-sm text-slate-500 mt-2">Manage your profile, reset passwords, and explore campus highlights.</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              to="/password/reset"
              className="px-5 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition"
            >
              Reset password
            </Link>
            <a
              href="/api/logout"
              className="px-5 py-2 rounded-full border border-slate-900 text-slate-900 text-sm font-semibold hover:bg-slate-900 hover:text-white transition"
            >
              Sign out
            </a>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <article key={item.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.description}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

export default Home;
