import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const levels = ['Easy', 'Medium', 'Hard'];

function buildQuestion(topic, level, index, mode) {
  const seed = index + 1;
  if (mode === 'exit') {
    return {
      id: `${mode}-${seed}`,
      prompt: `${seed}. (${level}) In an exit-exam setting, explain the most critical principle in "${topic}" and apply it to a realistic scenario.`,
    };
  }

  return {
    id: `${mode}-${seed}`,
    prompt: `${seed}. (${level}) Create a short-answer practice question about "${topic}" and include one practical example.`,
  };
}

function DidExit() {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('Medium');
  const [count, setCount] = useState(5);
  const [mode, setMode] = useState('practice');
  const [generatedAt, setGeneratedAt] = useState(null);
  const [questions, setQuestions] = useState([]);

  const canGenerate = topic.trim().length > 0;
  const title =
    mode === 'exit'
      ? 'Exit Exam Prep Generator'
      : 'Practice Question Generator';

  const tips = useMemo(
    () => [
      'Start with Medium difficulty, then move to Hard.',
      'Time yourself while answering to simulate exam pressure.',
      'Review weak topics and regenerate focused question sets.',
    ],
    [],
  );

  const handleGenerate = () => {
    if (!canGenerate) return;
    const trimmed = topic.trim();
    const normalizedCount = Math.min(Math.max(Number(count) || 5, 1), 20);
    const next = Array.from({ length: normalizedCount }, (_, index) =>
      buildQuestion(trimmed, level, index, mode),
    );
    setQuestions(next);
    setGeneratedAt(new Date());
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-6xl space-y-5">
        <div className="panel-card rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Liqu AI
              </p>
              <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">
                did Exit
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Generate AI-style practice and exit-exam questions for fast
                preparation.
              </p>
            </div>
            <Link to="/liqu-ai" className="btn-secondary px-4 py-2 text-sm">
              Back to Liqu AI
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="panel-card rounded-2xl p-4">
            <h2 className="font-display text-xl text-slate-900">{title}</h2>
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Mode
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('practice')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      mode === 'practice'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Practice
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('exit')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      mode === 'exit'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Exit Exam
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="did-exit-topic"
                  className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  Topic
                </label>
                <input
                  id="did-exit-topic"
                  type="text"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Example: Data Structures"
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="did-exit-difficulty"
                  className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  Difficulty
                </label>
                <select
                  id="did-exit-difficulty"
                  className="input-field text-sm"
                  value={level}
                  onChange={(event) => setLevel(event.target.value)}
                >
                  {levels.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="did-exit-count"
                  className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  Question count
                </label>
                <input
                  id="did-exit-count"
                  type="number"
                  min={1}
                  max={20}
                  value={count}
                  onChange={(event) => setCount(event.target.value)}
                  className="input-field text-sm"
                />
              </div>

              <button
                type="button"
                disabled={!canGenerate}
                onClick={handleGenerate}
                className="btn-primary w-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                Generate questions
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
                Prep tips
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </aside>

          <article className="panel-card rounded-2xl p-4">
            <h3 className="font-display text-2xl text-slate-900">
              Generated questions
            </h3>
            {generatedAt ? (
              <p className="mt-1 text-xs text-slate-500">
                Generated: {generatedAt.toLocaleString()}
              </p>
            ) : null}

            {questions.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                Enter a topic, choose settings, and generate your AI question
                set.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    {question.prompt}
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

export default DidExit;
