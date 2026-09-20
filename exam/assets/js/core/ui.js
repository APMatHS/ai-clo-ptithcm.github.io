const toastRoot=()=>document.getElementById('toast-root');
const modalRoot=()=>document.getElementById('modal-root');

export function escapeHtml(value=''){
  return String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
}

export function formatDateTime(value){
  if(!value) return '—';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(d);
}

export function toast(message,type='info',timeout=3200){
  const el=document.createElement('div');
  el.className='toast';
  el.dataset.type=type;
  el.textContent=message;
  toastRoot()?.appendChild(el);
  setTimeout(()=>el.remove(),timeout);
}

export function badge(label,type=''){
  return `<span class="badge ${type?`badge-${type}`:''}">${escapeHtml(label)}</span>`;
}

export function setBusy(button,busy,label='Đang xử lý…'){
  if(!button) return;
  if(busy){button.dataset.label=button.textContent;button.textContent=label;button.disabled=true;}
  else{button.textContent=button.dataset.label||button.textContent;button.disabled=false;}
}

export function closeModal(){ if(modalRoot()) modalRoot().innerHTML=''; }

export function openModal({title,body,footer='',wide=false,onMount}={}){
  const root=modalRoot();
  if(!root) return;
  root.innerHTML=`<div class="modal-backdrop" data-modal-close><section class="modal ${wide?'modal-wide':''}" role="dialog" aria-modal="true"><header class="modal-head"><strong>${escapeHtml(title||'')}</strong><button class="btn btn-ghost" type="button" data-close aria-label="Đóng">✕</button></header><div class="modal-body">${body||''}</div>${footer?`<footer class="modal-foot">${footer}</footer>`:''}</section></div>`;
  root.querySelector('[data-close]')?.addEventListener('click',closeModal);
  root.querySelector('[data-modal-close]')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
  onMount?.(root.querySelector('.modal'));
}

export function confirmDialog({title='Xác nhận',message,confirmText='Xác nhận',danger=false}={}){
  return new Promise(resolve=>{
    openModal({title,body:`<p>${escapeHtml(message||'')}</p>`,footer:`<button class="btn btn-secondary" data-cancel>Hủy</button><button class="btn ${danger?'btn-danger':'btn-primary'}" data-confirm>${escapeHtml(confirmText)}</button>`,onMount:modal=>{
      modal.querySelector('[data-cancel]').onclick=()=>{closeModal();resolve(false)};
      modal.querySelector('[data-confirm]').onclick=()=>{closeModal();resolve(true)};
    }});
  });
}

export function errorMessage(error,fallback='Có lỗi xảy ra.'){
  console.error(error);
  return error?.message||fallback;
}
