export const CAMPUS_PASSWORD_MIN_LENGTH = 8;

/**
 * @returns {{ id: string, label: string, met: boolean }[]}
 */
export function getPasswordRuleChecks(password) {
  const p = typeof password === 'string' ? password : '';
  return [
    {
      id: 'length',
      label: 'At least 8 characters',
      met: p.length >= CAMPUS_PASSWORD_MIN_LENGTH,
    },
    {
      id: 'upper',
      label: 'One uppercase letter (A–Z)',
      met: /[A-Z]/.test(p),
    },
    {
      id: 'lower',
      label: 'One lowercase letter (a–z)',
      met: /[a-z]/.test(p),
    },
    {
      id: 'number',
      label: 'One number',
      met: /[0-9]/.test(p),
    },
    {
      id: 'special',
      label: 'One special character (! @ # $ …)',
      met: /[^A-Za-z0-9]/.test(p),
    },
  ];
}

export function isCampusPasswordValid(password) {
  return getPasswordRuleChecks(password).every((rule) => rule.met);
}

/**
 * @returns {{ valid: boolean, message: string }}
 */
export function validateCampusPassword(password) {
  const unmet = getPasswordRuleChecks(password).filter((rule) => !rule.met);
  if (unmet.length === 0) {
    return { valid: true, message: '' };
  }
  const labels = unmet.map((rule) => rule.label.toLowerCase());
  const last = labels.pop();
  const list =
    labels.length === 0 ? last : `${labels.join(', ')}, and ${last}`;
  return {
    valid: false,
    message: `Password must include ${list}.`,
  };
}

/**
 * @returns {string[]} Human-readable suggestions for missing password rules
 */
export function getPasswordSuggestions(password) {
  return getPasswordRuleChecks(password)
    .filter((rule) => !rule.met)
    .map((rule) => rule.label);
}

export function getPasswordStrength(password) {
  let score = 0;
  if (!password)
    return {
      score: 0,
      label: 'Very weak',
      color: 'bg-slate-300',
      text: 'text-slate-500',
    };
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1)
    return {
      score,
      label: 'Weak',
      color: 'bg-rose-500',
      text: 'text-rose-600',
    };
  if (score <= 3)
    return {
      score,
      label: 'Medium',
      color: 'bg-amber-500',
      text: 'text-amber-600',
    };
  return {
    score,
    label: 'Strong',
    color: 'bg-emerald-500',
    text: 'text-emerald-600',
  };
}
