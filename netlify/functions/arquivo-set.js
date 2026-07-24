import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.APP_TOKEN}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { id, payload } = await req.json();
    if (!id || !payload) {
      return new Response(JSON.stringify({ ok: false, error: "id e payload são obrigatórios" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const store = getStore({ name: "arquivos" });
    await store.set(id, payload);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config = { path: "/api/arquivo-set" };
