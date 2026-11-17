/* ================================================================
   THE RUSTY CHEF - PANTRY AI WORKER  (Cloudflare Worker)
   ================================================================
   The website sends a pantry photo here, this asks Google Gemini
   what's in it, and sends back a short list. The Gemini API key
   lives ONLY in Cloudflare (Settings > Variables and Secrets,
   name: GEMINI_API_KEY), never in this file or on the website.

   Setup: Cloudflare dashboard > Workers & Pages > Create >
   Start with Hello World > Deploy > Edit code > paste this whole
   file > Deploy. Then add the GEMINI_API_KEY secret.
   ================================================================ */

const MODEL = "gemini-3.8-flash";
const ALLOWED_ORIGINS = ["https://therustychef.com", "https://www.therustychef.com"];
const MAX_IMAGE_CHARS = 3_000_000; // ~2.2 MB photo

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return reply({ ok: true, info: "Rusty Chef pantry AI is running." });
    if (!ALLOWED_ORIGINS.includes(origin)) return reply({ error: "Not allowed" }, 403);
    if (!env.GEMINI_API_KEY) return reply({ error: "GEMINI_API_KEY secret is missing" }, 500);

    let body;
    try { body = await request.json(); } catch { return reply({ error: "Bad request" }, 400); }
    const image = typeof body.image === "string" ? body.image : "";
    if (!image || image.length > MAX_IMAGE_CHARS) return reply({ error: "Missing or too-large image" }, 400);
    const pantry = Array.isArray(body.pantry) ? body.pantry.slice(0, 200)
      .filter(p => p && typeof p.k === "string" && typeof p.l === "string")
      .map(p => `${p.k.slice(0, 40)} = ${p.l.slice(0, 60)}`) : [];

    const prompt =
      "You are Rusty, a robot chef. Look at this photo of a kitchen pantry, fridge or a single food item and list " +
      "every distinct food or drink product you can see. Use short, everyday names, adding the brand when it is clear " +
      '(for example "Pepsi (soda)", "Cheerios cereal", "Canned black beans"). Ignore non-food things.\n\n' +
      "For each item, if it is one of these pantry ingredients, set key to the matching key exactly; otherwise set key to null:\n" +
      pantry.join("\n") +
      '\n\nReply with JSON only, shaped like {"items":[{"name":"...","key":"rice"}]}. Use {"items":[]} if you see no food.';

    let gemini;
    try {
      gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: image } }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
    } catch (e) {
      return reply({ error: "Could not reach Gemini" }, 502);
    }
    const data = await gemini.json().catch(() => ({}));
    if (!gemini.ok) return reply({ error: "Gemini error", status: gemini.status, detail: data?.error?.message || "" }, 502);

    const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    let items = [];
    try {
      const parsed = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim());
      items = (Array.isArray(parsed) ? parsed : parsed.items || [])
        .filter(it => it && typeof it.name === "string")
        .slice(0, 30)
        .map(it => ({ name: it.name.slice(0, 60), key: typeof it.key === "string" ? it.key : null }));
    } catch {
      return reply({ error: "Gemini gave an unreadable answer" }, 502);
    }
    return reply({ items });
  },
};
