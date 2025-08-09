// src/worker.js
import { v4 as uuidv4 } from 'uuid';

/**
 * Bindings:
 *  - env.DB: D1Database
 *  - env.OPENAI_API_KEY: string (wrangler secret put OPENAI_API_KEY)
 *
 * Routes:
 *  POST /api/itineraries       -> { destination: string, durationDays: number }
 *  GET  /api/itineraries/:id   -> returns stored doc
 */

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const { pathname } = url;

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
      }

      if (request.method === 'POST' && pathname === '/api/itineraries') {
        const body = await safeJson(request);
        const { destination, durationDays } = body || {};

        if (typeof destination !== 'string' || !destination.trim()) {
          return json({ error: 'destination is required (string)' }, 400);
        }
        const days = Number(durationDays);
        if (!Number.isInteger(days) || days <= 0 || days > 30) {
          return json({ error: 'durationDays must be an integer between 1 and 30' }, 400);
        }

        const jobId = uuidv4();
        const nowIso = new Date().toISOString();

        await env.DB.prepare(
          `INSERT INTO itineraries (id, status, destination, durationDays, createdAt, completedAt, itinerary_json, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(jobId, 'processing', destination.trim(), days, nowIso, null, null, null)
          .run();

        ctx.waitUntil(
          generateAndPersistItinerary(env, { jobId, destination: destination.trim(), durationDays: days })
        );

        return json({ jobId }, 202);
      }

      if (request.method === 'GET' && pathname.startsWith('/api/itineraries/')) {
        const jobId = pathname.split('/').pop();
        if (!jobId) return json({ error: 'jobId required' }, 400);

        const row = await env.DB.prepare(
          `SELECT id, status, destination, durationDays, createdAt, completedAt, itinerary_json, error
           FROM itineraries WHERE id = ?`
        )
          .bind(jobId)
          .first();

        if (!row) return json({ error: 'Not found' }, 404);

        return json(
          {
            status: row.status,
            destination: row.destination,
            durationDays: row.durationDays,
            createdAt: row.createdAt,
            completedAt: row.completedAt,
            itinerary: row.itinerary_json ? JSON.parse(row.itinerary_json) : null,
            error: row.error,
          },
          200
        );
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: 'Internal error' }, 500);
    }
  },
};

/* ---------------- Helpers ---------------- */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/* --------------- LLM + Persistence (Chat Completions) --------------- */

async function generateAndPersistItinerary(env, { jobId, destination, durationDays }) {
  // JSON Schema that matches your Firestore-like shape
  const itinerarySchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { enum: ['completed', 'processing', 'failed'] },
      destination: { type: 'string' },
      durationDays: { type: 'integer' },
      createdAt: { type: 'string' },
      completedAt: { type: ['string', 'null'] },
      itinerary: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            day: { type: 'integer' },
            theme: { type: 'string' },
            activities: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  time: { type: 'string' },
                  description: { type: 'string' },
                  location: { type: 'string' },
                },
                required: ['time', 'description', 'location'],
              },
            },
          },
          required: ['day', 'theme', 'activities'],
        },
      },
      error: { type: ['string', 'null'] },
    },
    required: ['status', 'destination', 'durationDays', 'createdAt', 'completedAt', 'itinerary', 'error'],
  };

  const system = `You are a travel planner. Produce a JSON object that STRICTLY conforms to the provided JSON schema.
No explanations. No markdown. No extra keys. Fill all required fields.
Use concise, realistic activities with local tips.`;

  const user = `Destination: ${destination}
Duration (days): ${durationDays}

Requirements:
- Tailor daily themes to avoid repetition.
- Balance mornings/afternoons/evenings.
- Include short practical tips (tickets, reservations, transit hints).
- Respect the JSON schema exactly.`;

  try {
    // Use Chat Completions with json_schema response_format
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.6,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ItineraryDoc',
            schema: itinerarySchema,
            strict: true,
          },
        },
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`OpenAI API error: ${resp.status} ${errTxt}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !looksLikeJson(content)) {
      throw new Error('Model did not return valid JSON content');
    }

    const doc = JSON.parse(content);

    // Normalize server-controlled fields
    doc.status = 'completed';
    doc.destination = destination;
    doc.durationDays = durationDays;
    doc.error = null;
    doc.createdAt = await getCreatedAt(env, jobId);
    doc.completedAt = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE itineraries
       SET status = ?, itinerary_json = ?, completedAt = ?, error = ?
       WHERE id = ?`
    )
      .bind('completed', JSON.stringify(doc.itinerary), doc.completedAt, null, jobId)
      .run();
  } catch (e) {
    console.error('Generation failed', e);
    await env.DB.prepare(
      `UPDATE itineraries
       SET status = ?, completedAt = ?, error = ?
       WHERE id = ?`
    )
      .bind('failed', new Date().toISOString(), String(e.message || e), jobId)
      .run();
  }
}

function looksLikeJson(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

async function getCreatedAt(env, jobId) {
  const row = await env.DB.prepare(`SELECT createdAt FROM itineraries WHERE id = ?`).bind(jobId).first();
  return row?.createdAt || new Date().toISOString();
}
