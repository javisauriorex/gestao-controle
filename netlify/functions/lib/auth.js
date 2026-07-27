import { sql } from "./db.js";

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Valida el token de Netlify Identity contra el propio sitio y devuelve
// { id, email, user_metadata, ... } o null si no es válido.
async function getIdentityUser(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const siteUrl = process.env.URL || process.env.DEPLOY_URL;
  try {
    const res = await fetch(`${siteUrl}/.netlify/identity/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Devuelve el usuario de NUESTRA tabla `usuarios` a partir del token de Identity.
// Si es la primera vez que esta persona entra:
//   - si hay un convite pendiente para su email, se une a esa empresa con el rank invitado
//   - si NO hay convite, se crea una empresa nueva y esta persona queda como Dono (rank 5)
export async function getUsuario(req) {
  const identityUser = await getIdentityUser(req);
  if (!identityUser || !identityUser.email) return null;
  const email = identityUser.email.toLowerCase();
  const nome = identityUser.user_metadata?.full_name || email;

  const existentes = await sql`SELECT * FROM usuarios WHERE email = ${email}`;
  if (existentes.length > 0) return existentes[0];

  const convites = await sql`
    SELECT * FROM convites WHERE email = ${email} AND aceito = false ORDER BY id DESC LIMIT 1
  `;

  if (convites.length > 0) {
    const convite = convites[0];
    const novos = await sql`
      INSERT INTO usuarios (email, nome, empresa_id, rank)
      VALUES (${email}, ${nome}, ${convite.empresa_id}, ${convite.rank})
      RETURNING *
    `;
    await sql`UPDATE convites SET aceito = true WHERE id = ${convite.id}`;
    const novoUsuario = novos[0];
    if (convite.obra_id) {
      await sql`
        INSERT INTO equipe (obra_id, usuario_id, funcao, criado_por)
        VALUES (${convite.obra_id}, ${novoUsuario.id}, ${convite.funcao || ""}, ${convite.criado_por})
        ON CONFLICT (obra_id, usuario_id) DO NOTHING
      `;
    }
    return novoUsuario;
  }

  // Nadie invitó a esta persona: arranca su propia empresa como Dono.
  const empresas = await sql`INSERT INTO empresas (nome) VALUES (${nome + " — empresa"}) RETURNING *`;
  const empresa = empresas[0];
  const novos = await sql`
    INSERT INTO usuarios (email, nome, empresa_id, rank)
    VALUES (${email}, ${nome}, ${empresa.id}, 5)
    RETURNING *
  `;
  const novoUsuario = novos[0];
  await sql`UPDATE empresas SET dono_usuario_id = ${novoUsuario.id} WHERE id = ${empresa.id}`;
  return novoUsuario;
}

// --- Reglas de permiso (una sola vez, usadas por todas las Functions) ---

// ¿El actor tiene rank suficiente para esta acción?
export function podeCrear(rankMinimo, rankAtor) {
  return rankAtor >= rankMinimo;
}

// Regla universal **: un escalafón inferior no modifica/borra lo que cargó uno superior.
export function podeModificar(rankAtor, rankCriador) {
  return rankAtor >= rankCriador;
}

// Al gestionar Equipe: nadie asigna un rank mayor al propio.
export function podeAsignarRank(rankAtor, rankAAsignar) {
  return rankAAsignar <= rankAtor;
}
