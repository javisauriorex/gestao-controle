# Provas automáticas de permissões

O que é: um roteiro que cria uma empresa de mentira (Dono, Eng. Chefe, Mestre, Encarregado,
Almoxarife, Profissional...), faz cada um tentar criar, ver, editar e apagar coisas, e confere
se o sistema deixa ou bloqueia exatamente como as regras dizem. Ex.: "Profissional tenta ver
obra onde não está → tem que dar erro".

Para que serve: antes de subir um bloco grande, roda-se isso e em segundos se sabe se alguma
regra de permissão quebrou — sem testar na mão, pessoa por pessoa.

Onde roda: num Postgres LOCAL de teste. Nunca toca o Neon nem a app real.
Quem roda: o Claude (ou qualquer dev) antes de entregar mudanças. Javi não precisa rodar.

Como rodar: `tests/rodar.sh` (precisa de Postgres e Node instalados).
