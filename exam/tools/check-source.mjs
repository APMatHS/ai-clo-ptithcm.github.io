import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const errors=[];const warnings=[];

function walk(dir,exts){if(!fs.existsSync(dir))return[];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p,exts):exts.some(x=>e.name.endsWith(x))?[p]:[];});}
function rel(p){return path.relative(root,p).replaceAll('\\','/');}
function checkJsSource(source,label){
  const temp=path.join(os.tmpdir(),`exam-inline-${process.pid}-${Math.random().toString(16).slice(2)}.js`);
  try{
    fs.writeFileSync(temp,source,'utf8');
    const check=spawnSync(process.execPath,['--check',temp],{encoding:'utf8'});
    if(check.status!==0)errors.push(`${label}: JavaScript syntax error\n${check.stderr.trim()}`);
  }finally{try{fs.unlinkSync(temp);}catch{}}
}

const frontendJs=walk(path.join(root,'assets','js'),['.js']);
const css=walk(path.join(root,'assets','css'),['.css']);
const htmlPath=path.join(root,'index.html');
const allText=[...frontendJs,...css,htmlPath].filter(fs.existsSync);

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

const html=fs.readFileSync(htmlPath,'utf8');
for(const m of html.matchAll(/(?:href|src)=["'](\.\/[^"'#?]+)["']/g)){
  const target=path.resolve(root,m[1]);
  if(!fs.existsSync(target))errors.push(`index.html tham chiếu file không tồn tại: ${m[1]}`);
}

let inlineIndex=0;
for(const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*\btype=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi)){
  inlineIndex+=1;
  checkJsSource(m[1],`index.html inline script #${inlineIndex}`);
}

console.log(`AI-CLO EXAM source check: ${frontendJs.length} JS, ${css.length} CSS, ${inlineIndex} inline script`);
for(const w of warnings)console.warn(`WARN: ${w}`);
if(errors.length){for(const e of errors)console.error(`ERROR: ${e}`);process.exit(1);}
console.log('OK: không phát hiện lỗi cấu trúc chặn deploy.');
