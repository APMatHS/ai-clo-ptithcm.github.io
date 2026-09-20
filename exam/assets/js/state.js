const initial={staff:null,profile:null,route:'home',routeParams:{},selectedExam:null,selectedSession:null,studentSession:null};
const state={...initial};
const listeners=new Set();

export function getState(){return state;}
export function setState(patch){Object.assign(state,patch);listeners.forEach(fn=>fn(state));}
export function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export function resetStaffState(){setState({staff:null,profile:null,selectedExam:null,selectedSession:null});}
export function saveUiState(key,value){try{sessionStorage.setItem(`exam-ui:${key}`,JSON.stringify(value));}catch{}}
export function loadUiState(key,fallback=null){try{const raw=sessionStorage.getItem(`exam-ui:${key}`);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
