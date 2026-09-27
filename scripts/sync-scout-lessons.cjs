// Generate a server-owned copy of the public lesson cards; never accept lesson prose from clients.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'frontend/src/lib/lessons.ts'), 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const sandbox = {exports:{}};
vm.runInNewContext(js, sandbox);
const lessons = Object.fromEntries(sandbox.exports.UNITS.flatMap(unit => unit.lessons.map(({id,title,cards})=>[id,{title,cards}])));
fs.writeFileSync(path.join(root,'src/layer/clearvest/data/scout_lessons.json'), JSON.stringify(lessons, null, 2)+'\n');
