import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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

  return (
    <div className="page-surface flex justify-center px-4 py-8">
      <div className="panel-card w-full max-w-6xl rounded-3xl p-4 sm:p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-slate-900 sm:text-3xl">
              {chatName}
            </h2>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
              Class resources
            </p>
          </div>
          <Link
            to="/classroom"
            className="btn-secondary px-4 py-2 text-xs uppercase tracking-wide"
          >
            View classrooms
          </Link>
        </div>

        <ClassroomTabs />

        {loadError ? (
          <p className="mb-3 text-sm text-rose-600" role="alert">
            {loadError}
          </p>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-display text-xl text-slate-900">Add resource</h3>
          <p className="mt-1 text-sm text-slate-600">
            {canManage
              ? 'Add a link and/or upload a file (files are stored securely on the server).'
              : 'Only classroom admins (creator and admins) can add resources.'}
          </p>

          <form
            onSubmit={submitResource}
            className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]"
          >
            <input
              type="text"
              placeholder="Resource title"
              value={resourceTitle}
              onChange={(e) => setResourceTitle(e.target.value)}
              className="input-field text-sm"
              disabled={!canManage || saving}
            />
            <input
              type="url"
              placeholder="https://resource-link (optional if you upload a file)"
              value={resourceLink}
              onChange={(e) => setResourceLink(e.target.value)}
              className="input-field text-sm md:col-span-1"
              disabled={!canManage || saving}
            />
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="file-input file-input-bordered w-full rounded-xl border-slate-200 bg-slate-50/70 text-sm"
              disabled={!canManage || saving}
            />
            <button
              type="submit"
              disabled={!canManage || saving}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-50 md:col-span-3 md:w-fit"
            >
              {saving ? 'Adding…' : 'Add resource'}
            </button>
          </form>
        </section>

        <section className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Loading resources…</p>
          ) : resources.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              No resources yet.
            </p>
          ) : (
            resources.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="font-display text-lg text-slate-900">
                    {item.title}
                  </h4>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => deleteOne(item.id)}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
                {item.link ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-semibold text-cyan-700 underline"
                  >
                    Open resource link
                  </a>
                ) : null}
                {item.fileUrl ? (
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-sm font-semibold text-cyan-700 underline"
                  >
                    {item.fileName
                      ? `Open uploaded file (${item.fileName})`
                      : 'Open uploaded file'}
                  </a>
                ) : null}
                {item.fileName && !item.fileUrl ? (
                  <p className="mt-1 text-sm text-slate-600">
                    File: {item.fileName}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  Uploaded by {item.author} on{' '}
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function ClassroomResources() {
  const { chatId } = useParams();

  if (!chatId) {
    return (
      <div className="page-surface flex justify-center px-4 py-8">
        <div className="panel-card w-full max-w-6xl rounded-3xl p-8">
          <p className="text-rose-600">Classroom not found.</p>
          <Link
            to="/classroom"
            className="mt-3 inline-block text-sm font-semibold text-cyan-700 underline"
          >
            &larr; Back to classrooms
          </Link>
        </div>
      </div>
    );
  }

  return <ClassroomResourcesContent key={chatId} chatId={chatId} />;
}

export default ClassroomResources;
