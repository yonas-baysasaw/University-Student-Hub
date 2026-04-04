import { useMemo, useState } from 'react';

const resources = [
  { id: 'res-1', title: 'Calculus Practice Set', category: 'Math', type: 'PDF', level: 'Intermediate' },
  { id: 'res-2', title: 'Academic Writing Guide', category: 'General', type: 'Guide', level: 'Beginner' },
  { id: 'res-3', title: 'Data Structures Cheatsheet', category: 'Computer Science', type: 'Cheatsheet', level: 'Intermediate' },
  { id: 'res-4', title: 'Physics Revision Notes', category: 'Physics', type: 'Notes', level: 'Advanced' },
  { id: 'res-5', title: 'Research Methods Toolkit', category: 'General', type: 'Toolkit', level: 'Advanced' },
  { id: 'res-6', title: 'Frontend UI Patterns', category: 'Computer Science', type: 'Article', level: 'Beginner' }
];

function Library() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [favorites, setFavorites] = useState([]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(resources.map((item) => item.category)))], []);

  const filteredResources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return resources.filter((item) => {
      const categoryMatch = filter === 'All' || item.category === filter;
      const queryMatch =
        !normalized ||
        item.title.toLowerCase().includes(normalized) ||
        item.type.toLowerCase().includes(normalized) ||
        item.level.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
  }, [filter, query]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="page-surface px-4 pb-10 pt-8 md:px-6">
      <section className="mx-auto max-w-6xl space-y-5">
        <div className="panel-card rounded-3xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Library</p>
          <h1 className="mt-2 font-display text-3xl text-slate-900 md:text-4xl">Find learning resources faster</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
            Search and filter resources instantly, and mark important materials as favorites for quick access.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              className="input-field text-sm"
              placeholder="Search title, type, or level..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className="input-field text-sm md:w-56" value={filter} onChange={(e) => setFilter(e.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredResources.length === 0 ? (
            <div className="panel-card col-span-full rounded-2xl p-6 text-center text-sm text-slate-500">
              No resources found. Try another search term or category.
            </div>
          ) : (
            filteredResources.map((item) => {
              const isFavorite = favorites.includes(item.id);
              return (
                <article key={item.id} className="panel-card fade-in-up rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-xl text-slate-900">{item.title}</h2>
                    <button
                      type="button"
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                        isFavorite ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      onClick={() => toggleFavorite(item.id)}
                    >
                      {isFavorite ? 'Saved' : 'Save'}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Category: <span className="font-semibold text-slate-700">{item.category}</span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Type: <span className="font-semibold text-slate-700">{item.type}</span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Level: <span className="font-semibold text-slate-700">{item.level}</span>
                  </p>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

export default Library;
