import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ALLOWED_ORIGINS = new Set([
  "https://ai-clo-ptithcm.github.io",
  "https://apmaths.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://ai-clo-ptithcm.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), "content-type": "application/json", "cache-control": "no-store" },
  });
}

function outputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  if (Array.isArray(data?.outputs)) {
    const text = data.outputs.filter((x: any) => x?.type === "text").map((x: any) => x.text || "").join("");
    if (text) return text;
  }
  if (Array.isArray(data?.steps)) {
    return data.steps.flatMap((s: any) => Array.isArray(s?.content) ? s.content : [])
      .filter((x: any) => x?.type === "text").map((x: any) => x.text || "").join("");
  }
  return "";
}

const responseSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["completed", "insufficient_evidence"] },
    estimated_level: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1"] },
    total_score: { type: "integer", minimum: 0, maximum: 25 },
    scores: {
      type: "object",
      properties: {
        task_fulfilment: { type: "integer", minimum: 0, maximum: 5 },
        grammar: { type: "integer", minimum: 0, maximum: 5 },
        vocabulary: { type: "integer", minimum: 0, maximum: 5 },
        coherence_cohesion: { type: "integer", minimum: 0, maximum: 5 },
        register_accuracy: { type: "integer", minimum: 0, maximum: 5 },
      },
      required: ["task_fulfilment", "grammar", "vocabulary", "coherence_cohesion", "register_accuracy"],
    },
    strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
    improvements: { type: "array", items: { type: "string" }, maxItems: 3 },
    next_attempt_tip: { type: "string" },
  },
  required: ["status", "estimated_level", "total_score", "scores", "strengths", "improvements", "next_attempt_tip"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_LIVE_API_KEY");
    const model = Deno.env.get("APTIS_AI_MODEL") || "gemini-3.6-flash";
    if (!supabaseUrl || !serviceRole || !anonKey || !apiKey) throw new Error("Missing server configuration");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(req, { ok: false, error: "Authentication required" }, 401);

    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
    const userDb = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await db.auth.getUser(token);
    const uid = userData?.user?.id;
    if (userError || !uid) return json(req, { ok: false, error: "Invalid session" }, 401);

    const body = await req.json();
    const attemptId = body?.attempt_id;
    const questionId = body?.question_id;
    if (!attemptId || !questionId) return json(req, { ok: false, error: "Missing attempt_id or question_id" }, 400);

    const { data: cached } = await db.from("aptis_ai_assessments").select("*")
      .eq("user_id", uid).eq("attempt_id", attemptId).eq("question_id", questionId)
      .eq("assessment_type", "writing").maybeSingle();
    if (cached) return json(req, { ok: true, assessment: cached, cached: true });

    const [{ data: attempt }, { data: item }, { data: question }] = await Promise.all([
      db.from("aptis_attempts").select("id,user_id,target_level").eq("id", attemptId).maybeSingle(),
      db.from("aptis_attempt_items").select("response,answered_at").eq("attempt_id", attemptId).eq("question_id", questionId).maybeSingle(),
      db.from("aptis_questions").select("id,skill,part,level,prompt").eq("id", questionId).maybeSingle(),
    ]);

    if (!attempt || attempt.user_id !== uid) return json(req, { ok: false, error: "Attempt not found" }, 404);
    if (!item?.answered_at || !question || question.skill !== "writing") return json(req, { ok: false, error: "Writing response not found" }, 400);

    const text = String(item.response?.text || "").trim();
    if (!text) return json(req, { ok: false, error: "Writing response is empty" }, 400);

    const { error: creditError } = await userDb.rpc("aptis_take_ai_credit", { p_feature: "writing_assessment" });
    if (creditError) return json(req, { ok: false, error: creditError.message || "AI quota exceeded" }, 429);

    const prompt = [
      "You are an English writing practice assessor for Aptis General preparation.",
      "This is formative practice feedback, not an official Aptis score.",
      `Target: ${attempt.target_level || question.level || "B2"}.`,
      `Part: ${question.part || "unknown"}.`,
      `Task: ${question.prompt}`,
      "Assess only the learner text shown below. Do not rewrite the entire answer.",
      "Score each rubric dimension from 0 to 5. total_score must equal the sum of the five dimensions.",
      "Consider task fulfilment, grammar, vocabulary, coherence/cohesion, and register/accuracy appropriate to the task.",
      "If the response is too short to assess, use status=insufficient_evidence and conservative scores.",
      "Keep feedback concise and actionable.",
      "LEARNER RESPONSE:",
      text,
    ].join("\n");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model,
        input: [{ type: "text", text: prompt }],
        response_format: { type: "text", mime_type: "application/json", schema: responseSchema },
      }),
    });

    const raw = await response.text();
    let payload: any = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch {}
    if (!response.ok) throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);

    const resultText = outputText(payload);
    let rubric: any = null;
    try { rubric = JSON.parse(resultText); } catch { throw new Error("Gemini returned invalid assessment JSON"); }

    const total = ["task_fulfilment", "grammar", "vocabulary", "coherence_cohesion", "register_accuracy"]
      .reduce((sum, key) => sum + Number(rubric?.scores?.[key] || 0), 0);
    rubric.total_score = total;

    const row = {
      user_id: uid,
      attempt_id: attemptId,
      question_id: questionId,
      assessment_type: "writing",
      status: rubric.status || "completed",
      estimated_level: rubric.estimated_level || null,
      total_score: total,
      rubric,
      model,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveError } = await db.from("aptis_ai_assessments")
      .upsert(row, { onConflict: "user_id,attempt_id,question_id,assessment_type" }).select().single();
    if (saveError) throw new Error(saveError.message);

    return json(req, { ok: true, assessment: saved, cached: false });
  } catch (error) {
    console.error("aptis-assess-writing", error);
    return json(req, { ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
