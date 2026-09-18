import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const MODELS = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
const VOICE = "Kore";
const SAMPLE_RATE = 24000;
const ALLOWED_ORIGINS = new Set([
  "https://ai-clo-ptithcm.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://ai-clo-ptithcm.github.io",
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

function base64ToBytes(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
}

function pcm16MonoToWav(pcm: Uint8Array) {
  const out = new Uint8Array(44 + pcm.length);
  const view = new DataView(out.buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

async function generateSpeech(apiKey: string, transcript: string) {
  let lastError = "";
  for (const model of MODELS) {
    const prompt = [
      "Read this English listening-test transcript once, naturally and clearly at a moderate pace.",
      "Say only the transcript text and nothing else.",
      "",
      transcript,
    ].join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
            },
          },
        }),
      },
    );

    const raw = await response.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      // handled below
    }

    if (response.ok) {
      const encoded = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (encoded) return { model, pcm: base64ToBytes(encoded) };
    }

    lastError = data?.error?.message || `HTTP ${response.status}`;
    console.warn("Aptis TTS fallback", model, lastError);
  }

  throw new Error(lastError || "Gemini TTS failed");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_LIVE_API_KEY");
    if (!supabaseUrl || !serviceRole || !apiKey) throw new Error("Missing server configuration");

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(req, { ok: false, error: "Authentication required" }, 401);

    const db = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await db.auth.getUser(token);
    const uid = userData?.user?.id;
    if (userError || !uid) return json(req, { ok: false, error: "Invalid session" }, 401);

    const [{ data: profile }, { data: membership }] = await Promise.all([
      db.from("profiles").select("role").eq("id", uid).maybeSingle(),
      db.from("aptis_memberships")
        .select("enabled,content_role")
        .eq("user_id", uid)
        .maybeSingle(),
    ]);

    const canManage = profile?.role === "admin" ||
      (membership?.enabled === true && membership?.content_role === "english_teacher");
    if (!canManage) return json(req, { ok: false, error: "APTIS_CONTENT_EDITOR_REQUIRED" }, 403);

    const { set_id, force = false } = await req.json();
    if (!set_id) return json(req, { ok: false, error: "Missing set_id" }, 400);

    const { data: set, error: setError } = await db
      .from("aptis_sets")
      .select("id,title,level,transcript,status,media")
      .eq("id", set_id)
      .eq("skill", "listening")
      .single();
    if (setError || !set) throw new Error(setError?.message || "Listening set not found");

    if (!force && set.status === "published" && set.media?.path) {
      return json(req, { ok: true, set_id: set.id, path: set.media.path, already_done: true });
    }
    if (!set.transcript?.trim()) throw new Error("Listening set has no transcript");

    const generated = await generateSpeech(apiKey, set.transcript.trim());
    const wav = pcm16MonoToWav(generated.pcm);
    const path = `listening/generated/${set.level}/${set.id}.wav`;

    const { error: uploadError } = await db.storage
      .from("aptis-content")
      .upload(path, wav, {
        upsert: true,
        contentType: "audio/wav",
        cacheControl: "3600",
      });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const media = {
      bucket: "aptis-content",
      path,
      mime: "audio/wav",
      kind: "audio",
      name: `${set.id}.wav`,
      size: wav.byteLength,
      sample_rate: SAMPLE_RATE,
      channels: 1,
      bits_per_sample: 16,
      generated_by: generated.model,
      voice: VOICE,
    };

    const { error: setUpdateError } = await db
      .from("aptis_sets")
      .update({ media, status: "published", is_active: true, updated_at: new Date().toISOString() })
      .eq("id", set.id);
    if (setUpdateError) throw new Error(setUpdateError.message);

    const { error: questionUpdateError } = await db
      .from("aptis_questions")
      .update({ status: "published", is_active: true, updated_at: new Date().toISOString() })
      .eq("set_id", set.id)
      .eq("skill", "listening");
    if (questionUpdateError) throw new Error(questionUpdateError.message);

    const { count } = await db
      .from("aptis_questions")
      .select("id", { count: "exact", head: true })
      .eq("skill", "listening")
      .eq("level", "B2")
      .eq("status", "published")
      .eq("is_active", true);

    if ((count || 0) >= 6) {
      await db.from("aptis_learning_lessons")
        .update({ is_available: true, updated_at: new Date().toISOString() })
        .eq("code", "APT-L1003");
    }

    return json(req, {
      ok: true,
      set_id: set.id,
      path,
      bytes: wav.byteLength,
      model: generated.model,
    });
  } catch (error) {
    console.error("aptis-listening-tts", error);
    return json(req, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
