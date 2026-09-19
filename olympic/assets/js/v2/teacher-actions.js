function sectionForm(subject,sec,code){
  dialog(sec?'Sửa nhóm nội dung':'Thêm nhóm nội dung',`<form id="sectionForm" class="oly-form-grid"><label class="oly-field wide"><span>Tên nhóm</span><input class="oly-input" name="name" required value="${esc(sec?.name||'')}"></label><label class="oly-field wide"><span>Mô tả</span><textarea class="oly-textarea" name="description">${esc(sec?.description||'')}</textarea></label><label class="oly-field"><span>Thứ tự</span><input class="oly-input" name="order_index" type="number" value="${sec?.order_index??10}"></label><label class="oly-field"><span>Hiển thị</span><select class="oly-select" name="is_visible"><option value="true" ${sec?.is_visible!==false?'selected':''}>Có</option><option value="false" ${sec?.is_visible===false?'selected':''}>Không</option></select></label><div class="oly-form-actions"><button class="oly-btn primary">Lưu</button></div></form>`);
  $('#sectionForm').onsubmit=async e=>{
    e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));v.subject_id=subject.id;v.order_index=Number(v.order_index)||0;v.is_visible=v.is_visible==='true';
    const r=sec?await db.from('olympic_sections').update(v).eq('id',sec.id):await db.from('olympic_sections').insert(v);
    if(r.error)return fail(r.error);clearDataCache(code);$('#olyDialog').close();toast('Đã lưu nhóm nội dung');refreshRoute({scroll:false});
  };
}

function topicForm(subject,sections,t,code){
  dialog(t?'Sửa mục nội dung':'Thêm mục nội dung',`<form id="topicForm" class="oly-form-grid"><label class="oly-field wide"><span>Tên mục</span><input class="oly-input" name="title" required value="${esc(t?.title||'')}"></label><label class="oly-field"><span>Nhóm</span><select class="oly-select" name="section_id"><option value="">Chưa phân nhóm</option>${sections.map(s=>`<option value="${s.id}" ${t?.section_id===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label class="oly-field"><span>Mức</span><select class="oly-select" name="importance">${['required','recommended','advanced'].map(v=>`<option value="${v}" ${t?.importance===v?'selected':''}>${importanceLabel(v)}</option>`).join('')}</select></label><label class="oly-field"><span>Trạng thái</span><select class="oly-select" name="status">${['draft','editing','approved','teaching'].map(v=>`<option value="${v}" ${t?.status===v?'selected':''}>${statusLabel(v)}</option>`).join('')}</select></label><label class="oly-field"><span>Thứ tự</span><input class="oly-input" name="order_index" type="number" value="${t?.order_index??10}"></label><label class="oly-field wide"><span>Mô tả</span><textarea class="oly-textarea" name="description">${esc(t?.description||'')}</textarea></label><label class="oly-field"><span>Hiển thị</span><select class="oly-select" name="is_visible"><option value="true" ${t?.is_visible!==false?'selected':''}>Có</option><option value="false" ${t?.is_visible===false?'selected':''}>Không</option></select></label><div class="oly-form-actions"><button class="oly-btn primary">Lưu</button></div></form>`);
  $('#topicForm').onsubmit=async e=>{
    e.preventDefault();const v=Object.fromEntries(new FormData(e.currentTarget));v.subject_id=subject.id;v.section_id=v.section_id||null;v.order_index=Number(v.order_index)||0;v.is_visible=v.is_visible==='true';v.updated_by=state.user.id;if(!t)v.created_by=state.user.id;
    const r=t?await db.from('olympic_topics').update(v).eq('id',t.id):await db.from('olympic_topics').insert(v);
    if(r.error)return fail(r.error);clearDataCache(code);$('#olyDialog').close();toast('Đã lưu mục nội dung');refreshRoute({scroll:false});
  };
}

async function deleteTopic(id,code){
  if(!confirm('Xóa mục nội dung này? Bài học đang liên kết sẽ không bị xóa.'))return;
  const r=await db.from('olympic_topics').delete().eq('id',id);
  if(r.error)return fail(r.error);clearDataCache(code);toast('Đã xóa mục nội dung');refreshRoute({scroll:false});
}
