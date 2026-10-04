// ============================================================
// Backup semanal da base (C3): todo SÁBADO às 11:30 (Brasília) o Worker junta todas as tabelas
// num arquivo JSON comprimido (.json.gz) e manda por e-mail para o administrador.
// Fotos e documentos NÃO vão aqui (ficam no KV): cada Dono tem o "Drive Backup" / "Celular Backup" com arquivos.
// Para restaurar, ver src/build/RESTAURAR.md.
// ============================================================

const REMETENTE = "app@gestaoecontrole.app.br";
const DESTINO = "marcelojavierbonet@gmail.com"; // caixa verificada no Email Routing

// Ordem = ordem de restauração (quem é referenciado vem antes). Tabelas temporárias ficam de fora
// (tokens_email, falhas_login, uploads).
export const TABELAS_BACKUP = [
  "empresas", "usuarios", "permissoes", "convites", "obras", "equipe", "etapas", "etapa_fotos",
  "materiais", "ferramentas", "documentos", "pedidos", "observacoes", "observacoes_historico", "leads", "acessos",
];

async function tabela(sql, nome) {
  // nome vem SÓ da lista fixa acima (nunca do usuário). Uma consulta por tabela, sem SQL montado na mão.
  switch (nome) {
    case "empresas": return sql`SELECT * FROM empresas ORDER BY id`;
    case "usuarios": return sql`SELECT * FROM usuarios ORDER BY id`;
    case "permissoes": return sql`SELECT * FROM permissoes ORDER BY id`;
    case "convites": return sql`SELECT * FROM convites ORDER BY id`;
    case "obras": return sql`SELECT * FROM obras ORDER BY id`;
    case "equipe": return sql`SELECT * FROM equipe ORDER BY id`;
    case "etapas": return sql`SELECT * FROM etapas ORDER BY id`;
    case "etapa_fotos": return sql`SELECT * FROM etapa_fotos ORDER BY id`;
    case "materiais": return sql`SELECT * FROM materiais ORDER BY id`;
    case "ferramentas": return sql`SELECT * FROM ferramentas ORDER BY id`;
    case "documentos": return sql`SELECT * FROM documentos ORDER BY id`;
    case "pedidos": return sql`SELECT * FROM pedidos ORDER BY id`;
    case "observacoes": return sql`SELECT * FROM observacoes ORDER BY id`;
    case "observacoes_historico": return sql`SELECT * FROM observacoes_historico ORDER BY id`;
    case "leads": return sql`SELECT * FROM leads ORDER BY id`;
    case "acessos": return sql`SELECT * FROM acessos ORDER BY id`;
    default: throw new Error("tabela fora da lista: " + nome);
  }
}

export async function gerarBackup(sql) {
  const dados = {};
  const contagem = {};
  for (const t of TABELAS_BACKUP) {
    dados[t] = await tabela(sql, t);
    contagem[t] = dados[t].length;
  }
  const conteudo = JSON.stringify({ app: "Gestão & Controle", versao_backup: 1, gerado_em: new Date().toISOString(), contagem, tabelas: dados });
  const gz = new Uint8Array(await new Response(new Blob([conteudo]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  return { gz, contagem, bytesJson: conteudo.length };
}

function b64(bytes) {
  let bin = "";
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
  return btoa(bin);
}
const b64Texto = (t) => b64(new TextEncoder().encode(t));

export async function enviarBackup(env, sql) {
  const { gz, contagem, bytesJson } = await gerarBackup(sql);
  const dia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const nomeArq = `gc-backup-${dia}.json.gz`;
  const corpo = [
    `Backup semanal do Gestão & Controle — ${dia}`,
    "",
    "Guarde este e-mail. O arquivo anexo tem a base de dados inteira (sem as fotos e documentos).",
    "Ele contém dados pessoais: não encaminhe a ninguém.",
    "",
    "Linhas por tabela:",
    ...Object.entries(contagem).map(([t, n]) => `  ${t}: ${n}`),
    "",
    `Tamanho: ${(bytesJson / 1024).toFixed(0)} KB sem compressão · ${(gz.length / 1024).toFixed(0)} KB comprimido.`,
    "Para restaurar: veja src/build/RESTAURAR.md no repositório.",
  ].join("\n");
  const fronteira = "gc-" + crypto.randomUUID();
  const raw = [
    `From: G&C Backup <${REMETENTE}>`,
    `To: ${DESTINO}`,
    `Subject: =?UTF-8?B?${b64Texto(`Backup semanal G&C — ${dia}`)}?=`,
    `Message-ID: <${crypto.randomUUID()}@gestaoecontrole.app.br>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${fronteira}"`,
    "",
    `--${fronteira}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64Texto(corpo).replace(/.{1,76}/g, (l) => l + "\r\n"),
    `--${fronteira}`,
    `Content-Type: application/gzip; name="${nomeArq}"`,
    `Content-Disposition: attachment; filename="${nomeArq}"`,
    "Content-Transfer-Encoding: base64",
    "",
    b64(gz).replace(/.{1,76}/g, (l) => l + "\r\n"),
    `--${fronteira}--`,
    "",
  ].join("\r\n");
  const { EmailMessage } = await import("cloudflare:email");
  await env.EMAIL.send(new EmailMessage(REMETENTE, DESTINO, raw));
  return { ok: true, arquivo: nomeArq, contagem, kb: Math.round(gz.length / 1024) };
}
