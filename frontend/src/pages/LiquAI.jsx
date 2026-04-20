import { Link } from 'react-router-dom';

const options = [
  {
    title: 'Study buddy',
    path: '/liqu-ai/study-buddy',
    description:
      'Bring books from Library, open the book, and study side-by-side with AI explanations and guided reading prompts.',
    cta: 'Open Study buddy',
  },
  {
    title: 'did Exit',
    path: '/liqu-ai/did-exit',
    description:
      'Generate AI-powered practice and exit-exam style questions to build confidence before high-stakes exams.',
    cta: 'Open did Exit',
  },
];

function LiquAI() {
  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-6xl space-y-5">
        <div className="panel-card rounded-3xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Liqu AI</p>
          <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">Choose your AI learning mode</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
            Use AI as a study companion for reading books or as a question engine for focused exit exam preparation.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {options.map((option) => (
            <article key={option.title} className="panel-card rounded-2xl p-5">
              <h2 className="font-display text-2xl text-slate-900">{option.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{option.description}</p>
              <Link to={option.path} className="btn-primary mt-5 px-5 py-2 text-sm">
                {option.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default LiquAI;
