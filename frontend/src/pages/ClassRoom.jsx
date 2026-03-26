import { useEffect } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

function ClassRoom() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [classroomName, setClassroomName] = useState('');
    const [classroomCode, setClassroomCode] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch("/api/chats");
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                const result = await response.json();
                setData(result);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleCreateClass = async () => {
        try {
            const response = await fetch("/api/chats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: classroomName, code: classroomCode })
            });
            if (response.ok) {
                setShowCreateModal(false);
                setClassroomName('');
                setClassroomCode('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <p>loading</p>;

    if (error) return <p className="text-red-500">{error}</p>;
    if (!data || data.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
                    <section className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <p className="text-sm text-slate-500 mt-2">Manage your profile, reset passwords, and explore campus highlights.</p>
                        <div className="mt-6 flex flex-wrap gap-4">
                            {showCreateModal && (
                                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                                        <h2 className="text-2xl font-bold mb-4">Create Classroom</h2>
                                        <input
                                            type="text"
                                            placeholder="Classroom Name"
                                            value={classroomName}
                                            onChange={(e) => setClassroomName(e.target.value)}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Classroom Code"
                                            value={classroomCode}
                                            onChange={(e) => setClassroomCode(e.target.value)}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCreateClass}
                                                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700"
                                            >
                                                Create
                                            </button>
                                            <button
                                                onClick={() => setShowCreateModal(false)}
                                                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-5 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition cursor-pointer"
                            >
                                create class
                            </button>
                            <a
                                href="#"
                                className="px-5 py-2 rounded-full border border-slate-900 text-slate-900 text-sm font-semibold hover:bg-slate-900 hover:text-white transition"
                            >
                                join class
                            </a>
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
                <section className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                    <h2 className="text-2xl font-bold mb-6">Your Classrooms</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.chats?.map((classroom) => (
                            <div key={classroom._id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:shadow-md transition">
                                <h3 className="font-semibold text-lg text-slate-900">{classroom.name}</h3>
                                <p className="text-sm text-slate-600 mt-1">Code: <span className="font-mono">{classroom.invitationCode}</span></p>
                                <p className="text-sm text-slate-600 mt-2">Members: {classroom.members.length}</p>
                                <div className="mt-4 flex gap-2">
                                    <Link
                                        className="flex-1 px-3 py-2 text-center bg-slate-900 text-white text-sm rounded hover:bg-slate-700"
                                        to={`/classroom/${classroom._id}`}
                                    >
                                        Enter
                                    </Link>

                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default ClassRoom;
