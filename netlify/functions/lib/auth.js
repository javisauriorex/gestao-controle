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

// Matriz de permissões default (rank 1..7 x módulo -> nível).
// 1 = mais poder (Dono) ... 7 = menos poder (Profissional).
// Semeada uma vez por empresa nova; editável depois via tela "Permissões" (rank 1-4).
const MODULOS = ["etapas", "equipe", "documentos", "ferramentas", "materiais", "observacoes"];
const NIVEL_DEFAULT_POR_RANK = {
  1: "editar", 2: "editar", 3: "editar", 4: "editar", 5: "editar",
  6: "visualizar",
  7: "nenhum", // sobrescrito abaixo para etapas/documentos
};
function nivelDefault(rank, modulo) {
  if (rank === 7) return modulo === "etapas" || modulo === "documentos" ? "visualizar" : "nenhum";
  return NIVEL_DEFAULT_POR_RANK[rank] || "nenhum";
}

async function semearPermissoesDefault(empresaId) {
  for (let rank = 1; rank <= 7; rank++) {
    for (const modulo of MODULOS) {
      await sql`
        INSERT INTO permissoes (empresa_id, rank, modulo, nivel)
        VALUES (${empresaId}, ${rank}, ${modulo}, ${nivelDefault(rank, modulo)})
        ON CONFLICT (empresa_id, rank, modulo) DO NOTHING
      `;
    }
  }
}

// Devuelve el usuario de NUESTRA tabla `usuarios` a partir del token de Identity.
// Si es la primera vez que esta persona entra:
//   - si hay un convite pendiente para su email, se une a esa empresa con el rank invitado
//   - si NO hay convite, se crea una empresa nueva y esta persona queda como Dono (rank 1)
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

  // Nadie invitó a esta persona: arranca su propia empresa como Dono (rank 1, o mais alto).
  const empresas = await sql`INSERT INTO empresas (nome) VALUES (${nome + " — empresa"}) RETURNING *`;
  const empresa = empresas[0];
  const novos = await sql`
    INSERT INTO usuarios (email, nome, empresa_id, rank)
    VALUES (${email}, ${nome}, ${empresa.id}, 1)
    RETURNING *
  `;
  const novoUsuario = novos[0];
  await sql`UPDATE empresas SET dono_usuario_id = ${novoUsuario.id} WHERE id = ${empresa.id}`;
  await semearPermissoesDefault(empresa.id);
  return novoUsuario;
}

// --- Reglas de permiso ---

// Consulta la matriz de permissões de la empresa: ¿qué nível tiene este rank para este módulo?
export async function getNivel(empresaId, rank, modulo) {
  const rows = await sql`
    SELECT nivel FROM permissoes WHERE empresa_id = ${empresaId} AND rank = ${rank} AND modulo = ${modulo}
  `;
  return rows.length > 0 ? rows[0].nivel : nivelDefault(rank, modulo);
}

// Combina o nível do rank com a exceção pessoal (Almoxarife, Técnico Especialista, etc).
// A exceção SÓ pode recortar — nunca amplia acima do que o rank já permite.
const NIVEL_ORDEM = { nenhum: 0, visualizar: 1, editar: 2 };
export function nivelEfetivo(nivelDoRank, excecaoModulos, modulo) {
  if (!excecaoModulos || excecaoModulos[modulo] === undefined) return nivelDoRank;
  const excecao = excecaoModulos[modulo];
  return NIVEL_ORDEM[excecao] < NIVEL_ORDEM[nivelDoRank] ? excecao : nivelDoRank;
}
