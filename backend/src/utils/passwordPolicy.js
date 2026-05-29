const MIN_LENGTH = 8;

/**
 * @param {unknown} password
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePasswordPolicy(password) {
  if (typeof password !== 'string' || !password) {
    return { valid: false, message: 'Password is required' };
  }

  const missing = [];
  if (password.length < MIN_LENGTH) {
    missing.push('at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    missing.push('an uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    missing.push('a lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    missing.push('a number');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    missing.push('a special character');
  }

  if (missing.length === 0) {
    return { valid: true, message: '' };
  }

  const last = missing.pop();
  const list =
    missing.length === 0
      ? last
      : `${missing.join(', ')}, and ${last}`;

  return {
    valid: false,
    message: `Password must include ${list}.`,
  };
}
