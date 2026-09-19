/* AI-CLO OLYMPIC V2 — persistent app shell, soft router, Supabase data layer */
'use strict';

const APP_VERSION='2.0.1';
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>[...p.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfg=window.AICLO_CONFIG||{};
const db=window.supabase?.createClient?.(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);

let page='home';
let subjectCode='';
let routeSeq=0;
let shellReady=false;

const state={
  user:null,
  profile:null,
  subjects:[],
  subject:null,
  dirty:false,
  cache:{trees:new Map(),lessons:new Map()}
};

const labels={
  home:['Olympic Toán sinh viên','Không gian học tập và luyện thi Olympic'],
  subject:['Tổng quan môn','Nội dung, bài học và luyện tập'],
  contents:['Nội dung cần học','Cây chuyên đề do giảng viên quản lý'],
  lessons:['Bài học','Lý thuyết, ví dụ và bài giảng TeX'],
  practice:['Luyện tập','Bài tập theo chuyên đề'],
  problems:['Ngân hàng bài toán','Bài toán Olympic được tuyển chọn'],
  tests:['Đề luyện','Đề luyện và thi thử'],
  results:['Kết quả','Theo dõi tiến độ học tập'],
  teacher:['Khu vực giảng viên','Biên soạn và quản lý học liệu'],
  teacherContents:['Quản lý nội dung','Thêm, sửa và sắp xếp cây nội dung'],
  teacherLessons:['Soạn bài học','Trình soạn TeX và xem trước trực tiếp'],
  teacherProblems:['Quản lý bài toán','Ngân hàng bài toán Olympic'],
  teacherTests:['Quản lý đề luyện','Tạo đề luyện và thi thử'],
  teacherStudents:['Sinh viên','Theo dõi hoạt động học tập'],
  admin:['Cấu hình Olympic','Phân quyền giảng viên theo môn']
};

const subjFallback={
  algebra:{code:'algebra',name:'Đại số',desc:'Ma trận, đại số tuyến tính, đa thức và các bài toán rời rạc.'},
  calculus:{code:'calculus',name:'Giải tích',desc:'Giới hạn, đạo hàm, tích phân, chuỗi và các bài toán giải tích Olympic.'}
};

const featurePages=new Set(['contents','lessons','practice','problems','tests','results']);
const teacherPages={contents:'teacherContents',lessons:'teacherLessons',problems:'teacherProblems',tests:'teacherTests',students:'teacherStudents'};
const CACHE_TTL=30000;

const role=()=>state.profile?.role||'guest';
const staff=()=>['admin','teacher','lecturer','giangvien'].includes(role());
const admin=()=>role()==='admin';
const subjectUrl=(code=subjectCode)=>`/olympic/${code}/`;
const subjectFeatureUrl=(feature,code=subjectCode)=>`/olympic/${code}/${feature}/`;

function toast(message,bad=false){
  const x=$('#olyToast');
  if(!x)return;
  x.textContent=message;
  x.className='oly-toast show'+(bad?' error':'');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>x.className='oly-toast',2700);
}
function fail(error){console.error(error);toast(error?.message||'Có lỗi xảy ra',true)}

function routeFromPath(pathname=location.pathname){
  let p=pathname.replace(/\/index\.html$/,'/');
  if(!p.endsWith('/'))p+='/';
  if(p==='/olympic/')return {valid:true,page:'home',subjectCode:''};
  if(p==='/olympic/admin/')return {valid:true,page:'admin',subjectCode:''};
  if(p==='/olympic/teacher/')return {valid:true,page:'teacher',subjectCode:''};
  let m=p.match(/^\/olympic\/teacher\/([^/]+)\/$/);
  if(m&&teacherPages[m[1]])return {valid:true,page:teacherPages[m[1]],subjectCode:''};
  m=p.match(/^\/olympic\/(algebra|calculus)\/$/);
  if(m)return {valid:true,page:'subject',subjectCode:m[1]};
  m=p.match(/^\/olympic\/(algebra|calculus)\/([^/]+)\/$/);
  if(m&&featurePages.has(m[2]))return {valid:true,page:m[2],subjectCode:m[1]};
  return {valid:false,page:'home',subjectCode:''};
}

function applyRoute(route){
  page=route.page;
  subjectCode=route.subjectCode||'';
  state.subject=subjectCode?(state.subjects.find(x=>x.code===subjectCode)||subjFallback[subjectCode]||null):null;
}

function routeTitle(){
  const l=labels[page]||labels.home;
  const s=state.subject?.name||subjFallback[subjectCode]?.name;
  return `${l[0]}${s?' · '+s:''} | AI-CLO OLYMPIC`;
}

function clearDataCache(code=''){
  if(!code){state.cache.trees.clear();state.cache.lessons.clear();return}
  state.cache.trees.delete(code);state.cache.lessons.delete(code);
}

function typeset(node){
  if(window.MathJax?.typesetPromise)return MathJax.typesetPromise([node]).catch(console.warn);
  return Promise.resolve();
}
