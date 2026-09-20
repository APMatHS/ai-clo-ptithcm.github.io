import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const errors=[];const warnings=[];

function walk(dir,exts){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p,exts):exts.some(x=>e.name.endsWith(x))?[p]:[];});}
function rel(p){return path.relative(root,p).replaceAll('\\','/');}

const frontendJs=walk(path.join(root,'assets','js'),['.js']);
const css=walk(path.join(root,'assets','css'),['.css']);
const allText=[...frontendJs,...css,path.join(root,'index.html')].filter(fs.existsSync);

for(const file of frontendJs){
  const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(check.status!==0)errors.push(`${rel(file)}: JavaScript syntax error\n${check.stderr.trim()}`);
  const text=fs.readFileSync(file,'utf8');
  if(/SUPABASE_SERVICE_ROLE_KEY|service[_-]?role\s*[:=]/i.test(text))errors.push(`${rel(file)}: không được chứa service-role secret.`);
  if(/(?:patch|fix)[-_]?v?\d/i.test(path.basename(file)))errors.push(`${rel(file)}: không tạo file vá theo phiên bản; sửa đúng module.`);
  if(Buffer.byteLength(text)>45_000)warnings.push(`${rel(file)} lớn hơn 45 KB; cân nhắc tách module.`);
  const importRe=/\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;
  for(const m of text.matchAll(importRe)){
    const target=path.resolve(path.dirname(file),m[1]);
    const candidates=[target,target+'.js',path.join(target,'index.js')];
    if(!candidates.some(fs.existsSync))errors.push(`${rel(file)}: import không tồn tại: ${m[1]}`);
  }
}

for(const file of css){
  const text=fs.readFileSync(file,'utf8');
  if(/(?:patch|fix)[-_]?v?\d/i.test(path.basename(file)))errors.push(`${rel(file)}: không tạo CSS vá theo phiên bản.`);
  if(Buffer.byteLength(text)>55_000)warnings.push(`${rel(file)} lớn hơn 55 KB; cân nhắc tách theo miền chức năng.`);
}

for(const file of allText){
  const text=fs.readFileSync(file,'utf8');
  const count=(text.match(/style=["']/g)||[]).length;
  if(count>8)warnings.push(`${rel(file)} có ${count} inline style; nên chuyển dần về CSS module.`);
}

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const m of html.matchAll(/(?:href|src)=["'](\.\/[^"'#?]+)["']/g)){
  const target=path.resolve(root,m[1]);
  if(!fs.existsSync(target))errors.push(`index.html tham chiếu file không tồn tại: ${m[1]}`);
}

console.log(`AI-CLO EXAM source check: ${frontendJs.length} JS, ${css.length} CSS`);
for(const w of warnings)console.warn(`WARN: ${w}`);
if(errors.length){for(const e of errors)console.error(`ERROR: ${e}`);process.exit(1);}
console.log('OK: không phát hiện lỗi cấu trúc chặn deploy.');
