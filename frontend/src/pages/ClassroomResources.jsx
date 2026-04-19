import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ClassroomMembersSidebar from '../components/ClassroomMembersSidebar';
import ClassroomTabs from '../components/ClassroomTabs';
import { useAuth } from '../contexts/AuthContext';
import { fetchClassroomMeta, isInstructor } from '../utils/classroom';

function ClassroomResourcesContent({ chatId, user }) {
  const [members, setMembers] = useState([]);
  const [membersError, setMembersError] = useState('');
  const [chatName, setChatName] = useState('Class Resources');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceLink, setResourceLink] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [resources, setResources] = useState(() => {
    const key = `ush_resources_${chatId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (error) {
      console.error('Failed to load resources', error);
    }
    return [];
  });
  const instructor = useMemo(() => isInstructor(user), [user]);

  useEffect(() => {
    if (!chatId) return;
    localStorage.setItem(`ush_resources_${chatId}`, JSON.stringify(resources));
  }, [resources, chatId]);

  useEffect(() => {
    if (!chatId) return;
    const controller = new AbortController();
    const loadMeta = async () => {
      try {
        const chat = await fetchClassroomMeta(chatId, controller.signal);
        setMembers(chat?.members ?? []);
        setChatName(chat?.name ?? 'Class Resources');
      } catch (error) {
        if (error.name !== 'AbortError') setMembersError(error.message);
      }
    };
    loadMeta();
    return () => controller.abort();
  }, [chatId]);

  const submitResource = (event) => {
    event.preventDefault();
    if (!instructor) return;
    const title = resourceTitle.trim();
    const link = resourceLink.trim();
    const fileName = selectedFile?.name ?? '';
    if (!title || (!link && !fileName)) return;

    const author = user?.displayName ?? user?.username ?? 'Instructor';
    setResources((prev) => [
      {
        id: `${Date.now()}`,
        title,
        link,
        fileName,
        author,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    setResourceTitle('');
    setResourceLink('');
    setSelectedFile(null);
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="font-display text-xl text-slate-900">
                Upload resource
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {instructor
                  ? 'Only instructors can upload resources for this classroom.'
                  : 'Resources are uploaded by the instructor only.'}
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
                  disabled={!instructor}
                />
                <input
                  type="url"
                  placeholder="https://resource-link"
                  value={resourceLink}
                  onChange={(e) => setResourceLink(e.target.value)}
                  className="input-field text-sm"
                  disabled={!instructor}
                />
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="file-input file-input-bordered w-full rounded-xl border-slate-200 bg-slate-50/70 text-sm"
                  disabled={!instructor}
                />
                <button
                  type="submit"
                  disabled={!instructor}
                  className="btn-primary px-5 py-2 text-sm disabled:opacity-50 md:col-span-3 md:w-fit"
                >
                  Upload
                </button>
              </form>
            </section>

            <section className="mt-4 space-y-3">
              {resources.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                  No resources uploaded yet.
                </p>
              ) : (
                resources.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <h4 className="font-display text-lg text-slate-900">
                      {item.title}
                    </h4>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sm font-semibold text-cyan-700 underline"
                      >
                        Open resource link
                      </a>
                    )}
                    {item.fileName && (
                      <p className="mt-1 text-sm text-slate-600">
                        File: {item.fileName}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      Uploaded by {item.author} on{' '}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </article>
                ))
              )}
            </section>
          </div>

          <ClassroomMembersSidebar
            members={members}
            membersError={membersError}
            user={user}
          />
        </div>
      </div>
    </div>
  );
}

function ClassroomResources() {
  const { chatId } = useParams();
  const { user } = useAuth();

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

  return <ClassroomResourcesContent key={chatId} chatId={chatId} user={user} />;
}

export default ClassroomResources;
