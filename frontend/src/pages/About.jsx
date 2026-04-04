import { Link } from 'react-router-dom';

const features = [
  {
    title: 'One academic workspace',
    description: 'Track classes, updates, and resources from a single dashboard that works on desktop and mobile.'
  },
  {
    title: 'Secure and reliable',
    description: 'Built around authenticated sessions so students can access information with confidence.'
  },
  {
    title: 'Designed for momentum',
    description: 'Fast interactions, clear layouts, and smooth transitions help you stay focused throughout the day.'
  }
];

const stats = [
  { value: '24/7', label: 'Anytime access' },
  { value: '1 hub', label: 'Unified student experience' },
  { value: '100%', label: 'Frontend responsive' }
];

function About() {
  return (
    <div className="page-surface px-4 pb-12 pt-8 md:px-6">
      <main className="mx-auto max-w-6xl space-y-7">
        <section className="panel-card fade-in-up rounded-3xl p-6 md:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">University Student Hub</p>
          <h1 className="mt-3 font-display text-4xl text-slate-900 md:text-5xl">A professional digital campus experience.</h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
            Organize your student life, follow key updates, and work with less friction through an interface designed to feel fast and dependable.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary px-6 py-3 text-sm">
              Create account
            </Link>
            <Link to="/login" className="btn-secondary px-6 py-3 text-sm">
              Sign in
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="panel-card fade-in-up rounded-2xl p-5">
              <h2 className="font-display text-xl text-slate-900">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 rounded-3xl bg-slate-900 p-6 text-white shadow-xl sm:grid-cols-3">
          {stats.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <p className="font-display text-3xl">{item.value}</p>
              <p className="mt-1 text-sm text-cyan-100">{item.label}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

export default About;
