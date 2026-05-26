const fs = require("fs");
const p = "c:/Users/Hello/Documents/GitHub/University-Student-Hub/frontend/src/utils/bookUploadMeta.js";
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("export function validateEventCatalogFields");
if (start < 0) process.exit(1);
const rest = s.indexOf("\n}\n", start);
const end = rest + 2;
const mid = `export function validateEventCatalogFields({ academicTrack, department }) {
  const track = String(academicTrack || "").trim().toLowerCase();
  if (!TRACK_IDS.includes(track)) {
    return "Choose a field: Engineering, Social sciences, or Natural sciences.";
  }

  const dept = String(department || "").trim();
  if (!dept || dept.length > 160) {
    return "Pick a school, faculty, or department.";
  }
  if (dept === "Other") {
    return "Specify your department when selecting Other.";
  }

  return null;
}`;
s = s.slice(0, start) + mid + s.slice(end);
fs.writeFileSync(p, s);
console.log("ok");
