const fs=require('fs');
const p='c:/Users/Hello/Documents/GitHub/University-Student-Hub/frontend/src/pages/Events.jsx';
let s=fs.readFileSync(p,'utf8');
s=s.replace(/  Upload,\n  X,/,'  ImagePlus,\n  Plus,\n  X,');
fs.writeFileSync(p,s);
console.log('ok');