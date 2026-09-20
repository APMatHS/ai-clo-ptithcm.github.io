import { escapeHtml } from '../core/ui.js';

export function mountRichEditor(host,{value='',placeholder='Nhập nội dung…',onChange}={}){
  host.classList.add('rich-editor');
  host.innerHTML=`<div class="rich-editor-toolbar" role="toolbar"><button type="button" data-cmd="bold" title="Đậm"><b>B</b></button><button type="button" data-cmd="italic" title="Nghiêng"><i>I</i></button><button type="button" data-cmd="underline" title="Gạch chân"><u>U</u></button><button type="button" data-cmd="subscript" title="Chỉ số dưới">x₂</button><button type="button" data-cmd="superscript" title="Chỉ số trên">x²</button><button type="button" data-cmd="insertUnorderedList" title="Danh sách">•≡</button><button type="button" data-latex title="Chèn LaTeX">∑</button><button type="button" data-table title="Chèn bảng">▦</button><button type="button" data-clear title="Xóa định dạng">Tx</button></div><div class="rich-editor-body" contenteditable="true" spellcheck="true" data-editor data-placeholder="${escapeHtml(placeholder)}">${value||''}</div>`;
  const editor=host.querySelector('[data-editor]');
  const emit=()=>onChange?.(editor.innerHTML);
  host.querySelectorAll('[data-cmd]').forEach(b=>b.addEventListener('click',()=>{editor.focus();document.execCommand(b.dataset.cmd,false,null);emit();}));
  host.querySelector('[data-clear]').addEventListener('click',()=>{editor.focus();document.execCommand('removeFormat',false,null);emit();});
  host.querySelector('[data-latex]').addEventListener('click',()=>{const tex=prompt('Nhập công thức LaTeX (không cần dấu $):');if(!tex)return;editor.focus();document.execCommand('insertText',false,`\\(${tex}\\)`);emit();});
  host.querySelector('[data-table]').addEventListener('click',()=>{const rows=Math.max(1,Math.min(10,Number(prompt('Số hàng:',2)||0))),cols=Math.max(1,Math.min(10,Number(prompt('Số cột:',2)||0)));if(!rows||!cols)return;const html=`<table><tbody>${Array.from({length:rows},()=>`<tr>${Array.from({length:cols},()=>'<td>&nbsp;</td>').join('')}</tr>`).join('')}</tbody></table><p><br></p>`;editor.focus();document.execCommand('insertHTML',false,html);emit();});
  editor.addEventListener('input',emit);
  editor.addEventListener('paste',()=>setTimeout(emit,0));
  return {getHTML:()=>editor.innerHTML.trim(),setHTML:html=>{editor.innerHTML=html||'';emit();},focus:()=>editor.focus(),element:editor};
}
