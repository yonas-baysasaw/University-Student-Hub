import fs from "fs";
const fpath = "c:/Users/Hello/Documents/GitHub/University-Student-Hub/backend/src/controllers/eventController.js";
let s = fs.readFileSync(fpath, "utf8");
s = s.replace(
`import {
  parsePublishYear,
  validateEventCatalogMeta,
} from '../utils/bookCatalogMeta.js';`,
`import { validateEventCatalogMeta } from '../utils/bookCatalogMeta.js';`
);
const needle = "    publishYear,\n    courseSubject,\n";
if (!s.includes(needle)) { console.error("needle1 fail"); process.exit(1);}
s = s.replace(needle, "");
s = s.replace(
`  const course =
    typeof courseSubject === 'string'
      ? courseSubject.trim().slice(0, 200)
      : '';
  const py = parsePublishYear(publishYear);
  const catalogErr = validateEventCatalogMeta({
    academicTrack,
    department: dept,
    publishYear: py,
    courseSubject: course,
  });`,
`  const catalogErr = validateEventCatalogMeta({
    academicTrack,
    department: dept,
  });`
);
s = s.replace(
`  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return res.status(400).json({ message: 'Valid start time is required.' });
  }

  let end = null;`,
`  const start = startsAt ? new Date(startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return res.status(400).json({ message: 'Valid start time is required.' });
  }

  const catalogYear = start.getFullYear();

  let end = null;`
);
s = s.replace(
`    publishYear: Math.floor(py),
    courseSubject: course,`,
`    publishYear: catalogYear,
    courseSubject: '',`
);
fs.writeFileSync(fpath, s);
console.log("done");
