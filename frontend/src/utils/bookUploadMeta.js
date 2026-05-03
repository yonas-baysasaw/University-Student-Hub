/** Academic metadata for library uploads — shared by Profile upload wizard */

export const ACADEMIC_TRACKS = [
  {
    id: 'engineering',
    label: 'Engineering',
    hint: 'Applied science & tech departments',
  },
  {
    id: 'social',
    label: 'Social sciences',
    hint: 'People, society & institutions',
  },
  {
    id: 'natural',
    label: 'Natural sciences',
    hint: 'Life, physical & formal sciences',
  },
];

/** Human-readable label for stored academicTrack values */
export function academicTrackLabel(raw) {
  const id = String(raw ?? '').trim().toLowerCase();
  if (!id) return '';
  const hit = ACADEMIC_TRACKS.find((t) => t.id === id);
  return hit ? hit.label : String(raw).trim();
}

export const DEPARTMENTS_BY_TRACK = {
  engineering: [
    'Software Engineering',
    'Civil Engineering',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Chemical Engineering',
    'Industrial Engineering',
    'Aerospace Engineering',
    'Biomedical Engineering',
    'Other',
  ],
  social: [
    'Psychology',
    'Sociology',
    'Economics',
    'Law & Policy',
    'Education',
    'Communication',
    'Political Science',
    'Anthropology',
    'Other',
  ],
  natural: [
    'Biology',
    'Chemistry',
    'Physics',
    'Mathematics',
    'Earth & Environmental Science',
    'Computer Science',
    'Statistics',
    'Materials Science',
    'Other',
  ],
};

/** Quick-insert chips for course / subject field */
export const COURSE_SUBJECT_SUGGESTIONS = [
  'Operating Systems',
  'Java Programming',
  'Artificial Intelligence',
  'Data Structures',
  'Linear Algebra',
  'Thermodynamics',
  'Structural Analysis',
  'Signals & Systems',
];

export function validateWizardStep(step, form) {
  if (step === 1) {
    if (!form.academicTrack) {
      return 'Select Engineering, Social sciences, or Natural sciences.';
    }
    if (!form.department) {
      return 'Choose a department or discipline.';
    }
    if (
      form.department === 'Other' &&
      !String(form.departmentOther || '').trim()
    ) {
      return 'Describe your department when using Other.';
    }
    return null;
  }
  if (step === 2) {
    if (!String(form.title || '').trim()) {
      return 'Enter the book name.';
    }
    const y = Number(form.publishYear);
    if (!Number.isFinite(y) || y < 1950 || y > 2035) {
      return 'Enter a publish year between 1950 and 2035.';
    }
    if (!String(form.courseSubject || '').trim()) {
      return 'Enter the course or subject.';
    }
    return null;
  }
  if (step === 3) {
    if (!form.file) {
      return 'Attach a file to upload.';
    }
    return null;
  }
  return null;
}

export function resolveDepartmentForSubmit(form) {
  if (form.department === 'Other') {
    return String(form.departmentOther || '').trim();
  }
  return String(form.department || '').trim();
}

const TRACK_IDS = ['engineering', 'social', 'natural'];

/**
 * Client-side catalog check for events (matches backend validateEventCatalogMeta).
 * @returns {string|null} Error message or null when valid.
 */
export function validateEventCatalogFields({
  academicTrack,
  department,
  publishYear,
  courseSubject,
}) {
  const track = String(academicTrack || '').trim().toLowerCase();
  if (!TRACK_IDS.includes(track)) {
    return 'Choose a field: Engineering, Social sciences, or Natural sciences.';
  }

  const dept = String(department || '').trim();
  if (!dept || dept.length > 160) {
    return 'Department or discipline is required.';
  }
  if (dept === 'Other') {
    return 'Specify your department when selecting Other.';
  }

  const y = Number(publishYear);
  if (!Number.isFinite(y) || y < 1950 || y > 2035) {
    return 'Enter a valid year (1950–2035).';
  }

  if (!String(courseSubject || '').trim()) {
    return 'Course or subject is required (e.g. Operating Systems, Java).';
  }

  return null;
}
