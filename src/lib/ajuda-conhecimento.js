// ============================================================
// MANUAL DO G&C — a "comida" do assistente e da tela de Ajuda.
// Uma única fonte: a tela Ajuda mostra estas seções, o "?" de cada gaveta
// mostra a seção do módulo, e o assistente (Workers AI) responde SÓ com base nisto.
//
// Ao mudar algo no app, atualize aqui também (senão o assistente ensina errado).
// "para": quem vê a seção em destaque — "todos", "chefes" (rank 1-5, quem gerencia)
// ou "obra" (quem trabalha na obra, rank 6-8). Todo mundo pode ler tudo.
// ============================================================

export const RANKS = {
  1: "Dono", 2: "Engenheiro Chefe de Obra", 3: "Engenheiro Estagiário", 4: "Mestre de Obra",
  5: "Encarregado", 6: "Almoxarife", 7: "Chefe de Turma", 8: "Profissional",
};

export const SECOES = [
  {
    id: "comecar",
    titulo: "Primeiros passos",
    para: "todos",
    texto: `O G&C (Gestão & Controle) organiza a obra num só lugar: etapas, equipe, materiais, ferramentas, documentos e o livro de obra.

Na tela INÍCIO você vê as obras em que participa. Toque numa obra para abri-la. Dentro da obra aparece um arquivo com 6 gavetas: Equipe, Etapas, Ferramentas, Materiais, Observações e Documentos. Toque numa gaveta para entrar nela.

Para voltar, use o botão ou gesto "voltar" do próprio celular (não existe botão voltar na tela). Na tela Início, o "voltar" pergunta se você quer sair do aplicativo.

Na barra de baixo: INÍCIO (suas obras), AJUDA (esta tela e o assistente) e CONFIG (sua conta, PIN, senha, tema escuro, Termos e Privacidade).

Manual completo: na tela AJUDA (ou em CONFIG → Manual do usuário) abre o manual inteiro, com índice, para ler, imprimir ou salvar em PDF.

Instalar como aplicativo: no Chrome do celular, abra o menu (⋮) e toque em "Adicionar à tela inicial" ou "Instalar app".`,
  },
  {
    id: "ranks",
    titulo: "Ranks: quem pode o quê",
    para: "todos",
    texto: `Cada pessoa tem um rank. Número menor = mais poder:
1 Dono · 2 Engenheiro Chefe de Obra · 3 Engenheiro Estagiário · 4 Mestre de Obra · 5 Encarregado · 6 Almoxarife · 7 Chefe de Turma · 8 Profissional.

O rank vale para todas as obras da empresa. A "função" (ex.: Pedreiro, Eletricista) é só um texto e pode ser diferente em cada obra.

Regras gerais (a autoridade só desce):
- Dono, Engenheiro Chefe e Engenheiro Estagiário veem TODAS as obras da empresa. Do Mestre de Obra para baixo, cada um vê só as obras em que está na equipe.
- Criar obra: Dono, Engenheiro Chefe e Mestre de Obra.
- Editar ou apagar uma obra, mudar o estado (ativa/pausada/concluída) e transferir o responsável: só Dono e Engenheiro Chefe.
- Convidar e adicionar pessoas: quem tem "Editar" na gaveta Equipe (por padrão Dono, Engenheiro Chefe, Mestre, Encarregado e Chefe de Turma), sempre para ranks abaixo do seu.
- Tirar alguém da obra: só um superior. O responsável da obra só sai depois de transferir a obra.
- Mudar o rank: Dono, Engenheiro Chefe e Mestre de Obra, só de quem está abaixo e só para ranks abaixo do seu. O Dono principal pode nomear outro Dono (co-Dono); mudar ou excluir um Dono é feito pelo suporte.
- Ninguém altera ou apaga o que foi criado por alguém de rank igual ou maior. Vale o rank que a pessoa tinha quando criou.
- O que cada rank pode ver ou editar em cada gaveta é definido na tela de Permissões da empresa (só Dono e Engenheiro Chefe mudam).
- Gaveta escurecida com cadeado 🔒 = você não tem acesso a ela nesta obra. Se precisar, fale com o responsável da obra.

Funções paralelas:
- Engenheiro Estagiário: suplente ou secretário. Vê todas as obras e todas as gavetas, mas não altera nada.
- Almoxarife: recebe e entrega materiais e ferramentas das obras em que está. É quem liga os pedidos às entregas.

Permissões padrão (a empresa pode mudar):
- Dono, Engenheiro Chefe, Mestre e Encarregado: editam todas as gavetas.
- Engenheiro Estagiário: vê todas as gavetas.
- Almoxarife: edita Materiais, Ferramentas e Observações; vê Etapas e Documentos; não vê Equipe.
- Chefe de Turma: edita Equipe (convida Profissionais), Materiais, Ferramentas e Observações; vê Etapas e Documentos.
- Profissional: vê Etapas e Documentos; em Materiais e Ferramentas pode PEDIR e CONFIRMAR o que recebeu; escreve no livro de obra.`,
  },
  {
    id: "entrar",
    titulo: "Como entrar no aplicativo",
    para: "todos",
    texto: `Há três formas de entrar:
1. CPF + PIN: para quem recebeu convite pelo WhatsApp. Digite seu CPF e o PIN de 4 números que você criou.
2. E-mail e senha. Ao criar a conta assim, enviamos um link de confirmação ao seu e-mail: abra o e-mail e toque no link antes de entrar pela primeira vez (olhe também o spam). Não chegou? Tente entrar com e-mail e senha e toque em "Reenviar e-mail".
3. Entrar com Google (botão branco com o "G" colorido).

Convite pelo WhatsApp: toque no link recebido, digite seu CPF, crie um PIN de 4 números (duas vezes), aceite os Termos e toque em Entrar. O link vale 7 dias e só pode ser usado uma vez. Se venceu, peça um novo a quem te convidou.

Regras do PIN: 4 números; não pode ser repetido (1111), sequência (1234) nem parte do seu CPF. Não conte seu PIN a ninguém.

Tranca rápida: depois de entrar, o app pode oferecer usar a digital ou o rosto do celular para abrir mais rápido. A biometria fica só no seu celular.

Errou o PIN ou a senha 5 vezes? O acesso fica bloqueado por 15 minutos. Se continuar errando, 1 hora e depois 24 horas.

Primeiro acesso: o app pede para aceitar os Termos de Uso e a Política de Privacidade. É preciso ter 18 anos ou mais.`,
  },
  {
    id: "esqueci",
    titulo: "Esqueci o PIN ou a senha",
    para: "todos",
    texto: `Esqueceu a SENHA (entra com e-mail)? Na tela de entrada, digite seu e-mail e toque em "Esqueci a senha". Chega um link no seu e-mail (vale 1 hora, só funciona uma vez): toque nele e crie a senha nova. Os outros aparelhos saem da conta.

Esqueceu o PIN (entra com CPF)? A recuperação é feita por um link no WhatsApp, enviado pelo seu chefe:

1. Peça ao Dono ou ao Engenheiro Chefe um "Novo PIN".
2. Ele abre a gaveta Equipe, toca na chave 🔑 ao lado do seu nome e te manda o link pelo WhatsApp. Se você ainda não tinha CPF cadastrado, ele vai precisar informar o seu CPF: o link só funciona com esse CPF.
3. Toque no link, digite seu CPF e crie um PIN novo de 4 números.
4. Pronto: entre com CPF + PIN.

Quem entra com Google não tem senha do G&C: se perder o acesso ao Google, peça um Novo PIN ao seu chefe.

Ao usar um Novo PIN, os outros aparelhos em que você estava logado saem da conta (por segurança, caso o celular tenha sido perdido).

Se o seu e-mail for Gmail, você também pode usar o botão "Entrar com Google".

O Dono não tem chefe para pedir: se o Dono perder o acesso, deve escrever para suporte@gestaoecontrole.app.br a partir do e-mail da conta.

O link vale 7 dias e só pode ser usado uma vez.`,
  },
  {
    id: "obras",
    titulo: "Obras: criar, editar, estado",
    para: "chefes",
    texto: `Criar obra: na tela Início, toque em "+ Nova obra" (Dono, Engenheiro Chefe, Engenheiro Estagiário e Mestre de Obra). Preencha cliente, endereço, tipo, data de início e o responsável. Quem cria e o responsável entram automaticamente na equipe.

Editar ou apagar obra: nos botões do cartão da obra na tela Início (só Dono e Engenheiro Chefe). Apagar uma obra apaga tudo dela (etapas, fotos, documentos) e não tem volta.

Estado da obra: dentro da obra, toque no carimbo (ATIVA / PAUSADA / CONCLUÍDA) para mudar (só Dono e Engenheiro Chefe).

Responsável da obra: aparece na gaveta Observações. Dono e Engenheiro Chefe podem trocar em "🔄 Transferir". O responsável é quem pode bloquear gavetas para pessoas da equipe nesta obra.

Pendências: botão na tela Início que lista as etapas ainda não concluídas de todas as suas obras.

Relatório semanal: botão na tela Início que monta um resumo da semana para enviar por WhatsApp ou e-mail.

Avisos em tempo real: com a obra aberta, o app avisa quando alguém adiciona etapa, material, ferramenta, documento, foto ou observação.`,
  },
  {
    id: "equipe",
    titulo: "Gaveta Equipe",
    para: "chefes",
    modulo: "equipe",
    texto: `A gaveta Equipe mostra quem trabalha nesta obra, com rank e função.

Presença: cada pessoa marca a SUA presença, só do dia de hoje, no botão "✋ Marcar minha presença hoje", embaixo das gavetas. Se alguém não tem celular ou ficou sem bateria, um superior pode ANOTAR a presença dele no quadradinho ao lado do nome (até 7 dias atrás): fica laranja e aparece "presença anotada por Fulano". O superior não desmarca o que a própria pessoa marcou. O número "Xd" mostra quantos dias a pessoa esteve presente. E-mail e presença de cada um só aparecem para a própria pessoa e para os superiores dela.

Adicionar pessoas (quem tem "Editar" na Equipe, sempre para ranks abaixo do seu):
- 📲 Novo por link: digite nome, WhatsApp (opcional), função e rank e toque em "Gerar link". Depois toque em "📲 WhatsApp" para mandar o convite, ou em "📋 Copiar link". A pessoa entra com CPF + PIN, sem e-mail.
- 👥 Da empresa: escolha alguém que já tem conta na empresa (de outra obra) e toque em Adicionar.
- ✉ Por email: digite o e-mail. Se a pessoa ainda não tem conta, é gerado um link de convite.

Engrenagem ⚙ ao lado de cada pessoa:
- Rank: Dono, Engenheiro Chefe e Mestre de Obra mudam o rank de quem está abaixo, sempre para um rank abaixo do seu. O rank vale para todas as obras.
- Função: texto livre desta obra (para Profissional, o ofício: Pedreiro, Pintor...).
- Bloquear gavetas NESTA obra: só o responsável da obra, para quem está abaixo dele.
- Excluir conta: um superior pode excluir a conta de alguém abaixo dele.

Chave 🔑: gera um "Novo PIN" (Dono e Engenheiro Chefe).
Botão ×: tira a pessoa desta obra (ela continua na empresa e nas outras obras). Só aparece para quem é superior dela; o responsável da obra não pode ser tirado sem antes transferir a obra.

"Usuário removido": pessoa que teve a conta excluída. Os registros dela ficam na obra, sem nome.`,
  },
  {
    id: "etapas",
    titulo: "Gaveta Etapas",
    para: "todos",
    modulo: "etapas",
    texto: `A gaveta Etapas é a lista de tarefas da obra (ex.: Fundação, Alvenaria, Reboco). Cada etapa pode ter sub-etapas.

Criar etapa: escreva o nome no campo de baixo (ex.: "instalação elétrica") e toque em +.
Dentro de cada etapa: 📁 abre as sub-etapas (e permite criar novas), ✎ muda o nome, + adiciona fotos de avanço.

Concluir: marque o quadradinho da etapa. Aparece "✓ por Fulano · data e hora". Qualquer pessoa com permissão de editar Etapas pode concluir, mesmo que outra pessoa tenha criado a etapa. Desmarcar: só quem concluiu ou um superior dele.

Fotos de avanço: toque no + da etapa para adicionar fotos (quantas quiser, quando quiser). As fotos são reduzidas no celular antes de enviar.

Mudar o texto ou apagar uma etapa: só quem criou ou um superior dele. Apagar uma etapa apaga também as sub-etapas e as fotos; se alguma delas é de alguém do seu nível ou acima, essa pessoa tem que apagar antes.

Se você só vê as etapas mas não consegue marcar, o seu rank tem permissão só de "ver" — fale com seu superior.`,
  },
  {
    id: "materiais",
    titulo: "Gaveta Materiais",
    para: "todos",
    modulo: "materiais",
    texto: `A gaveta Materiais registra os materiais da obra (ex.: "10 sacos de cimento").

Registrar: escreva no campo e toque em +. Apagar: quem registrou ou um superior dele.

Pedidos e entregas (parte de cima da gaveta) — o Almoxarife é o nexo:
- "+ Pedir": pedir um material a alguém de rank acima (ex.: o Pedreiro pede ao Almoxarife). Fica PENDENTE.
- Quem recebe o pedido toca em "🚚 Entreguei" (ou "Recusar"). Aí fica 🚚 AGUARDANDO a confirmação.
- Quem pediu toca em "✓ Recebi" (ou "Não recebi", que volta a pendente). Só então fecha como RECEBIDO.
- "+ Entregar": registrar que você entregou a alguém de rank abaixo. Também fica aguardando até ele confirmar "Recebi".
- Cancelar: quem criou o pedido ou um superior dele.
- Os pedidos aparecem para as duas pessoas e para os superiores delas.

Assim fica registrado quem pediu, quem entregou, quem recebeu e quando.`,
  },
  {
    id: "ferramentas",
    titulo: "Gaveta Ferramentas",
    para: "todos",
    modulo: "ferramentas",
    texto: `A gaveta Ferramentas funciona igual à de Materiais: lista das ferramentas da obra (ex.: furadeira, andaime) e, em cima, os Pedidos.

"+ Pedir" pede uma ferramenta a alguém de rank acima (fica pendente). Quem fornece toca em "🚚 Entreguei" e quem pediu confirma "✓ Recebi". "+ Entregar" registra uma entrega direta, que também espera o "Recebi" de quem recebeu. Assim cada ferramenta tem alguém que assinou que recebeu.

Registrar ferramenta: escreva e toque em +. Apagar: quem registrou ou um superior dele.`,
  },
  {
    id: "documentos",
    titulo: "Gaveta Documentos",
    para: "todos",
    modulo: "documentos",
    texto: `A gaveta Documentos guarda arquivos da obra: plantas, projetos, orçamentos, contratos, fotos.

Formatos aceitos: PDF, Word, Excel, JPG e PNG, até cerca de 4 MB. Toque para abrir ou ver a imagem.

Limite por dia (fotos de avanço + documentos, somados): 10 arquivos por pessoa e 20 por empresa. Passou do limite? No dia seguinte libera de novo.

Só quem tem acesso à obra consegue abrir os arquivos dela.

Apagar: quem enviou ou um superior dele. Apagar um documento apaga o arquivo de vez.

Em cima da gaveta também há Pedidos de documento (pedir a alguém acima / entregar a alguém abaixo), iguais aos de Materiais.

Cuidado: não envie documentos pessoais sensíveis (ex.: atestado médico) sem necessidade. Fotos enviadas como documento podem conter a localização de onde foram tiradas.`,
  },
  {
    id: "observacoes",
    titulo: "Gaveta Observações (livro de obra)",
    para: "todos",
    modulo: "observacoes",
    texto: `A gaveta Observações é o livro de obra: avisos, sugestões, reclamações e registros do dia. Ex.: "Pedreiro, ATENÇÃO às tubulações de água e eletricidade na parede leste."

Escrever: digite na caixa e toque em "📝 Registrar no livro". Todos podem escrever (salvo se a empresa bloquear).

Assinatura: cada observação mostra "— Nome · Rank · data e hora". O rank é o que a pessoa tinha no momento em que escreveu.

Editar: só o próprio autor (✏️). Aparece "editado" com a data, e a versão anterior fica guardada (🕘 versões) — visível só para o autor e os superiores dele.

Apagar (🗑): só um superior de quem escreveu. O autor não apaga o que escreveu (é um registro da obra).

Importante: a assinatura do livro é um registro dentro do app. Não é assinatura digital oficial nem substitui o Livro de Ordem do CREA/CAU.

Nesta gaveta também aparecem o responsável da obra, o botão de transferir responsável e o de excluir a obra (Dono e Engenheiro Chefe).`,
  },
  {
    id: "permissoes",
    titulo: "Tela de Permissões",
    para: "chefes",
    texto: `Em CONFIG → Permissões você vê, para cada rank, o que ele pode fazer em cada gaveta: Nenhum (nem vê), Ver, Receber (só em Materiais e Ferramentas: vê, pede e confirma o que recebeu) ou Editar.

Só o Dono e o Engenheiro Chefe alteram a tabela, tocando numa célula para alternar, e cada um só altera as linhas dos ranks abaixo do seu. Os outros chefes só consultam.

Embaixo da tabela ficam as "Regras fixas da hierarquia", que valem sempre (por exemplo: ninguém apaga o que é de um igual ou superior; no livro de obra o autor não apaga). E o link "💡 Sugestões de fluxo de informação?": escreva como a informação deveria circular na sua obra e toque em Enviar — a mensagem vai direto para a equipe do G&C.

Além disso, o responsável de cada obra pode bloquear uma gaveta para uma pessoa específica, só naquela obra (gaveta Equipe → ⚙).`,
  },
  {
    id: "conta",
    titulo: "Sua conta, privacidade e suporte",
    para: "todos",
    texto: `Em CONFIG você encontra: Definir/Trocar senha, Criar/Trocar meu PIN, Modo escuro, Permissões (para chefes), Drive Backup e Celular Backup (Dono), Manual do usuário, Termos de Uso, Privacidade, Exportar meus dados, Sair de todos os aparelhos, Sair e, no final, Excluir minha conta.

Criar/Trocar meu PIN: pede para digitar o seu CPF (por segurança, o G&C não guarda o CPF completo, só uma versão protegida).

Trocar senha: pede a senha atual. Ao trocar a senha ou o PIN, os outros aparelhos saem da conta; o aparelho que você está usando continua.

Drive Backup e Celular Backup (só o Dono): fazem uma cópia de tudo da empresa — todas as obras com etapas, equipe, materiais, ferramentas, observações, e também as fotos e os documentos, organizados em pastas por obra — num arquivo .zip. "Drive Backup" salva no seu Google Drive, na pasta "G&C backup" (na primeira vez o Google pede sua autorização; o G&C só enxerga os arquivos que ele mesmo criou, nunca o resto do seu Drive). Ficam os 10 backups mais novos; os mais velhos vão para a lixeira do Drive. "Celular Backup" baixa o .zip direto na pasta de downloads do aparelho. O arquivo é montado no seu aparelho: com muitas fotos pode demorar alguns minutos (não feche a tela). O mais seguro é o Drive: se perder o celular, a cópia continua lá.

Exportar meus dados: mostra tudo o que o G&C guarda sobre você (cadastro, obras, presenças, observações, pedidos, arquivos enviados e registros de acesso). Dá para ver e imprimir/salvar em PDF, ou baixar um arquivo JSON para levar a outro sistema.

Sair de todos os aparelhos: fecha a sessão em todos os outros celulares e computadores. Use se perdeu o celular ou entrou num aparelho que não é seu.

Segurança: o G&C NUNCA pede seu PIN ou senha por WhatsApp, e-mail ou telefone. O único endereço do aplicativo é gestaoecontrole.app.br.

Excluir minha conta: você deixa de entrar e seus dados pessoais (nome, e-mail, CPF, telefone) são apagados. O que você registrou nas obras fica, assinado como "Usuário removido". O Dono não tem esse botão.

Encerrar a empresa (apagar tudo): o Dono toca em CONFIG → "Excluir conta e encerrar empresa" e confirma. O pedido vai direto para o suporte, que responde no e-mail da conta para confirmar antes de apagar. Concluímos em até 15 dias. Se o envio falhar, escreva para suporte@gestaoecontrole.app.br a partir do e-mail da conta.

Privacidade, pedidos de dados e dúvidas gerais: info@gestaoecontrole.app.br.

O G&C está em versão beta e é gratuito.`,
  },
  {
    id: "problemas",
    titulo: "Perguntas frequentes e problemas",
    para: "todos",
    texto: `Não vejo uma obra: você só vê as obras em que está na equipe (Dono e Engenheiro Chefe veem todas). Peça para te adicionarem na gaveta Equipe da obra.

Não vejo uma gaveta: o seu rank não tem acesso a ela na tela de Permissões, ou o responsável da obra bloqueou para você.

Vejo mas não consigo editar: seu nível nessa gaveta é "Ver". Fale com seu superior.

Não consigo apagar algo: só quem criou ou um superior dele pode apagar.

"Sem acesso a esta obra": você não está na equipe dessa obra.

Link de convite "inválido", "já usado" ou "venceu": peça um novo link a quem te convidou.

A tela não mostra o que outra pessoa acabou de fazer: com a obra aberta, o app atualiza sozinho a cada 15 segundos. Se precisar, saia e entre de novo na obra.

O app abriu na última gaveta que eu estava: é normal, ele lembra onde você parou.

Algo não funciona: escreva para suporte@gestaoecontrole.app.br contando o que aconteceu (e, se puder, um print da tela).`,
  },
];

// Perguntas sugeridas no assistente, por grupo de rank
export const SUGESTOES = {
  chefes: [
    "Como convido um trabalhador pelo WhatsApp?",
    "Como mudo o rank de alguém?",
    "Como bloqueio uma gaveta para uma pessoa?",
    "Quem pode apagar uma obra?",
    "O que o Almoxarife pode fazer?",
  ],
  obra: [
    "Como peço material?",
    "Como marco uma etapa como concluída?",
    "Esqueci meu PIN, o que faço?",
    "Como escrevo no livro de obra?",
    "Por que não vejo uma obra?",
  ],
};

export function grupoDoRank(rank) {
  return rank <= 5 ? "chefes" : "obra";
}

// Texto completo para o assistente
export function manualCompleto() {
  return SECOES.map((s) => `## ${s.titulo}\n${s.texto}`).join("\n\n");
}
