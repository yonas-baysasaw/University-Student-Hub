export function getPasswordStrength(password) {
  let score = 0;
  if (!password) return { score: 0, label: 'Very weak', color: 'bg-slate-300', text: 'text-slate-500' };
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-600' };
  if (score <= 3) return { score, label: 'Medium', color: 'bg-amber-500', text: 'text-amber-600' };
  return { score, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' };
}
