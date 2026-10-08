# G&C na Play Store — guia técnico (TWA)

Datos fijos (no cambiar después de publicar):

| Dato | Valor |
|---|---|
| Package name (applicationId) | `br.app.gestaoecontrole` |
| Dominio | `gestaoecontrole.app.br` |
| Start URL | `/index.html` |
| Política de privacidad (para Play) | `https://gestaoecontrole.app.br/privacidade` |
| URL de eliminación de cuenta y datos (para Play) | `https://gestaoecontrole.app.br/excluir-conta` |
| Contacto público | `suporte@gestaoecontrole.app.br` |

> El package name es permanente: una vez subida la primera versión a Play no se puede cambiar.
> Si querés otro, decilo ANTES de generar el paquete (hay que cambiarlo también en `src/routes/assetlinks.js`).

## 1. Subir este bloque y verificar (5 min)

1. Descomprimir el zip, seleccionar el CONTENIDO y arrastrarlo a GitHub (Add file → Upload files). Un solo commit.
2. Esperar el build verde de Cloudflare.
3. Verificar en el navegador:
   - `https://gestaoecontrole.app.br/.well-known/assetlinks.json` → debe mostrar `[]` (todavía sin huella).
   - `https://gestaoecontrole.app.br/excluir-conta` → debe abrir la página nueva.
4. Si `.well-known/assetlinks.json` devolviera el index de la app en vez de `[]`, avisame: es que falta registrar la ruta en el Worker.

No hay SQL en este bloque.

## 2. Generar el paquete con PWABuilder

1. Entrar a https://www.pwabuilder.com, pegar `https://gestaoecontrole.app.br` y tocar Start.
2. Revisar el informe (manifest, service worker, seguridad). Lo de "offline" puede salir como aviso: no es requisito de Play.
3. Package for stores → Android → Google Play. Los nombres exactos de los campos pueden cambiar; los valores son:
   - Package ID: `br.app.gestaoecontrole`
   - App name: `Gestão & Controle` · Short name: `G&C`
   - App version: `1.0.0` · App version code: `1`
   - Host: `gestaoecontrole.app.br` · Start URL: `/index.html`
   - Display: standalone · Orientation: portrait
   - Theme color `#D98E04` · Background `#EDEAE1`
   - Notification delegation: **activada** (para que las notificaciones push de la 🔔 funcionen en el app)
   - Location delegation: desactivada (el app no usa GPS)
   - Google Play Billing: desactivada por ahora (la monetización viene después)
   - Signing key: dejar que PWABuilder genere una nueva ("New")
4. Descargar el zip. Adentro vienen el `.aab` (el que se sube a Play), la keystore, un archivo con las claves y un `assetlinks.json`.
5. **Guardar la keystore y sus contraseñas** en tu Mac y en una segunda copia (Drive privado o pendrive). Nunca en el repo ni en el chat.

## 3. Huella SHA-256 → variable de Cloudflare

La huella que importa depende de cómo firma Google:

- Con **Play App Signing** (lo normal), Google firma el app con su propia clave. La huella se ve en Play Console → tu app → Probar y publicar → Configuración → Integridad de la app (App signing key certificate → SHA-256).
- Poné también la huella de tu clave de subida (la que sale del zip de PWABuilder). Tener las dos no hace daño.

Cargarlas así:

1. Cloudflare → Workers → gestao-controle → Settings → **Variables y secretos → Runtime variables**.
2. Agregar `TWA_SHA256` con las huellas separadas por coma, formato `AA:BB:CC:...` (32 pares).
3. Guardar y desplegar. No hace falta subir código.
4. Verificar que `/.well-known/assetlinks.json` ahora muestra el package y las huellas.
5. Verificación oficial de Google (pegar en el navegador):
   `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://gestaoecontrole.app.br&relation=delegate_permission/common.handle_all_urls`

Si el app abre con una barra de URL arriba, es que esta verificación todavía no cierra (huella equivocada o variable sin desplegar).

## 4. Pruebas en el celular (pruebas internas de Play)

Instalar desde el link de pruebas internas y chequear, en este orden:

- [ ] Abre sin barra de navegador arriba (pantalla completa).
- [ ] El splash se ve entero y el ícono es el correcto.
- [ ] La barra "INSTALAR APLICATIVO" no aparece (ya está instalado).
- [ ] Login con e-mail+senha, con Google y con CPF+PIN.
- [ ] Link de convite recibido por WhatsApp: ¿abre dentro del app? (con la verificación hecha, debería).
- [ ] Fotos de etapa: 📷 Câmera y 🖼 Galeria, y permiso de cámara.
- [ ] 🔔 Ativar notificações: llega una notificación de prueba y, al tocarla, abre la obra.
- [ ] Celular Backup (descarga del zip a Descargas).
- [ ] **Drive Backup**: es el punto de más riesgo. Usa una ventana emergente de Google dentro del app; en un TWA puede no volver el resultado. Si falla, se esconde el botón dentro del app y se deja solo en la web.
- [ ] Botón de WhatsApp para enviar el convite y el reporte (abre `wa.me`).
- [ ] Exportar meus dados y Excluir minha conta (con una cuenta descartable).
- [ ] Tema oscuro y Tamanho da letra.

## 5. Antes de pedir producción

- [ ] Ficha de la tienda completa (ver `FICHA-PLAY.md`).
- [ ] Declaración de seguridad de datos (Data Safety) cargada.
- [ ] Cuenta demo creada y probada (ver `FICHA-PLAY.md`).
- [ ] Clasificación de contenido y público objetivo 18+.
- [ ] URL de política de privacidad y URL de eliminación de datos cargadas.
- [ ] Capturas de pantalla (mínimo 2, ideal 6-8) y gráfico de funciones 1024×500.

## Riesgos conocidos

1. **Drive Backup en TWA** (ver arriba).
2. **Google Play y pagos**: mientras el app no tenga precios ni botones de compra, no hay conflicto con la política de pagos. La monetización se decide en la fase siguiente.
3. **`user-scalable=no`** en el `viewport` de `index.html`: Play no lo rechaza, pero perjudica accesibilidad. Es un cambio chico y se puede hacer después.
