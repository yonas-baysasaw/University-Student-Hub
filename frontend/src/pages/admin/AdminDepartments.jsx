import { Plus, Save, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  SkeletonRows,
} from './adminShared';

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [departmentData, studentData] = await Promise.all([
        adminApi.departments(),
        adminApi.users({ accountType: 'student', limit: 100 }),
      ]);
      setDepartments(departmentData.departments ?? []);
      setStudents(studentData.users ?? []);
    } catch (e) {
      toast.error(e?.message || 'Could not load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createDepartment = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createDepartment(form);
      toast.success('Department created');
      setForm({ name: '', code: '', description: '' });
      await load();
    } catch (e) {
      toast.error(e?.message || 'Create failed');
    }
  };

  const toggleDepartment = async (department) => {
    try {
      await adminApi.updateDepartment(department._id, {
        active: !department.active,
      });
      toast.success(
        department.active ? 'Department disabled' : 'Department enabled',
      );
      await load();
    } catch (e) {
      toast.error(e?.message || 'Update failed');
    }
  };

  const assignStudent = async (e) => {
    e.preventDefault();
    if (!selectedDepartment || !selectedStudent) return;
    try {
      await adminApi.assignStudents(selectedDepartment, [selectedStudent]);
      toast.success('Student assigned');
      setSelectedStudent('');
      await load();
    } catch (e) {
      toast.error(e?.message || 'Assignment failed');
    }
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Departments"
        description="Create departments, keep department status current, and assign students to academic units."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <AdminCard className="overflow-hidden">
          {loading ? (
            <SkeletonRows rows={6} />
          ) : departments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Students</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {departments.map((department) => (
                    <tr key={department._id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {department.name}
                        </p>
                        <p className="max-w-[360px] truncate text-xs text-slate-500">
                          {department.description || 'No description'}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {department.code}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Users className="h-4 w-4" />{' '}
                          {department.studentCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            department.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {department.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleDepartment(department)}
                          className="btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
                        >
                          <Trash2 className="h-4 w-4" />{' '}
                          {department.active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No departments yet"
                description="Create the first academic department from the panel."
              />
            </div>
          )}
        </AdminCard>

        <div className="space-y-4">
          <AdminCard className="p-4">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              New department
            </h2>
            <form onSubmit={createDepartment} className="mt-4 space-y-3">
              <input
                className="input-field"
                placeholder="Department name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <input
                className="input-field"
                placeholder="Code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
              />
              <textarea
                className="input-field min-h-24"
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
              <button
                type="submit"
                className="btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
              >
                <Plus className="h-4 w-4" /> Create
              </button>
            </form>
          </AdminCard>

          <AdminCard className="p-4">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Assign student
            </h2>
            <form onSubmit={assignStudent} className="mt-4 space-y-3">
              <select
                className="input-field"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
              >
                <option value="">Select department</option>
                {departments
                  .filter((d) => d.active)
                  .map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <select
                className="input-field"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
              >
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName || s.name || s.email}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="btn-secondary inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm"
              >
                <Save className="h-4 w-4" /> Assign
              </button>
            </form>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
