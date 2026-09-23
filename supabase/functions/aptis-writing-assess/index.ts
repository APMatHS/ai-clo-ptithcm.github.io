import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const MODEL = "gemini-2.5-flash";
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
    headers: {
      ...cors(req),
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function parseJsonText(text: string) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(cleaned);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_LIVE_API_KEY");
    if (!url || !serviceRole || !apiKey) throw new Error("Missing server configuration");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(req, { ok: false, error: "Authentication required" }, 401);

    const db = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await db.auth.getUser(token);
    const uid = userData?.user?.id;
    if (userError || !uid) return json(req, { ok: false, error: "Invalid session" }, 401);

    const { attempt_id, question_id } = await req.json();
    if (!attempt_id || !question_id) {
      return json(req, { ok: false, error: "Missing attempt_id or question_id" }, 400);
    }

    const { data: item, error: itemError } = await db
      .from("aptis_attempt_items")
      .select("id,response,answered_at,attempt_id,question_id,aptis_attempts!inner(user_id,target_level),aptis_questions!inner(skill,part,prompt,question_type,level)")
      .eq("attempt_id", attempt_id)
      .eq("question_id", question_id)
      .eq("aptis_attempts.user_id", uid)
      .single();

    if (itemError || !item) return json(req, { ok: false, error: "Writing response not found" }, 404);

    const question: any = (item as any).aptis_questions;
    const attempt: any = (item as any).aptis_attempts;
    if (question?.skill !== "writing" || question?.question_type !== "writing_prompt") {
      return json(req, { ok: false, error: "Not a writing prompt" }, 400);
    }

    const { data: cached } = await db
      .from("aptis_ai_assessments")
      .select("*")
      .eq("attempt_item_id", (item as any).id)
      .eq("feature", "writing")
      .maybeSingle();
    if (cached) return json(req, { ok: true, cached: true, assessment: cached });

    const text = String((item as any).response?.text || "").trim();
    if (!text || text.split(/\s+/).length < 3) {
      return json(req, { ok: false, error: "Writing response is too short to assess" }, 422);
    }

    const today = new Date().toISOString().slice(0, 10);
    const [{ data: membership }, { data: settings }, { data: usage }] = await Promise.all([
      db.from("aptis_memberships")
        .select("enabled,ai_daily_limit_override")
        .eq("user_id", uid)
        .maybeSingle(),
      db.from("aptis_settings")
        .select("default_ai_daily_limit")
        .eq("id", 1)
        .single(),
      db.from("aptis_ai_usage")
        .select("calls")
        .eq("user_id", uid)
        .eq("usage_date", today),
    ]);

    if (membership?.enabled !== true) {
      return json(req, { ok: false, error: "APTIS_ACCESS_REQUIRED" }, 403);
    }

    const limit = membership.ai_daily_limit_override ?? settings?.default_ai_daily_limit ?? 10;
    const used = (usage || []).reduce((sum: number, row: any) => sum + Number(row.calls || 0), 0);
    if (used >= limit) {
      return json(req, {
        ok: false,
        error: "AI_DAILY_LIMIT_REACHED",
        quota: { limit, used, remaining: 0 },
      }, 429);
    }

    const instruction = `You are an English writing practice assessor for a learner preparing for Aptis General around B1-B2. This is formative practice, not an official Aptis score.\n\nTarget: ${attempt?.target_level || question?.level || "B2"}.\nPart: ${question?.part || "unknown"}.\nTask: ${question?.prompt || ""}\n\nLearner response:\n${text}\n\nReturn ONLY valid JSON with this exact shape:\n{"status":"completed|insufficient_evidence","estimated_level":"B1|B1+|B2|B2+|null","scores":{"task_fulfilment":0,"grammar":0,"vocabulary":0,"coherence_cohesion":0,"register_accuracy":0},"strengths":[""],"improvements":[""],"notable_errors":[{"excerpt":"","suggestion":""}],"next_attempt_tip":""}\n\nEach score is an integer 0-5. Judge only the submitted text. Use insufficient_evidence if the response is too short or irrelevant to assess reliably. Do not rewrite the full answer. Keep feedback concise, supportive, and specific.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.15,
          },
        }),
      },
    );

    const raw = await geminiResponse.text();
    let geminiData: any = null;
    try { geminiData = raw ? JSON.parse(raw) : null; } catch {}
    if (!geminiResponse.ok) {
      throw new Error(geminiData?.error?.message || `Gemini HTTP ${geminiResponse.status}`);
    }

    const assessment = parseJsonText(geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    const scores = assessment?.scores || {};
    const dimensions = [
      "task_fulfilment",
      "grammar",
      "vocabulary",
      "coherence_cohesion",
      "register_accuracy",
    ];
    const values = dimensions.map((key) => Number(scores[key]));
    const validScores = values.every((n) => Number.isInteger(n) && n >= 0 && n <= 5);
    if (assessment.status !== "insufficient_evidence" && !validScores) {
      throw new Error("AI returned an invalid rubric");
    }
    const total = validScores ? values.reduce((a, b) => a + b, 0) : null;

    const { data: featureUsage } = await db
      .from("aptis_ai_usage")
      .select("calls")
      .eq("user_id", uid)
      .eq("usage_date", today)
      .eq("feature", "writing_assessment")
      .maybeSingle();

    const { error: creditError } = await db
      .from("aptis_ai_usage")
      .upsert({
        user_id: uid,
        usage_date: today,
        feature: "writing_assessment",
        calls: Number(featureUsage?.calls || 0) + 1,
      }, { onConflict: "user_id,usage_date,feature" });
    if (creditError) throw new Error(creditError.message);

    const quota = {
      allowed: true,
      limit,
      used: used + 1,
      remaining: Math.max(limit - used - 1, 0),
    };

    const row = {
      user_id: uid,
      attempt_id,
      question_id,
      attempt_item_id: (item as any).id,
      feature: "writing",
      status: assessment.status === "insufficient_evidence" ? "insufficient_evidence" : "completed",
      rubric: assessment,
      estimated_level: assessment.status === "insufficient_evidence" ? null : assessment.estimated_level,
      total_score: total,
      model: MODEL,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveError } = await db
      .from("aptis_ai_assessments")
      .upsert(row, { onConflict: "attempt_item_id,feature" })
      .select()
      .single();
    if (saveError) throw new Error(saveError.message);

    return json(req, { ok: true, cached: false, assessment: saved, quota });
  } catch (error) {
    console.error("aptis-writing-assess", error);
    return json(req, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
