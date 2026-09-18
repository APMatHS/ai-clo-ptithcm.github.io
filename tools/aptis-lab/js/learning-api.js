(() => {
  'use strict';

  const API = window.AptisAPI;
  if (!API?.client) return;

  const client = API.client;
  const rpc = async (name, args = {}) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  };

  const currentUserId = async () => {
    const session = await API.getSession();
    return session?.user?.id || null;
  };

  const compact = (obj) => Object.fromEntries(
    Object.entries(obj || {}).filter(([, value]) => value !== undefined)
  );

  Object.assign(API, {
    getLearningPath: () => rpc('aptis_get_learning_path'),

    resumeAttempt: (attemptId) =>
      rpc('aptis_get_attempt_resume', { p_attempt_id: attemptId }),

    startLesson: (lessonId, limit = null) =>
      rpc('aptis_start_lesson', {
        p_lesson_id: lessonId,
        p_limit: limit == null ? null : Number(limit)
      }),

    drawSmartReview: (limit = 15) =>
      rpc('aptis_draw_review', { p_limit: Number(limit) }),

    markLessonComplete: (lessonId, attemptId) =>
      rpc('aptis_mark_lesson_complete', {
        p_lesson_id: lessonId,
        p_attempt_id: attemptId
      }),

    async getLearningState() {
      const userId = await currentUserId();
      if (!userId) return null;
      const { data, error } = await client
        .from('aptis_learning_state')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async saveLearningState(patch = {}) {
      const userId = await currentUserId();
      if (!userId) throw new Error('AUTH_REQUIRED');
      const payload = compact({
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString()
      });
      const { data, error } = await client
        .from('aptis_learning_state')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },

    async clearLearningState({ keepTab = true } = {}) {
      const state = await this.getLearningState();
      if (!state) return null;
      return this.saveLearningState({
        active_attempt_id: null,
        active_lesson_id: null,
        question_index: 0,
        draft_response: {},
        ui_state: {},
        scroll_position: 0,
        ...(keepTab ? { practice_tab: state.practice_tab || 'route' } : {})
      });
    }
  });
})();
