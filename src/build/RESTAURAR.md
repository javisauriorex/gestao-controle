# Como restaurar o backup semanal (C3)

O e-mail "Backup semanal G&C — AAAA-MM-DD" traz o anexo `gc-backup-AAAA-MM-DD.json.gz`:
a base inteira em JSON comprimido (gzip), **sem fotos e documentos** (esses ficam no KV e
cada Dono pode baixar com "Drive Backup" / "Celular Backup").

Formato: `{ app, versao_backup: 1, gerado_em, contagem: {tabela: n}, tabelas: {tabela: [linhas...]} }`.
As tabelas estão na ordem de restauração (quem é referenciado vem antes).

**Não restaure sozinho.** Se um dia precisar, abra uma sessão com o Claude, anexe o arquivo
`.json.gz` e diga o que aconteceu. O procedimento é:
1. Criar um *branch* novo no Neon (nunca restaurar por cima da produção direto).
2. Rodar `schema.sql` no branch novo e importar as tabelas na ordem (script gerado na hora).
3. Conferir as contagens com as do e-mail.
4. Só então apontar o `DATABASE_URL` do Cloudflare para o branch restaurado.
