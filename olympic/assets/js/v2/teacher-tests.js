// AI-CLO OLYMPIC — teacher test management
'use strict';

function richMiniToolbar(id){
  return `<div class="oly-editor-toolbar" id="${id}"><button type="button" data-format="bold"><b>B</b></button><button type="button" data-format="italic"><i>I</i></button><button type="button" data-format="underline"><u>U</u></button><button type="button" data-action="text-color">Màu chữ</button><button type="button" data-action="font-size">Cỡ chữ</button><button type="button" data-snippet="$$\n\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}\n$$">Ma trận</button><button type="button" data-env="example">Ví dụ</button><button type="button" data-env="note">Chú ý</button><button type="button" data-action="image">🖼 Ảnh</button><button type="button" data-action="external-link">↗ Liên kết</button></div>`;
}

function wireMiniToolbar(toolbar,ta,subject,onChange){
  if(!toolbar||!ta)return;
  toolbar.onclick=e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.action==='external-link')return externalLinkDialog(ta);
    if(b.dataset.action==='image')return imageUploadDialog(ta,subject);
    if(b.dataset.action==='text-color')return textColorDialog(ta);
    if(b.dataset.action==='font-size')return fontSizeDialog(ta);
    if(b.dataset.format==='bold')wrapSelection(ta,'**','**','văn bản đậm');
    else if(b.dataset.format==='italic')wrapSelection(ta,'*','*','văn bản nghiêng');
    else if(b.dataset.format==='underline')wrapSelection(ta,'[u]','[/u]','văn bản gạch chân');
    else if(b.dataset.env)insertAtCursor(ta,`\\begin{${b.dataset.env}}\nNội dung ${b.dataset.env}.\n\\end{${b.dataset.env}}`);
    else if(b.dataset.snippet)insertAtCursor(ta,b.dataset.snippet);
    onChange?.();
  };
}

async function renderTeacherTests(c){
  if(!state.user){c.innerHTML=authGate();return wireGate()}
  if(!staff()){c.innerHTML='<div class="oly-panel oly-empty"><b>Không có quyền truy cập.</b></div>';return}
  const qs=new URLSearchParams(location.search),requested=qs.get('subject')||preferredTeacherSubjectCode(),edit=qs.get('edit'),view=qs.get('view'),topicFilter=qs.get('topic')||'';
  const {sel,code,subject:s}=await resolveTeacherSubject(requested);
  if(!s){c.innerHTML='<div class="oly-panel oly-empty"><b>Chưa được phân quyền môn Olympic.</b></div>';return}
  if(edit==='new'||edit)return renderTeacherTestEditor(c,s,code,edit==='new'?null:edit);
  if(view)return renderTeacherTestView(c,s,code,view);

  const tree=await loadTree(code,{force:true});
  const [tr,ir]=await Promise.all([
    db.from('olympic_tests').select('id,title,description,test_type,status,is_visible,topic_id,lesson_id,updated_at,lesson:olympic_lessons(title)').eq('subject_id',s.id).order('updated_at',{ascending:false}),
    db.from('olympic_test_items').select('test_id').eq('subject_id',s.id)
  ]);
  if(tr.error)throw tr.error;if(ir.error)throw ir.error;
  let tests=tr.data||[];
  if(topicFilter)tests=tests.filter(x=>x.topic_id===topicFilter);
  const itemCount=new Map();for(const x of ir.data||[])itemCount.set(x.test_id,(itemCount.get(x.test_id)||0)+1);
  const topicById=new Map(tree.topics.map(x=>[x.id,x])),sectionById=new Map(tree.sections.map(x=>[x.id,x])),currentTopic=topicById.get(topicFilter);
  const tab=qs.get('tab')||'all';
  c.innerHTML=`<div class="oly-toolbar"><div class="grow">${sel.html}</div>${currentTopic?`<span class="oly-badge required">Mục · ${esc(currentTopic.title)}</span><a class="oly-btn small" href="${teacherUrl('tests',code)}">Bỏ lọc</a>`:''}<a class="oly-btn" href="${teacherUrl('problems',code)}">Ngân hàng câu →</a><a class="oly-btn primary" href="?subject=${encodeURIComponent(code)}&edit=new">+ Tạo đề</a></div><div class="oly-grid" style="margin-bottom:16px"><div class="oly-card"><div class="math-icon green">π</div><h3>${tests.length}</h3><p>Tổng số đề đang hiển thị.</p></div><div class="oly-card"><div class="math-icon">✓</div><h3>${tests.filter(x=>x.status==='published').length}</h3><p>Đã xuất bản.</p></div><div class="oly-card"><div class="math-icon gold">?</div><h3>${tests.reduce((n,x)=>n+(itemCount.get(x.id)||0),0)}</h3><p>Câu có cấu trúc trong các đề.</p></div></div><div class="oly-toolbar"><div class="grow"><input class="oly-input" id="testSearch" placeholder="Tìm đề luyện…"></div><select class="oly-select" id="testTab" style="width:auto"><option value="all">Tất cả</option><option value="lesson">Lộ trình / cuối bài</option><option value="general">Đề tổng hợp</option><option value="draft">Bản nháp</option></select></div><div class="oly-panel oly-table-wrap"><table class="oly-table"><thead><tr><th>Đề luyện</th><th>Nhóm</th><th>Mục</th><th>Loại</th><th>Câu</th><th>Trạng thái</th><th></th></tr></thead><tbody id="teacherTestRows"></tbody></table></div>`;
  $('#teacherSubject').value=code;$('#teacherSubject').onchange=e=>navigateTo(teacherUrl('tests',e.target.value));$('#testTab').value=tab;
  const draw=()=>{const q=normalizeText($('#testSearch').value),f=$('#testTab').value;let list=tests.filter(x=>!q||normalizeText(`${x.title} ${x.description||''} ${x.lesson?.title||''}`).includes(q));if(f==='lesson')list=list.filter(x=>x.test_type==='lesson');if(f==='general')list=list.filter(x=>x.test_type!=='lesson');if(f==='draft')list=list.filter(x=>x.status==='draft');$('#teacherTestRows').innerHTML=list.length?list.map(x=>{const t=topicById.get(x.topic_id),sec=sectionById.get(t?.section_id),n=itemCount.get(x.id)||0;return `<tr><td><b>${esc(x.title)}</b><br><span style="color:#829ab1">${esc(x.description||'')}</span></td><td>${esc(sec?.name||'—')}</td><td>${esc(t?.title||'—')}</td><td><span class="oly-badge ${x.test_type==='lesson'?'required':'recommended'}">${x.test_type==='lesson'?'Lộ trình':'Tổng hợp'}</span></td><td>${n?n+' câu':'TeX cũ'}</td><td><span class="oly-badge ${x.status}">${statusLabel(x.status)}</span>${x.is_visible===false?'<br><span class="oly-badge draft">Đang ẩn</span>':''}</td><td><a class="oly-btn small" href="?subject=${encodeURIComponent(code)}&view=${x.id}">Xem</a></td></tr>`}).join(''):'<tr><td colspan="7"><div class="oly-empty"><b>Không có đề phù hợp.</b></div></td></tr>'};
  draw();$('#testSearch').oninput=draw;$('#testTab').onchange=draw;
}

async function renderTeacherTestView(c,s,code,id){
  const [tr,ir]=await Promise.all([
    db.from('olympic_tests').select('*,topic:olympic_topics(title),lesson:olympic_lessons(title)').eq('id',id).eq('subject_id',s.id).maybeSingle(),
    db.from('olympic_test_items').select('*').eq('test_id',id).eq('subject_id',s.id).order('order_index')
  ]);
  if(tr.error)throw tr.error;if(ir.error)throw ir.error;if(!tr.data){c.innerHTML='<div class="oly-panel oly-empty"><b>Không tìm thấy đề luyện.</b></div>';return}
  const x=tr.data,items=ir.data||[];
  c.innerHTML=`<div class="oly-toolbar"><a class="oly-btn" href="${teacherUrl('tests',code)}">← Danh sách</a><a class="oly-btn" href="${subjectFeatureUrl('tests',code)}?id=${encodeURIComponent(x.id)}">Xem như sinh viên</a><div class="grow"></div><a class="oly-btn primary" href="?subject=${encodeURIComponent(code)}&edit=${x.id}">Sửa đề</a><button class="oly-btn danger" id="deleteTest">Xóa</button></div><article class="oly-panel"><span class="oly-badge ${x.test_type==='lesson'?'required':'recommended'}">${x.test_type==='lesson'?'Lộ trình':'Tổng hợp'}</span><h2 style="font-family:Cambria Math,Georgia,serif;font-size:30px;margin-bottom:6px">${esc(x.title)}</h2><p style="color:#627d98">${esc(x.description||'')}</p><div class="meta">${x.topic?.title?`<span class="oly-badge">${esc(x.topic.title)}</span>`:''}${x.lesson?.title?`<span class="oly-badge">Sau bài: ${esc(x.lesson.title)}</span>`:''}<span class="oly-badge ${x.status}">${statusLabel(x.status)}</span></div>${items.length?`<div style="margin-top:18px;display:grid;gap:14px">${items.map((it,i)=>`<section class="oly-card"><div class="meta"><span class="oly-badge">Câu ${i+1}</span><span class="oly-badge">${problemTypeLabel(it.problem_type)}</span><span class="oly-badge">${Number(it.points||0)} điểm</span><span class="oly-badge ${it.source_type==='bank'?'recommended':'required'}">${it.source_type==='bank'?'Ngân hàng':'Thủ công'}</span></div><div class="oly-preview" style="border:0;padding:8px 0 0;min-height:0">${renderTex(it.content_tex||'')}</div>${it.hint_tex?`<details><summary>Gợi ý</summary><div class="oly-preview" style="border:0;min-height:0">${renderTex(it.hint_tex)}</div></details>`:''}${it.answer_tex?`<details><summary>Đáp án / lời giải</summary><div class="oly-preview" style="border:0;min-height:0">${renderTex(it.answer_tex)}</div></details>`:''}</section>`).join('')}</div>`:`<div class="oly-preview" style="border:0;padding:12px 0 0;min-height:0">${renderTex(x.content_tex||'')}</div>`}</article>`;
  $('#deleteTest').onclick=async()=>{if(!confirm(`Xóa vĩnh viễn đề “${x.title}”?\n\nCác câu cấu trúc trong đề cũng sẽ bị xóa khỏi đề, nhưng câu gốc trong ngân hàng vẫn được giữ.`))return;const r=await db.from('olympic_tests').delete().eq('id',x.id).eq('subject_id',s.id);if(r.error)return fail(r.error);toast('Đã xóa đề');navigateTo(teacherUrl('tests',code),{force:true})};
}

async function renderTeacherTestEditor(c,s,code,id){
  const tree=await loadTree(code,{force:true});
  let test=null,items=[];
  if(id){const [tr,ir]=await Promise.all([db.from('olympic_tests').select('*').eq('id',id).eq('subject_id',s.id).maybeSingle(),db.from('olympic_test_items').select('*').eq('test_id',id).eq('subject_id',s.id).order('order_index')]);if(tr.error)throw tr.error;if(ir.error)throw ir.error;test=tr.data;items=ir.data||[];if(!test){c.innerHTML='<div class="oly-panel oly-empty"><b>Không tìm thấy đề luyện.</b></div>';return}}
  const topicOptions=tree.sections.map(sec=>`<optgroup label="${esc(sec.name)}">${tree.topics.filter(t=>t.section_id===sec.id).map(t=>`<option value="${t.id}" ${test?.topic_id===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</optgroup>`).join('');
  const lessons=await db.from('olympic_lessons').select('id,title,topic_id').eq('subject_id',s.id).order('order_index');if(lessons.error)throw lessons.error;
  c.innerHTML=`<div class="oly-toolbar"><a class="oly-btn" href="${teacherUrl('tests',code)}">← Danh sách</a>${test?`<a class="oly-btn" href="?subject=${encodeURIComponent(code)}&view=${test.id}">Xem</a>`:''}<div class="grow"></div><button class="oly-btn primary" id="saveTest">Lưu đề</button></div><div class="oly-panel"><div class="oly-form-grid"><label class="oly-field wide"><span>Tên đề</span><input class="oly-input" id="testTitle" value="${esc(test?.title||'')}"></label><label class="oly-field wide"><span>Mô tả</span><input class="oly-input" id="testDescription" value="${esc(test?.description||'')}"></label><label class="oly-field"><span>Loại đề</span><select class="oly-select" id="testType"><option value="general" ${test?.test_type!=='lesson'?'selected':''}>Đề tổng hợp</option><option value="lesson" ${test?.test_type==='lesson'?'selected':''}>Đề cuối bài / lộ trình</option></select></label><label class="oly-field"><span>Mục nội dung</span><select class="oly-select" id="testTopic"><option value="">Không gắn mục</option>${topicOptions}</select></label><label class="oly-field"><span>Bài học liên kết</span><select class="oly-select" id="testLesson"><option value="">Không gắn bài học</option>${(lessons.data||[]).map(l=>`<option value="${l.id}" data-topic="${l.topic_id||''}" ${test?.lesson_id===l.id?'selected':''}>${esc(l.title)}</option>`).join('')}</select></label><label class="oly-field"><span>Trạng thái</span><select class="oly-select" id="testStatus"><option value="draft" ${!test||test.status==='draft'?'selected':''}>Nháp</option><option value="published" ${test?.status==='published'?'selected':''}>Xuất bản</option><option value="archived" ${test?.status==='archived'?'selected':''}>Lưu trữ</option></select></label></div><div class="oly-section-head"><div><h3>Nội dung đề</h3><p>Tạo câu thủ công, lấy câu từ Ngân hàng bài toán, hoặc trộn cả hai. Các đề TeX cũ vẫn được giữ để tương thích.</p></div><div><button class="oly-btn" id="addManualItem">+ Câu thủ công</button> <button class="oly-btn primary" id="pickBankItem">+ Từ ngân hàng</button></div></div><div id="testItems"></div><details style="margin-top:14px" ${!items.length&&test?.content_tex?'open':''}><summary>Nội dung TeX cũ / ghi chú chung</summary><div style="margin-top:10px">${richMiniToolbar('legacyTestToolbar')}<textarea class="oly-textarea" id="legacyTestTex">${esc(test?.content_tex||'')}</textarea><div class="oly-preview" id="legacyTestPreview" style="margin-top:10px"></div></div></details></div>`;
  let work=items.map(x=>({...x,problem_type:x.problem_type||'essay'}));
  const legacy=$('#legacyTestTex'),legacyPreview=$('#legacyTestPreview');
  const drawLegacy=()=>{legacyPreview.innerHTML=renderTex(legacy.value);typeset(legacyPreview)};drawLegacy();legacy.oninput=()=>{state.dirty=true;drawLegacy()};wireMiniToolbar($('#legacyTestToolbar'),legacy,s,()=>{state.dirty=true;drawLegacy()});
  const drawItems=()=>{
    $('#testItems').innerHTML=work.length?work.map((it,i)=>`<section class="oly-card" data-item-index="${i}" style="margin-bottom:12px"><div class="oly-toolbar" style="margin-bottom:10px"><b>Câu ${i+1}</b><span class="oly-badge ${it.source_type==='bank'?'recommended':'required'}">${it.source_type==='bank'?'Ngân hàng':'Thủ công'}</span><select class="oly-select" data-item-type style="width:auto"><option value="essay" ${it.problem_type==='essay'?'selected':''}>Tự luận</option><option value="short" ${it.problem_type==='short'?'selected':''}>Điền đáp số</option><option value="mcq" ${it.problem_type==='mcq'?'selected':''}>Trắc nghiệm</option></select><label style="display:flex;align-items:center;gap:6px">Điểm <input class="oly-input" data-item-points style="width:88px" type="number" min="0" step="0.25" value="${Number(it.points??1)}"></label><div class="grow"></div><button class="oly-btn small" data-item-up ${i===0?'disabled':''}>↑</button><button class="oly-btn small" data-item-down ${i===work.length-1?'disabled':''}>↓</button><button class="oly-btn small danger" data-item-remove>Xóa</button></div>${richMiniToolbar(`itemToolbar-${i}`)}<textarea class="oly-textarea" data-item-content>${esc(it.content_tex||'')}</textarea><details style="margin-top:8px"><summary>Gợi ý & đáp án</summary><label class="oly-field" style="margin-top:8px"><span>Gợi ý</span><textarea class="oly-textarea" data-item-hint style="min-height:90px">${esc(it.hint_tex||'')}</textarea></label><label class="oly-field"><span>Đáp án / lời giải</span><textarea class="oly-textarea" data-item-answer style="min-height:120px">${esc(it.answer_tex||'')}</textarea></label></details></section>`).join(''):'<div class="oly-empty"><b>Chưa có câu cấu trúc.</b><span>Thêm câu thủ công hoặc chọn từ ngân hàng. Đề cũ vẫn có thể dùng nội dung TeX bên dưới.</span></div>';
    $$('[data-item-index]',$('#testItems')).forEach(card=>{
      const i=Number(card.dataset.itemIndex),it=work[i],content=$('[data-item-content]',card),hint=$('[data-item-hint]',card),answer=$('[data-item-answer]',card),points=$('[data-item-points]',card),type=$('[data-item-type]',card);
      const mark=()=>{it.content_tex=content.value;it.hint_tex=hint.value;it.answer_tex=answer.value;it.points=Number(points.value||0);it.problem_type=type.value;state.dirty=true};
      wireMiniToolbar($(`#itemToolbar-${i}`,card),content,s,mark);[content,hint,answer,points,type].forEach(el=>el.oninput=mark);
      $('[data-item-remove]',card).onclick=()=>{work.splice(i,1);state.dirty=true;drawItems()};
      $('[data-item-up]',card).onclick=()=>{[work[i-1],work[i]]=[work[i],work[i-1]];state.dirty=true;drawItems()};
      $('[data-item-down]',card).onclick=()=>{[work[i+1],work[i]]=[work[i],work[i+1]];state.dirty=true;drawItems()};
    });
  };
  drawItems();
  $('#addManualItem').onclick=()=>{work.push({source_type:'manual',problem_id:null,problem_type:'essay',content_tex:'',hint_tex:'',answer_tex:'',points:1});state.dirty=true;drawItems()};
  $('#pickBankItem').onclick=()=>openProblemPicker(s,tree,chosen=>{for(const p of chosen)work.push({source_type:'bank',problem_id:p.id,problem_type:p.problem_type||'essay',content_tex:p.content_tex||'',hint_tex:p.hint_tex||'',answer_tex:p.answer_tex||'',points:Number(p.default_points||1)});state.dirty=true;drawItems()});
  $('#testLesson').onchange=e=>{const opt=e.target.selectedOptions[0];if(opt?.dataset.topic)$('#testTopic').value=opt.dataset.topic;state.dirty=true};
  ['testTitle','testDescription','testType','testTopic','testStatus'].forEach(x=>$('#'+x).oninput=()=>{state.dirty=true});
  $('#saveTest').onclick=async()=>{
    const title=$('#testTitle').value.trim();if(!title)return toast('Nhập tên đề',true);
    const status=$('#testStatus').value,v={subject_id:s.id,topic_id:$('#testTopic').value||null,lesson_id:$('#testLesson').value||null,title,description:$('#testDescription').value.trim(),content_tex:legacy.value,test_type:$('#testType').value,status,is_visible:true,updated_by:state.user.id,published_at:status==='published'?(test?.published_at||new Date().toISOString()):test?.published_at||null};if(!test)v.created_by=state.user.id;
    const rr=test?await db.from('olympic_tests').update(v).eq('id',test.id).select('id').single():await db.from('olympic_tests').insert(v).select('id').single();if(rr.error)return fail(rr.error);const testId=rr.data.id;
    const del=await db.from('olympic_test_items').delete().eq('test_id',testId);if(del.error)return fail(del.error);
    if(work.length){const rows=work.map((it,i)=>({test_id:testId,subject_id:s.id,problem_id:it.problem_id||null,source_type:it.source_type||'manual',problem_type:it.problem_type||'essay',content_tex:it.content_tex||'',hint_tex:it.hint_tex||'',answer_tex:it.answer_tex||'',points:Number(it.points||0),order_index:(i+1)*10,created_by:state.user.id,updated_by:state.user.id}));const ins=await db.from('olympic_test_items').insert(rows);if(ins.error)return fail(ins.error)}
    state.dirty=false;toast('Đã lưu đề luyện');navigateTo(`?subject=${encodeURIComponent(code)}&view=${testId}`,{force:true});
  };
}

async function openProblemPicker(subject,tree,onPick){
  const r=await db.from('olympic_problems').select('*').eq('subject_id',subject.id).eq('is_visible',true).order('updated_at',{ascending:false});if(r.error)return fail(r.error);const all=r.data||[];
  dialog('Chọn câu từ ngân hàng',`<div class="oly-toolbar"><div class="grow"><input class="oly-input" id="bankPickSearch" placeholder="Tìm câu trong ngân hàng…"></div><select class="oly-select" id="bankPickTopic" style="width:auto"><option value="all">Tất cả mục</option>${tree.sections.map(sec=>`<optgroup label="${esc(sec.name)}">${tree.topics.filter(t=>t.section_id===sec.id).map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}</optgroup>`).join('')}</select></div><div id="bankPickRows" style="max-height:52vh;overflow:auto"></div><div class="oly-form-actions"><button class="oly-btn" id="cancelBankPick">Hủy</button><button class="oly-btn primary" id="confirmBankPick">Thêm câu đã chọn</button></div>`);
  const selected=new Set(),draw=()=>{const q=normalizeText($('#bankPickSearch').value),topic=$('#bankPickTopic').value,list=all.filter(x=>(topic==='all'||x.topic_id===topic)&&(!q||normalizeText(`${x.title||''} ${x.content_tex||''}`).includes(q)));$('#bankPickRows').innerHTML=list.length?list.map(x=>`<label class="oly-card" style="display:block;margin-bottom:8px;cursor:pointer"><div style="display:flex;gap:10px;align-items:flex-start"><input type="checkbox" data-pick-problem="${x.id}" ${selected.has(x.id)?'checked':''}><div><b>${esc(x.title||'Câu hỏi')}</b><div class="oly-preview" style="border:0;padding:5px 0 0;min-height:0">${renderTex(x.content_tex||'')}</div><div class="meta"><span class="oly-badge">${problemTypeLabel(x.problem_type)}</span><span class="oly-badge">${problemDifficultyLabel(x.difficulty)}</span><span class="oly-badge">${Number(x.default_points||1)} điểm</span></div></div></div></label>`).join(''):'<div class="oly-empty"><b>Chưa có câu phù hợp.</b><span>Hãy tạo câu trong Ngân hàng bài toán trước.</span></div>';$$('[data-pick-problem]',$('#bankPickRows')).forEach(ch=>ch.onchange=()=>ch.checked?selected.add(ch.dataset.pickProblem):selected.delete(ch.dataset.pickProblem));typeset($('#bankPickRows'))};
  draw();$('#bankPickSearch').oninput=draw;$('#bankPickTopic').onchange=draw;$('#cancelBankPick').onclick=()=>$('#olyDialog').close();$('#confirmBankPick').onclick=()=>{const chosen=all.filter(x=>selected.has(x.id));if(!chosen.length)return toast('Chọn ít nhất một câu',true);$('#olyDialog').close();onPick(chosen)};
}

function problemDifficultyLabel(v){return ({basic:'Cơ bản',medium:'Trung bình',advanced:'Nâng cao'})[v]||'Trung bình'}
