import Nav from "../components/Nav";

const features = [
  {
    title: "Curated resources",
    description: "Discover study guides, campus events, and student services tailored to your major."
  },
  {
    title: "Secure authentication",
    description: "Sign in with your campus account or Google and let us keep your preferences safe."
  },
  {
    title: "Community feed",
    description: "Share announcements, join clubs, and stay in the loop with other University Student Hub members."
  }
];

function About() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <main className="max-w-5xl mx-auto px-4 py-16">
        <section className="text-center space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">University Student Hub</p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900">
            A modern command center for every student.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
            Manage your profile, stay on top of deadlines, and connect with peers without switching tabs.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="/signup"
              className="px-6 py-3 rounded-full bg-slate-900 text-white font-semibold shadow-lg hover:bg-slate-700 transition"
            >
              Create your account
            </a>
            <a
              href="/login"
              className="px-6 py-3 rounded-full border border-slate-900 text-slate-900 font-semibold hover:bg-slate-900 hover:text-white transition"
            >
              Sign in
            </a>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100"
            >
              <h3 className="text-xl font-semibold text-slate-900">{feature.title}</h3>
              <p className="text-sm text-slate-500 mt-3">{feature.description}</p>
            </article>
          ))}
        </section>

        <section className="mt-16 rounded-2xl bg-slate-900 text-white p-8 shadow-lg flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-emerald-300">Stay ahead</p>
            <h2 className="text-2xl font-semibold">Weekly digests, community highlights, and event reminders.</h2>
          </div>
          <a
            href="/signup"
            className="inline-flex items-center justify-center rounded-full border border-white px-6 py-3 font-semibold text-white hover:bg-white hover:text-slate-900 transition"
          >
            Join the hub
          </a>
        </section>
      </main>
    </div>
  );
}

export default About;
