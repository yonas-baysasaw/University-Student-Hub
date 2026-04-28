import { FileText, FolderOpen, Link2, Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassroomHero from '../components/ClassroomHero';
import ClassroomTabs from '../components/ClassroomTabs';
import { fetchClassroomMeta } from '../utils/classroom';
import { readJsonOrThrow } from '../utils/http';

function ClassroomResourcesContent({ chatId }) {
  const [chatName, setChatName] = useState('Class Resources');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [resources, setResources] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/resources`,
        {
          credentials: 'include',
        },
      );
      const data = await readJsonOrThrow(res, 'Failed to load resources');
      setResources(Array.isArray(data.resources) ? data.resources : []);
      setCanManage(Boolean(data.canManage));
    } catch (e) {
      setLoadError(e?.message || 'Failed to load resources');
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!chatId) return;
    const controller = new AbortController();
    const loadMeta = async () => {
      try {
        const chat = await fetchClassroomMeta(chatId, controller.signal);
        setChatName(chat?.name ?? 'Class Resources');
      } catch (error) {
        if (error.name !== 'AbortError') setChatName('Class Resources');
      }
    };
    loadMeta();
    return () => controller.abort();
  }, [chatId]);

  const filteredResources = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) =>
      String(r.title || '')
        .toLowerCase()
        .includes(q),
    );
  }, [resources, query]);

  const submitResource = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    const title = resourceTitle.trim();
    const link = resourceLink.trim();
    if (!title || (!link && !selectedFile)) {
      return;
    }

    setSaving(true);
    setLoadError('');
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('link', link);
      if (selectedFile) {
        fd.append('file', selectedFile);
      }

      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/resources`,
        {
          method: 'POST',
          credentials: 'include',
          body: fd,
        },
      );
      const data = await readJsonOrThrow(res, 'Failed to add resource');
      if (data.resource) {
        setResources((prev) => [data.resource, ...prev]);
      } else {
        await load();
      }
      setResourceTitle('');
      setResourceLink('');
      setSelectedFile(null);
    } catch (e) {
      setLoadError(e?.message || 'Could not add resource');
    } finally {
      setSaving(false);
    }
  };

  const deleteOne = async (id) => {
    if (!canManage) return;
    if (!window.confirm('Delete this resource?')) return;
    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(chatId)}/resources/${encodeURIComponent(id)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      await readJsonOrThrow(res, 'Failed to delete');
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setLoadError(e?.message || 'Delete failed');
    }
  };

  const headerActions = (
    <Link
      to="/classroom"
      className="btn-secondary px-4 py-2 text-xs font-bold uppercase tracking-wide"
    >
      All classrooms
    </Link>
  );

  const eyebrowMeta = (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
      <FolderOpen className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden />
      Shared files & links
    </span>
  );

  return (
    <div className="classroom-ambient relative page-surface flex justify-center px-4 pb-14 pt-6 md:px-6 md:pt-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[min(260px,34vh)] workspace-hero-mesh opacity-85 dark:opacity-55" />

      <div className="relative z-[2] w-full max-w-6xl">
        <div className="panel-card rounded-3xl p-4 sm:p-5 md:p-7">
          <ClassroomHero
            title={chatName}
            eyebrow="Resources"
            meta={eyebrowMeta}
            actions={headerActions}
          />

          <ClassroomTabs />

          {loadError ? (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100" role="alert">
              {loadError}
            </p>
          ) : null}

          <section className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-indigo-50/35 p-5 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950/95 md:p-6">
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Add resource
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              {canManage
                ? 'Combine a clear title with a link and/or upload—PDFs stay scoped to this classroom.'
                : 'Only classroom admins (creator and admins) can add resources.'}
            </p>

            <form
              onSubmit={submitResource}
              className="mt-5 grid gap-3 lg:grid-cols-2"
            >
              <input
                type="text"
                placeholder="Resource title"
                value={resourceTitle}
                onChange={(e) => setResourceTitle(e.target.value)}
                className="input-field text-sm lg:col-span-2"
                disabled={!canManage || saving}
              />
              <input
                type="url"
                placeholder="https://… (optional if uploading)"
                value={resourceLink}
                onChange={(e) => setResourceLink(e.target.value)}
                className="input-field text-sm"
                disabled={!canManage || saving}
              />
              <label className="flex cursor-pointer flex-col justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/90 px-4 py-3 text-center transition hover:border-cyan-400 hover:bg-cyan-50/40 dark:border-slate-600 dark:bg-slate-950/40 dark:hover:border-cyan-700">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  File upload
                </span>
                <span className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {selectedFile ? selectedFile.name : 'Choose or drop a file'}
                </span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  disabled={!canManage || saving}
                />
              </label>
              <button
                type="submit"
                disabled={!canManage || saving}
                className="btn-primary px-6 py-3 text-sm disabled:opacity-50 lg:col-span-2 lg:w-fit lg:justify-self-end"
              >
                {saving ? 'Adding…' : 'Add to library wall'}
              </button>
            </form>
          </section>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search resources by title…"
              className="input-field h-11 border-slate-200/90 bg-white/90 pl-9 text-sm dark:border-slate-600 dark:bg-slate-950/70"
              aria-label="Search resources"
            />
          </div>

          <section className="mt-5 space-y-4">
            {loading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-10 dark:border-slate-700 dark:bg-slate-900/40">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-600" aria-hidden />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Loading resources…
                </p>
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300/90 bg-white/80 px-6 py-14 text-center dark:border-slate-600 dark:bg-slate-900/50">
                <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
                <p className="mx-auto mt-3 max-w-md text-sm font-medium text-slate-600 dark:text-slate-400">
                  {resources.length === 0
                    ? 'Pin syllabus PDFs, slides, or helpful links—everything stays organized here.'
                    : 'No resources match your search.'}
                </p>
              </div>
            ) : (
              filteredResources.map((item, idx) => (
                <article
                  key={item.id}
                  style={{ animationDelay: `${Math.min(idx * 40, 320)}ms` }}
                  className="fade-in-up rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-cyan-200/90 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-cyan-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/10 text-cyan-700 dark:text-cyan-300">
                        <FolderOpen className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-900 ring-1 ring-cyan-200/80 transition hover:bg-cyan-100 dark:bg-cyan-950/60 dark:text-cyan-100 dark:ring-cyan-800"
                            >
                              <Link2 className="h-3.5 w-3.5" aria-hidden />
                              Open link
                            </a>
                          ) : null}
                          {item.fileUrl ? (
                            <a
                              href={item.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800 ring-1 ring-slate-200/80 transition hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600"
                            >
                              <FileText className="h-3.5 w-3.5" aria-hidden />
                              {item.fileName
                                ? `Open file (${item.fileName})`
                                : 'Open uploaded file'}
                            </a>
                          ) : null}
                        </div>
                        {item.fileName && !item.fileUrl ? (
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            File: {item.fileName}
                          </p>
                        ) : null}
                        <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {item.author} ·{' '}
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                    </div>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => deleteOne(item.id)}
                        className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-700 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ClassroomResources() {
  const { chatId } = useParams();

  if (!chatId) {
    return (
      <div className="classroom-ambient relative page-surface flex justify-center px-4 py-10">
        <div className="relative z-[2] w-full max-w-6xl">
          <div className="panel-card rounded-3xl p-8">
            <p className="font-medium text-rose-600">Classroom not found.</p>
            <Link
              to="/classroom"
              className="mt-4 inline-block text-sm font-semibold text-cyan-700 underline dark:text-cyan-400"
            >
              ← Back to classrooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <ClassroomResourcesContent key={chatId} chatId={chatId} />;
}

export default ClassroomResources;
