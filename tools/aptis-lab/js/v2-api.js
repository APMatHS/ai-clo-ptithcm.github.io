(() => {
  'use strict';

  const API = window.AptisAPI;
  if (!API?.client) return;

  const client = API.client;

  async function invoke(name, body) {
    const { data, error } = await client.functions.invoke(name, { body });
    if (error) {
      let message = error.message || `Không gọi được ${name}.`;
      try {
        const detail = await error.context?.json?.();
        if (detail?.error) message = detail.error;
        else if (detail?.message) message = detail.message;
      } catch (_) {}
      throw new Error(message);
    }
    return data;
  }

  async function currentUserId() {
    const session = await API.getSession();
    return session?.user?.id || null;
  }

  Object.assign(API, {
    async getAssessment(attemptId, questionId, kind) {
      const userId = await currentUserId();
      if (!userId) return null;
      const { data, error } = await client
        .from('aptis_ai_assessments')
        .select('*')
        .eq('user_id', userId)
        .eq('attempt_id', attemptId)
        .eq('question_id', questionId)
        .eq('assessment_type', kind)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        // Production may not have the V2 table yet. Keep the learner flow usable.
        if (`${error.code || ''}` === '42P01') return null;
        throw error;
      }
      return data;
    },

    getSpeakingAssessment(attemptId, questionId) {
      return this.getAssessment(attemptId, questionId, 'speaking');
    },

    getWritingAssessment(attemptId, questionId) {
      return this.getAssessment(attemptId, questionId, 'writing');
    },

    assessSpeaking(attemptId, questionId) {
      return invoke('aptis-assess-speaking', {
        attempt_id: attemptId,
        question_id: questionId
      });
    },

    assessWriting(attemptId, questionId) {
      return invoke('aptis-assess-writing', {
        attempt_id: attemptId,
        question_id: questionId
      });
    },

    async getAttemptItems(attemptId) {
      const { data, error } = await client
        .from('aptis_attempt_items')
        .select('id,attempt_id,question_id,position,response,is_correct,answered_at,response_time_ms')
        .eq('attempt_id', attemptId)
        .order('position');
      if (error) throw error;
      return data || [];
    },

    async getProgressBreakdown(days = 90) {
      const since = new Date(Date.now() - Math.max(1, Number(days || 90)) * 86400000).toISOString();
      const userId = await currentUserId();
      if (!userId) return [];
      const { data, error } = await client
        .from('aptis_attempt_items')
        .select('is_correct,answered_at,question:aptis_questions(skill,part,topic,level)')
        .not('answered_at', 'is', null)
        .gte('answered_at', since)
        .order('answered_at', { ascending: false })
        .limit(3000);
      if (error) throw error;
      return data || [];
    }
  });
})();
