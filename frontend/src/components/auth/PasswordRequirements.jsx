import { HiOutlineCheck, HiOutlineX } from 'react-icons/hi';
import { getPasswordRuleChecks } from '../../utils/passwordStrength';

export function PasswordRequirements({ password, className = '' }) {
  const rules = getPasswordRuleChecks(password);
  const merged = className
    ? `auth-campus-password-requirements ${className}`.trim()
    : 'auth-campus-password-requirements';

  return (
    <ul className={merged} aria-label="Password requirements">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className={rule.met ? 'auth-campus-password-rule--met' : 'auth-campus-password-rule--unmet'}
        >
          {rule.met ? (
            <HiOutlineCheck className="auth-campus-password-rule-icon" aria-hidden />
          ) : (
            <HiOutlineX className="auth-campus-password-rule-icon" aria-hidden />
          )}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
