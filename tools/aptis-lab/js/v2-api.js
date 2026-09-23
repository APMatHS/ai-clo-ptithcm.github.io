(() => {
  'use strict';

  const API = window.AptisAPI;
  if (!API?.client) return;

  const client = API.client;
  const originalSubmitAnswer = API.submitAnswer.bind(API);

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
    if (data?.ok === false) throw new Error(data.error || `Không gọi được ${name}.`);
    return data;
  }

  async function rpc(name, args = {}) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return data;
  }

  async function currentUserId() {
    const session = await API.getSession();
    return session?.user?.id || null;
  }

  Object.assign(API, {
    // Keep the existing Practice submit flow, but publish an event so V2 can
    // attach Writing feedback without modifying the legacy runner deeply.
    async submitAnswer(attemptId, questionId, response, elapsedMs = null) {
      const result = await originalSubmitAnswer(attemptId, questionId, response, elapsedMs);
      window.dispatchEvent(new CustomEvent('aptis:v2-answer-submitted', {
        detail: { attemptId, questionId, response, result }
      }));
      return result;
    },

    drawMockBlock(skill, level, limit, mockKind, section, mockSessionId) {
      return rpc('aptis_draw_mock_block', {
        p_skill: skill,
        p_level: level,
        p_limit: Number(limit),
        p_mock_kind: mockKind,
        p_section: section || null,
        p_mock_session_id: mockSessionId || null
      });
    },

    resumeMockAttempt(attemptId) {
      return rpc('aptis_get_mock_resume', { p_attempt_id: attemptId });
    },

    submitMockAnswer(attemptId, questionId, response, elapsedMs = null) {
      return rpc('aptis_submit_mock_answer', {
        p_attempt_id: attemptId,
        p_question_id: questionId,
        p_response: response,
        p_response_time_ms: elapsedMs
      });
    },

    finalizeMockAttempt(attemptId) {
      return rpc('aptis_finalize_mock_attempt', { p_attempt_id: attemptId });
    },

    async getAssessment(attemptId, questionId, kind) {
      const userId = await currentUserId();
      if (!userId) return null;
      const { data, error } = await client
        .from('aptis_ai_assessments')
        .select('*')
        .eq('user_id', userId)
        .eq('attempt_id', attemptId)
        .eq('question_id', questionId)
        .eq('feature', kind)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    getSpeakingAssessment(attemptId, questionId) {
      return this.getAssessment(attemptId, questionId, 'speaking');
    },

    getWritingAssessment(attemptId, questionId) {
      return this.getAssessment(attemptId, questionId, 'writing');
    },

    assessSpeaking(attemptId, questionId) {
      return invoke('aptis-speaking-assess', {
        attempt_id: attemptId,
        question_id: questionId
      });
    },

    assessWriting(attemptId, questionId) {
      return invoke('aptis-writing-assess', {
        attempt_id: attemptId,
        question_id: questionId
      });
    },

    getProgressBreakdown(days = 90) {
      return rpc('aptis_progress_breakdown_v2', {
        p_days: Math.max(1, Math.min(365, Number(days || 90)))
      });
    }
  });
})();
