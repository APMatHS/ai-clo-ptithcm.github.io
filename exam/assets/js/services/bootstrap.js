import { invokeFunction } from '../core/supabase.js';

export const bootstrapService={
  async status(){return invokeFunction('bootstrap-admin',{action:'status'});},
  async createFirstAdmin({email,fullName,password,bootstrapCode}){
    return invokeFunction('bootstrap-admin',{action:'create',email,fullName,password,bootstrapCode});
  }
};
