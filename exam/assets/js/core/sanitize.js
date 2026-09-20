let purifierPromise;
async function purifier(){if(!purifierPromise)purifierPromise=import('https://cdn.jsdelivr.net/npm/dompurify@3.4.15/+esm');return purifierPromise;}
export async function sanitizeHtml(html=''){
  const mod=await purifier();const DOMPurify=mod.default||mod;
  return DOMPurify.sanitize(String(html),{USE_PROFILES:{html:true,svg:true,mathMl:true},FORBID_TAGS:['script','iframe','object','embed','form','input','button','textarea','select'],FORBID_ATTR:['style','onerror','onload','onclick','onmouseover'],ADD_ATTR:['target','rel']});
}
