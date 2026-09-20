import { CONFIG } from '../config.js';
import { supabase } from '../core/supabase.js';

function safeName(name='file'){
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(-120)||'file';
}

class StorageAdapter{
  async upload({examId,file,kind='other'}){
    if(!examId||!file) throw new Error('Thiếu examId hoặc file.');
    const objectPath=`exams/${examId}/${kind}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const {error:uploadError}=await supabase.storage.from(CONFIG.storageBucket).upload(objectPath,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
    if(uploadError) throw uploadError;
    const {data,error}=await supabase.from('exam_assets').insert({exam_id:examId,provider:'supabase',bucket:CONFIG.storageBucket,object_path:objectPath,kind,mime_type:file.type||null,size_bytes:file.size,created_by:(await supabase.auth.getUser()).data.user?.id}).select().single();
    if(error){await supabase.storage.from(CONFIG.storageBucket).remove([objectPath]);throw error;}
    return data;
  }
  async signedUrl(asset,expiresIn=300){
    const row=typeof asset==='string'?(await supabase.from('exam_assets').select('*').eq('id',asset).single()).data:asset;
    if(!row) throw new Error('Không tìm thấy tài nguyên.');
    if(row.provider!=='supabase') throw new Error(`Storage provider ${row.provider} chưa được cấu hình.`);
    const {data,error}=await supabase.storage.from(row.bucket).createSignedUrl(row.object_path,Math.max(30,Math.min(3600,expiresIn)));
    if(error) throw error;return data.signedUrl;
  }
  async remove(assetId){
    const {data:row,error}=await supabase.from('exam_assets').select('*').eq('id',assetId).single();
    if(error) throw error;
    if(row.provider==='supabase'){
      const {error:storageError}=await supabase.storage.from(row.bucket).remove([row.object_path]);
      if(storageError) throw storageError;
    }
    const {error:dbError}=await supabase.from('exam_assets').update({deleted_at:new Date().toISOString()}).eq('id',assetId);
    if(dbError) throw dbError;
  }
}

export const storageService=new StorageAdapter();
