import { getStore } from "@netlify/blobs";

export default async (req) => {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.APP_TOKEN}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: "id é obrigatório" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const store = getStore({ name: "arquivos" });
    const payload = await store.get(id);
    if (payload === null) {
      return new Response(JSON.stringify({ ok: false, error: "not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, payload }), {
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

export const config = { path: "/api/arquivo-get" };
