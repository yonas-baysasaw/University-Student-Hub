import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function ClassRoom() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [classroomName, setClassroomName] = useState('');
    const [classroomCode, setClassroomCode] = useState('');
    const [joinCode, setJoinCode] = useState('');
    const [createError, setCreateError] = useState(null);
    const [joinError, setJoinError] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    const fetchChats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/chats', { credentials: 'include' });
            if (!response.ok) {
                throw new Error(`Unable to load classrooms (${response.status})`);
            }
            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchChats();
    }, [fetchChats]);

    const handleCreateClass = async () => {
        const trimmedName = classroomName.trim();
        if (!trimmedName) {
            setCreateError('Classroom name is required.');
            return;
        }

        setCreateError(null);
        setIsCreating(true);
        try {
            const payload = {
                name: trimmedName,
                ...(classroomCode.trim() ? { code: classroomCode.trim() } : {}),
            };

            const response = await fetch('/api/chats', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body?.message ?? `Unable to create classroom (${response.status})`);
            }

            setShowCreateModal(false);
            setClassroomName('');
            setClassroomCode('');
            await fetchChats();
        } catch (err) {
            setCreateError(err.message);
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinClass = async () => {
        const trimmedCode = joinCode.trim();
        if (!trimmedCode) {
            setJoinError('Invitation code is required.');
            return;
        }

        setJoinError(null);
        setIsJoining(true);
        try {
            const response = await fetch('/api/chats/join', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invitationCode: trimmedCode }),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body?.message ?? `Unable to join classroom (${response.status})`);
            }

            setShowJoinModal(false);
            setJoinCode('');
            await fetchChats();
        } catch (err) {
            setJoinError(err.message);
        } finally {
            setIsJoining(false);
        }
    };

    const openCreateModal = () => {
        setCreateError(null);
        setShowCreateModal(true);
    };

    const openJoinModal = () => {
        setJoinError(null);
        setShowJoinModal(true);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex justify-center items-center px-4 py-8">
                <div className="max-w-5xl w-full bg-white rounded-2xl shadow-lg p-6">
                    <p className="text-sm text-slate-600">Loading classrooms...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex justify-center items-center px-4 py-8">
                <div className="max-w-5xl w-full bg-white rounded-2xl shadow-lg p-6 space-y-4">
                    <p className="text-sm text-red-600">Error: {error}</p>
                    <button
                        onClick={fetchChats}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const classrooms = data?.chats ?? [];
    const hasClassrooms = classrooms.length > 0;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
                <section className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-2xl font-bold">{hasClassrooms ? 'Your Classrooms' : 'No classrooms yet'}</h2>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={openCreateModal}
                                className="px-5 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition"
                            >
                                create class
                            </button>
                            <button
                                onClick={openJoinModal}
                                className="px-5 py-2 rounded-full border border-slate-900 text-slate-900 text-sm font-semibold hover:bg-slate-900 hover:text-white transition"
                            >
                                join class
                            </button>
                        </div>
                    </div>

                    {!hasClassrooms ? (
                        <p className="text-sm text-slate-500">
                            Manage your profile, reset passwords, and explore campus highlights while you wait for your first classroom.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {classrooms.map((classroom) => (
                                <div
                                    key={classroom._id}
                                    className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
                                >
                                    <h3 className="font-semibold text-lg text-slate-900">{classroom.name}</h3>
                                    <p className="text-sm text-slate-600 mt-1">
                                        Code: <span className="font-mono">{classroom.invitationCode}</span>
                                    </p>
                                    <p className="text-sm text-slate-600 mt-2">
                                        Members: {classroom.members?.length ?? 0}
                                    </p>
                                    <div className="mt-4">
                                        <Link
                                            className="inline-flex w-full justify-center px-3 py-2 bg-slate-900 text-white text-sm rounded hover:bg-slate-700"
                                            to={`/classroom/${classroom._id}`}
                                        >
                                            Enter
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center px-4 py-8 z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
                        <h2 className="text-2xl font-bold mb-4">Create Classroom</h2>
                        {createError && <p className="mb-3 text-sm text-red-600">{createError}</p>}
                        <input
                            type="text"
                            placeholder="Classroom Name"
                            value={classroomName}
                            onChange={(e) => setClassroomName(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4"
                            disabled={isCreating}
                        />
                        <input
                            type="text"
                            placeholder="Classroom Code (optional)"
                            value={classroomCode}
                            onChange={(e) => setClassroomCode(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4"
                            disabled={isCreating}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleCreateClass}
                                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
                                disabled={isCreating}
                            >
                                {isCreating ? 'Creating...' : 'Create'}
                            </button>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100"
                                disabled={isCreating}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showJoinModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center px-4 py-8 z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
                        <h2 className="text-2xl font-bold mb-4">Join Classroom</h2>
                        {joinError && <p className="mb-3 text-sm text-red-600">{joinError}</p>}
                        <input
                            type="text"
                            placeholder="Invitation Code"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4"
                            disabled={isJoining}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleJoinClass}
                                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
                                disabled={isJoining}
                            >
                                {isJoining ? 'Joining...' : 'Join'}
                            </button>
                            <button
                                onClick={() => setShowJoinModal(false)}
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100"
                                disabled={isJoining}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClassRoom;
