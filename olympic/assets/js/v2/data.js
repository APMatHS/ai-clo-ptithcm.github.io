async function loadSession(){
  if(!db)return;
  const {data,error}=await db.auth.getSession();
  if(error)console.warn('Olympic auth session:',error);
  state.user=data?.session?.user||null;
}

async function loadProfileAndSubjects(){
  state.profile=null;state.subjects=[];
  if(!db||!state.user){state.subject=null;return}
  const [p,s]=await Promise.all([
    db.from('profiles').select('id,full_name,email,role,is_active').eq('id',state.user.id).maybeSingle(),
    db.from('olympic_subjects').select('*').order('order_index')
  ]);
  if(!p.error)state.profile=p.data;
  if(!s.error)state.subjects=s.data||[];
  state.subject=state.subjects.find(x=>x.code===subjectCode)||null;
}

function cacheGet(map,key){
  const hit=map.get(key);
  if(!hit)return null;
  if(Date.now()-hit.time>CACHE_TTL){map.delete(key);return null}
  return hit.value;
}
function cacheSet(map,key,value){map.set(key,{time:Date.now(),value});return value}
function clearDataCache(code){
  if(!code){state.cache.trees.clear();state.cache.lessons.clear();return}
  state.cache.trees.delete(code);
  state.cache.lessons.delete(code);
}

async function loadTree(code=subjectCode,{force=false}={}){
  if(!force){const hit=cacheGet(state.cache.trees,code);if(hit)return hit}
  const subject=state.subjects.find(x=>x.code===code);
  if(!subject)return {sections:[],topics:[]};
  const [a,b]=await Promise.all([
    db.from('olympic_sections').select('*').eq('subject_id',subject.id).order('order_index'),
    db.from('olympic_topics').select('*').eq('subject_id',subject.id).order('order_index')
  ]);
  if(a.error)throw a.error;if(b.error)throw b.error;
  return cacheSet(state.cache.trees,code,{sections:a.data||[],topics:b.data||[]});
}

async function loadPublishedLessons(code=subjectCode,{force=false}={}){
  if(!force){const hit=cacheGet(state.cache.lessons,code);if(hit)return hit}
  const subject=state.subjects.find(x=>x.code===code);
  if(!subject)return [];
  const r=await db.from('olympic_lessons').select('*,topic:olympic_topics!olympic_lessons_topic_id_fkey(title)').eq('subject_id',subject.id).eq('status','published').eq('is_visible',true).order('order_index');
  if(r.error)throw r.error;
  return cacheSet(state.cache.lessons,code,r.data||[]);
}
