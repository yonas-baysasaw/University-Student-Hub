import { Link } from 'react-router-dom';

function FinalCtaSection() {
  return (
    <section
      id="cta"
      className="scroll-mt-24 px-4 py-14 md:px-6 md:py-20"
      aria-labelledby="cta-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="cta-heading"
          className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50 md:text-3xl"
        >
          Start Using the University Student Hub Today
        </h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Register for a new account or sign in if you already have access.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/signup"
            className="btn-primary min-w-[9rem] px-8 py-3 text-sm font-semibold"
          >
            Register
          </Link>
          <Link
            to="/login"
            className="btn-secondary min-w-[9rem] px-8 py-3 text-sm font-semibold"
          >
            Login
          </Link>
        </div>
      </div>
    </section>
  );
}

export default FinalCtaSection;
