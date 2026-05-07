import { readJsonOrThrow } from '../utils/http';

const request = async (path, options = {}) => {
  const res = await fetch(`/api/admin${path}`, {
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
    body:
      options.body && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  });
  return readJsonOrThrow(res, 'Admin request failed');
};

export const adminApi = {
  stats: () => request('/stats'),
  analytics: (days = 30) => request(`/analytics?days=${days}`),
  users: (params = {}) => request(`/users?${new URLSearchParams(params)}`),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PUT', body }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  suspendUsers: (body) => request('/users/suspend', { method: 'POST', body }),
  activateUsers: (body) => request('/users/activate', { method: 'POST', body }),
  departments: () => request('/departments'),
  createDepartment: (body) => request('/departments', { method: 'POST', body }),
  updateDepartment: (id, body) =>
    request(`/departments/${id}`, { method: 'PUT', body }),
  deleteDepartment: (id) => request(`/departments/${id}`, { method: 'DELETE' }),
  assignStudents: (id, studentIds) =>
    request(`/departments/${id}/students`, {
      method: 'POST',
      body: { studentIds },
    }),
  logs: (params = {}) => request(`/logs?${new URLSearchParams(params)}`),
  notifications: () => request('/notifications'),
  sendAnnouncement: (body) =>
    request('/notifications/announcements', { method: 'POST', body }),
  settings: () => request('/settings'),
  updateSettings: (body) => request('/settings', { method: 'PUT', body }),
};
