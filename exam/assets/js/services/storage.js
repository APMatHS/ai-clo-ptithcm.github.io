import { CONFIG } from '../config.js';
import { invokeFunction } from '../core/supabase.js';

class StorageAdapter{
  async upload({examId,file,kind='other',pathHint=''}){
    const ticket=await invokeFunction(CONFIG.assetFunction,{action:'create-upload',examId,kind,fileName:file.name,mimeType:file.type||'application/octet-stream',size:file.size,pathHint});
    const response=await fetch(ticket.uploadUrl,{method:'PUT',headers:ticket.headers||{'Content-Type':file.type||'application/octet-stream'},body:file});
    if(!response.ok) throw new Error(`Tải file thất bại (${response.status}).`);
    return invokeFunction(CONFIG.assetFunction,{action:'complete-upload',examId,kind,objectPath:ticket.objectPath,mimeType:file.type||null,size:file.size});
  }
  async signedUrl(assetId,expiresIn=300){
    const data=await invokeFunction(CONFIG.assetFunction,{action:'signed-url',assetId,expiresIn});
    return data.url;
  }
  async remove(assetId){return invokeFunction(CONFIG.assetFunction,{action:'remove',assetId});}
}

export const storageService=new StorageAdapter();
