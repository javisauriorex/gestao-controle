# G&C — ficha de Play Console (borrador)

Todo lo que va en la tienda está en **portugués (pt-BR)**: el app hoy solo existe en ese idioma, y Play pide que la ficha corresponda al idioma real del producto. Las fichas en español (y otros idiomas) se agregan cuando el app tenga esa interfaz.

## 1. Textos de la ficha (pt-BR)

**Nome do app** (máx. 30): `Gestão & Controle – Obras`

**Descrição curta** (máx. 80):
`Gestão de obras: etapas, equipe, materiais, fotos e livro de obra num só app.`

**Descrição completa** (máx. 4000):

```
O Gestão & Controle (G&C) organiza a sua obra de construção civil no celular, do Dono ao profissional, cada um vendo só o que precisa.

O QUE VOCÊ FAZ NO G&C
• Etapas: acompanhe o andamento da obra, marque o que foi concluído (com o nome de quem concluiu) e anexe fotos de avanço direto da câmera ou da galeria.
• Equipe: monte a equipe de cada obra e convide pelo WhatsApp com um link. A pessoa entra com CPF e um PIN de 4 números, sem precisar de e-mail.
• Materiais e ferramentas: registre o que a obra tem e o que precisa, e peça o que falta. A entrega só fecha quando quem recebe confirma.
• Documentos: guarde PDFs, plantas, contratos e planilhas da obra ao alcance de quem precisa.
• Livro de obra: registre observações com data, hora e autor. O texto só pode ser editado por quem escreveu, e as versões anteriores ficam guardadas.
• Presença: cada pessoa marca a própria presença do dia.
• Avisos: um sino mostra o que aconteceu na obra e, se você ativar, o celular avisa na hora.

CADA UM NO SEU NÍVEL
O G&C segue a hierarquia real da obra: Dono, Engenheiro Chefe, Engenheiro Estagiário, Mestre de Obra, Encarregado, Almoxarife, Chefe de Turma e Profissional. A empresa define o que cada nível pode ver e fazer, e o responsável de cada obra pode restringir ainda mais.

SEUS DADOS, SOB CONTROLE
• Exporte seus dados quando quiser.
• Exclua sua conta pelo próprio aplicativo.
• O Dono pode baixar uma cópia de tudo (com fotos e documentos) para o celular ou para o próprio Google Drive.
• Tema claro e escuro, e tamanho da letra ajustável.

COMO COMEÇAR
Crie sua conta (e-mail e senha, ou Conta Google) e cadastre sua empresa e sua primeira obra. Para entrar na equipe de alguém, basta aceitar o convite que chegou pelo WhatsApp.

Versão beta, grátis nesta fase. O G&C é um aplicativo para maiores de 18 anos. O registro de autor do livro de obra é um registro dentro do aplicativo: não é assinatura digital ICP-Brasil e não substitui registros exigidos por lei ou pelo CREA/CAU.

Dúvidas: suporte@gestaoecontrole.app.br
Política de Privacidade: https://gestaoecontrole.app.br/privacidade
```

**Categoria:** Negócios (Business) · **Tags sugeridas:** Gestão de projetos, Construção.
**E-mail de contato:** `suporte@gestaoecontrole.app.br` · **Site:** `https://gestaoecontrole.app.br`
**Política de privacidade:** `https://gestaoecontrole.app.br/privacidade`
**Eliminação de conta/dados (URL):** `https://gestaoecontrole.app.br/excluir-conta`

**Capturas necesarias:** mínimo 2 de teléfono (ideal 6-8: dashboard, obra con cajones, etapas con fotos, equipe, livro de obra, avisos, permissões, Apresentação). Gráfico de funciones 1024×500. Ícono 512×512 (sale de `icon-512-any.png`).

## 2. Acceso al app para el revisor de Google (App access)

Google necesita entrar sin ayuda. El login por CPF+PIN no sirve para eso; usar e-mail+senha.

Preparar (lo hacés vos, una vez):

1. Crear en la web una cuenta con un e-mail que controles (por ejemplo `revisor@gestaoecontrole.app.br`, que el Email Routing te reenvía a tu Gmail) y una senha fuerte. Confirmar el e-mail.
2. Cargar una obra de ejemplo con 3-4 etapas, un par de fotos, un documento y una observación, para que el revisor vea todo.
3. Probar el login desde un navegador en modo incógnito.
4. No cambiar esa cuenta ni su contraseña mientras la app esté en revisión.

Texto para el campo de instrucciones:

```
Login: toque em "ENTRAR" e use e-mail e senha.
E-mail: [REVISOR]
Senha: [SENHA]
A conta já tem uma obra de exemplo. Não é preciso cartão, SMS nem código por e-mail.
O app é em português. O acesso por convite (CPF+PIN) depende de convites reais e não é necessário para a revisão.
```

## 3. Seguridad de los datos (Data Safety)

Borrador armado desde la Política de Privacidade v1.2. **Verificar contra el formulario real de Play al completarlo**, porque las categorías cambian de nombre.

**Preguntas generales**
- ¿La app recopila o comparte datos del usuario? **Sí.**
- ¿Los datos se cifran en tránsito? **Sí** (HTTPS).
- ¿Pueden los usuarios pedir que se borren sus datos? **Sí:** dentro del app y por la URL `/excluir-conta`.
- ¿Se venden datos? **No.** Publicidad: **ninguna.**

**Tipos de datos recopilados**

| Categoría de Play | Dato | Obligatorio | Finalidad | Compartido con terceros |
|---|---|---|---|---|
| Info personal → Nombre | Nombre | Sí | Funcionalidad de la app, administración de cuenta | No |
| Info personal → Correo | E-mail (cuentas con senha o Google) | Sí* | Funcionalidad, administración de cuenta, comunicaciones del servicio | No |
| Info personal → Número de teléfono | Teléfono del convidado (opcional) | No | Funcionalidad | No |
| Info personal → ID de usuario / Otra info | CPF (solo huella criptográfica y versión enmascarada) | No** | Funcionalidad, seguridad (login) | No |
| Fotos y videos → Fotos | Fotos de avance de obra | No | Funcionalidad | No |
| Archivos y documentos | PDF, Word, Excel, JPG, PNG enviados como documentos | No | Funcionalidad | No |
| Actividad en la app → Otro contenido generado por el usuario | Observaciones del libro de obra, pedidos, etapas | No | Funcionalidad | No |
| Dispositivo u otros ID | Identificador técnico de la inscripción de notificaciones push; IP en registros de acceso | No / Sí | Funcionalidad; seguridad y cumplimiento legal | No |

\* El e-mail es obligatorio para quien crea cuenta con senha o Google; quien entra por convite usa CPF.
\** Obligatorio solo para el acceso por convite.

**Notas para responder bien:**
- Cloudflare, Neon y Resend procesan datos **por cuenta del G&C** (proveedores de servicio). Según las reglas de Play, eso no cuenta como "compartir"; no se marca "compartido".
- **No se recopila:** ubicación, contactos, mensajes SMS/e-mail, datos financieros ni de salud, audio, historial de navegación, información de pagos.
- El 18+ y la eliminación de datos coinciden con los Termos y la Política.

## 4. Otras declaraciones

| Sección de Play | Respuesta |
|---|---|
| Público objetivo | Solo adultos (18+). No está dirigido a niños |
| Clasificación de contenido | Cuestionario IARC: categoría utilidad / productividad, sin violencia, sin contenido sexual, sin juegos de azar, sin compras. Resultado esperado: apto para todos o 3+. En la pregunta de contenido generado por usuarios, ver la nota* |
| Anuncios | No contiene anuncios |
| App de gobierno / finanzas / salud / noticias | No |
| Funciones de IA | El asistente de Ajuda usa IA (Cloudflare Workers AI) para responder dudas sobre el manual; declararlo si el formulario lo pide |
| Permisos | Cámara (fotos de avance) y notificaciones. Sin ubicación |
| Precio | Gratis |

\* Si el cuestionario IARC pregunta por contenido generado por usuarios, responder con honestidad: los usuarios cargan texto, fotos y documentos que ven otros miembros de su misma empresa (no es una red social abierta).
