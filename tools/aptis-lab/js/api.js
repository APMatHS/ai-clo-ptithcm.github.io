(() => {
  const cfg = window.APTIS_LAB_CONFIG;
  if (!cfg || !window.supabase?.createClient) throw new Error('Không thể khởi tạo Supabase cho Aptis Lab.');

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const rpc = async (name, args = {}) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  };

  const one = async (query) => {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  const sanitizeFileName = (name = 'file') => name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'file';

  const mediaKind = (file) => file?.type?.startsWith('audio/') ? 'audio' : file?.type?.startsWith('image/') ? 'image' : 'file';

  window.AptisAPI = {
    client,
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data.session;
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    initializeMe: () => rpc('aptis_initialize_me'),
    setTargetLevel: (level) => rpc('aptis_set_target_level', { p_level: level }),
    drawPractice: (skill, level, limit) => rpc('aptis_draw_practice', { p_skill: skill || null, p_level: level || null, p_limit: limit }),
    submitAnswer: (attemptId, questionId, response, elapsedMs = null) => rpc('aptis_submit_answer', {
      p_attempt_id: attemptId,
      p_question_id: questionId,
      p_response: response,
      p_response_time_ms: elapsedMs
    }),
    takeAiCredit: (feature) => rpc('aptis_take_ai_credit', { p_feature: feature }),
    adminListMembers: () => rpc('aptis_admin_list_members'),
    adminSetMember: (email, enabled, contentRole, overrideLimit) => rpc('aptis_admin_set_member_by_email', {
      p_email: email,
      p_enabled: enabled,
      p_content_role: contentRole,
      p_ai_daily_limit_override: overrideLimit === '' || overrideLimit == null ? null : Number(overrideLimit)
    }),
    adminUpdateSettings: (limit, allowAdvanced, retentionDays) => rpc('aptis_admin_update_settings', {
      p_ai_daily_limit: Number(limit),
      p_allow_advanced: !!allowAdvanced,
      p_retention_days: Number(retentionDays)
    }),
    getSettings: () => one(client.from('aptis_settings').select('*').eq('id', 1).single()),
    getAttempts: (days = 90) => {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      return one(client.from('aptis_attempts').select('*').gte('started_at', since).order('started_at', { ascending: false }).limit(500));
    },
    getActivity: (days = 120) => {
      const d = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      return one(client.from('aptis_activity_days').select('*').gte('activity_date', d).order('activity_date'));
    },
    getAiUsageToday: () => one(client.from('aptis_ai_usage').select('feature,calls,usage_date').eq('usage_date', new Date().toISOString().slice(0, 10))),
    getVocabulary: () => one(client.from('aptis_vocabulary').select('*').order('created_at', { ascending: false }).limit(500)),
    addVocabulary: (row) => one(client.from('aptis_vocabulary').upsert(row, { onConflict: 'user_id,term' }).select().single()),
    updateVocabulary: (id, patch) => one(client.from('aptis_vocabulary').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single()),
    deleteVocabulary: (id) => one(client.from('aptis_vocabulary').delete().eq('id', id)),
    getQuestions: (filters = {}) => {
      let q = client.from('aptis_questions').select('*').order('updated_at', { ascending: false }).limit(1000);
      if (filters.skill) q = q.eq('skill', filters.skill);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.level) q = q.eq('level', filters.level);
      return one(q);
    },
    saveQuestion: (question) => {
      if (!question.id) return one(client.from('aptis_questions').insert(question).select().single());
      const { id, ...patch } = question;
      return one(client.from('aptis_questions').update(patch).eq('id', id).select().single());
    },
    deleteQuestion: (id) => one(client.from('aptis_questions').delete().eq('id', id)),
    async uploadContent(file, skill = 'misc') {
      const ext = (sanitizeFileName(file.name).split('.').pop() || '').toLowerCase();
      const base = sanitizeFileName(file.name.replace(/\.[^.]+$/, ''));
      const path = `${skill}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${base}${ext ? '.' + ext : ''}`;
      const { error } = await client.storage.from(cfg.CONTENT_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      return { bucket: cfg.CONTENT_BUCKET, path, mime: file.type || '', kind: mediaKind(file), name: file.name, size: file.size };
    },
    async uploadRecording(file, userId) {
      const ext = file.type.includes('mp4') ? 'm4a' : file.type.includes('mpeg') ? 'mp3' : file.type.includes('wav') ? 'wav' : 'webm';
      const path = `${userId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const { error } = await client.storage.from(cfg.RECORDINGS_BUCKET).upload(path, file, { cacheControl: '0', upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      return { bucket: cfg.RECORDINGS_BUCKET, path, mime: file.type || '', kind: 'audio', size: file.size };
    },
    async signedUrl(media, expiresIn = 3600) {
      if (!media?.path) return null;
      const bucket = media.bucket || cfg.CONTENT_BUCKET;
      const { data, error } = await client.storage.from(bucket).createSignedUrl(media.path, expiresIn);
      if (error) throw error;
      return data?.signedUrl || null;
    },
    getSuggestions: () => one(client.from('aptis_suggestions').select('*').order('created_at', { ascending: false }).limit(300)),
    addSuggestion: (row) => one(client.from('aptis_suggestions').insert(row).select().single()),
    updateSuggestion: (id, patch) => one(client.from('aptis_suggestions').update(patch).eq('id', id).select().single())
  };
})();
