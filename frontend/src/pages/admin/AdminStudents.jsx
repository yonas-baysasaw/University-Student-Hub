import AdminUsersPage from './AdminUsersPage';

export default function AdminStudents() {
  return (
    <AdminUsersPage
      accountType="student"
      title="Student management"
      description="Search students, update departments, assign roles, suspend accounts, and apply read-only controls."
    />
  );
}
