/** Machine codes + labels for universal reporting (keep in sync with frontend `reportReasons.js`). */

export const REPORT_TARGET_TYPES = ['book', 'event', 'user', 'message', 'classroom'];

export const BOOK_REPORT_REASONS = [
  { code: 'incorrect_information', label: 'Incorrect Information' },
  { code: 'copyright_issue', label: 'Copyright Issue' },
  { code: 'offensive_content', label: 'Offensive Content' },
  { code: 'spam', label: 'Spam' },
  { code: 'duplicate_book', label: 'Duplicate Book' },
  { code: 'broken_file', label: 'Broken File/PDF' },
  { code: 'other', label: 'Other' },
];

export const EVENT_REPORT_REASONS = [
  { code: 'fake_event', label: 'Fake Event' },
  { code: 'wrong_information', label: 'Wrong Information' },
  { code: 'spam', label: 'Spam' },
  { code: 'offensive_content', label: 'Offensive Content' },
  { code: 'dangerous_activity', label: 'Dangerous Activity' },
  { code: 'duplicate_event', label: 'Duplicate Event' },
  { code: 'other', label: 'Other' },
];

export const USER_REPORT_REASONS = [
  { code: 'harassment', label: 'Harassment' },
  { code: 'spam', label: 'Spam' },
  { code: 'fake_account', label: 'Fake Account' },
  { code: 'inappropriate_behavior', label: 'Inappropriate Behavior' },
  { code: 'hate_speech', label: 'Hate Speech' },
  { code: 'scam_fraud', label: 'Scam/Fraud' },
  { code: 'other', label: 'Other' },
];

const REASONS_BY_TYPE = {
  book: BOOK_REPORT_REASONS,
  event: EVENT_REPORT_REASONS,
  user: USER_REPORT_REASONS,
};

export function getReasonsForTargetType(targetType) {
  return REASONS_BY_TYPE[targetType] || [];
}

export function getReasonLabel(targetType, code) {
  const list = getReasonsForTargetType(targetType);
  const hit = list.find((r) => r.code === code);
  return hit?.label || code;
}

export function isValidReasonCode(targetType, code) {
  if (!code || typeof code !== 'string') return false;
  const list = getReasonsForTargetType(targetType);
  return list.some((r) => r.code === code);
}
