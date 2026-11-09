// G&C — app compilado de src/app/app.jsx (NÃO editar este arquivo: editar o app.jsx e rodar node src/build/compilar.mjs). Versão 64a7449d1409
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// ============================================================
// G&C — código do app (React + JSX).
// NÃO é publicado assim: `node src/build/compilar.mjs` gera o app.js (já compilado) e atualiza o index.html.
// (D2, 10/11/2026: antes o celular baixava o Babel e compilava este código a cada abertura.)
// ============================================================
const {
  useState,
  useEffect,
  useRef,
  useMemo
} = React;

// --- shim: localStorage acting like window.storage ---
window.storage = {
  get: async key => {
    const v = localStorage.getItem(key);
    return v !== null ? {
      key,
      value: v
    } : null;
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return {
      key,
      value
    };
  }
};
const TEMA_CLARO = {
  bg: "#EDEAE1",
  surface: "#FFFFFF",
  ink: "#262420",
  inkMuted: "#6B655C",
  border: "#D8D2C4",
  amber: "#D98E04",
  blue: "#35586F",
  rust: "#B54B33",
  green: "#4B7A51",
  steel: "#7A6A52",
  teal: "#3E7068"
};
const TEMA_ESCURO = {
  bg: "#1C1B19",
  surface: "#262420",
  ink: "#EDEAE1",
  inkMuted: "#A8A29A",
  border: "#3D3A35",
  amber: "#E8A33D",
  blue: "#7BA0BF",
  rust: "#E08769",
  green: "#7FB588",
  steel: "#B7A184",
  teal: "#6FBBA9"
};
// C referencia variables CSS: los valores reales se inyectan en el div raíz según o tema ativo.
// Isso permite trocar de tema sem reescrever cada componente que usa C.xxx.
const C = {
  bg: "var(--c-bg)",
  surface: "var(--c-surface)",
  ink: "var(--c-ink)",
  inkMuted: "var(--c-inkMuted)",
  border: "var(--c-border)",
  amber: "var(--c-amber)",
  blue: "var(--c-blue)",
  rust: "var(--c-rust)",
  green: "var(--c-green)",
  steel: "var(--c-steel)",
  teal: "var(--c-teal)"
};
const REG_CATS = {
  ferramenta: {
    label: "Ferramenta",
    color: C.steel,
    glyph: "🔧"
  },
  material: {
    label: "Material",
    color: C.amber,
    glyph: "📦"
  },
  pendencia: {
    label: "Pendência",
    color: C.rust,
    glyph: "⚠"
  }
};
const FUNCOES = ["Encarregado", "Oficial", "Ajudante", "Almoxarife", "Frete", "Outro"];
const RANK_LABELS = {
  1: "Dono",
  2: "Engenheiro Chefe de Obra",
  3: "Engenheiro Estagiário",
  4: "Mestre de Obra",
  5: "Encarregado",
  6: "Almoxarife",
  7: "Chefe de Turma",
  8: "Profissional"
};
const RANK_DESCRICOES = {
  1: "acesso total a todas as obras da empresa",
  2: "gerencia obras, equipe e conteúdo como o Dono",
  3: "mesmo nível de acesso que o Engenheiro Chefe",
  4: "gerencia etapas, equipe e conteúdo da obra",
  5: "carrega conteúdo, conclui etapas, gerencia equipe",
  6: "gerencia materiais e ferramentas, visualiza o resto",
  7: "só visualiza — não pode editar nada",
  8: "só visualiza Etapas e Documentos — sem acesso ao resto"
};
const ESTADOS = {
  ativa: {
    label: "ATIVA",
    color: C.blue,
    selo: "selo_ativa_8.webp"
  },
  pausada: {
    label: "PAUSADA",
    color: C.amber,
    selo: "selo_pausada_9.webp"
  },
  concluida: {
    label: "CONCLUÍDA",
    color: C.green,
    selo: "selo_concluida_10.webp"
  }
};
const uid = () => Math.random().toString(36).slice(2, 10);
// Data de HOJE no Brasil (não em UTC: depois das 21h o UTC já é "amanhã" e a presença era recusada).
const todayISO = () => new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Sao_Paulo"
});
const fmt = iso => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};
const fmtTs = ts => ts ? new Date(ts).toLocaleDateString("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
}) : "";
const daysAgo = iso => Math.floor((Date.now() - new Date(iso + "T00:00:00").getTime()) / 86400000);
const EMPTY = {
  obras: [],
  registros: [],
  etapas: [],
  avancos: [],
  equipe: [],
  documentos: []
};

// --- Auth local (sem backend): hash de senha, código de recuperação, WebAuthn ---
async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function randomCode(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}
function bufToBase64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlToBuf(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
}
const biometriaSuportada = () => typeof window !== "undefined" && !!window.PublicKeyCredential;

// --- Login propio (JWT contra /api/auth/*), reemplaza a Netlify Identity ---

// --- Turnstile (Cloudflare): "não sou um robô" sem semáforos. Quase sempre invisível; às vezes um tilde. ---
const TURNSTILE_SITE_KEY = "0x4AAAAAAFNL0jzkVfLaOEHc";
let turnstileScript = null;
function carregarTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileScript) {
    turnstileScript = new Promise((ok, falha) => {
      const sc = document.createElement("script");
      sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      sc.async = true;
      sc.onload = () => ok(window.turnstile);
      sc.onerror = () => {
        turnstileScript = null;
        falha(new Error("Turnstile não carregou"));
      };
      document.head.appendChild(sc);
    });
  }
  return turnstileScript;
}
// onToken(token) é chamado quando a verificação passa ("" quando vence). Trocar "chave" refaz a verificação.
function Turnstile({
  onToken,
  chave = 0
}) {
  const ref = useRef(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let id = null,
      vivo = true;
    onToken("");
    carregarTurnstile().then(ts => {
      if (!vivo || !ref.current) return;
      id = ts.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language: "pt-br",
        appearance: "interaction-only",
        callback: t => onToken(t),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken("")
      });
    }).catch(() => setErro("Não foi possível carregar a verificação. Confira sua internet e recarregue a página."));
    return () => {
      vivo = false;
      try {
        if (id !== null && window.turnstile) window.turnstile.remove(id);
      } catch (e) {}
    };
  }, [chave]);
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-3 flex flex-col items-center"
  }, /*#__PURE__*/React.createElement("div", {
    ref: ref
  }), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-1 text-center"
  }, erro));
}
async function apiSignup(email, password, nome, aceitouTermos, turnstile) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email,
      senha: password,
      nome,
      aceitouTermos,
      turnstile
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const e = new Error(data.error || "Não foi possível criar a conta.");
    e.codigo = data.codigo;
    throw e;
  }
  return data;
}
async function apiLogin(email, password, turnstile) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      email,
      senha: password,
      turnstile
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const e = new Error(data.error || "Email ou senha incorretos.");
    e.codigo = data.codigo;
    throw e;
  }
  return data;
}

// --- CPF + PIN e convite por link (WhatsApp) ---
function limparCpf(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 11);
}
function formatarCpf(v) {
  const c = limparCpf(v);
  return c.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}
function cpfValido(v) {
  const c = limparCpf(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dig = n => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = s * 10 % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(c[9]) && dig(10) === Number(c[10]);
}
function linkDoConvite(token) {
  return `${window.location.origin}/?convite=${token}`;
}
function urlWhatsApp(telefone, texto) {
  let t = String(telefone || "").replace(/\D/g, "");
  if (t.length === 10 || t.length === 11) t = "55" + t;
  return `https://wa.me/${t}?text=${encodeURIComponent(texto)}`;
}
async function apiPublica(path, body) {
  const res = await fetch(path, body ? {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const e = new Error(data.error || "Algo deu errado. Tente de novo.");
    e.codigo = data.codigo;
    throw e;
  }
  return data;
}
function saveSession(authData) {
  const session = {
    token: authData.token,
    usuario: authData.usuario
  };
  localStorage.setItem("gc-session", JSON.stringify(session));
  return session;
}
function getSession() {
  try {
    return JSON.parse(localStorage.getItem("gc-session"));
  } catch (e) {
    return null;
  }
}
function clearSession() {
  localStorage.removeItem("gc-session");
}

// Helper central: toda llamada a nuestras Functions pasa por acá.
// Agrega el token automáticamente y tira un error legible si el server rechaza.
async function apiFetch(path, opts = {}) {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  const headers = {
    authorization: `Bearer ${token}`,
    ...(opts.headers || {})
  };
  if (opts.body) headers["content-type"] = "application/json";
  const res = await fetch(path, {
    ...opts,
    headers
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || `Erro ${res.status}`);
    e.codigo = data.codigo;
    throw e;
  }
  // O servidor renovou a sessão (trocou senha/PIN, "Sair de todos os aparelhos"): guarda o token novo.
  if (data.novoToken) {
    const s = getSession();
    if (s) saveSession({
      ...s,
      token: data.novoToken
    });
  }
  return data;
}

// Só aceita arquivo que seja imagem, PDF, Word ou Excel de verdade (S1). Qualquer outra coisa
// (ex.: "javascript:..." ou uma página HTML disfarçada) é tratada como arquivo inexistente.
const TIPOS_ARQUIVO_OK = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"];
function arquivoSeguro(f) {
  if (!f || typeof f.dataUrl !== "string") return false;
  const m = f.dataUrl.slice(0, 200).match(/^data:([a-z0-9.+\/-]+);base64,/);
  return !!m && TIPOS_ARQUIVO_OK.includes(m[1]);
}

// El token propio dura 30 dias (definido en el backend); si el servidor lo rechaza (401),
// el propio apiFetch/carregarUsuarioAPI limpia la sesión. No hay refresh — más simple, alcanza para esta etapa.
async function getValidAccessToken() {
  const session = getSession();
  return session?.token || null;
}

// Arquivos (fotos/documentos): autorizados com a sessão do usuário (JWT), e o servidor
// confere se o arquivo é de uma obra a que ele tem acesso. Ids de arquivo = UUID (não adivinháveis).
const novoIdArquivo = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
const cabecalhoAuth = () => {
  const t = getSession()?.token;
  return t ? {
    authorization: `Bearer ${t}`
  } : {};
};
function compressImage(file, maxWidth = 800, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
const EXT_IMAGEM = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "svg"];
function isImagemDoc(doc) {
  if (doc.tipo && doc.tipo.startsWith("image/")) return true;
  const ext = (doc.nome || "").split(".").pop().toLowerCase();
  return EXT_IMAGEM.includes(ext);
}

// Formatos permitidos en Documentos: planos (PDF), administrativo (Word/Excel), fotos.
// Nada de video: es justo lo que más pesa el bandwidth sin aportar tanto valor acá.
const TIPO_MIME_DOC = {
  "application/pdf": "pdf",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.ms-excel": "excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "image/jpeg": "imagem",
  "image/png": "imagem"
};
const TIPO_EXT_DOC = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "excel",
  xlsx: "excel",
  jpg: "imagem",
  jpeg: "imagem",
  png: "imagem"
};
function categoriaDoc(doc) {
  if (doc.tipo && TIPO_MIME_DOC[doc.tipo]) return TIPO_MIME_DOC[doc.tipo];
  const ext = (doc.nome || "").split(".").pop().toLowerCase();
  return TIPO_EXT_DOC[ext] || "outro";
}
const ICONE_DOC = {
  pdf: "📕",
  word: "📘",
  excel: "📗",
  outro: "📄"
};
function StampBadge({
  estado,
  onClick,
  grande = false,
  enorme = false
}) {
  const e = ESTADOS[estado];
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: "Toque para mudar o estado",
    style: {
      transform: "rotate(-8deg)"
    },
    className: "shrink-0 bg-transparent hover:opacity-70 transition"
  }, /*#__PURE__*/React.createElement("img", {
    src: e.selo,
    alt: e.label,
    className: enorme ? "w-full h-auto object-contain" : grande ? "h-10 w-auto object-contain" : "h-7 w-auto object-contain",
    draggable: "false"
  }));
}
function EtapaFotosGaleria({
  etapaId,
  fileCache,
  loadFile,
  onViewImage,
  onAddFoto,
  onDeleteFoto,
  podeEditar,
  saveArquivo
}) {
  const [fotos, setFotos] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState("");
  const inputRef = useRef(null); // 📷 câmera
  const galeriaRef = useRef(null); // 🖼 galeria (várias de uma vez)
  const [progresso, setProgresso] = useState("");
  const carregar = async () => {
    try {
      const r = await apiFetch(`/api/etapa-fotos?etapa_id=${etapaId}`);
      setFotos(r.fotos);
    } catch (err) {
      setFotos([]);
    }
  };
  useEffect(() => {
    carregar();
  }, [etapaId]);

  // Câmera ou galeria: cada foto é reduzida no celular (800 px, ~100 KB) antes de enviar — economiza dados
  // e apaga a localização (GPS) da foto. Da galeria dá para escolher várias; vão uma por uma.
  const handleAdd = async e => {
    const arquivos = [...(e.target.files || [])].filter(f => f.type.startsWith("image/")).slice(0, 10);
    e.target.value = "";
    if (!arquivos.length) return;
    setUploading(true);
    setErro("");
    let feitas = 0;
    for (const file of arquivos) {
      if (arquivos.length > 1) setProgresso(`${feitas + 1}/${arquivos.length}`);
      try {
        const dataUrl = await compressImage(file);
        const fotoId = novoIdArquivo();
        const ok = await saveArquivo(fotoId, {
          nome: "avanco.jpg",
          tipo: "image/jpeg",
          dataUrl
        });
        if (ok !== true) {
          setErro(`Não foi possível salvar: ${ok?.erro || "erro desconhecido"}`);
          break;
        }
        await onAddFoto(etapaId, fotoId);
        feitas++;
      } catch (err) {
        setErro(err.message);
        break;
      }
    }
    await carregar();
    setProgresso("");
    setUploading(false);
  };
  const handleDelete = async fotoRowId => {
    if (!window.confirm("Apagar esta foto?")) return;
    try {
      await onDeleteFoto(fotoRowId);
      await carregar();
    } catch (err) {
      setErro(err.message);
    }
  };
  if (fotos === null) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "mt-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 flex-wrap"
  }, fotos.map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "relative"
  }, /*#__PURE__*/React.createElement(Thumbnail, {
    fotoId: f.arquivo_id,
    fileCache: fileCache,
    loadFile: loadFile,
    onView: onViewImage
  }), podeEditar && /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDelete(f.id),
    style: {
      background: C.rust
    },
    className: "absolute -top-1.5 -right-1.5 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow"
  }, "\xD7"))), podeEditar && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: "image/*",
    capture: "environment",
    onChange: handleAdd,
    className: "hidden"
  }), /*#__PURE__*/React.createElement("input", {
    ref: galeriaRef,
    type: "file",
    accept: "image/*",
    multiple: true,
    onChange: handleAdd,
    className: "hidden"
  }), uploading ? /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border,
      color: C.inkMuted
    },
    className: "w-16 h-16 border-2 border-dashed rounded shrink-0 flex items-center justify-center text-xs font-mono"
  }, progresso || "…") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => inputRef.current?.click(),
    title: "Tirar foto",
    "aria-label": "Tirar foto com a c\xE2mera",
    style: {
      borderColor: C.border,
      color: C.inkMuted
    },
    className: "w-16 h-16 border-2 border-dashed rounded shrink-0 flex flex-col items-center justify-center text-xl leading-none"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCF7"), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono uppercase mt-1"
  }, "C\xE2mera")), /*#__PURE__*/React.createElement("button", {
    onClick: () => galeriaRef.current?.click(),
    title: "Escolher da galeria",
    "aria-label": "Escolher fotos da galeria",
    style: {
      borderColor: C.border,
      color: C.inkMuted
    },
    className: "w-16 h-16 border-2 border-dashed rounded shrink-0 flex flex-col items-center justify-center text-xl leading-none"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDDBC"), /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] font-mono uppercase mt-1"
  }, "Galeria"))))), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-[11px] font-mono mt-1"
  }, erro));
}
function Thumbnail({
  fotoId,
  fileCache,
  loadFile,
  onView
}) {
  useEffect(() => {
    if (!fileCache[fotoId]) loadFile(fotoId);
  }, [fotoId]);
  const file = fileCache[fotoId];
  if (file === "MISSING") return /*#__PURE__*/React.createElement("div", {
    title: "Foto n\xE3o encontrada (falha ao salvar)",
    style: {
      background: C.bg,
      borderColor: C.rust,
      color: C.rust
    },
    className: "w-16 h-16 rounded border-2 border-dashed shrink-0 flex items-center justify-center text-lg"
  }, "\u26A0");
  if (!file) return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.border
    },
    className: "w-16 h-16 rounded animate-pulse shrink-0"
  });
  return /*#__PURE__*/React.createElement("img", {
    src: file.dataUrl,
    alt: "",
    onClick: () => onView && onView(file.dataUrl),
    className: "w-16 h-16 object-cover rounded border shrink-0 cursor-pointer active:opacity-70",
    style: {
      borderColor: C.border
    }
  });
}
function EditableRow({
  glyph,
  color,
  label,
  dateStr,
  text,
  onSave,
  onDelete,
  extra
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  if (editing) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.surface,
        borderLeftColor: color
      },
      className: "border-l-4 rounded-r-md p-3 shadow-sm"
    }, /*#__PURE__*/React.createElement("textarea", {
      value: val,
      onChange: e => setVal(e.target.value),
      rows: 2,
      style: {
        borderColor: C.border,
        color: C.ink
      },
      className: "w-full border rounded px-2 py-1.5 text-sm outline-none resize-none mb-2",
      autoFocus: true
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        onSave(val);
        setEditing(false);
      },
      style: {
        background: C.green
      },
      className: "text-white text-xs font-bold uppercase rounded px-2.5 py-1"
    }, "\uD83D\uDCBE Salvar"), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setVal(text);
        setEditing(false);
      },
      style: {
        color: C.inkMuted,
        borderColor: C.border
      },
      className: "border text-xs font-bold uppercase rounded px-2.5 py-1"
    }, "Cancelar")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      borderLeftColor: color
    },
    className: "border-l-4 rounded-r-md p-3 shadow-sm flex gap-3 group"
  }, glyph && /*#__PURE__*/React.createElement("span", {
    className: "mt-0.5 shrink-0"
  }, glyph), /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      color
    },
    className: "text-[11px] font-bold uppercase tracking-wide"
  }, label), dateStr && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono"
  }, dateStr)), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm mt-0.5"
  }, text), extra), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 shrink-0"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditing(true),
    style: {
      color: C.inkMuted
    }
  }, "\u270E"), /*#__PURE__*/React.createElement("button", {
    onClick: onDelete,
    style: {
      color: C.rust
    }
  }, "\uD83D\uDDD1")));
}
function ConfirmarLimpezaModal({
  onClose,
  onConfirm
}) {
  const [texto, setTexto] = useState("");
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-6 w-full max-w-sm shadow-xl"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.rust
    },
    className: "text-lg font-extrabold uppercase tracking-wide mb-2"
  }, "\u26A0 Limpar todos os dados"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm mb-3"
  }, "Isso vai apagar TODAS as obras, etapas, fotos, documentos e equipe deste aparelho. Sua conta e login continuam. N\xE3o pode ser desfeito \u2014 fa\xE7a um backup antes se ainda n\xE3o fez."), /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Digite LIMPAR para confirmar"), /*#__PURE__*/React.createElement("input", {
    value: texto,
    onChange: e => setTexto(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none uppercase",
    autoFocus: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 border font-bold uppercase tracking-wide text-sm rounded py-2.5"
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    onClick: onConfirm,
    disabled: texto.trim().toUpperCase() !== "LIMPAR",
    style: {
      background: C.rust
    },
    className: "flex-1 text-white font-bold uppercase tracking-wide text-sm rounded py-2.5 disabled:opacity-40"
  }, "Limpar"))));
}
function NuevaObraModal({
  onClose,
  onSave,
  obras = [],
  equipe = []
}) {
  const [cliente, setCliente] = useState("");
  const [endereco, setEndereco] = useState("");
  const [tipo, setTipo] = useState("");
  const [dataInicio, setDataInicio] = useState(todayISO());
  const [responsavelId, setResponsavelId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const clientesHistoricos = [...new Set(obras.map(o => o.cliente).filter(Boolean))];
  const tiposHistoricos = [...new Set(obras.map(o => o.tipo).filter(Boolean))];
  const submit = async () => {
    if (!cliente.trim()) return;
    setErro("");
    setSalvando(true);
    try {
      await onSave({
        cliente: cliente.trim(),
        endereco: endereco.trim(),
        tipo: tipo.trim(),
        dataInicio,
        responsavelId: responsavelId || null
      });
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-6 w-full max-w-md shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-4"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide"
  }, "Nova obra"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.inkMuted
    },
    className: "text-xl"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Cliente"), /*#__PURE__*/React.createElement("input", {
    value: cliente,
    onChange: e => setCliente(e.target.value),
    list: "clientes-historicos",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none",
    placeholder: "Nome do cliente",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Endere\xE7o"), /*#__PURE__*/React.createElement("input", {
    value: endereco,
    onChange: e => setEndereco(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none",
    placeholder: "Bairro / endere\xE7o"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Tipo de trabalho"), /*#__PURE__*/React.createElement("input", {
    value: tipo,
    onChange: e => setTipo(e.target.value),
    list: "tipos-historicos",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none",
    placeholder: "Ex: reforma el\xE9trica, pintura"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Data de in\xEDcio"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: dataInicio,
    onChange: e => setDataInicio(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Respons\xE1vel"), /*#__PURE__*/React.createElement("select", {
    value: responsavelId,
    onChange: e => setResponsavelId(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 eu mesmo \u2014"), equipe.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.usuario_id,
    value: m.usuario_id
  }, m.nome)))), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono"
  }, erro)), /*#__PURE__*/React.createElement("datalist", {
    id: "clientes-historicos"
  }, clientesHistoricos.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }))), /*#__PURE__*/React.createElement("datalist", {
    id: "tipos-historicos"
  }, tiposHistoricos.map(t => /*#__PURE__*/React.createElement("option", {
    key: t,
    value: t
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: !cliente.trim() || salvando,
    style: {
      background: C.amber
    },
    className: "w-full mt-5 text-white font-bold uppercase tracking-wide rounded py-2.5 disabled:opacity-40"
  }, salvando ? "Criando..." : "Criar obra")));
}
function EditarObraModal({
  obra,
  equipe,
  onClose,
  onSave
}) {
  const [cliente, setCliente] = useState(obra.cliente || "");
  const [endereco, setEndereco] = useState(obra.endereco || "");
  const [tipo, setTipo] = useState(obra.tipo || "");
  const [responsavelId, setResponsavelId] = useState(obra.responsavel_id || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const submit = async () => {
    if (!cliente.trim()) return;
    setErro("");
    setSalvando(true);
    try {
      await onSave({
        cliente: cliente.trim(),
        endereco: endereco.trim(),
        tipo: tipo.trim(),
        novoResponsavelId: responsavelId || null
      });
      onClose();
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-6 w-full max-w-md shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-4"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide"
  }, "Editar obra"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.inkMuted
    },
    className: "text-xl"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Cliente"), /*#__PURE__*/React.createElement("input", {
    value: cliente,
    onChange: e => setCliente(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Endere\xE7o"), /*#__PURE__*/React.createElement("input", {
    value: endereco,
    onChange: e => setEndereco(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Tipo de trabalho"), /*#__PURE__*/React.createElement("input", {
    value: tipo,
    onChange: e => setTipo(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Respons\xE1vel"), /*#__PURE__*/React.createElement("select", {
    value: responsavelId,
    onChange: e => setResponsavelId(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 sem respons\xE1vel \u2014"), equipe.map(m => /*#__PURE__*/React.createElement("option", {
    key: m.usuario_id,
    value: m.usuario_id
  }, m.nome)))), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono"
  }, erro)), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: !cliente.trim() || salvando,
    style: {
      background: C.amber
    },
    className: "w-full mt-5 text-white font-bold uppercase tracking-wide rounded py-2.5 disabled:opacity-40"
  }, salvando ? "Salvando..." : "Salvar alterações")));
}
function CollapsibleSection({
  title,
  defaultOpen = true,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      borderColor: C.border
    },
    className: "border rounded-md mb-5"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(!open),
    className: "w-full flex items-center justify-between p-4"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, title), /*#__PURE__*/React.createElement("span", null, open ? "🔺" : "🔻")), open && /*#__PURE__*/React.createElement("div", {
    className: "px-4 pb-4"
  }, children));
}
function DocumentosSection({
  obraId,
  documentos,
  onAdd,
  onDelete,
  fileCache,
  loadFile,
  saveArquivo,
  onViewImage,
  podeEditar = true
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState("");
  const [pdfAberto, setPdfAberto] = useState(null);
  const list = documentos;
  const handleFile = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const categoria = categoriaDoc({
      tipo: file.type,
      nome: file.name
    });
    if (categoria === "outro") {
      setErro("Formato não suportado. Apenas PDF, Word (.doc/.docx), Excel (.xls/.xlsx), JPG ou PNG.");
      e.target.value = "";
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      alert("O arquivo é muito grande (máx ~4MB).");
      e.target.value = "";
      return;
    }
    setErro("");
    setUploading(true);
    try {
      const dataUrl = await fileToDataURL(file);
      const arquivoId = novoIdArquivo();
      const ok = await saveArquivo(arquivoId, {
        nome: file.name,
        tipo: file.type,
        dataUrl
      });
      if (ok === true) {
        await onAdd({
          obraId,
          nome: file.name,
          tipo: file.type,
          arquivoId
        });
      } else {
        alert(`Não foi possível salvar o arquivo: ${ok?.erro || "erro desconhecido"}`);
      }
    } catch (err) {
      setErro(err.message || "Não foi possível processar o arquivo.");
    }
    setUploading(false);
    e.target.value = "";
  };
  useEffect(() => {
    list.forEach(d => {
      if (!fileCache[d.arquivo_id]) loadFile(d.arquivo_id);
    });
  }, [obraId, list.map(d => d.arquivo_id).join(",")]);
  const download = doc => {
    const f = fileCache[doc.arquivo_id];
    if (!f || f === "MISSING") return;
    const a = document.createElement("a");
    a.href = f.dataUrl;
    a.download = doc.nome;
    a.click();
  };
  const abrir = doc => {
    const f = fileCache[doc.arquivo_id];
    if (!f || f === "MISSING") return;
    const categoria = categoriaDoc(doc);
    if (categoria === "imagem") onViewImage(f.dataUrl);else if (categoria === "pdf") setPdfAberto({
      src: f.dataUrl,
      nome: doc.nome
    });else download(doc);
  };
  const remover = async doc => {
    setErro("");
    try {
      await onDelete(doc.id, doc.arquivo_id);
    } catch (err) {
      setErro(err.message);
    }
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2 mb-3"
  }, list.map(d => {
    const categoria = categoriaDoc(d);
    const f = fileCache[d.arquivo_id];
    const faltando = f === "MISSING";
    return /*#__PURE__*/React.createElement("div", {
      key: d.id,
      className: "relative flex flex-col items-center gap-1"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => abrir(d),
      disabled: faltando,
      style: {
        background: C.bg,
        borderColor: faltando ? C.rust : C.border
      },
      className: "w-full aspect-square border rounded-lg overflow-hidden flex items-center justify-center disabled:opacity-60"
    }, categoria === "imagem" && f && !faltando ? /*#__PURE__*/React.createElement("img", {
      src: f.dataUrl,
      className: "w-full h-full object-cover"
    }) : /*#__PURE__*/React.createElement("span", {
      className: "text-3xl"
    }, faltando ? "⚠" : ICONE_DOC[categoria])), podeEditar && /*#__PURE__*/React.createElement("button", {
      onClick: () => remover(d),
      style: {
        background: C.rust
      },
      className: "absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs leading-none shadow"
    }, "\xD7"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: faltando ? C.rust : C.inkMuted
      },
      className: "text-[10px] font-mono text-center truncate w-full px-0.5"
    }, d.nome, faltando ? " (indisp.)" : ""));
  }), list.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono col-span-3"
  }, "Nenhum documento anexado.")), !podeEditar && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono"
  }, "Seu n\xEDvel de acesso \xE9 somente visualiza\xE7\xE3o neste m\xF3dulo."), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mb-2"
  }, erro), podeEditar && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    ref: inputRef,
    type: "file",
    accept: ".pdf,.doc,.docx,.xls,.xlsx,image/jpeg,image/png",
    onChange: handleFile,
    className: "hidden"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => inputRef.current?.click(),
    disabled: uploading,
    style: {
      background: C.ink
    },
    className: "text-white font-bold uppercase tracking-wide text-sm rounded px-4 py-2 disabled:opacity-50"
  }, "+ ", uploading ? "Enviando..." : "Adicionar projeto"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[10px] font-mono mt-1.5"
  }, "PDF, Word, Excel, JPG ou PNG \u2014 at\xE9 4MB.")), pdfAberto && /*#__PURE__*/React.createElement(PdfViewer, {
    src: pdfAberto.src,
    nome: pdfAberto.nome,
    onClose: () => setPdfAberto(null)
  }));
}
function EquipeSection({
  obraId,
  equipe,
  onAdd,
  onRemove,
  onToggleHoje,
  onSetExcecao,
  usuarioRank,
  usuarioId,
  usuarioNome,
  donoPrincipal = false,
  responsavelId,
  podeEditar = true
}) {
  const souResponsavel = usuarioId != null && usuarioId === responsavelId;
  // Hierarquia (05/10): superior estrito; entre dois Donos, o principal fica acima.
  const souSuperiorDe = m => m.usuario_id !== usuarioId && (usuarioRank < m.rank || usuarioRank === 1 && m.rank === 1 && donoPrincipal);
  const possoMudarRanks = [1, 2, 4].includes(usuarioRank);
  const [email, setEmail] = useState("");
  const [funcao, setFuncao] = useState("");
  const [rank, setRank] = useState(usuarioRank + 1 <= 8 ? usuarioRank + 1 : 8);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excecaoAberta, setExcecaoAberta] = useState(null);
  const [modoAdd, setModoAdd] = useState("link"); // "link" (WhatsApp) | "email"
  const [nomeNovo, setNomeNovo] = useState("");
  const [telNovo, setTelNovo] = useState("");
  const [linkGerado, setLinkGerado] = useState(null); // { link, nome, telefone, novoPin }
  const [genteEmpresa, setGenteEmpresa] = useState(null); // pra "Da empresa"
  const [pessoaEscolhida, setPessoaEscolhida] = useState("");
  const [edicao, setEdicao] = useState({
    rank: 8,
    funcao: ""
  }); // painel ⚙
  const list = equipe;
  const hoje = todayISO();
  const funcoesHistoricas = [...new Set([...FUNCOES, ...equipe.map(m => m.funcao).filter(Boolean)])];
  const ranksDisponiveis = [1, 2, 3, 4, 5, 6, 7, 8].filter(r => r > usuarioRank || r === 1 && usuarioRank === 1 && donoPrincipal);
  const submit = async () => {
    if (!email.trim()) return;
    setErro("");
    setMsg("");
    setSalvando(true);
    try {
      const r = await onAdd({
        obraId,
        email: email.trim(),
        rank,
        funcao: funcao.trim()
      });
      if (r.convite && r.token) {
        setLinkGerado({
          link: linkDoConvite(r.token),
          nome: email.trim().split("@")[0],
          telefone: "",
          novoPin: false
        });
        setMsg("Ainda não tem conta: mande o link abaixo (ou ele entra com o Google usando esse email).");
      } else {
        setMsg(r.convite ? `Convite criado para ${email.trim()}.` : "Adicionado.");
      }
      setEmail("");
      setFuncao("");
    } catch (err) {
      setErro(err.message);
    }
    setSalvando(false);
  };
  const convidarPorLink = async () => {
    if (!nomeNovo.trim()) return;
    setErro("");
    setMsg("");
    setSalvando(true);
    try {
      const r = await apiFetch("/api/convite-link", {
        method: "POST",
        body: JSON.stringify({
          obraId,
          nome: nomeNovo.trim(),
          telefone: telNovo,
          rank,
          funcao: funcao.trim()
        })
      });
      setLinkGerado({
        link: linkDoConvite(r.token),
        nome: nomeNovo.trim(),
        telefone: telNovo,
        novoPin: false
      });
      setNomeNovo("");
      setTelNovo("");
      setFuncao("");
    } catch (err) {
      setErro(err.message);
    }
    setSalvando(false);
  };
  const gerarNovoPin = async (m, cpf) => {
    setErro("");
    setMsg("");
    try {
      const r = await apiFetch("/api/convite-link", {
        method: "POST",
        body: JSON.stringify({
          usuarioId: m.usuario_id,
          cpf
        })
      });
      setLinkGerado({
        link: linkDoConvite(r.token),
        nome: m.nome,
        telefone: r.convite.telefone || "",
        novoPin: true
      });
    } catch (err) {
      // Pessoa sem CPF na conta: o link só vale para o CPF que o chefe informar (segurança).
      if (err.codigo === "precisa_cpf") {
        const digitado = window.prompt(`${err.message}\n\nCPF de ${m.nome}:`, cpf || "");
        if (digitado) return gerarNovoPin(m, digitado);
        return;
      }
      setErro(err.message);
    }
  };
  const remover = async m => {
    setErro("");
    try {
      await onRemove(m.id);
    } catch (err) {
      setErro(err.message);
    }
  };
  const marcarPresenca = async m => {
    setErro("");
    try {
      await onToggleHoje(m.id, hoje);
    } catch (err) {
      setErro(err.message);
    }
  };
  const toggleBloqueio = async (m, moduloKey) => {
    setErro("");
    const atual = m.excecao_modulos || {};
    const bloqueado = atual[moduloKey] === "nenhum";
    const novo = {
      ...atual
    };
    if (bloqueado) delete novo[moduloKey];else novo[moduloKey] = "nenhum";
    try {
      await onSetExcecao(m.id, {
        excecaoModulos: Object.keys(novo).length > 0 ? novo : null
      });
    } catch (err) {
      setErro(err.message);
    }
  };
  const abrirPainel = m => {
    if (excecaoAberta === m.id) {
      setExcecaoAberta(null);
      return;
    }
    setEdicao({
      rank: m.rank,
      funcao: m.funcao || ""
    });
    setExcecaoAberta(m.id);
  };
  const excluirConta = async m => {
    if (window.prompt(`Excluir a conta de ${m.nome}? Ele não vai mais conseguir entrar, os dados pessoais dele são apagados e os registros dele ficam como "Usuário removido". Digite EXCLUIR para confirmar.`) !== "EXCLUIR") return;
    setErro("");
    setMsg("");
    try {
      await apiFetch(`/api/usuarios-me?id=${m.usuario_id}`, {
        method: "DELETE"
      });
      await onSetExcecao(m.id, {}); // PATCH vazio: só recarrega o integrante (agora com removido_em)
      setExcecaoAberta(null);
      setMsg(`Conta de ${m.nome} excluída.`);
    } catch (err) {
      setErro(err.message);
    }
  };
  const salvarMembro = async m => {
    setErro("");
    setMsg("");
    const campos = {
      funcao: edicao.funcao
    };
    if (possoMudarRanks && souSuperiorDe(m) && m.rank !== 1 && Number(edicao.rank) !== m.rank) campos.rank = Number(edicao.rank);
    try {
      await onSetExcecao(m.id, campos);
      setMsg(`${m.nome} atualizado.`);
      setExcecaoAberta(null);
    } catch (err) {
      setErro(err.message);
    }
  };
  const escolherModo = async modo => {
    setModoAdd(modo);
    if (modo === "empresa") {
      try {
        const r = await apiFetch("/api/equipe");
        setGenteEmpresa(r.equipe);
      } catch (err) {
        setErro(err.message);
      }
    }
  };
  const adicionarDaEmpresa = async () => {
    if (!pessoaEscolhida) return;
    const p = (genteEmpresa || []).find(x => String(x.usuario_id) === String(pessoaEscolhida));
    setErro("");
    setMsg("");
    setSalvando(true);
    try {
      await onAdd({
        obraId,
        usuarioId: Number(pessoaEscolhida),
        funcao: funcao.trim()
      });
      setMsg(`${p ? p.nome : "Pessoa"} adicionado à obra.`);
      setPessoaEscolhida("");
      setFuncao("");
    } catch (err) {
      setErro(err.message);
    }
    setSalvando(false);
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mb-3"
  }, list.map(m => {
    const presenteHoje = m.asistencias?.includes(hoje);
    const anotacaoHoje = m.presencas_por?.[hoje] || null;
    // Presença: cada um a sua; um superior com "editar" só ANOTA (e só desfaz o que foi anotado, não o que a pessoa marcou).
    const podeMarcar = m.usuario_id === usuarioId || podeEditar && souSuperiorDe(m) && (!presenteHoje || !!anotacaoHoje);
    const temExcecao = m.excecao_modulos && Object.keys(m.excecao_modulos).length > 0;
    const ausente = !!m.removido_em;
    if (ausente) {
      return /*#__PURE__*/React.createElement("div", {
        key: m.id,
        style: {
          background: C.bg,
          borderColor: C.border,
          opacity: 0.6
        },
        className: "border rounded px-3 py-2 flex items-center gap-2"
      }, /*#__PURE__*/React.createElement("div", {
        className: "flex-1 min-w-0 truncate"
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.inkMuted
        },
        className: "font-semibold text-sm italic"
      }, "Usu\xE1rio removido"), /*#__PURE__*/React.createElement("div", {
        style: {
          color: C.inkMuted
        },
        className: "text-[11px] font-mono truncate"
      }, "conta exclu\xEDda \xB7 ", RANK_LABELS[m.rank])), /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.inkMuted
        },
        className: "text-xs font-mono shrink-0"
      }, m.asistencias?.length || 0, "d"), podeEditar && souSuperiorDe(m) && /*#__PURE__*/React.createElement("button", {
        onClick: () => remover(m),
        title: "Tirar da lista desta obra",
        style: {
          color: C.inkMuted
        },
        className: "shrink-0"
      }, "\xD7"));
    }
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      style: {
        background: C.bg,
        borderColor: C.border
      },
      className: "border rounded px-3 py-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => podeMarcar && marcarPresenca(m),
      disabled: !podeMarcar,
      "aria-label": presenteHoje ? "Presente hoje" : "Ausente hoje",
      title: m.usuario_id === usuarioId ? "Marcar minha presença hoje" : anotacaoHoje ? `Presente — anotada por ${anotacaoHoje.nome}` : presenteHoje ? "Presente — marcada pela própria pessoa" : podeMarcar ? "Ausente — toque para marcar presente (fica registrado que foi você)" : "Ausente",
      style: {
        borderColor: presenteHoje ? C.green : C.rust,
        background: presenteHoje ? C.green : "transparent",
        color: presenteHoje ? "#fff" : C.rust
      },
      className: "w-6 h-6 border-2 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
    }, presenteHoje ? "✓" : "✕"), /*#__PURE__*/React.createElement("div", {
      className: "flex-1 min-w-0 truncate"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.ink
      },
      className: "font-semibold text-sm"
    }, m.nome), " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.inkMuted
      },
      className: "text-xs font-mono uppercase"
    }, "\xB7 ", m.rank === 8 && m.funcao ? m.funcao : RANK_LABELS[m.rank]), /*#__PURE__*/React.createElement("div", {
      style: {
        color: C.inkMuted
      },
      className: "text-[11px] font-mono truncate"
    }, m.rank === 8 ? m.funcao ? `${RANK_LABELS[8]} · ` : "" : m.funcao ? `${m.funcao} · ` : "", m.email || (m.usuario_id === usuarioId || souSuperiorDe(m) ? "entra com CPF" : ""), temExcecao ? " · acesso personalizado" : "", anotacaoHoje ? ` · presença anotada por ${anotacaoHoje.nome}` : "")), /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.inkMuted
      },
      className: "text-xs font-mono shrink-0"
    }, m.asistencias?.length || 0, "d"), podeEditar && /*#__PURE__*/React.createElement("button", {
      onClick: () => abrirPainel(m),
      style: {
        color: temExcecao ? C.amber : C.inkMuted
      },
      title: "Editar rank, fun\xE7\xE3o e acesso",
      className: "shrink-0"
    }, "\u2699"), podeEditar && usuarioRank <= 2 && m.rank > usuarioRank && /*#__PURE__*/React.createElement("button", {
      onClick: () => gerarNovoPin(m),
      title: "Novo PIN (manda link por WhatsApp)",
      style: {
        color: C.inkMuted
      },
      className: "shrink-0"
    }, "\uD83D\uDD11"), podeEditar && souSuperiorDe(m) && m.usuario_id !== responsavelId && /*#__PURE__*/React.createElement("button", {
      onClick: () => remover(m),
      title: "Tirar desta obra",
      style: {
        color: C.inkMuted
      },
      className: "shrink-0"
    }, "\xD7")), excecaoAberta === m.id && /*#__PURE__*/React.createElement("div", {
      style: {
        borderColor: C.border
      },
      className: "mt-2 pt-2 border-t"
    }, possoMudarRanks && souSuperiorDe(m) && m.rank !== 1 || souResponsavel && souSuperiorDe(m) ? /*#__PURE__*/React.createElement("div", {
      className: "mb-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-2 items-center"
    }, /*#__PURE__*/React.createElement("select", {
      value: edicao.rank,
      disabled: !possoMudarRanks || m.rank === 1,
      onChange: e => setEdicao({
        ...edicao,
        rank: Number(e.target.value)
      }),
      style: {
        borderColor: C.border,
        color: C.ink
      },
      className: "border rounded px-1 py-1.5 text-xs outline-none bg-white"
    }, [...new Set([m.rank, ...ranksDisponiveis])].sort((a, b) => a - b).map(r => /*#__PURE__*/React.createElement("option", {
      key: r,
      value: r
    }, RANK_LABELS[r], r === 1 ? " (co-Dono)" : ""))), /*#__PURE__*/React.createElement("input", {
      value: edicao.funcao,
      onChange: e => setEdicao({
        ...edicao,
        funcao: e.target.value
      }),
      placeholder: edicao.rank === 8 ? "Ofício (ex.: Pedreiro)" : "Função nesta obra",
      list: "funcoes-equipe",
      style: {
        borderColor: C.border,
        color: C.ink
      },
      className: "flex-1 min-w-[7rem] border rounded px-2 py-1.5 text-xs outline-none"
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => salvarMembro(m),
      style: {
        background: C.teal
      },
      className: "text-white rounded px-3 py-1.5 text-xs font-bold uppercase"
    }, "Salvar")), /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-[11px] font-mono mt-1"
    }, "O rank vale para todas as obras; a fun\xE7\xE3o, s\xF3 para esta.")) : /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-[11px] font-mono mb-2"
    }, m.rank === 1 ? "Mudar ou excluir um Dono é feito pelo suporte (suporte@gestaoecontrole.app.br)." : "Só Dono, Engenheiro Chefe e Mestre de Obra mudam o rank, e só de quem está abaixo deles."), souResponsavel && souSuperiorDe(m) ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-[11px] font-mono mb-1.5"
    }, "Bloquear acesso NESTA obra a (voc\xEA \xE9 o respons\xE1vel):"), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-2"
    }, MODULOS_OBRA.map(mod => {
      const bloqueado = m.excecao_modulos?.[mod.key] === "nenhum";
      return /*#__PURE__*/React.createElement("button", {
        key: mod.key,
        onClick: () => toggleBloqueio(m, mod.key),
        style: {
          borderColor: bloqueado ? C.rust : C.border,
          background: bloqueado ? C.rust : "transparent",
          color: bloqueado ? "#fff" : C.inkMuted
        },
        className: "border rounded px-2 py-1 text-[11px] font-mono"
      }, mod.glyph, " ", mod.label);
    }))) : /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-[11px] font-mono"
    }, "S\xF3 o respons\xE1vel da obra bloqueia m\xF3dulos nesta obra."), usuarioRank < m.rank && m.usuario_id !== usuarioId && /*#__PURE__*/React.createElement("button", {
      onClick: () => excluirConta(m),
      style: {
        color: C.rust
      },
      className: "mt-3 text-[11px] font-mono uppercase"
    }, "\uD83D\uDEAB Excluir conta (os registros ficam como \"Usu\xE1rio removido\")")));
  }), list.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono"
  }, "Sem equipe atribu\xEDda.")), !podeEditar && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono"
  }, "Seu n\xEDvel de acesso \xE9 somente visualiza\xE7\xE3o neste m\xF3dulo."), podeEditar && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex mb-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => escolherModo("link"),
    style: {
      background: modoAdd === "link" ? C.teal : "transparent",
      color: modoAdd === "link" ? "#fff" : C.inkMuted,
      borderColor: C.teal
    },
    className: "flex-1 border rounded-l py-1.5 text-[11px] font-bold uppercase"
  }, "\uD83D\uDCF2 Novo por link"), /*#__PURE__*/React.createElement("button", {
    onClick: () => escolherModo("empresa"),
    style: {
      background: modoAdd === "empresa" ? C.teal : "transparent",
      color: modoAdd === "empresa" ? "#fff" : C.inkMuted,
      borderColor: C.teal
    },
    className: "flex-1 border-y py-1.5 text-[11px] font-bold uppercase"
  }, "\uD83D\uDC65 Da empresa"), /*#__PURE__*/React.createElement("button", {
    onClick: () => escolherModo("email"),
    style: {
      background: modoAdd === "email" ? C.teal : "transparent",
      color: modoAdd === "email" ? "#fff" : C.inkMuted,
      borderColor: C.teal
    },
    className: "flex-1 border rounded-r py-1.5 text-[11px] font-bold uppercase"
  }, "\u2709 Por email")), modoAdd === "link" && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("input", {
    value: nomeNovo,
    onChange: e => setNomeNovo(e.target.value),
    placeholder: "Nome",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 min-w-[8rem] border rounded px-3 py-1.5 text-sm outline-none"
  }), /*#__PURE__*/React.createElement("input", {
    value: telNovo,
    onChange: e => setTelNovo(e.target.value),
    placeholder: "WhatsApp (opcional)",
    inputMode: "tel",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 min-w-[8rem] border rounded px-3 py-1.5 text-sm outline-none"
  })), modoAdd === "empresa" && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("select", {
    value: pessoaEscolhida,
    onChange: e => setPessoaEscolhida(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 min-w-0 border rounded px-2 py-1.5 text-sm outline-none bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, genteEmpresa ? "Escolha a pessoa..." : "Carregando..."), (genteEmpresa || []).filter(p => !list.some(m => m.usuario_id === p.usuario_id) && (usuarioRank <= 2 || p.rank > usuarioRank)).map(p => /*#__PURE__*/React.createElement("option", {
    key: p.usuario_id,
    value: p.usuario_id
  }, p.nome, " \xB7 ", RANK_LABELS[p.rank]))), /*#__PURE__*/React.createElement("input", {
    value: funcao,
    onChange: e => setFuncao(e.target.value),
    placeholder: "Fun\xE7\xE3o",
    list: "funcoes-equipe",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "border rounded px-2 py-1.5 text-xs outline-none w-28 shrink-0"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: adicionarDaEmpresa,
    disabled: !pessoaEscolhida || salvando,
    style: {
      background: C.teal
    },
    className: "text-white rounded px-3 text-xs font-bold uppercase disabled:opacity-40 shrink-0"
  }, "Adicionar")), modoAdd !== "empresa" && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, modoAdd === "email" && /*#__PURE__*/React.createElement("input", {
    value: email,
    onChange: e => setEmail(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit(),
    placeholder: "email@exemplo.com",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 min-w-0 border rounded px-3 py-1.5 text-sm outline-none"
  }), /*#__PURE__*/React.createElement("input", {
    value: funcao,
    onChange: e => setFuncao(e.target.value),
    placeholder: rank === 8 ? "Ofício (ex.: Pedreiro)" : "Função (opcional)",
    list: "funcoes-equipe",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "border rounded px-2 py-1.5 text-xs outline-none w-28 shrink-0"
  }), /*#__PURE__*/React.createElement("select", {
    value: rank,
    onChange: e => setRank(Number(e.target.value)),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "border rounded px-1 py-1.5 text-xs outline-none bg-white shrink-0"
  }, ranksDisponiveis.map(r => /*#__PURE__*/React.createElement("option", {
    key: r,
    value: r
  }, RANK_LABELS[r]))), /*#__PURE__*/React.createElement("datalist", {
    id: "funcoes-equipe"
  }, funcoesHistoricas.map(f => /*#__PURE__*/React.createElement("option", {
    key: f,
    value: f
  }))), modoAdd === "email" ? /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: !email.trim() || salvando,
    style: {
      background: C.teal
    },
    className: "text-white rounded px-3 disabled:opacity-40 shrink-0"
  }, "+") : /*#__PURE__*/React.createElement("button", {
    onClick: convidarPorLink,
    disabled: !nomeNovo.trim() || salvando,
    style: {
      background: C.teal
    },
    className: "text-white rounded px-3 text-xs font-bold uppercase disabled:opacity-40 shrink-0"
  }, salvando ? "..." : "Gerar link")), modoAdd !== "empresa" && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.amber
    },
    className: "text-[11px] font-mono mt-1.5"
  }, "\u2192 ", RANK_LABELS[rank], " \xB7 ", RANK_DESCRICOES[rank]), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mt-1"
  }, modoAdd === "link" ? "Gera um link para mandar por WhatsApp. A pessoa entra com CPF + PIN, sem precisar de email." : modoAdd === "empresa" ? "Quem já tem conta na empresa (inclusive com CPF). Mantém o rank que já tem." : "Se o email ainda não tem conta, gera um link de convite."), linkGerado && /*#__PURE__*/React.createElement(LinkConviteCard, _extends({}, linkGerado, {
    onFechar: () => setLinkGerado(null)
  }))), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-1"
  }, erro), msg && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.green
    },
    className: "text-xs font-mono mt-1"
  }, msg));
}
function Lightbox({
  src,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    className: "fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[100]"
  }, /*#__PURE__*/React.createElement("img", {
    src: src,
    className: "max-w-full max-h-full rounded shadow-2xl",
    onClick: e => e.stopPropagation()
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "absolute top-4 right-4 text-white text-3xl leading-none"
  }, "\xD7"));
}
function PdfViewer({
  src,
  nome,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/85 flex flex-col z-[100]"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      borderColor: C.border
    },
    className: "flex items-center justify-between px-4 py-3 border-b"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.ink
    },
    className: "text-sm font-bold truncate flex-1 pr-2"
  }, nome), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.ink
    },
    className: "text-2xl leading-none px-1"
  }, "\xD7")), typeof src === "string" && src.startsWith("data:application/pdf;base64,") ? /*#__PURE__*/React.createElement("iframe", {
    src: src,
    title: nome,
    className: "flex-1 w-full border-0",
    style: {
      background: "#fff"
    }
  }) : /*#__PURE__*/React.createElement("p", {
    style: {
      color: "#fff"
    },
    className: "p-6 text-center"
  }, "Arquivo inv\xE1lido."));
}
function EtapaNode({
  etapa,
  allEtapas,
  depth,
  onToggle,
  onRemove,
  onAddSub,
  onEditEtapa,
  fileCache,
  loadFile,
  saveArquivo,
  onViewImage,
  onAddFoto,
  onDeleteFoto,
  nomesHistoricos = [],
  podeEditar = true
}) {
  const [openSub, setOpenSub] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(etapa.texto);
  const [novoSub, setNovoSub] = useState("");
  const [erro, setErro] = useState("");
  const inputRef = useRef(null);
  const filhos = allEtapas.filter(e => e.parent_id === etapa.id);
  const temFilhos = filhos.length > 0;
  const salvarNome = async () => {
    if (nomeEdit.trim() && nomeEdit.trim() !== etapa.texto) {
      try {
        await onEditEtapa(etapa.id, nomeEdit.trim());
      } catch (err) {
        setErro(err.message);
        setNomeEdit(etapa.texto);
      }
    } else setNomeEdit(etapa.texto);
    setEditando(false);
  };
  const toggleSimples = async () => {
    if (!podeEditar) return;
    setErro("");
    try {
      await onToggle(etapa.id, !etapa.concluida);
    } catch (err) {
      setErro(err.message);
    }
  };
  const addSub = async () => {
    if (!novoSub.trim()) return;
    setErro("");
    try {
      await onAddSub(etapa.id, novoSub.trim());
      setNovoSub("");
    } catch (err) {
      setErro(err.message);
    }
  };
  const removerEtapa = async () => {
    setErro("");
    try {
      await onRemove(etapa.id);
    } catch (err) {
      setErro(err.message);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: depth * 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border,
      background: C.bg
    },
    className: "border rounded-md p-2.5 mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1.5"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: toggleSimples,
    disabled: !podeEditar,
    style: {
      borderColor: etapa.concluida ? C.green : C.border,
      background: etapa.concluida ? C.green : "transparent"
    },
    className: "w-4 h-4 border-2 rounded flex items-center justify-center shrink-0 text-white text-[10px] disabled:opacity-60"
  }, etapa.concluida ? "✓" : ""), /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpenSub(!openSub),
    title: "Subetapas",
    className: "shrink-0"
  }, temFilhos ? openSub ? "📂" : "📁" : "📄"), editando ? /*#__PURE__*/React.createElement("input", {
    value: nomeEdit,
    onChange: e => setNomeEdit(e.target.value),
    onKeyDown: e => e.key === "Enter" && salvarNome(),
    onBlur: salvarNome,
    autoFocus: true,
    style: {
      borderColor: C.border,
      color: C.ink,
      background: C.surface
    },
    className: "flex-1 min-w-0 border rounded px-2 py-0.5 text-sm outline-none"
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: etapa.concluida ? C.inkMuted : C.ink,
      textDecoration: etapa.concluida ? "line-through" : "none"
    },
    className: "text-sm flex-1 min-w-0 truncate"
  }, etapa.texto), temFilhos && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "text-[10px] font-mono shrink-0"
  }, filhos.filter(f => f.concluida).length, "/", filhos.length), podeEditar && !editando && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setNomeEdit(etapa.texto);
      setEditando(true);
    },
    style: {
      color: C.inkMuted
    },
    className: "shrink-0"
  }, "\u270E"), podeEditar && /*#__PURE__*/React.createElement("button", {
    onClick: removerEtapa,
    style: {
      color: C.rust
    },
    className: "shrink-0"
  }, "\uD83D\uDDD1")), etapa.concluida && etapa.concluida_em && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.green
    },
    className: "text-[11px] font-mono mt-1"
  }, "\u2713 ", etapa.concluida_por_nome ? `por ${etapa.concluida_por_nome} · ` : "", fmtFirma(etapa.concluida_em)), /*#__PURE__*/React.createElement(EtapaFotosGaleria, {
    etapaId: etapa.id,
    fileCache: fileCache,
    loadFile: loadFile,
    onViewImage: onViewImage,
    onAddFoto: onAddFoto,
    onDeleteFoto: onDeleteFoto,
    podeEditar: podeEditar,
    saveArquivo: saveArquivo
  }), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-[11px] font-mono mt-1"
  }, erro)), openSub && /*#__PURE__*/React.createElement("div", {
    style: {
      borderLeft: `2px dashed ${C.border}`,
      marginLeft: 8
    },
    className: "pl-2 mb-2"
  }, filhos.map(f => /*#__PURE__*/React.createElement(EtapaNode, {
    key: f.id,
    etapa: f,
    allEtapas: allEtapas,
    depth: 0,
    onToggle: onToggle,
    onRemove: onRemove,
    onAddSub: onAddSub,
    onEditEtapa: onEditEtapa,
    fileCache: fileCache,
    loadFile: loadFile,
    saveArquivo: saveArquivo,
    onViewImage: onViewImage,
    onAddFoto: onAddFoto,
    onDeleteFoto: onDeleteFoto,
    nomesHistoricos: nomesHistoricos,
    podeEditar: podeEditar
  })), podeEditar && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-2"
  }, /*#__PURE__*/React.createElement("input", {
    value: novoSub,
    onChange: e => setNovoSub(e.target.value),
    onKeyDown: e => e.key === "Enter" && addSub(),
    placeholder: "Nova subetapa",
    list: "nomes-etapas",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 min-w-0 border rounded px-3 py-1.5 text-sm outline-none"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: addSub,
    disabled: !novoSub.trim(),
    style: {
      background: C.teal
    },
    className: "text-white rounded px-3 disabled:opacity-40 shrink-0"
  }, "+"))));
}
function EtapasSection({
  obraId,
  etapas,
  onAdd,
  onToggle,
  onRemove,
  onEditEtapa,
  fileCache,
  loadFile,
  saveArquivo,
  onViewImage,
  onAddFoto,
  onDeleteFoto,
  podeEditar = true
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const raiz = etapas.filter(e => !e.parent_id);
  const nomesHistoricos = [...new Set(etapas.map(e => e.texto).filter(Boolean))];
  const submit = async () => {
    if (!texto.trim()) return;
    setErro("");
    try {
      await onAdd(null, texto.trim());
      setTexto("");
    } catch (err) {
      setErro(err.message);
    }
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mb-2"
  }, "\uD83D\uDCC1 abre subetapas \xB7 \u270E edita nome \xB7 \uD83D\uDCF7 c\xE2mera ou \uD83D\uDDBC galeria adicionam fotos de avan\xE7o."), /*#__PURE__*/React.createElement("div", {
    className: "mb-3"
  }, raiz.map(e => /*#__PURE__*/React.createElement(EtapaNode, {
    key: e.id,
    etapa: e,
    allEtapas: etapas,
    depth: 0,
    onToggle: onToggle,
    onRemove: onRemove,
    onAddSub: onAdd,
    onEditEtapa: onEditEtapa,
    fileCache: fileCache,
    loadFile: loadFile,
    saveArquivo: saveArquivo,
    onViewImage: onViewImage,
    onAddFoto: onAddFoto,
    onDeleteFoto: onDeleteFoto,
    nomesHistoricos: nomesHistoricos,
    podeEditar: podeEditar
  })), raiz.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono"
  }, "Sem etapas cadastradas.")), !podeEditar && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono"
  }, "Seu n\xEDvel de acesso \xE9 somente visualiza\xE7\xE3o neste m\xF3dulo."), podeEditar && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    value: texto,
    onChange: e => setTexto(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit(),
    placeholder: "Ex: instala\xE7\xE3o el\xE9trica",
    list: "nomes-etapas",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 min-w-0 border rounded px-3 py-1.5 text-sm outline-none"
  }), /*#__PURE__*/React.createElement("datalist", {
    id: "nomes-etapas"
  }, nomesHistoricos.map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: !texto.trim(),
    style: {
      background: C.ink
    },
    className: "text-white rounded px-3 disabled:opacity-40 shrink-0"
  }, "+")), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-1"
  }, erro));
}

// Pedidos e entregas (05/10): pedido → "pendente"; quem fornece entrega → "aguardando";
// quem recebe confirma → "atendido" (ou contesta → volta a "pendente"). Uma entrega direta já nasce "aguardando".
// Pedir e confirmar: nível "receber" ou "editar". Entregar direto: "editar".
const ORDEM_NIVEL = {
  nenhum: 0,
  visualizar: 1,
  receber: 2,
  editar: 3
};
function PedidosPanel({
  obraId,
  tipo,
  tipoLabel,
  equipe,
  usuarioAPI,
  nivel = "editar"
}) {
  const [pedidos, setPedidos] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(null); // "pedir" | "entregar" | null
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [pessoaId, setPessoaId] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const podePedir = ORDEM_NIVEL[nivel] >= 2;
  const podeEntregar = nivel === "editar";
  const carregar = async () => {
    try {
      const r = await apiFetch(`/api/pedidos?obra_id=${obraId}`);
      setPedidos(r.pedidos.filter(p => p.tipo === tipo));
    } catch (e) {
      setPedidos([]);
    }
  };
  useEffect(() => {
    carregar();
  }, [obraId, tipo]);
  const superiores = equipe.filter(m => !m.removido_em && m.rank < usuarioAPI.rank);
  const subordinados = equipe.filter(m => !m.removido_em && m.rank > usuarioAPI.rank);
  const abrirForm = qual => {
    setMostrarForm(qual);
    setDescricao("");
    setQuantidade("");
    setPessoaId("");
    setErro("");
  };
  const enviar = async () => {
    if (!descricao.trim() || !pessoaId) {
      setErro("Preencha a descrição e escolha a pessoa.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const remetenteId = mostrarForm === "pedir" ? pessoaId : usuarioAPI.id;
      const destinatarioId = mostrarForm === "pedir" ? usuarioAPI.id : pessoaId;
      await apiFetch("/api/pedidos", {
        method: "POST",
        body: JSON.stringify({
          obraId,
          tipo,
          descricao: descricao.trim(),
          quantidade: quantidade.trim(),
          remetenteId,
          destinatarioId
        })
      });
      setMostrarForm(null);
      await carregar();
    } catch (err) {
      setErro(err.message);
    }
    setSalvando(false);
  };
  const responder = async (id, status) => {
    setErro("");
    try {
      await apiFetch(`/api/pedidos?id=${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status
        })
      });
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };
  const cancelar = async id => {
    if (!window.confirm("Cancelar este pedido?")) return;
    setErro("");
    try {
      await apiFetch(`/api/pedidos?id=${id}`, {
        method: "DELETE"
      });
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };
  if (pedidos === null) return null;
  const paraEntregar = pedidos.filter(p => p.remetente_id === usuarioAPI.id && p.status === "pendente");
  const paraConfirmar = pedidos.filter(p => p.destinatario_id === usuarioAPI.id && p.status === "aguardando");
  const destaque = new Set([...paraEntregar, ...paraConfirmar].map(p => p.id));
  const historico = pedidos.filter(p => !destaque.has(p.id)).slice(0, 10);
  const SIMBOLO = {
    atendido: "✓",
    recusado: "✕",
    aguardando: "🚚",
    pendente: "…"
  };
  const LEGENDA = {
    atendido: "recebido",
    recusado: "recusado",
    aguardando: "entregue · falta confirmar",
    pendente: "pedido · aguardando entrega"
  };
  const fmtData = ts => new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border,
      background: C.surface
    },
    className: "border rounded-md p-3 mb-4"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-xs font-extrabold uppercase tracking-wide mb-2"
  }, "\uD83D\uDCCB Pedidos de ", tipoLabel), paraEntregar.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mb-3 space-y-2"
  }, paraEntregar.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      borderColor: C.amber,
      background: C.bg
    },
    className: "border rounded p-2"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("b", null, p.destinatario_nome), " pediu: ", p.descricao, p.quantidade ? ` (${p.quantidade})` : ""), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-1.5"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => responder(p.id, "entregue"),
    style: {
      background: C.green
    },
    className: "text-white text-[11px] font-bold uppercase rounded px-2 py-1"
  }, "\uD83D\uDE9A Entreguei"), /*#__PURE__*/React.createElement("button", {
    onClick: () => responder(p.id, "recusado"),
    style: {
      color: C.rust,
      borderColor: C.rust
    },
    className: "border text-[11px] font-bold uppercase rounded px-2 py-1"
  }, "Recusar"))))), paraConfirmar.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mb-3 space-y-2"
  }, paraConfirmar.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      borderColor: C.green,
      background: C.bg
    },
    className: "border rounded p-2"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("b", null, p.remetente_nome), " entregou para voc\xEA: ", p.descricao, p.quantidade ? ` (${p.quantidade})` : ""), podePedir ? /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-1.5"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => responder(p.id, "atendido"),
    style: {
      background: C.green
    },
    className: "text-white text-[11px] font-bold uppercase rounded px-2 py-1"
  }, "\u2713 Recebi"), /*#__PURE__*/React.createElement("button", {
    onClick: () => responder(p.id, "contestar"),
    style: {
      color: C.rust,
      borderColor: C.rust
    },
    className: "border text-[11px] font-bold uppercase rounded px-2 py-1"
  }, "N\xE3o recebi")) : /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mt-1"
  }, "Seu n\xEDvel neste m\xF3dulo \xE9 s\xF3 visualizar.")))), mostrarForm ? /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border
    },
    className: "border rounded p-2 mb-2"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono uppercase mb-1.5"
  }, mostrarForm === "pedir" ? "Pedir a alguém acima" : "Entregar a alguém abaixo (ele confirma que recebeu)"), /*#__PURE__*/React.createElement("select", {
    value: pessoaId,
    onChange: e => setPessoaId(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-2 py-1.5 text-sm outline-none bg-white mb-1.5"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, mostrarForm === "pedir" ? "Pedir a quem?" : "Entregar a quem?"), (mostrarForm === "pedir" ? superiores : subordinados).map(m => /*#__PURE__*/React.createElement("option", {
    key: m.usuario_id,
    value: m.usuario_id
  }, m.nome, " (", RANK_LABELS[m.rank], ")"))), /*#__PURE__*/React.createElement("input", {
    value: descricao,
    onChange: e => setDescricao(e.target.value),
    placeholder: tipo === "material" ? "Ex: cimento" : tipo === "ferramenta" ? "Ex: furadeira" : "Ex: planta baixa",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-2 py-1.5 text-sm outline-none mb-1.5"
  }), tipo !== "documento" && /*#__PURE__*/React.createElement("input", {
    value: quantidade,
    onChange: e => setQuantidade(e.target.value),
    placeholder: "Quantidade (opcional)",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-2 py-1.5 text-sm outline-none mb-1.5"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: enviar,
    disabled: salvando,
    style: {
      background: C.amber
    },
    className: "text-white text-xs font-bold uppercase rounded px-3 py-1.5 disabled:opacity-50"
  }, salvando ? "..." : "Confirmar"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMostrarForm(null),
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Cancelar"))) : /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mb-2"
  }, podePedir && superiores.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => abrirForm("pedir"),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "border rounded px-3 py-1.5 text-xs font-mono uppercase"
  }, "+ Pedir"), podeEntregar && subordinados.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => abrirForm("entregar"),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "border rounded px-3 py-1.5 text-xs font-mono uppercase"
  }, "+ Entregar")), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-[11px] font-mono mb-1.5"
  }, erro), historico.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border
    },
    className: "mt-2 pt-2 border-t space-y-1.5"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[10px] font-mono uppercase tracking-wide"
  }, "Hist\xF3rico"), historico.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "flex items-start justify-between gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "min-w-0"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-xs truncate"
  }, SIMBOLO[p.status] || "…", " ", p.descricao, p.quantidade ? ` (${p.quantidade})` : ""), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[10px] font-mono truncate"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: p.status === "atendido" ? C.green : p.status === "recusado" ? C.rust : C.amber
    },
    className: "font-bold uppercase"
  }, LEGENDA[p.status]), " · ", p.remetente_nome, " \u2192 ", p.destinatario_nome, p.atendido_em || p.entregue_em || p.criado_em ? ` · ${fmtData(p.atendido_em || p.entregue_em || p.criado_em)}` : "")), (p.criado_por === usuarioAPI.id || p.rank_autor > usuarioAPI.rank) && ["pendente", "aguardando"].includes(p.status) && /*#__PURE__*/React.createElement("button", {
    onClick: () => cancelar(p.id),
    style: {
      color: C.rust
    },
    className: "text-[11px] shrink-0"
  }, "cancelar")))));
}

// --- Observações: "livro de obra" com firma, edição só do autor (com histórico) e apagar só superiores ---
const fmtFirma = ts => ts ? new Date(ts).toLocaleString("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
}) : "";
function ObservacoesSection({
  items,
  onAdd,
  onDelete,
  onEdit,
  usuarioAPI,
  podeEditar = true
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [textoEdicao, setTextoEdicao] = useState("");
  const [historico, setHistorico] = useState({}); // { [id]: versoes[] }
  const eu = usuarioAPI || {};
  const registrar = async () => {
    if (!texto.trim()) return;
    setErro("");
    setSalvando(true);
    try {
      await onAdd(texto.trim());
      setTexto("");
    } catch (err) {
      setErro(err.message);
    }
    setSalvando(false);
  };
  const salvarEdicao = async item => {
    if (!textoEdicao.trim()) return;
    setErro("");
    try {
      await onEdit(item.id, textoEdicao.trim());
      setEditandoId(null);
      setHistorico(h => {
        const n = {
          ...h
        };
        delete n[item.id];
        return n;
      });
    } catch (err) {
      setErro(err.message);
    }
  };
  const apagar = async item => {
    if (!window.confirm("Apagar esta observação? Não pode ser desfeito.")) return;
    setErro("");
    try {
      await onDelete(item.id);
    } catch (err) {
      setErro(err.message);
    }
  };
  const alternarHistorico = async item => {
    if (historico[item.id]) {
      setHistorico(h => {
        const n = {
          ...h
        };
        delete n[item.id];
        return n;
      });
      return;
    }
    setErro("");
    try {
      const r = await apiFetch(`/api/observacoes?historico=${item.id}`);
      setHistorico(h => ({
        ...h,
        [item.id]: r.versoes
      }));
    } catch (err) {
      setErro(err.message);
    }
  };
  return /*#__PURE__*/React.createElement("div", null, podeEditar && /*#__PURE__*/React.createElement("div", {
    className: "mb-4"
  }, /*#__PURE__*/React.createElement("textarea", {
    value: texto,
    onChange: e => setTexto(e.target.value),
    rows: 3,
    placeholder: "Aviso, sugest\xE3o, reclama\xE7\xE3o... Ex.: Pedreiro, ATEN\xC7\xC3O \xE0s tubula\xE7\xF5es existentes de \xE1gua e eletricidade.",
    style: {
      borderColor: C.border,
      color: C.ink,
      background: C.surface
    },
    className: "w-full border rounded px-3 py-2 text-sm outline-none resize-y"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: registrar,
    disabled: !texto.trim() || salvando,
    style: {
      background: C.teal
    },
    className: "w-full mt-1 text-white font-bold uppercase tracking-wide text-sm rounded py-2 disabled:opacity-40"
  }, salvando ? "Registrando..." : "📝 Registrar no livro")), !podeEditar && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mb-3"
  }, "Seu n\xEDvel de acesso \xE9 somente visualiza\xE7\xE3o neste m\xF3dulo."), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mb-2"
  }, erro), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, items.map(item => {
    const souAutor = item.criado_por === eu.id;
    // Protege pelo rank que o autor tinha ao escrever (05/10). Entre Donos, o principal fica acima.
    const rankAutor = item.rank_autor ?? item.autor_rank_atual;
    const souSuperior = !souAutor && rankAutor != null && (eu.rank < rankAutor || eu.rank === 1 && rankAutor === 1 && !!eu.dono_principal);
    const rankNaFirma = item.rank_autor ?? item.autor_rank_atual;
    return /*#__PURE__*/React.createElement("div", {
      key: item.id,
      style: {
        background: C.surface,
        borderLeftColor: C.teal
      },
      className: "border-l-4 rounded-r-md p-3 shadow-sm"
    }, editandoId === item.id ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("textarea", {
      value: textoEdicao,
      onChange: e => setTextoEdicao(e.target.value),
      rows: 3,
      style: {
        borderColor: C.border,
        color: C.ink,
        background: C.bg
      },
      className: "w-full border rounded px-2 py-1.5 text-sm outline-none resize-y",
      autoFocus: true
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2 mt-1"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setEditandoId(null),
      style: {
        borderColor: C.border,
        color: C.ink
      },
      className: "flex-1 border rounded py-1.5 text-xs font-bold uppercase"
    }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
      onClick: () => salvarEdicao(item),
      disabled: !textoEdicao.trim(),
      style: {
        background: C.teal
      },
      className: "flex-1 text-white rounded py-1.5 text-xs font-bold uppercase disabled:opacity-40"
    }, "Salvar")), /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-[10px] font-mono mt-1"
    }, "A vers\xE3o anterior fica guardada (vis\xEDvel s\xF3 pra voc\xEA e seus superiores).")) : /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.ink
      },
      className: "text-sm whitespace-pre-wrap"
    }, item.texto), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-3 mt-2 flex-wrap"
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-[11px] font-mono flex-1 min-w-0"
    }, "\u2014 ", item.autor_removido ? "Usuário removido" : item.autor_nome || "?", rankNaFirma ? ` · ${RANK_LABELS[rankNaFirma]}` : "", " \xB7 ", fmtFirma(item.criado_em), item.editado_em && /*#__PURE__*/React.createElement("span", {
      className: "italic"
    }, " \xB7 editado ", fmtFirma(item.editado_em))), item.n_edicoes > 0 && (souAutor || souSuperior) && /*#__PURE__*/React.createElement("button", {
      onClick: () => alternarHistorico(item),
      style: {
        color: C.blue
      },
      className: "text-[11px] font-mono shrink-0"
    }, "\uD83D\uDD58 ", historico[item.id] ? "ocultar" : `versões (${item.n_edicoes})`), souAutor && editandoId !== item.id && /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setEditandoId(item.id);
        setTextoEdicao(item.texto);
      },
      title: "Editar (s\xF3 o autor)",
      className: "shrink-0"
    }, "\u270F\uFE0F"), souSuperior && !souAutor && /*#__PURE__*/React.createElement("button", {
      onClick: () => apagar(item),
      title: "Apagar (s\xF3 superiores do autor)",
      style: {
        color: C.rust
      },
      className: "shrink-0"
    }, "\uD83D\uDDD1"), souSuperior && souAutor && eu.rank === 1 && /*#__PURE__*/React.createElement("button", {
      onClick: () => apagar(item),
      title: "Apagar",
      style: {
        color: C.rust
      },
      className: "shrink-0"
    }, "\uD83D\uDDD1")), historico[item.id] && /*#__PURE__*/React.createElement("div", {
      style: {
        borderColor: C.border
      },
      className: "mt-2 pt-2 border-t space-y-1.5"
    }, historico[item.id].map((v, i) => /*#__PURE__*/React.createElement("div", {
      key: i
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-xs whitespace-pre-wrap line-through decoration-1"
    }, v.texto), /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-[10px] font-mono"
    }, "substitu\xEDdo em ", fmtFirma(v.substituido_em))))));
  }), items.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono"
  }, "Nada registrado ainda.")));
}
function ListaSimplesSection({
  items,
  onAdd,
  onDelete,
  placeholder,
  color,
  glyph,
  datalistId,
  podeEditar = true,
  textoSemEdicao = "Seu nível de acesso é somente visualização neste módulo."
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const historico = [...new Set(items.map(i => i.texto).filter(Boolean))];
  const submit = async () => {
    if (!texto.trim()) return;
    setErro("");
    try {
      await onAdd(texto.trim());
      setTexto("");
    } catch (err) {
      setErro(err.message);
    }
  };
  const remover = async item => {
    setErro("");
    try {
      await onDelete(item.id);
    } catch (err) {
      setErro(err.message);
    }
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mb-3"
  }, items.map(item => /*#__PURE__*/React.createElement("div", {
    key: item.id,
    style: {
      background: C.surface,
      borderLeftColor: color
    },
    className: "border-l-4 rounded-r-md p-3 shadow-sm flex gap-3 group"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mt-0.5 shrink-0"
  }, glyph), /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono"
  }, fmtTs(item.criado_em)), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm"
  }, item.texto)), podeEditar && /*#__PURE__*/React.createElement("button", {
    onClick: () => remover(item),
    style: {
      color: C.rust
    },
    className: "opacity-0 group-hover:opacity-100 hover:opacity-60 transition shrink-0"
  }, "\uD83D\uDDD1"))), items.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono"
  }, "Nada registrado ainda.")), !podeEditar && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono"
  }, textoSemEdicao), podeEditar && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    value: texto,
    onChange: e => setTexto(e.target.value),
    onKeyDown: e => e.key === "Enter" && submit(),
    placeholder: placeholder,
    list: datalistId,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 min-w-0 border rounded px-3 py-1.5 text-sm outline-none"
  }), /*#__PURE__*/React.createElement("datalist", {
    id: datalistId
  }, historico.map(h => /*#__PURE__*/React.createElement("option", {
    key: h,
    value: h
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: !texto.trim(),
    style: {
      background: color
    },
    className: "text-white rounded px-3 disabled:opacity-40 shrink-0"
  }, "+")), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-1"
  }, erro));
}

// --- Ajuda: o conteúdo vem do servidor (src/lib/ajuda-conhecimento.js), mesma fonte do assistente ---
let ajudaCache = null;
async function carregarAjuda() {
  if (!ajudaCache) ajudaCache = apiFetch("/api/ajuda").catch(e => {
    ajudaCache = null;
    throw e;
  });
  return ajudaCache;
}

// Texto simples com **negrito** e quebras de linha (respostas do assistente e seções)
function TextoAjuda({
  texto
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.ink
    },
    className: "text-sm whitespace-pre-wrap leading-relaxed"
  }, String(texto || "").split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? /*#__PURE__*/React.createElement("b", {
    key: i
  }, p.slice(2, -2)) : /*#__PURE__*/React.createElement("span", {
    key: i
  }, p)));
}

// "?" no topo de cada gaveta: mostra a seção do manual daquele módulo
function AjudaModulo({
  modulo
}) {
  const [aberto, setAberto] = useState(false);
  const [secao, setSecao] = useState(null);
  const abrir = async () => {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAberto(true);
    if (!secao) {
      try {
        const r = await carregarAjuda();
        setSecao(r.secoes.find(x => x.modulo === modulo) || null);
      } catch (e) {}
    }
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: abrir,
    title: "Ajuda desta gaveta",
    style: {
      borderColor: C.border,
      color: C.inkMuted
    },
    className: "ml-auto w-7 h-7 border rounded-full text-sm font-bold shrink-0"
  }, "?"), aberto && /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      borderColor: C.amber
    },
    className: "basis-full border-l-4 rounded-r p-3 mt-2 text-left normal-case tracking-normal font-normal"
  }, secao ? /*#__PURE__*/React.createElement(TextoAjuda, {
    texto: secao.texto
  }) : /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono"
  }, "Carregando..."), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAberto(false),
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono uppercase mt-2"
  }, "Fechar")));
}
function AjudaScreen({
  usuarioAPI,
  onVerApresentacao
}) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [conversa, setConversa] = useState([]); // [{role, content}]
  const [pergunta, setPergunta] = useState("");
  const [pensando, setPensando] = useState(false);
  const [aberta, setAberta] = useState(null);
  const fimRef = useRef(null);
  useEffect(() => {
    carregarAjuda().then(setDados).catch(e => setErro(e.message));
  }, []);
  useEffect(() => {
    fimRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }, [conversa, pensando]);
  const perguntar = async texto => {
    const t = String(texto || "").trim();
    if (!t || pensando) return;
    setPergunta("");
    setErro("");
    const historico = conversa.slice(-4);
    setConversa(c => [...c, {
      role: "user",
      content: t
    }]);
    setPensando(true);
    try {
      const r = await apiFetch("/api/ajuda", {
        method: "POST",
        body: JSON.stringify({
          pergunta: t,
          historico
        })
      });
      setConversa(c => [...c, {
        role: "assistant",
        content: r.resposta
      }]);
    } catch (e) {
      setConversa(c => [...c, {
        role: "assistant",
        content: e.message,
        erro: true
      }]);
    }
    setPensando(false);
  };
  if (erro && !dados) return /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-sm font-mono text-center py-16"
  }, erro);
  if (!dados) return /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono text-center py-16"
  }, "Carregando...");
  const primeiro = (usuarioAPI.nome || "").split(" ")[0];
  const secoesOrdenadas = [...dados.secoes].sort((a, b) => (b.para === dados.grupo) - (a.para === dados.grupo));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide mb-1"
  }, "\u2753 Ajuda"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono mb-3"
  }, "Ol\xE1, ", primeiro, "! Voc\xEA \xE9 ", /*#__PURE__*/React.createElement("b", null, RANK_LABELS[usuarioAPI.rank]), "."), /*#__PURE__*/React.createElement("a", {
    href: "/manual",
    target: "_blank",
    rel: "noopener",
    style: {
      borderColor: C.border,
      color: C.ink,
      background: C.surface
    },
    className: "w-full border rounded-md px-3 py-2.5 mb-4 text-sm font-mono flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base leading-none"
  }, "\uD83D\uDCD8"), /*#__PURE__*/React.createElement("span", {
    className: "flex-1"
  }, "Manual completo ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    }
  }, "(ler, imprimir ou salvar em PDF)"))), onVerApresentacao && /*#__PURE__*/React.createElement("button", {
    onClick: onVerApresentacao,
    style: {
      borderColor: C.border,
      color: C.ink,
      background: C.surface
    },
    className: "w-full border rounded-md px-3 py-2.5 -mt-2 mb-4 text-sm font-mono flex items-center gap-3 text-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-base leading-none"
  }, "\uD83C\uDF9E"), /*#__PURE__*/React.createElement("span", {
    className: "flex-1"
  }, "Ver apresenta\xE7\xE3o ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    }
  }, "(o passo a passo do come\xE7o)"))), dados.assistente && /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      borderColor: C.border
    },
    className: "border rounded-md p-3 mb-5"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "font-bold text-sm mb-2"
  }, "\uD83D\uDCAC Pergunte ao G&C"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 mb-2"
  }, conversa.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, dados.sugestoes.map(q => /*#__PURE__*/React.createElement("button", {
    key: q,
    onClick: () => perguntar(q),
    style: {
      borderColor: C.teal,
      color: C.teal
    },
    className: "border rounded-full px-3 py-1 text-xs text-left"
  }, q))), conversa.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: m.role === "user" ? "flex justify-end" : "flex"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: m.role === "user" ? C.teal : C.bg,
      color: m.role === "user" ? "#fff" : C.ink,
      borderColor: m.erro ? C.rust : C.border
    },
    className: `max-w-[85%] rounded-lg px-3 py-2 ${m.role === "user" ? "" : "border"}`
  }, m.role === "user" ? /*#__PURE__*/React.createElement("span", {
    className: "text-sm"
  }, m.content) : /*#__PURE__*/React.createElement(TextoAjuda, {
    texto: m.content
  })))), pensando && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono"
  }, "G&C est\xE1 pensando..."), /*#__PURE__*/React.createElement("div", {
    ref: fimRef
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    value: pergunta,
    onChange: e => setPergunta(e.target.value),
    onKeyDown: e => e.key === "Enter" && perguntar(pergunta),
    maxLength: 400,
    placeholder: "Escreva sua d\xFAvida...",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 min-w-0 border rounded px-3 py-2 text-sm outline-none"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => perguntar(pergunta),
    disabled: !pergunta.trim() || pensando,
    style: {
      background: C.teal
    },
    className: "text-white rounded px-3 text-sm font-bold disabled:opacity-40"
  }, "Enviar")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[10px] font-mono mt-2"
  }, "O assistente usa intelig\xEAncia artificial e pode errar. N\xE3o escreva CPF, PIN ou senha aqui. Na d\xFAvida, confira no guia abaixo ou fale com seu superior.")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "font-bold text-sm mb-2"
  }, "\uD83D\uDCD6 Guia"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, secoesOrdenadas.map(sec => /*#__PURE__*/React.createElement("div", {
    key: sec.id,
    style: {
      background: C.surface,
      borderColor: C.border
    },
    className: "border rounded-md"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setAberta(aberta === sec.id ? null : sec.id),
    style: {
      color: C.ink
    },
    className: "w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-left"
  }, /*#__PURE__*/React.createElement("span", null, sec.titulo), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    }
  }, aberta === sec.id ? "▲" : "▼")), aberta === sec.id && /*#__PURE__*/React.createElement("div", {
    className: "px-3 pb-3"
  }, /*#__PURE__*/React.createElement(TextoAjuda, {
    texto: sec.texto
  }))))), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono text-center mt-5"
  }, "N\xE3o achou? Escreva para ", /*#__PURE__*/React.createElement("a", {
    href: "mailto:suporte@gestaoecontrole.app.br",
    style: {
      color: C.amber
    },
    className: "underline"
  }, "suporte@gestaoecontrole.app.br")));
}

// Cartão de boas-vindas no primeiro acesso (some ao tocar em "Entendi")
// ---------- Apresentação (slides do começo): aparece uma vez por pessoa, depois do splash ----------
function slidesApresentacao(usuarioAPI) {
  const primeiro = (usuarioAPI.nome || "").split(" ")[0];
  const img = (src, cls = "w-40 h-40") => /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    className: `${cls} object-contain mx-auto`,
    draggable: "false"
  });
  const lista = [{
    arte: img("logo.png", "w-44 h-44 rounded-full"),
    titulo: `Bem-vindo ao G&C${primeiro ? `, ${primeiro}` : ""}!`,
    texto: /*#__PURE__*/React.createElement(React.Fragment, null, "A sua obra organizada num s\xF3 lugar, no celular. Voc\xEA entrou como ", /*#__PURE__*/React.createElement("b", null, RANK_LABELS[usuarioAPI.rank]), ".")
  }, {
    arte: /*#__PURE__*/React.createElement("div", {
      className: "flex justify-center items-center gap-1"
    }, img("selo_ativa_8.webp", "w-28 h-28"), img("selo_pausada_9.webp", "w-24 h-24"), img("selo_concluida_10.webp", "w-28 h-28")),
    titulo: "Suas obras",
    texto: "Na tela inicial ficam as obras em que você participa. O selo mostra se está ATIVA, PAUSADA ou CONCLUÍDA. Toque numa obra para abrir."
  }, {
    arte: img("arquivero_completo_16.webp", "h-56 w-auto"),
    titulo: "O arquivo da obra",
    texto: "Cada obra é um arquivo com 6 gavetas: Equipe, Etapas, Ferramentas, Materiais, Observações e Documentos. Gaveta com 🔒 é porque o seu rank não vê."
  }, {
    equipe: true,
    arte: img("icone_equipe_2.webp"),
    titulo: "Monte sua equipe",
    texto: "Na gaveta Equipe → 📲 Novo por link você convida pelo WhatsApp. A pessoa entra com CPF + PIN, sem precisar de e-mail."
  }, {
    arte: img("icone_etapas_1.webp"),
    titulo: "Etapas e fotos",
    texto: "As etapas são o passo a passo da obra. Marque como concluída e registre com fotos: 📷 Câmera na hora ou 🖼 Galeria (até 10 de uma vez)."
  }, {
    arte: /*#__PURE__*/React.createElement("div", {
      className: "flex justify-center gap-3"
    }, img("icone_materiais_5.webp", "w-28 h-28"), img("icone_ferramentas_4.webp", "w-28 h-28")),
    titulo: "Pedir e entregar",
    texto: /*#__PURE__*/React.createElement(React.Fragment, null, "Faltou material ou ferramenta? Fa\xE7a um pedido. Quem entrega toca ", /*#__PURE__*/React.createElement("b", null, "Entreguei"), " e quem recebe confirma com ", /*#__PURE__*/React.createElement("b", null, "Recebi"), ". Tudo fica no hist\xF3rico.")
  }, {
    arte: img("icone_observacoes_6.webp"),
    titulo: "Livro de obra",
    texto: "Em Observações fica o diário da obra, com nome, rank e data de quem escreveu. Nada se perde: o que é editado guarda as versões anteriores."
  }, {
    arte: /*#__PURE__*/React.createElement("div", {
      className: "text-7xl leading-none text-center"
    }, "\uD83D\uDD14 \u270B"),
    titulo: "Avisos e presença",
    texto: "O sininho 🔔 mostra as novidades das suas obras — ligue as notificações para recebê-las no celular. Na Equipe você marca a sua presença do dia."
  }, {
    arte: img("logo.png", "w-36 h-36 rounded-full"),
    titulo: "Pronto!",
    texto: /*#__PURE__*/React.createElement(React.Fragment, null, "Ficou alguma d\xFAvida? Em ", /*#__PURE__*/React.createElement("b", null, "Config \u2192 \u2753 Ajuda"), " tem o manual e um assistente que responde perguntas. Esta apresenta\xE7\xE3o tamb\xE9m fica l\xE1.")
  }];
  // "Monte sua equipe" só para quem pode convidar (Profissional, Almoxarife e Estagiário não convidam).
  return lista.filter(s => !s.equipe || [1, 2, 4, 5, 7].includes(usuarioAPI.rank));
}
function Apresentacao({
  usuarioAPI,
  onFim
}) {
  const slides = slidesApresentacao(usuarioAPI);
  const [i, setI] = useState(0);
  const [arraste, setArraste] = useState(0);
  const toque = useRef(null);
  const ultimo = i === slides.length - 1;
  const ir = n => setI(Math.max(0, Math.min(slides.length - 1, n)));
  useEffect(() => {
    const tecla = e => {
      if (e.key === "ArrowRight") ir(i + 1);else if (e.key === "ArrowLeft") ir(i - 1);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });
  const inicio = e => {
    const t = e.touches[0];
    toque.current = {
      x: t.clientX,
      y: t.clientY,
      horizontal: null
    };
  };
  const mover = e => {
    const c = toque.current;
    if (!c) return;
    const t = e.touches[0];
    const dx = t.clientX - c.x,
      dy = t.clientY - c.y;
    if (c.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) c.horizontal = Math.abs(dx) > Math.abs(dy);
    if (c.horizontal) setArraste(dx);
  };
  const fim = () => {
    const c = toque.current;
    toque.current = null;
    if (c && c.horizontal) {
      if (arraste < -50) ir(i + 1);else if (arraste > 50) ir(i - 1);
    }
    setArraste(0);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.bg,
      color: C.ink
    },
    className: "fixed inset-0 z-50 flex flex-col select-none",
    role: "dialog",
    "aria-label": "Apresenta\xE7\xE3o do G&C"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end p-3",
    style: {
      paddingTop: "max(12px, env(safe-area-inset-top))"
    }
  }, !ultimo && /*#__PURE__*/React.createElement("button", {
    onClick: onFim,
    style: {
      color: C.inkMuted
    },
    className: "font-bold uppercase tracking-wide text-sm px-3 py-2"
  }, "Pular \u203A"), ultimo && /*#__PURE__*/React.createElement("span", {
    className: "py-2 text-sm"
  }, "\xA0")), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-hidden",
    onTouchStart: inicio,
    onTouchMove: mover,
    onTouchEnd: fim,
    onTouchCancel: fim
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex h-full",
    style: {
      transform: `translateX(calc(${-i * 100}% + ${arraste}px))`,
      transition: arraste ? "none" : "transform 0.3s ease"
    }
  }, slides.map((s, k) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "w-full h-full shrink-0 flex flex-col items-center justify-center px-8 text-center",
    "aria-hidden": k !== i
  }, /*#__PURE__*/React.createElement("div", {
    className: "mb-6 flex items-center justify-center",
    style: {
      minHeight: "10rem"
    }
  }, s.arte), /*#__PURE__*/React.createElement("h2", {
    className: "font-comic text-3xl tracking-wide mb-3"
  }, s.titulo), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-base leading-relaxed max-w-sm"
  }, s.texto))))), /*#__PURE__*/React.createElement("div", {
    className: "px-6 pb-6",
    style: {
      paddingBottom: "max(24px, env(safe-area-inset-bottom))"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-center gap-2 mb-5"
  }, slides.map((_, k) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => ir(k),
    "aria-label": `Ir para ${k + 1}`,
    style: {
      background: k === i ? C.amber : C.border,
      width: k === i ? 22 : 8
    },
    className: "h-2 rounded-full transition-all"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => ir(i - 1),
    disabled: i === 0,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "border rounded-md w-14 py-3 text-xl font-bold disabled:opacity-0",
    "aria-label": "Anterior"
  }, "\u2039"), ultimo ? /*#__PURE__*/React.createElement("button", {
    onClick: onFim,
    style: {
      background: C.amber
    },
    className: "flex-1 text-white font-bold uppercase tracking-wide rounded-md py-3"
  }, "Come\xE7ar") : /*#__PURE__*/React.createElement("button", {
    onClick: () => ir(i + 1),
    style: {
      background: C.ink,
      color: C.bg
    },
    className: "flex-1 font-bold uppercase tracking-wide rounded-md py-3"
  }, "Pr\xF3ximo \u203A"))));
}

// ---------- Barra "INSTALAR APLICATIVO" (só no navegador; some quando o app está instalado) ----------
const appInstalado = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch (e) {
    return false;
  }
};
const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
function BarraInstalar() {
  const [evento, setEvento] = useState(() => window.__gcInstalar || null);
  const [instalado, setInstalado] = useState(appInstalado);
  const [dialogo, setDialogo] = useState(null); // "instalando" | "ios"
  useEffect(() => {
    const pronto = () => setEvento(window.__gcInstalar || null);
    const feito = () => {
      setEvento(null);
      setDialogo("instalando");
    };
    window.addEventListener("gc-instalavel", pronto);
    window.addEventListener("gc-instalado", feito);
    return () => {
      window.removeEventListener("gc-instalavel", pronto);
      window.removeEventListener("gc-instalado", feito);
    };
  }, []);
  const instalar = async () => {
    if (evento) {
      try {
        evento.prompt();
        const r = await evento.userChoice;
        if (r && r.outcome === "accepted") {
          setEvento(null);
          window.__gcInstalar = null;
          setDialogo("instalando");
        }
      } catch (e) {}
    } else if (ehIOS()) setDialogo("ios");
  };
  const mostrarBarra = !instalado && (evento || ehIOS());
  return /*#__PURE__*/React.createElement(React.Fragment, null, mostrarBarra && /*#__PURE__*/React.createElement("button", {
    onClick: instalar,
    className: "gc-barra-instalar sticky top-0 z-[60] w-full text-white font-extrabold uppercase tracking-widest text-xs py-1.5 shadow",
    style: {
      letterSpacing: "0.12em"
    }
  }, "\uD83D\uDCF2 Instalar aplicativo"), dialogo && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[250]",
    onClick: () => setDialogo(null)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-6 w-full max-w-sm shadow-xl text-center",
    onClick: e => e.stopPropagation()
  }, dialogo === "instalando" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("img", {
    src: "icon-192.png",
    alt: "",
    className: "w-16 h-16 mx-auto rounded-2xl shadow mb-3"
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide mb-2"
  }, "Instala\xE7\xE3o em andamento"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm mb-3"
  }, "Verifique sua ", /*#__PURE__*/React.createElement("b", null, "tela de in\xEDcio"), ": o \xEDcone do G&C vai aparecer l\xE1 em alguns segundos."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs mb-4"
  }, "Se ele aparecer s\xF3 na lista de aplicativos, mantenha o dedo sobre o \xEDcone e arraste para a tela de in\xEDcio.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("img", {
    src: "icon-192.png",
    alt: "",
    className: "w-16 h-16 mx-auto rounded-2xl shadow mb-3"
  }), /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide mb-2"
  }, "Instalar no iPhone"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm mb-1"
  }, "1. Toque em ", /*#__PURE__*/React.createElement("b", null, "Compartilhar"), " (o quadrado com a seta \u2B06\uFE0F) na barra do Safari."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm mb-1"
  }, "2. Escolha ", /*#__PURE__*/React.createElement("b", null, "Adicionar \xE0 Tela de In\xEDcio"), "."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm mb-4"
  }, "3. Toque em ", /*#__PURE__*/React.createElement("b", null, "Adicionar"), ".")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setDialogo(null);
      if (appInstalado()) setInstalado(true);
    },
    style: {
      background: C.amber
    },
    className: "w-full text-white font-bold uppercase tracking-wide rounded py-2.5"
  }, "Entendi"))));
}

// ---------- 🔔 Bandeja de avisos ----------
const CATEGORIAS_AVISO = [{
  key: "etapas",
  label: "Etapas"
}, {
  key: "fotos",
  label: "Fotos"
}, {
  key: "materiais",
  label: "Materiais"
}, {
  key: "ferramentas",
  label: "Ferramentas"
}, {
  key: "documentos",
  label: "Documentos"
}, {
  key: "observacoes",
  label: "Observações"
}, {
  key: "equipe",
  label: "Equipe"
}, {
  key: "obra",
  label: "Estado da obra"
}];
const CADEIA_AVISOS = [1, 2, 4, 5, 7, 8];
const POS_AVISOS = {
  1: 1,
  2: 2,
  3: 2.5,
  4: 3,
  5: 4,
  6: 3.5,
  7: 5,
  8: 6
};
const MODULO_DO_AVISO = {
  etapas: "etapas",
  fotos: "etapas",
  materiais: "materiais",
  ferramentas: "ferramentas",
  documentos: "documentos",
  observacoes: "observacoes",
  equipe: "equipe"
};
function tempoAtras(ts) {
  const min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo"
  });
}

// ---------- 📱 Notificações push no celular ----------
const pushSuportado = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
function chaveParaBytes(b64) {
  const s = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function estadoPush() {
  if (!pushSuportado()) return "sem-suporte";
  if (Notification.permission === "denied") return "negado";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    return sub && Notification.permission === "granted" ? "ativo" : "inativo";
  } catch (e) {
    return "inativo";
  }
}
async function ativarPush() {
  if (!pushSuportado()) throw new Error(ehIOS() ? "No iPhone, primeiro instale o app (Compartilhar → Adicionar à Tela de Início) e abra pelo ícone." : "Este navegador não aceita notificações. Use o Chrome.");
  if (ehIOS() && !appInstalado()) throw new Error("No iPhone, primeiro instale o app (Compartilhar → Adicionar à Tela de Início) e abra pelo ícone.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Você não permitiu as notificações. Para ligar depois: cadeado ao lado do endereço → Notificações → Permitir.");
  const reg = await navigator.serviceWorker.ready;
  const {
    publicKey
  } = await apiFetch("/api/push");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: chaveParaBytes(publicKey)
  });
  await apiFetch("/api/push", {
    method: "POST",
    body: JSON.stringify({
      subscription: sub.toJSON()
    })
  });
  await apiFetch("/api/push", {
    method: "POST",
    body: JSON.stringify({
      teste: true
    })
  }).catch(() => {});
}
async function desativarPush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) {
    await apiFetch("/api/push", {
      method: "DELETE",
      body: JSON.stringify({
        endpoint: sub.endpoint
      })
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
function BotaoPush({
  compacto = false
}) {
  const [estado, setEstado] = useState(null);
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    estadoPush().then(setEstado);
  }, []);
  if (estado === null || estado === "sem-suporte" && !ehIOS()) return null;
  const ligar = async () => {
    setMsg("");
    setOcupado(true);
    try {
      await ativarPush();
      setEstado("ativo");
      setMsg("✓ Pronto! Mandamos uma notificação de teste.");
    } catch (err) {
      setMsg(err.message);
      setEstado(await estadoPush());
    }
    setOcupado(false);
  };
  const desligar = async () => {
    setOcupado(true);
    await desativarPush();
    setEstado("inativo");
    setMsg("");
    setOcupado(false);
  };
  const ligado = estado === "ativo";
  return /*#__PURE__*/React.createElement("div", {
    className: compacto ? "" : "mb-1"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: ligado ? desligar : ligar,
    disabled: ocupado,
    role: "switch",
    "aria-checked": ligado,
    "aria-label": "Notifica\xE7\xF5es neste celular",
    style: {
      borderColor: C.border
    },
    className: "w-full flex items-center justify-between border rounded px-3 py-2 disabled:opacity-60"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.ink
    },
    className: "text-sm font-bold"
  }, ligado ? "🔔" : "🔕", " Notifica\xE7\xF5es"), /*#__PURE__*/React.createElement("span", {
    style: {
      background: ligado ? C.green : C.border
    },
    className: "relative inline-block w-11 h-6 rounded-full transition-colors"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      left: ligado ? "22px" : "2px"
    },
    className: "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
  }))), estado === "negado" && !msg && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-[11px] font-mono mt-1"
  }, "Bloqueadas no navegador: cadeado ao lado do endere\xE7o \u2192 Notifica\xE7\xF5es \u2192 Permitir."), msg && !msg.startsWith("✓") && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-[11px] font-mono mt-1"
  }, msg));
}
function AvisosPainel({
  dados,
  onFechar,
  onAbrirAviso,
  onConfigurar
}) {
  const lista = dados?.avisos || [];
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-[45]",
    onClick: onFechar
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      borderColor: C.border,
      bottom: "64px"
    },
    className: "absolute left-2 right-2 sm:left-auto sm:w-96 border rounded-lg shadow-2xl flex flex-col max-h-[65vh]",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border
    },
    className: "flex items-center justify-between px-4 py-2.5 border-b"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm font-extrabold uppercase tracking-wide"
  }, "\uD83D\uDD14 Avisos"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onConfigurar,
    title: "Configurar avisos",
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "\u2699 Configurar"), /*#__PURE__*/React.createElement("button", {
    onClick: onFechar,
    style: {
      color: C.inkMuted
    },
    className: "text-xl leading-none"
  }, "\xD7"))), /*#__PURE__*/React.createElement("div", {
    className: "overflow-y-auto p-2 space-y-1.5"
  }, /*#__PURE__*/React.createElement(BotaoPush, {
    compacto: true
  }), !dados && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono text-center py-6"
  }, "Carregando..."), dados && lista.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono text-center py-6"
  }, "Nenhum aviso nos \xFAltimos 30 dias."), lista.map(a => /*#__PURE__*/React.createElement("button", {
    key: a.id,
    onClick: () => onAbrirAviso(a),
    style: {
      background: a.lido ? "transparent" : C.bg,
      borderLeftColor: a.lido ? C.border : a.paraVoce ? C.rust : C.amber
    },
    className: "w-full text-left border-l-4 rounded-r px-3 py-2"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm leading-snug"
  }, /*#__PURE__*/React.createElement("b", null, a.autor_nome), " ", a.texto), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mt-0.5"
  }, a.paraVoce && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.rust
    },
    className: "font-bold uppercase"
  }, "para voc\xEA \xB7 "), a.obra_nome ? `${a.obra_nome} · ` : "", tempoAtras(a.criado_em)))))));
}
function AvisosConfigModal({
  usuario,
  prefs,
  onClose,
  onSalvo
}) {
  const abaixo = CADEIA_AVISOS.filter(r => POS_AVISOS[r] > POS_AVISOS[usuario.rank]);
  const maxProf = Math.min(5, abaixo.length);
  const [prof, setProf] = useState(Math.min(prefs?.profundidade || 1, Math.max(1, maxProf)));
  const [mods, setMods] = useState(() => ({
    ...(prefs?.modulos || {})
  }));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const RANKS_CURTOS = {
    1: "Dono",
    2: "Eng. Chefe",
    4: "Mestre",
    5: "Encarregado",
    7: "Chefe de Turma",
    8: "Profissional"
  };
  const salvar = async () => {
    setErro("");
    setSalvando(true);
    try {
      const r = await apiFetch("/api/avisos", {
        method: "PATCH",
        body: JSON.stringify({
          profundidade: Math.max(1, prof),
          modulos: mods
        })
      });
      onSalvo(r.prefs);
      onClose();
    } catch (err) {
      setErro(err.message);
    }
    setSalvando(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-5 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-3"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-base font-extrabold uppercase tracking-wide"
  }, "\uD83D\uDD14 Configurar avisos"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.inkMuted
    },
    className: "text-xl leading-none"
  }, "\xD7")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs mb-3"
  }, "Voc\xEA sempre recebe o que \xE9 ", /*#__PURE__*/React.createElement("b", null, "para voc\xEA"), " (pedidos, entregas, o que apagaram de seu) e as novidades de quem est\xE1 acima. Aqui voc\xEA escolhe o que quer saber de quem est\xE1 ", /*#__PURE__*/React.createElement("b", null, "abaixo"), "."), maxProf > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-xs font-mono uppercase mb-1.5"
  }, RANK_LABELS[usuario.rank], " \u2014 Quero saber o que acontece at\xE9:"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 mb-1"
  }, Array.from({
    length: maxProf
  }, (_, i) => i + 1).map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    onClick: () => setProf(n),
    style: {
      background: prof === n ? C.amber : "transparent",
      borderColor: prof === n ? C.amber : C.border,
      color: prof === n ? "#fff" : C.ink
    },
    className: "border rounded px-3 py-1.5 text-sm font-bold"
  }, n))), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mb-4"
  }, "rank(s) abaixo de mim: at\xE9 ", /*#__PURE__*/React.createElement("b", null, RANKS_CURTOS[abaixo[prof - 1]] || ""), prof === 1 ? " (só o escalão imediato)" : "")) : /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono mb-4"
  }, "Voc\xEA recebe as novidades da obra e o que \xE9 para voc\xEA."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-xs font-mono uppercase mb-1.5"
  }, "Gavetas:"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-1.5 mb-4"
  }, CATEGORIAS_AVISO.map(c => {
    const ligado = mods[c.key] !== false;
    return /*#__PURE__*/React.createElement("button", {
      key: c.key,
      onClick: () => setMods({
        ...mods,
        [c.key]: !ligado ? undefined : false
      }),
      style: {
        borderColor: ligado ? C.green : C.border,
        color: ligado ? C.ink : C.inkMuted
      },
      className: "border rounded px-2 py-1.5 text-xs text-left"
    }, ligado ? "✅" : "⬜", " ", c.label);
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mb-3"
  }, "D\xE1 para silenciar uma obra inteira no bot\xE3o \uD83D\uDD14 da pr\xF3pria obra. Gavetas com \uD83D\uDD12 n\xE3o mandam avisos."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-xs font-mono uppercase mb-1.5"
  }, "No celular:"), /*#__PURE__*/React.createElement("div", {
    className: "mb-4"
  }, /*#__PURE__*/React.createElement(BotaoPush, null), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mt-1"
  }, "Os mesmos avisos da \uD83D\uDD14 chegam como notifica\xE7\xE3o, mesmo com o app fechado.")), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mb-2"
  }, erro), /*#__PURE__*/React.createElement("button", {
    onClick: salvar,
    disabled: salvando,
    style: {
      background: C.amber
    },
    className: "w-full text-white font-bold uppercase tracking-wide rounded py-2.5 disabled:opacity-50"
  }, salvando ? "Salvando..." : "Salvar")));
}
function BottomNav({
  onInicio,
  onConfig,
  onAjuda,
  onAvisos,
  naoLidos = 0,
  active
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      borderColor: C.border
    },
    className: "fixed bottom-0 left-0 right-0 border-t flex justify-around items-center py-2 z-40"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onInicio,
    className: "flex flex-col items-center gap-0.5 px-3 py-1"
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo_home_11.webp",
    alt: "In\xEDcio",
    className: "w-6 h-6 object-contain",
    style: {
      opacity: active === "inicio" ? 1 : 0.55
    },
    draggable: "false"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: active === "inicio" ? C.amber : C.inkMuted
    },
    className: "text-[11px] font-mono uppercase"
  }, "In\xEDcio")), /*#__PURE__*/React.createElement("button", {
    onClick: onAjuda,
    className: "flex flex-col items-center gap-0.5 px-3 py-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-6 h-6 flex items-center justify-center text-lg leading-none",
    style: {
      opacity: active === "ajuda" ? 1 : 0.55
    }
  }, "\u2753"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: active === "ajuda" ? C.amber : C.inkMuted
    },
    className: "text-[11px] font-mono uppercase"
  }, "Ajuda")), onAvisos && /*#__PURE__*/React.createElement("button", {
    onClick: onAvisos,
    className: "relative flex flex-col items-center gap-0.5 px-3 py-1",
    "aria-label": `Avisos${naoLidos ? `: ${naoLidos} novos` : ""}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-6 h-6 flex items-center justify-center text-lg leading-none",
    style: {
      opacity: active === "avisos" ? 1 : 0.7
    }
  }, "\uD83D\uDD14"), naoLidos > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      background: C.rust
    },
    className: "absolute top-0 right-3 text-white text-[10px] font-extrabold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center"
  }, naoLidos > 99 ? "99+" : naoLidos), /*#__PURE__*/React.createElement("span", {
    style: {
      color: active === "avisos" ? C.amber : C.inkMuted
    },
    className: "text-[11px] font-mono uppercase"
  }, "Avisos")), /*#__PURE__*/React.createElement("button", {
    onClick: onConfig,
    className: "flex flex-col items-center gap-0.5 px-3 py-1"
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo_config_12.webp",
    alt: "Config",
    className: "w-6 h-6 object-contain",
    style: {
      opacity: 0.55
    },
    draggable: "false"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono uppercase"
  }, "Config")));
}

// ---------- Google Drive (backup do Dono) ----------
// Ícone oficial do Drive (arquivo drive-logo.png na raiz do site). Se faltar, mostra ☁️.
function IconeDrive() {
  const [falhou, setFalhou] = useState(false);
  return falhou ? /*#__PURE__*/React.createElement("span", null, "\u2601\uFE0F") : /*#__PURE__*/React.createElement("img", {
    src: "drive-logo.png",
    alt: "",
    className: "w-4 h-4 object-contain",
    draggable: "false",
    onError: () => setFalhou(true)
  });
}
const DRIVE_ESCOPO = "https://www.googleapis.com/auth/drive.file";
const DRIVE_PASTA = "G&C backup";
const DRIVE_MANTER = 10;
let driveToken = null; // { valor, vence } — só na memória deste aparelho

function carregarGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((ok, erro) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => erro(new Error("Não foi possível falar com o Google. Confira a internet e tente de novo."));
    document.head.appendChild(s);
  });
}

// Carregado já ao abrir o Config (do Dono): assim a janela do Google abre logo no toque
// e o navegador não a bloqueia como "pop-up".
let driveClientId = null;
async function prepararDrive() {
  if (!driveClientId) {
    const cfg = await fetch("/api/google-config").then(r => r.json()).catch(() => ({}));
    driveClientId = cfg.clientId || null;
  }
  await carregarGoogleIdentity();
}
async function tokenDrive(emailDica) {
  if (driveToken && driveToken.vence > Date.now() + 60000) return driveToken.valor;
  await prepararDrive();
  const cfg = {
    clientId: driveClientId
  };
  if (!cfg.clientId) throw new Error("Backup no Drive indisponível no momento. Use \"Celular Backup\".");
  return new Promise((ok, erro) => {
    const cliente = window.google.accounts.oauth2.initTokenClient({
      client_id: cfg.clientId,
      scope: DRIVE_ESCOPO,
      hint: emailDica || undefined,
      callback: resp => {
        if (resp.error || !resp.access_token) return erro(new Error("O Google não autorizou o acesso ao Drive."));
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_ESCOPO)) return erro(new Error("Para salvar no Drive, marque a permissão do Google Drive na tela do Google."));
        driveToken = {
          valor: resp.access_token,
          vence: Date.now() + (Number(resp.expires_in) || 3600) * 1000
        };
        ok(resp.access_token);
      },
      error_callback: () => erro(new Error("A janela do Google foi fechada antes de autorizar."))
    });
    cliente.requestAccessToken({
      prompt: ""
    });
  });
}
async function driveApi(token, url, opcoes = {}) {
  const r = await fetch(url, {
    ...opcoes,
    headers: {
      authorization: `Bearer ${token}`,
      ...(opcoes.headers || {})
    }
  });
  if (r.status === 401) {
    driveToken = null;
    throw new Error("A conexão com o Drive venceu. Toque em \"Drive Backup\" de novo.");
  }
  if (r.status === 403) {
    const t = await r.text().catch(() => "");
    throw new Error(/storageQuota/i.test(t) ? "Seu Google Drive está cheio. Libere espaço ou use \"Celular Backup\"." : "O Google recusou o envio ao Drive.");
  }
  if (!r.ok) throw new Error("Falha ao falar com o Google Drive (" + r.status + ").");
  return r;
}
async function subirParaDrive(token, blob, nome) {
  const API = "https://www.googleapis.com/drive/v3/files";
  const q = s => encodeURIComponent(s);
  // 1) Pasta "G&C backup" (o G&C só enxerga a que ele mesmo criou)
  const busca = await (await driveApi(token, `${API}?q=${q(`name='${DRIVE_PASTA}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&spaces=drive`)).json();
  let pastaId = busca.files?.[0]?.id;
  if (!pastaId) {
    const nova = await (await driveApi(token, `${API}?fields=id`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: DRIVE_PASTA,
        mimeType: "application/vnd.google-apps.folder"
      })
    })).json();
    pastaId = nova.id;
  }
  // 2) Envio "retomável" (serve para arquivos grandes, com muitas fotos)
  const inicio = await driveApi(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "application/zip",
      "x-upload-content-length": String(blob.size)
    },
    body: JSON.stringify({
      name: nome,
      parents: [pastaId],
      mimeType: "application/zip",
      appProperties: {
        gc: "backup"
      }
    })
  });
  const destino = inicio.headers.get("location");
  if (!destino) throw new Error("O Google Drive não aceitou iniciar o envio.");
  await driveApi(token, destino, {
    method: "PUT",
    headers: {
      "content-type": "application/zip"
    },
    body: blob
  });
  // 3) Guarda só os mais novos: os velhos criados pelo G&C vão para a lixeira (recuperáveis por 30 dias)
  try {
    const lista = await (await driveApi(token, `${API}?q=${q(`'${pastaId}' in parents and trashed=false and appProperties has { key='gc' and value='backup' }`)}&orderBy=createdTime desc&pageSize=100&fields=files(id)`)).json();
    for (const f of (lista.files || []).slice(DRIVE_MANTER)) {
      await driveApi(token, `${API}/${f.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          trashed: true
        })
      });
    }
  } catch (e) {/* limpar é opcional: o backup novo já está salvo */}
}
function ConfigDrawer({
  usuario,
  temaEscuro,
  onAlternarTema,
  onSair,
  onClose,
  onExcluirConta,
  onAbrirMeuPin,
  onAbrirMeusDados,
  onAbrirPermissoes,
  onAbrirLeads,
  onAbrirDefinirSenha,
  onAbrirAvisos,
  onBackupCelular,
  onBackupDrive,
  fazendoBackup
}) {
  // Tamanho da letra: guardado neste aparelho. Normal → Grande → Muito grande.
  const [fonte, setFonte] = useState(() => {
    try {
      return localStorage.getItem("gc-fonte") || "normal";
    } catch (e) {
      return "normal";
    }
  });
  const trocarFonte = () => {
    const ordem = ["normal", "grande", "enorme"];
    const nova = ordem[(ordem.indexOf(fonte) + 1) % ordem.length];
    setFonte(nova);
    try {
      localStorage.setItem("gc-fonte", nova);
    } catch (e) {}
    document.documentElement.style.setProperty("--fs", {
      normal: 1.12,
      grande: 1.25,
      enorme: 1.4
    }[nova]);
  };
  useEffect(() => {
    if (usuario.rank === 1) prepararDrive().catch(() => {});
  }, []);
  // Todos os itens com o mesmo formato: ícone à esquerda, texto alinhado, mesma altura.
  const Item = ({
    icone,
    texto,
    onClick,
    href,
    perigo,
    disabled
  }) => {
    const estilo = {
      borderColor: perigo ? C.rust : C.border,
      color: perigo ? C.rust : C.ink
    };
    const classe = "w-full border rounded px-3 py-2.5 text-sm font-mono flex items-center gap-3 text-left leading-tight disabled:opacity-50";
    const conteudo = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "w-5 shrink-0 flex items-center justify-center text-base leading-none"
    }, icone), /*#__PURE__*/React.createElement("span", {
      className: "flex-1"
    }, texto));
    return href ? /*#__PURE__*/React.createElement("a", {
      href: href,
      target: "_blank",
      rel: "noopener",
      style: estilo,
      className: classe
    }, conteudo) : /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      disabled: disabled,
      style: estilo,
      className: classe
    }, conteudo);
  };
  const Titulo = ({
    children
  }) => /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[10px] font-mono uppercase tracking-widest mt-4 mb-1.5 px-1"
  }, children);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const encerrarEmpresa = async () => {
    const ok = window.confirm("Você é o Dono: excluir a sua conta significa ENCERRAR A EMPRESA inteira (todas as obras, fotos, documentos e contas da equipe).\n\nO pedido vai para o suporte, que confirma com você pelo e-mail da conta antes de apagar. Concluímos em até 15 dias.\n\nEnviar o pedido agora?");
    if (!ok) return;
    setEnviandoPedido(true);
    try {
      await apiFetch("/api/encerrar-empresa", {
        method: "POST",
        body: "{}"
      });
      window.alert(`Pedido enviado ao suporte.\n\nVamos responder no e-mail ${usuario.email || "da sua conta"} para confirmar antes de apagar qualquer coisa.`);
    } catch (err) {
      window.alert(`Não foi possível enviar o pedido agora (${err.message}).\n\nEscreva para suporte@gestaoecontrole.app.br a partir do e-mail da conta, com o assunto "Encerrar empresa no G&C".`);
    }
    setEnviandoPedido(false);
  };
  const temEmpresa = usuario.rank <= 3 || usuario.rank === 1 || usuario.email === "marcelojavierbonet@gmail.com";
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex justify-end"
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    className: "absolute inset-0 bg-black/40"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      borderColor: C.border,
      height: "100dvh"
    },
    className: "relative w-72 max-w-[85vw] shadow-2xl border-l flex flex-col"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border
    },
    className: "px-4 pt-3 pb-3 border-b shrink-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.inkMuted
    },
    className: "text-2xl leading-none w-8 h-8 -mr-1",
    "aria-label": "Fechar"
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "G&C",
    className: "w-11 h-11 rounded-full shrink-0"
  }), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-1"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "font-bold text-sm truncate"
  }, usuario.nome), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono truncate"
  }, usuario.email), /*#__PURE__*/React.createElement("span", {
    style: {
      background: C.bg,
      color: C.inkMuted,
      borderColor: C.border
    },
    className: "inline-block border rounded px-2 py-0.5 mt-1 text-[10px] font-mono uppercase tracking-wide"
  }, RANK_LABELS[usuario.rank])))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto px-4 pb-4"
  }, /*#__PURE__*/React.createElement(Titulo, null, "Minha conta"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDD11",
    texto: usuario.tem_senha ? "Trocar senha" : "Definir senha",
    onClick: onAbrirDefinirSenha
  }), onAbrirMeuPin && /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDCF1",
    texto: usuario.tem_pin ? "Trocar meu PIN" : "Criar meu PIN",
    onClick: onAbrirMeuPin
  }), onAbrirMeusDados && /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDDC2",
    texto: "Exportar meus dados",
    onClick: onAbrirMeusDados
  }), /*#__PURE__*/React.createElement(Item, {
    icone: temaEscuro ? "☀️" : "🌙",
    texto: temaEscuro ? "Modo claro" : "Modo escuro",
    onClick: onAlternarTema
  }), onAbrirAvisos && /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDD14",
    texto: "Avisos: o que quero saber",
    onClick: onAbrirAvisos
  }), /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDD20",
    texto: `Tamanho da letra: ${{
      normal: "Normal",
      grande: "Grande",
      enorme: "Muito grande"
    }[fonte]}`,
    onClick: trocarFonte
  })), temEmpresa && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Titulo, null, "Empresa"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, usuario.rank <= 3 && /*#__PURE__*/React.createElement(Item, {
    icone: /*#__PURE__*/React.createElement("img", {
      src: "logo_permissoes_13.webp",
      alt: "",
      className: "w-4 h-4 object-contain",
      draggable: "false"
    }),
    texto: "Permiss\xF5es",
    onClick: onAbrirPermissoes
  }), usuario.rank === 1 && fazendoBackup && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono px-1"
  }, "\u23F3 ", typeof fazendoBackup === "string" ? fazendoBackup : "Gerando...", " (n\xE3o feche a tela)"), usuario.rank === 1 && /*#__PURE__*/React.createElement(Item, {
    icone: /*#__PURE__*/React.createElement(IconeDrive, null),
    texto: "Drive Backup",
    onClick: onBackupDrive,
    disabled: !!fazendoBackup
  }), usuario.rank === 1 && /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDCE5",
    texto: "Celular Backup",
    onClick: onBackupCelular,
    disabled: !!fazendoBackup
  }), usuario.email === "marcelojavierbonet@gmail.com" && /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDEE0",
    texto: "Painel admin",
    href: "/admin"
  }))), /*#__PURE__*/React.createElement(Titulo, null, "Ajuda e legal"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDCD8",
    texto: "Manual do usu\xE1rio",
    href: "/manual"
  }), /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDCC4",
    texto: "Termos de Uso",
    href: "/termos"
  }), /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDEE1\uFE0F",
    texto: "Pol\xEDtica de Privacidade",
    href: "/privacidade"
  })), /*#__PURE__*/React.createElement(Titulo, null, "Sess\xE3o"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDCF5",
    texto: "Sair de todos os aparelhos",
    onClick: async () => {
      if (!window.confirm("Fechar a sessão em TODOS os outros aparelhos (celulares, computadores) onde você entrou? Este aparelho continua logado.")) return;
      try {
        await apiFetch("/api/usuarios-me", {
          method: "PATCH",
          body: JSON.stringify({
            sairDeTodos: true
          })
        });
        window.alert("Pronto! Os outros aparelhos vão pedir para entrar de novo.");
      } catch (err) {
        window.alert(err.message);
      }
    }
  }), /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDD12",
    texto: "Sair",
    onClick: onSair,
    perigo: true
  })), (usuario.rank === 1 || onExcluirConta) && /*#__PURE__*/React.createElement("div", {
    className: "mt-6"
  }, usuario.rank === 1 ? /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDEAB",
    texto: enviandoPedido ? "Enviando pedido..." : "Excluir conta e encerrar empresa",
    onClick: encerrarEmpresa,
    disabled: enviandoPedido,
    perigo: true
  }) : /*#__PURE__*/React.createElement(Item, {
    icone: "\uD83D\uDEAB",
    texto: "Excluir minha conta",
    onClick: onExcluirConta,
    perigo: true
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[10px] font-mono text-center mt-6"
  }, "\xA9 2026 Gest\xE3o & Controle"))));
}
function MeuPinModal({
  usuario,
  onClose,
  forcado
}) {
  // forcado = PIN antigo de 4 números: desde 09/11/2026 o PIN tem 6 (Bloco D). A tela não fecha sem trocar.
  const [cpf, setCpf] = useState("");
  const [pinAtual, setPinAtual] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const jaTemCpf = !!usuario.cpf_mascarado;
  const salvar = async () => {
    setErro("");
    if (usuario.tem_pin && !/^\d{4,6}$/.test(pinAtual)) {
      setErro("Digite seu PIN atual.");
      return;
    }
    if (!cpfValido(cpf)) {
      setErro("CPF inválido. Confira os números.");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setErro("O PIN novo precisa ter 6 números.");
      return;
    }
    if (pin !== pin2) {
      setErro("Os dois PIN não são iguais.");
      return;
    }
    setSalvando(true);
    try {
      await apiFetch("/api/usuarios-me", {
        method: "PATCH",
        body: JSON.stringify({
          cpf: limparCpf(cpf),
          pin,
          pinAtual: usuario.tem_pin ? pinAtual : undefined
        })
      });
      setOk(true);
    } catch (err) {
      setErro(err.message);
    }
    setSalvando(false);
  };
  const campoPin = (valor, setValor, extra = {}) => /*#__PURE__*/React.createElement("input", _extends({
    value: valor,
    onChange: e => setValor(e.target.value.replace(/\D/g, "").slice(0, 6)),
    type: "password",
    inputMode: "numeric",
    autoComplete: "off",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 mb-3 outline-none text-xl tracking-[0.4em] text-center"
  }, extra));
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-6 w-full max-w-sm shadow-xl"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide mb-1"
  }, "\uD83D\uDCF1 ", forcado ? "PIN novo de 6 números" : usuario.tem_pin ? "Trocar meu PIN" : "Criar meu PIN"), ok ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.green
    },
    className: "text-sm my-4"
  }, "Pronto! Na pr\xF3xima vez, entre com seu CPF e o PIN novo de 6 n\xFAmeros."), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: C.teal
    },
    className: "w-full text-white font-bold uppercase tracking-wide text-sm rounded py-2.5"
  }, "Fechar")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs mb-3"
  }, forcado ? "Para deixar sua conta mais segura, o PIN agora tem 6 números. Crie o seu novo PIN para continuar." : "Para entrar com CPF + PIN, sem precisar de email nem Google."), usuario.tem_pin && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Seu PIN atual"), campoPin(pinAtual, setPinAtual)), /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, jaTemCpf ? `Confirme seu CPF (${usuario.cpf_mascarado})` : "Seu CPF"), /*#__PURE__*/React.createElement("input", {
    value: cpf,
    onChange: e => setCpf(formatarCpf(e.target.value)),
    inputMode: "numeric",
    placeholder: "000.000.000-00",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 mb-3 outline-none tracking-wider"
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "PIN novo (6 n\xFAmeros)"), campoPin(pin, setPin), /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Repita o PIN novo"), campoPin(pin2, setPin2, {
    onKeyDown: e => e.key === "Enter" && salvar()
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mt-1"
  }, "N\xE3o use 123456, n\xFAmeros repetidos (111111, 121212) nem parte do CPF."), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-2"
  }, erro), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-4"
  }, !forcado && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 border font-bold uppercase tracking-wide text-sm rounded py-2.5"
  }, "Cancelar"), /*#__PURE__*/React.createElement("button", {
    onClick: salvar,
    disabled: salvando,
    style: {
      background: C.teal
    },
    className: "flex-1 text-white font-bold uppercase tracking-wide text-sm rounded py-2.5 disabled:opacity-50"
  }, salvando ? "..." : "Salvar")))));
}

// "Exportar meus dados" (LGPD): página legível para ler/imprimir/salvar em PDF + arquivo JSON.
function escHtml(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}
function dataBR(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d) ? escHtml(v) : d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });
}
function htmlMeusDados(d) {
  const tabela = (titulo, linhas, colunas) => {
    if (!linhas || !linhas.length) return `<h2>${titulo}</h2><p class="vazio">Nada registrado.</p>`;
    return `<h2>${titulo} <small>(${linhas.length})</small></h2><table><tr>${colunas.map(c => `<th>${c[0]}</th>`).join("")}</tr>` + linhas.map(l => `<tr>${colunas.map(c => `<td>${c[1](l)}</td>`).join("")}</tr>`).join("") + `</table>`;
  };
  const c = d.cadastro || {};
  const RANKS = ["", "Dono", "Eng. Chefe de Obra", "Eng. Estagiário", "Mestre de Obra", "Encarregado", "Almoxarife", "Chefe de Turma", "Profissional"];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Meus dados — G&amp;C</title>
<style>body{font-family:system-ui,sans-serif;color:#1A1815;max-width:900px;margin:0 auto;padding:20px;font-size:14px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:26px 0 8px;border-bottom:2px solid #D98E04;padding-bottom:4px}small{color:#777;font-weight:normal}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f3efe6}dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px}dt{color:#666}.vazio{color:#888}.meta{color:#666;font-size:12px}
.barra{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:8px}.barra button{background:#D98E04;color:#fff;border:0;border-radius:6px;padding:9px 14px;font-weight:700;cursor:pointer}@media print{.barra{display:none}}</style></head><body>
<div class="barra"><button id="imprimir">🖨 Imprimir / salvar em PDF</button></div>
<h1>Meus dados no Gestão &amp; Controle</h1><p class="meta">Gerado em ${dataBR(d.gerado_em)} · ${escHtml(d.sobre)}</p>
<h2>Cadastro</h2><dl>
<dt>Nome</dt><dd>${escHtml(c.nome)}</dd><dt>E-mail</dt><dd>${escHtml(c.email || "—")}${c.email ? c.email_confirmado ? " (confirmado)" : " (não confirmado)" : ""}</dd>
<dt>CPF</dt><dd>${escHtml(c.cpf || "—")}</dd><dt>Telefone</dt><dd>${escHtml(c.telefone || "—")}</dd>
<dt>Empresa</dt><dd>${escHtml(c.empresa || "—")}</dd><dt>Rank</dt><dd>${escHtml(RANKS[c.rank] || c.rank)}</dd>
<dt>Conta criada em</dt><dd>${dataBR(c.conta_criada_em)}</dd><dt>Formas de entrar</dt><dd>${[c.entra_com_senha && "e-mail e senha", c.entra_com_pin && "CPF e PIN"].filter(Boolean).join(", ") || "Google"}</dd>
<dt>Termos aceitos</dt><dd>${c.termos_aceitos ? `versão ${escHtml(c.termos_aceitos.versao)} em ${dataBR(c.termos_aceitos.em)}` : "—"}</dd></dl>
${tabela("Obras em que participa", d.obras, [["Obra", l => escHtml(l.obra)], ["Endereço", l => escHtml(l.endereco)], ["Função", l => escHtml(l.funcao)], ["Situação", l => escHtml(l.estado)], ["Dias de presença", l => (Array.isArray(l.presencas) ? l.presencas.length : 0) + (Array.isArray(l.presencas) && l.presencas.length ? `<br><small>${l.presencas.map(escHtml).join(", ")}</small>` : "")]])}
${tabela("Observações (livro de obra) que você escreveu", d.observacoes, [["Obra", l => escHtml(l.obra)], ["Texto", l => escHtml(l.texto) + (l.versoes_anteriores && l.versoes_anteriores.length ? `<br><small>Versões anteriores: ${l.versoes_anteriores.map(v => `“${escHtml(v.texto)}” (${dataBR(v.substituido_em)})`).join(" · ")}</small>` : "")], ["Escrita em", l => dataBR(l.criado_em)]])}
${tabela("Pedidos e entregas", d.pedidos, [["Obra", l => escHtml(l.obra)], ["Você", l => escHtml(l.papel)], ["Outra pessoa", l => escHtml(l.outra_pessoa)], ["Tipo", l => escHtml(l.tipo)], ["Descrição", l => escHtml(l.descricao) + (l.quantidade ? ` (${escHtml(l.quantidade)})` : "")], ["Situação", l => escHtml(l.status)], ["Data", l => dataBR(l.criado_em)]])}
${tabela("Etapas", d.etapas, [["Obra", l => escHtml(l.obra)], ["Etapa", l => escHtml(l.texto)], ["Criada por você", l => l.criada_por_voce ? "sim" : ""], ["Concluída por você em", l => dataBR(l.concluida_por_voce_em)]])}
${tabela("Materiais e ferramentas que você registrou", d.materiais_e_ferramentas, [["Tipo", l => escHtml(l.tipo)], ["Obra", l => escHtml(l.obra)], ["Item", l => escHtml(l.texto)], ["Data", l => dataBR(l.criado_em)]])}
${tabela("Fotos e documentos que você enviou", d.arquivos_enviados, [["Tipo", l => escHtml(l.tipo)], ["Obra", l => escHtml(l.obra)], ["Nome / etapa", l => escHtml(l.nome)], ["Data", l => dataBR(l.criado_em)]])}
${tabela("Registros de acesso (últimos 6 meses)", d.registros_de_acesso, [["Quando", l => dataBR(l.quando)], ["Como", l => escHtml(l.como)], ["IP", l => escHtml(l.ip)]])}
</body></html>`;
}
function MeusDadosModal({
  onClose
}) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    apiFetch("/api/meus-dados").then(setDados).catch(e => setErro(e.message));
  }, []);
  const verPagina = () => {
    const w = window.open("", "_blank");
    if (!w) {
      setErro("O navegador bloqueou a nova aba. Permita pop-ups para este site e tente de novo.");
      return;
    }
    w.document.open();
    w.document.write(htmlMeusDados(dados));
    w.document.close();
    // Sem onclick dentro da página (a CSP do app não deixa): o botão é ligado daqui.
    try {
      const bt = w.document.getElementById("imprimir");
      if (bt) bt.addEventListener("click", () => w.print());
    } catch (e) {}
  };
  const baixarJson = () => {
    const {
      ok,
      ...conteudo
    } = dados;
    const url = URL.createObjectURL(new Blob([JSON.stringify(conteudo, null, 2)], {
      type: "application/json"
    }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `meus-dados-gc-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const n = k => dados && Array.isArray(dados[k]) ? dados[k].length : 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-6 w-full max-w-sm shadow-xl",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-3"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide"
  }, "\uD83D\uDCE5 Meus dados"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.inkMuted
    },
    className: "text-xl leading-none"
  }, "\xD7")), !dados && !erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono"
  }, "Reunindo seus dados..."), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono"
  }, erro), dados && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm mb-2"
  }, "Tudo o que o G&C guarda sobre voc\xEA:"), /*#__PURE__*/React.createElement("ul", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono mb-4 space-y-0.5"
  }, /*#__PURE__*/React.createElement("li", null, "\u2022 Cadastro e formas de entrar"), /*#__PURE__*/React.createElement("li", null, "\u2022 ", n("obras"), " obra(s) e suas presen\xE7as"), /*#__PURE__*/React.createElement("li", null, "\u2022 ", n("observacoes"), " observa\xE7\xE3o(\xF5es) \xB7 ", n("pedidos"), " pedido(s) \xB7 ", n("etapas"), " etapa(s)"), /*#__PURE__*/React.createElement("li", null, "\u2022 ", n("arquivos_enviados"), " foto(s)/documento(s) enviados"), /*#__PURE__*/React.createElement("li", null, "\u2022 ", n("registros_de_acesso"), " registro(s) de acesso")), /*#__PURE__*/React.createElement("button", {
    onClick: verPagina,
    style: {
      background: C.amber
    },
    className: "w-full text-white font-bold uppercase tracking-wide rounded py-2.5"
  }, "\uD83D\uDCC4 Ver e imprimir (PDF)"), /*#__PURE__*/React.createElement("button", {
    onClick: baixarJson,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border font-bold uppercase tracking-wide text-sm rounded py-2.5 mt-2"
  }, "\u2913 Baixar arquivo (JSON)"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mt-3"
  }, "O arquivo JSON serve para levar seus dados a outro sistema (portabilidade, LGPD)."))));
}

// Campo de senha com o botão "ver senha" (olhinho). Vale para cadastro, login e troca de senha.
// O botão só alterna a exibição neste aparelho; nada é enviado nem guardado.
function CampoSenha({
  value,
  onChange,
  onKeyDown,
  autoComplete,
  placeholder,
  autoFocus,
  margem
}) {
  const [ver, setVer] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    className: margem || "mt-1"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: ver ? "text" : "password",
    value: value,
    onChange: onChange,
    onKeyDown: onKeyDown,
    autoComplete: autoComplete,
    placeholder: placeholder,
    autoFocus: autoFocus,
    autoCapitalize: "off",
    autoCorrect: "off",
    spellCheck: false,
    style: {
      borderColor: C.border,
      color: C.ink,
      paddingRight: 46
    },
    className: "w-full border rounded px-3 py-2 outline-none"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setVer(!ver),
    "aria-label": ver ? "Ocultar senha" : "Mostrar senha",
    "aria-pressed": ver,
    title: ver ? "Ocultar senha" : "Mostrar senha",
    style: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      width: 44,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: 18,
      lineHeight: 1,
      opacity: ver ? 1 : 0.6
    }
  }, ver ? "🙈" : "👁")));
}
function DefinirSenhaModal({
  usuario,
  onClose
}) {
  const jaTemSenha = !!usuario?.tem_senha;
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    setErro("");
    if (jaTemSenha && !senhaAtual) {
      setErro("Digite a sua senha atual.");
      return;
    }
    if (senha.length < 8) {
      setErro("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== senha2) {
      setErro("As senhas não coincidem.");
      return;
    }
    setSalvando(true);
    try {
      await apiFetch("/api/usuarios-me", {
        method: "PATCH",
        body: JSON.stringify({
          novaSenha: senha,
          senhaAtual: jaTemSenha ? senhaAtual : undefined
        })
      });
      // Oferece salvar no gerenciador de senhas do navegador (Google Password Manager no Chrome).
      try {
        if (window.PasswordCredential) {
          const cred = new window.PasswordCredential({
            id: usuario.email,
            password: senha,
            name: usuario.nome
          });
          await navigator.credentials.store(cred);
        }
      } catch (e) {/* navegador sem suporte, ou usuário recusou — segue normal */}
      setOk(true);
    } catch (err) {
      setErro(err.message);
    }
    setSalvando(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-6 w-full max-w-sm shadow-xl"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-4"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide"
  }, jaTemSenha ? "Trocar senha" : "Definir senha"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      color: C.inkMuted
    },
    className: "text-xl"
  }, "\xD7")), ok ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm"
  }, "Senha salva! Agora voc\xEA tamb\xE9m pode entrar com email e senha, sem depender do Google. Por seguran\xE7a, os outros aparelhos em que voc\xEA estava logado v\xE3o pedir para entrar de novo."), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: C.amber
    },
    className: "w-full mt-5 text-white font-bold uppercase tracking-wide rounded py-2.5"
  }, "Fechar")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono mb-3"
  }, "\xDAtil se voc\xEA entrou com Google \u2014 assim consegue entrar mesmo sem ele."), jaTemSenha && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Senha atual"), /*#__PURE__*/React.createElement(CampoSenha, {
    value: senhaAtual,
    onChange: e => setSenhaAtual(e.target.value),
    autoComplete: "current-password",
    margem: "mt-1 mb-3",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Nova senha"), /*#__PURE__*/React.createElement(CampoSenha, {
    value: senha,
    onChange: e => setSenha(e.target.value),
    autoComplete: "new-password",
    margem: "mt-1 mb-3",
    autoFocus: !jaTemSenha
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Confirmar senha"), /*#__PURE__*/React.createElement(CampoSenha, {
    value: senha2,
    onChange: e => setSenha2(e.target.value),
    onKeyDown: e => e.key === "Enter" && salvar(),
    autoComplete: "new-password",
    margem: "mt-1"
  }), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-2"
  }, erro), /*#__PURE__*/React.createElement("button", {
    onClick: salvar,
    disabled: salvando,
    style: {
      background: C.amber
    },
    className: "w-full mt-5 text-white font-bold uppercase tracking-wide rounded py-2.5 disabled:opacity-50"
  }, salvando ? "Salvando..." : "Salvar senha"))));
}
function TicketCard({
  obra,
  pendCount,
  lastDate,
  onOpen,
  onEdit,
  onDelete
}) {
  const e = ESTADOS[obra.estado];
  return /*#__PURE__*/React.createElement("div", {
    onClick: onOpen,
    style: {
      background: C.surface,
      borderColor: C.border,
      backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 6px, ${C.bg} 6px, ${C.bg} 10px)`,
      backgroundSize: "100% 3px",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "bottom"
    },
    className: "relative cursor-pointer border rounded-md p-4 pb-5 shadow-sm active:shadow-md transition"
  }, pendCount > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.rust
    },
    className: "absolute -top-2 -right-2 text-white text-[11px] font-extrabold rounded-full w-6 h-6 flex items-center justify-center shadow"
  }, pendCount), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-start gap-2"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono uppercase tracking-wide"
  }, obra.tipo || "Obra"), /*#__PURE__*/React.createElement("h3", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold leading-tight mt-0.5"
  }, obra.cliente), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm mt-0.5"
  }, obra.endereco)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: e.color,
      borderColor: e.color,
      transform: "rotate(-6deg)",
      fontFamily: "ui-monospace, monospace"
    },
    className: "text-[10px] font-extrabold tracking-widest border-2 rounded px-2 py-0.5 uppercase shrink-0"
  }, e.label)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mt-4 pt-3",
    style: {
      borderTop: `1px dashed ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono"
  }, "\uD83D\uDD50 ", lastDate ? `há ${daysAgo(lastDate)}d` : "sem atividade"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, onEdit && /*#__PURE__*/React.createElement("button", {
    onClick: ev => {
      ev.stopPropagation();
      onEdit();
    },
    style: {
      color: C.blue
    },
    className: "text-xs font-mono uppercase"
  }, "\u270F\uFE0F Editar"), onDelete && /*#__PURE__*/React.createElement("button", {
    onClick: ev => {
      ev.stopPropagation();
      onDelete();
    },
    style: {
      color: C.rust
    },
    className: "text-xs font-mono uppercase"
  }, "\uD83D\uDDD1\uFE0F Eliminar"))));
}
function LeadsScreen({
  onBack
}) {
  const [leads, setLeads] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/leads");
        setLeads(r.leads);
      } catch (err) {
        setErro(err.message);
      }
    })();
  }, []);
  const exportarCSV = () => {
    const linhas = [["Nome", "Empresa", "Contato", "Data"]];
    leads.forEach(l => linhas.push([l.nome, l.empresa || "", l.contato, fmtTs(l.criado_em)]));
    const csv = linhas.map(linha => linha.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-gc-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-4"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide"
  }, "\uD83D\uDCCB Leads (expo)"), leads && leads.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: exportarCSV,
    style: {
      background: C.teal
    },
    className: "text-white text-xs font-bold uppercase rounded px-3 py-1.5"
  }, "\u2913 Exportar CSV")), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-sm font-mono mb-3"
  }, erro), !leads && !erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono"
  }, "Carregando..."), leads && leads.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono"
  }, "Nenhum lead capturado ainda."), leads && leads.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono mb-2"
  }, leads.length, " contato", leads.length !== 1 ? "s" : "", " capturado", leads.length !== 1 ? "s" : ""), leads.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    style: {
      background: C.surface,
      borderColor: C.border
    },
    className: "border rounded-md p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-start gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.ink
    },
    className: "font-bold text-sm"
  }, l.nome), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono shrink-0"
  }, fmtTs(l.criado_em))), l.empresa && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs"
  }, l.empresa), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.amber
    },
    className: "text-sm font-mono mt-1"
  }, l.contato)))));
}
function PermissoesScreen({
  onBack,
  usuarioRank = 8
}) {
  const [permissoes, setPermissoes] = useState(null);
  const [erro, setErro] = useState("");
  const [salvandoCelda, setSalvandoCelda] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await apiFetch("/api/permissoes");
        setPermissoes(r.permissoes);
      } catch (err) {
        setErro(err.message);
      }
    })();
  }, []);
  const nivelDe = (rank, modulo) => {
    const row = permissoes?.find(p => p.rank === rank && p.modulo === modulo);
    return row ? row.nivel : "nenhum";
  };

  // "Receber" (ver + pedir + confirmar o que recebeu) só existe em Ferramentas e Materiais.
  const comReceber = modulo => modulo === "ferramentas" || modulo === "materiais";
  const proximo = (nivel, modulo) => {
    const ordem = comReceber(modulo) ? ["nenhum", "visualizar", "receber", "editar"] : ["nenhum", "visualizar", "editar"];
    return ordem[(ordem.indexOf(nivel) + 1) % ordem.length] || "nenhum";
  };
  const corDe = {
    nenhum: C.inkMuted,
    visualizar: C.blue,
    receber: C.amber,
    editar: C.green
  };
  const labelNivel = {
    nenhum: "Nenhum",
    visualizar: "Ver",
    receber: "Receber",
    editar: "Editar"
  };
  const [sugestaoAberta, setSugestaoAberta] = useState(false);
  const [sugestao, setSugestao] = useState("");
  const [sugestaoMsg, setSugestaoMsg] = useState("");
  const [enviandoSugestao, setEnviandoSugestao] = useState(false);
  const enviarSugestao = async () => {
    setSugestaoMsg("");
    setEnviandoSugestao(true);
    try {
      await apiFetch("/api/sugestao", {
        method: "POST",
        body: JSON.stringify({
          texto: sugestao
        })
      });
      setSugestao("");
      setSugestaoMsg("✓ Enviado! Obrigado — lemos todas as sugestões.");
    } catch (err) {
      setSugestaoMsg(err.message);
    }
    setEnviandoSugestao(false);
  };
  const toggle = async (rank, modulo) => {
    const novo = proximo(nivelDe(rank, modulo), modulo);
    const key = `${rank}-${modulo}`;
    setSalvandoCelda(key);
    setErro("");
    try {
      await apiFetch("/api/permissoes", {
        method: "PATCH",
        body: JSON.stringify({
          rank,
          modulo,
          nivel: novo
        })
      });
      setPermissoes(prev => {
        const existe = prev.find(p => p.rank === rank && p.modulo === modulo);
        if (existe) return prev.map(p => p.rank === rank && p.modulo === modulo ? {
          ...p,
          nivel: novo
        } : p);
        return [...prev, {
          rank,
          modulo,
          nivel: novo
        }];
      });
    } catch (err) {
      setErro(err.message);
    }
    setSalvandoCelda(null);
  };
  if (!permissoes) return /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono text-center py-16"
  }, "Carregando...");
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide mb-1"
  }, "\uD83D\uDD11 Permiss\xF5es"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono mb-4"
  }, usuarioRank <= 2 ? "Toque numa célula para alternar: Nenhum → Ver → (Receber) → Editar. Você só altera os ranks abaixo do seu (as linhas apagadas estão travadas)." : "Só o Dono e o Engenheiro Chefe alteram esta tabela. Aqui você vê o que cada rank pode fazer."), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto -mx-4 px-4"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "text-left p-1"
  }), MODULOS_OBRA.map(m => /*#__PURE__*/React.createElement("th", {
    key: m.key,
    style: {
      color: C.inkMuted
    },
    className: "p-1 font-mono font-normal text-center"
  }, m.glyph)))), /*#__PURE__*/React.createElement("tbody", null, [1, 2, 3, 4, 5, 6, 7, 8].map(rank => /*#__PURE__*/React.createElement("tr", {
    key: rank
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      color: C.ink
    },
    className: "p-1 font-mono whitespace-nowrap pr-2 text-[11px]"
  }, RANK_LABELS[rank]), MODULOS_OBRA.map(m => {
    const nivel = nivelDe(rank, m.key);
    const key = `${rank}-${m.key}`;
    return /*#__PURE__*/React.createElement("td", {
      key: m.key,
      className: "p-1 text-center"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => toggle(rank, m.key),
      disabled: salvandoCelda === key || rank <= usuarioRank || usuarioRank > 2,
      style: {
        borderColor: corDe[nivel],
        color: corDe[nivel]
      },
      className: "border rounded w-14 py-1 text-[10px] font-mono uppercase disabled:opacity-50"
    }, salvandoCelda === key ? "..." : labelNivel[nivel]));
  })))))), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-3"
  }, erro), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[10px] font-mono mt-2"
  }, "Ver = s\xF3 olha \xB7 Receber = olha, pede e confirma o que recebeu \xB7 Editar = cria, entrega, altera."), /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border,
      background: C.surface
    },
    className: "border rounded-md p-3 mt-5"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-xs font-extrabold uppercase tracking-wide mb-2"
  }, "\uD83D\uDCCF Regras fixas da hierarquia"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mb-2"
  }, "Valem sempre, al\xE9m da tabela acima. N\xE3o se mudam aqui."), /*#__PURE__*/React.createElement("ul", {
    style: {
      color: C.ink
    },
    className: "text-xs space-y-1.5 list-disc pl-4"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "A autoridade s\xF3 desce:"), " voc\xEA altera ou apaga o que \xE9 seu e o que \xE9 de quem est\xE1 abaixo de voc\xEA. Nunca o de um igual ou de um superior."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Livro de obra (Observa\xE7\xF5es):"), " o autor n\xE3o apaga o que escreveu; s\xF3 um superior dele."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Obras vis\xEDveis:"), " Dono, Eng. Chefe e Eng. Estagi\xE1rio veem todas as obras; do Mestre para baixo, s\xF3 as obras em que est\xE3o na equipe."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Criar obra:"), " Dono, Eng. Chefe e Mestre de Obra."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Convidar e adicionar:"), " quem tem \"Editar\" na Equipe, sempre para ranks abaixo do seu. ", /*#__PURE__*/React.createElement("b", null, "Tirar da obra:"), " s\xF3 um superior (o respons\xE1vel da obra sai s\xF3 depois de transferir)."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Mudar rank:"), " Dono, Eng. Chefe e Mestre de Obra, s\xF3 de quem est\xE1 abaixo e s\xF3 para ranks abaixo do seu. O Dono principal pode nomear um co-Dono; mudar ou excluir um Dono \xE9 pelo suporte."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Presen\xE7a:"), " cada um marca a sua, s\xF3 de hoje. Um superior pode anotar a de algu\xE9m de baixo, e fica registrado quem anotou."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Pedidos e entregas:"), " quem fornece marca \"entreguei\" e quem recebe confirma \"recebi\". Cancelar: quem criou ou um superior dele."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Etapa conclu\xEDda:"), " s\xF3 quem concluiu (ou um superior dele) desmarca."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("b", null, "Esta tabela:"), " s\xF3 Dono e Eng. Chefe alteram, e s\xF3 as linhas abaixo do seu rank.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setSugestaoAberta(true);
      setSugestaoMsg("");
    },
    style: {
      color: C.amber
    },
    className: "text-xs font-mono underline mt-3"
  }, "\uD83D\uDCA1 Sugest\xF5es de fluxo de informa\xE7\xE3o?")), sugestaoAberta && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50",
    onClick: () => setSugestaoAberta(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-5 w-full max-w-sm shadow-xl",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-base font-extrabold uppercase tracking-wide"
  }, "\uD83D\uDCA1 Sugest\xE3o"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSugestaoAberta(false),
    style: {
      color: C.inkMuted
    },
    className: "text-xl leading-none"
  }, "\xD7")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs mb-2"
  }, "Como a informa\xE7\xE3o deveria circular na sua obra? Quem deveria ver, pedir ou aprovar o qu\xEA? Sua mensagem vai direto para a equipe do G&C."), /*#__PURE__*/React.createElement("textarea", {
    value: sugestao,
    onChange: e => setSugestao(e.target.value),
    rows: 5,
    maxLength: 3000,
    placeholder: "Ex.: o Almoxarife deveria ver a Equipe para saber a quem entregar.",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 text-sm outline-none"
  }), sugestaoMsg && /*#__PURE__*/React.createElement("p", {
    style: {
      color: sugestaoMsg.startsWith("✓") ? C.green : C.rust
    },
    className: "text-xs font-mono mt-1"
  }, sugestaoMsg), /*#__PURE__*/React.createElement("button", {
    onClick: enviarSugestao,
    disabled: enviandoSugestao || sugestao.trim().length < 5,
    style: {
      background: C.amber
    },
    className: "w-full mt-3 text-white font-bold uppercase tracking-wide rounded py-2.5 disabled:opacity-50"
  }, enviandoSugestao ? "Enviando..." : "Enviar"))));
}
const MODULOS_OBRA = [{
  key: "equipe",
  label: "Equipe",
  glyph: "👥",
  cajao: "cajon_equipe_2.webp",
  icone: "icone_equipe_2.webp"
}, {
  key: "etapas",
  label: "Etapas",
  glyph: "☑",
  cajao: "cajon_etapas_1.webp",
  icone: "icone_etapas_1.webp"
}, {
  key: "ferramentas",
  label: "Ferramentas",
  glyph: "🔧",
  cajao: "cajon_ferramentas_4.webp",
  icone: "icone_ferramentas_4.webp"
}, {
  key: "materiais",
  label: "Materiais",
  glyph: "📦",
  cajao: "cajon_materiais_5.webp",
  icone: "icone_materiais_5.webp"
}, {
  key: "observacoes",
  label: "Observações",
  glyph: "📝",
  cajao: "cajon_observacoes_6.webp",
  icone: "icone_observacoes_6.webp"
}, {
  key: "documentos",
  label: "Documentos",
  glyph: "📎",
  cajao: "cajon_documentos_3.webp",
  icone: "icone_documentos_3.webp"
}];
function ObraDetail({
  obra,
  obraDetalhe,
  onBack,
  onChangeEstado,
  onDeleteObra,
  onTransferirObra,
  onAddEtapa,
  onToggleEtapa,
  onRemoveEtapa,
  onEditEtapa,
  onAddFotoEtapa,
  onDeleteFotoEtapa,
  onAddFerramenta,
  onDeleteFerramenta,
  onAddMaterial,
  onDeleteMaterial,
  onAddObservacao,
  onDeleteObservacao,
  onEditObservacao,
  onAddEquipo,
  onRemoveEquipo,
  onToggleHoje,
  onSetExcecao,
  usuarioRank,
  usuarioAPI,
  niveis,
  onAddDoc,
  onDeleteDoc,
  fileCache,
  loadFile,
  saveArquivo,
  onViewImage,
  modulo,
  onAbrirModulo,
  avisosSilenciados = false,
  onAlternarSilencio
}) {
  const [erroObra, setErroObra] = useState("");
  const [erroPresenca, setErroPresenca] = useState("");
  const [transferindo, setTransferindo] = useState(false);
  const [novoResponsavel, setNovoResponsavel] = useState("");
  const {
    etapas,
    equipe,
    ferramentas,
    materiais,
    observacoes,
    documentos
  } = obraDetalhe;
  const etapasObraCount = etapas.length;
  const etapasObraDone = etapas.filter(e => e.concluida).length;
  const responsavelAtual = equipe.find(m => m.usuario_id === obra.responsavel_id);
  // Nível efetivo NESTA obra: o da tela de Permissões, recortado pelo bloqueio que o responsável da obra definiu.
  const meuMembro = equipe.find(m => m.usuario_id === usuarioAPI?.id);
  const nivelDoModulo = key => {
    const base = niveis?.[key] || "nenhum";
    const exc = meuMembro?.excecao_modulos?.[key];
    if (exc && ORDEM_NIVEL[exc] < ORDEM_NIVEL[base]) return exc;
    return base;
  };
  const souChefe = usuarioRank <= 2;
  const cycleEstado = async () => {
    setErroObra("");
    const order = ["ativa", "pausada", "concluida"];
    try {
      await onChangeEstado(obra.id, order[(order.indexOf(obra.estado) + 1) % order.length]);
    } catch (err) {
      setErroObra(err.message);
    }
  };
  const excluir = async () => {
    setErroObra("");
    try {
      await onDeleteObra(obra.id);
    } catch (err) {
      setErroObra(err.message);
    }
  };
  const transferir = async () => {
    if (!novoResponsavel) return;
    setErroObra("");
    try {
      await onTransferirObra(obra.id, Number(novoResponsavel));
      setTransferindo(false);
      setNovoResponsavel("");
    } catch (err) {
      setErroObra(err.message);
    }
  };
  const contagens = {
    etapas: etapasObraCount > 0 ? `${etapasObraDone}/${etapasObraCount}` : null,
    equipe: equipe.length || null,
    documentos: documentos.length || null,
    ferramentas: ferramentas.length || null,
    materiais: materiais.length || null,
    observacoes: observacoes.length || null
  };
  if (modulo) {
    const mod = MODULOS_OBRA.find(m => m.key === modulo);
    const podeEditar = nivelDoModulo(modulo) === "editar";
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
      style: {
        color: C.ink
      },
      className: "text-lg font-extrabold uppercase tracking-wide mb-4 flex flex-wrap items-center gap-2"
    }, /*#__PURE__*/React.createElement("img", {
      src: mod.icone,
      alt: "",
      className: "w-8 h-8 rounded-full object-cover",
      draggable: "false"
    }), " ", mod.label, /*#__PURE__*/React.createElement(AjudaModulo, {
      modulo: modulo
    })), modulo === "documentos" && /*#__PURE__*/React.createElement(PedidosPanel, {
      obraId: obra.id,
      tipo: "documento",
      tipoLabel: "Documentos",
      equipe: equipe,
      usuarioAPI: usuarioAPI,
      nivel: nivelDoModulo("documentos")
    }), modulo === "documentos" && /*#__PURE__*/React.createElement(DocumentosSection, {
      obraId: obra.id,
      documentos: documentos,
      onAdd: onAddDoc,
      onDelete: onDeleteDoc,
      fileCache: fileCache,
      loadFile: loadFile,
      saveArquivo: saveArquivo,
      onViewImage: onViewImage,
      podeEditar: podeEditar
    }), modulo === "equipe" && /*#__PURE__*/React.createElement(EquipeSection, {
      obraId: obra.id,
      equipe: equipe,
      onAdd: onAddEquipo,
      onRemove: onRemoveEquipo,
      onToggleHoje: onToggleHoje,
      onSetExcecao: onSetExcecao,
      usuarioRank: usuarioRank,
      usuarioId: usuarioAPI?.id,
      usuarioNome: usuarioAPI?.nome,
      donoPrincipal: !!usuarioAPI?.dono_principal,
      responsavelId: obra.responsavel_id,
      podeEditar: podeEditar
    }), modulo === "etapas" && /*#__PURE__*/React.createElement(EtapasSection, {
      obraId: obra.id,
      etapas: etapas,
      onAdd: onAddEtapa,
      onToggle: onToggleEtapa,
      onRemove: onRemoveEtapa,
      onEditEtapa: onEditEtapa,
      fileCache: fileCache,
      loadFile: loadFile,
      saveArquivo: saveArquivo,
      onViewImage: onViewImage,
      onAddFoto: onAddFotoEtapa,
      onDeleteFoto: onDeleteFotoEtapa,
      podeEditar: podeEditar
    }), modulo === "ferramentas" && /*#__PURE__*/React.createElement(PedidosPanel, {
      obraId: obra.id,
      tipo: "ferramenta",
      tipoLabel: "Ferramentas",
      equipe: equipe,
      usuarioAPI: usuarioAPI,
      nivel: nivelDoModulo("ferramentas")
    }), modulo === "ferramentas" && /*#__PURE__*/React.createElement(ListaSimplesSection, {
      items: ferramentas,
      onAdd: onAddFerramenta,
      onDelete: onDeleteFerramenta,
      placeholder: "Ex: furadeira, andaime...",
      color: C.steel,
      glyph: "\uD83D\uDD27",
      datalistId: "hist-ferramentas",
      podeEditar: podeEditar,
      textoSemEdicao: nivelDoModulo("ferramentas") === "receber" ? "Você pode pedir e confirmar o que recebeu (Pedidos, acima). Registrar itens na lista é com o Almoxarife ou os chefes." : undefined
    }), modulo === "materiais" && /*#__PURE__*/React.createElement(PedidosPanel, {
      obraId: obra.id,
      tipo: "material",
      tipoLabel: "Materiais",
      equipe: equipe,
      usuarioAPI: usuarioAPI,
      nivel: nivelDoModulo("materiais")
    }), modulo === "materiais" && /*#__PURE__*/React.createElement(ListaSimplesSection, {
      items: materiais,
      onAdd: onAddMaterial,
      onDelete: onDeleteMaterial,
      placeholder: "Ex: 10 sacos de cimento...",
      color: C.amber,
      glyph: "\uD83D\uDCE6",
      datalistId: "hist-materiais",
      podeEditar: podeEditar,
      textoSemEdicao: nivelDoModulo("materiais") === "receber" ? "Você pode pedir e confirmar o que recebeu (Pedidos, acima). Registrar itens na lista é com o Almoxarife ou os chefes." : undefined
    }), modulo === "observacoes" && /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.surface,
        borderColor: C.border
      },
      className: "border rounded-md p-4 mb-4"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between flex-wrap gap-2"
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-xs font-mono"
    }, "\uD83D\uDC64 Respons\xE1vel: ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.ink
      }
    }, responsavelAtual ? `${responsavelAtual.nome} (${RANK_LABELS[responsavelAtual.rank]})` : "—")), souChefe && /*#__PURE__*/React.createElement("button", {
      onClick: () => setTransferindo(!transferindo),
      style: {
        color: C.blue
      },
      className: "text-xs font-mono uppercase"
    }, "\uD83D\uDD04 Transferir")), transferindo && /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2 mt-2"
    }, /*#__PURE__*/React.createElement("select", {
      value: novoResponsavel,
      onChange: e => setNovoResponsavel(e.target.value),
      style: {
        borderColor: C.border,
        color: C.ink
      },
      className: "flex-1 min-w-0 border rounded px-2 py-1.5 text-xs outline-none bg-white"
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Escolha o novo respons\xE1vel..."), equipe.filter(m => !m.removido_em).map(m => /*#__PURE__*/React.createElement("option", {
      key: m.usuario_id,
      value: m.usuario_id
    }, m.nome, " (", RANK_LABELS[m.rank], ")"))), /*#__PURE__*/React.createElement("button", {
      onClick: transferir,
      disabled: !novoResponsavel,
      style: {
        background: C.blue
      },
      className: "text-white text-xs font-bold uppercase rounded px-3 disabled:opacity-40 shrink-0"
    }, "Confirmar")), souChefe && /*#__PURE__*/React.createElement("button", {
      onClick: excluir,
      style: {
        color: C.rust
      },
      className: "mt-4 text-xs font-mono"
    }, "\uD83D\uDDD1 excluir obra"), erroObra && /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.rust
      },
      className: "text-xs font-mono mt-2"
    }, erroObra)), modulo === "observacoes" && /*#__PURE__*/React.createElement(ObservacoesSection, {
      items: observacoes,
      onAdd: onAddObservacao,
      onDelete: onDeleteObservacao,
      onEdit: onEditObservacao,
      usuarioAPI: usuarioAPI,
      podeEditar: podeEditar
    }));
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "relative -mx-4 -mt-4 mb-3"
  }, /*#__PURE__*/React.createElement("img", {
    src: "arquivero_completo_16.webp",
    alt: "",
    className: "w-full h-auto block",
    draggable: "false",
    style: {
      aspectRatio: "1048 / 1797"
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute",
    style: {
      left: "13%",
      top: "12%",
      width: "24%",
      transform: "rotate(-3deg)",
      transformOrigin: "top left"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: "#4A4640"
    },
    className: "text-[11px] font-bold font-mono uppercase tracking-wide"
  }, obra.tipo || "Obra", obra.data_inicio ? ` · desde ${fmt(obra.data_inicio)}` : ""), /*#__PURE__*/React.createElement("h2", {
    style: {
      color: "#1A1815",
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical",
      overflow: "hidden"
    },
    className: "text-lg font-extrabold leading-tight mt-1"
  }, obra.cliente), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "#3D3934",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden"
    },
    className: "text-xs font-bold mt-1"
  }, obra.endereco)), /*#__PURE__*/React.createElement("div", {
    className: "absolute",
    style: {
      left: "66%",
      top: "22%",
      width: "12%",
      transform: "rotate(-2deg)",
      transformOrigin: "top left"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: "#4A4640"
    },
    className: "text-[9px] font-bold font-mono uppercase tracking-wide"
  }, "Respons\xE1vel"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "#1A1815",
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical",
      overflow: "hidden"
    },
    className: "text-xs font-extrabold leading-tight mt-1"
  }, responsavelAtual ? responsavelAtual.nome : "—")), /*#__PURE__*/React.createElement("div", {
    className: "absolute",
    style: {
      right: "3%",
      top: "1%",
      width: "42%"
    }
  }, /*#__PURE__*/React.createElement(StampBadge, {
    estado: obra.estado,
    onClick: cycleEstado,
    enorme: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "absolute grid grid-cols-2",
    style: {
      left: 0,
      right: 0,
      top: "37%",
      bottom: 0,
      gridTemplateRows: "repeat(3, 1fr)"
    }
  }, MODULOS_OBRA.map(m => {
    const liberado = nivelDoModulo(m.key) !== "nenhum";
    return liberado ? /*#__PURE__*/React.createElement("button", {
      key: m.key,
      onClick: () => onAbrirModulo(m.key),
      className: "relative active:bg-black/10 transition"
    }, contagens[m.key] != null && /*#__PURE__*/React.createElement("div", {
      style: {
        background: "rgba(0,0,0,0.75)"
      },
      className: "absolute top-2 right-4 text-white text-[11px] font-extrabold rounded-full min-w-[22px] h-[22px] px-1 flex items-center justify-center shadow"
    }, contagens[m.key])) : /*#__PURE__*/React.createElement("button", {
      key: m.key,
      disabled: true,
      title: "Sem acesso a esta gaveta",
      "aria-label": `${m.label}: sem acesso`,
      style: {
        background: "rgba(20,18,15,0.62)"
      },
      className: "relative flex items-center justify-center cursor-not-allowed"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-2xl opacity-90"
    }, "\uD83D\uDD12"));
  }))), meuMembro && (() => {
    const hojeP = todayISO();
    const presente = (meuMembro.asistencias || []).includes(hojeP);
    return /*#__PURE__*/React.createElement("div", {
      className: "mt-3"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: async () => {
        setErroPresenca("");
        try {
          await onToggleHoje(meuMembro.id, hojeP);
        } catch (err) {
          setErroPresenca(err.message);
        }
      },
      style: {
        background: presente ? C.green : C.surface,
        borderColor: presente ? C.green : C.border,
        color: presente ? "#fff" : C.ink
      },
      className: "w-full border-2 rounded-md py-3 font-bold uppercase tracking-wide text-sm"
    }, presente ? "✓ Minha presença de hoje está marcada" : "✋ Marcar minha presença hoje"), erroPresenca && /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.rust
      },
      className: "text-xs font-mono mt-1 text-center"
    }, erroPresenca));
  })(), onAlternarSilencio && /*#__PURE__*/React.createElement("button", {
    onClick: () => onAlternarSilencio().catch(() => {}),
    style: {
      borderColor: C.border,
      color: avisosSilenciados ? C.inkMuted : C.ink
    },
    className: "w-full mt-2 border rounded-md py-2 text-xs font-mono uppercase"
  }, avisosSilenciados ? "🔕 Avisos desta obra: silenciados (toque para ligar)" : "🔔 Avisos desta obra: ligados (toque para silenciar)"));
}
function PendientesView({
  obras,
  onBack,
  onOpenObra
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const resultados = await Promise.all(obras.map(async obra => {
        try {
          const r = await apiFetch(`/api/etapas?obra_id=${obra.id}`);
          return {
            obra,
            pendentes: r.etapas.filter(e => !e.concluida)
          };
        } catch (e) {
          return {
            obra,
            pendentes: []
          };
        }
      }));
      setItems(resultados.filter(x => x.pendentes.length > 0));
      setLoading(false);
    })();
  }, [obras]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-xl font-extrabold uppercase tracking-wide mb-1"
  }, "\u25CF Pend\xEAncias"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono mb-4"
  }, "Etapas ainda n\xE3o conclu\xEDdas, em todas as obras"), loading && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono text-center py-12"
  }, "Carregando..."), !loading && items.length === 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono text-center py-12"
  }, "Nada pendente. Tudo em ordem."), /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, items.map(({
    obra,
    pendentes
  }) => /*#__PURE__*/React.createElement("div", {
    key: obra.id,
    style: {
      background: C.surface,
      borderColor: C.border
    },
    className: "border rounded-md p-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onOpenObra(obra.id),
    style: {
      color: C.ink
    },
    className: "font-extrabold text-sm uppercase tracking-wide"
  }, obra.cliente, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "font-normal normal-case"
  }, "\u2014 ", obra.endereco)), pendentes.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.id,
    className: "flex items-start gap-2 text-sm mt-2"
  }, /*#__PURE__*/React.createElement("span", null, "\u2611"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    }
  }, e.texto)))))));
}
function ReportView({
  obras,
  onBack
}) {
  const [loading, setLoading] = useState(true);
  const [reportText, setReportText] = useState("");
  const [copied, setCopied] = useState(false);
  const cutoff = todayISO();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const lines = [`*RELATÓRIO SEMANAL — GESTÃO & CONTROLE*`, `${fmt(weekAgo)} a ${fmt(cutoff)}`, ""];
      let totalPendentes = 0;
      const blocos = [];
      for (const obra of obras) {
        try {
          const [etR, feR, maR, obR] = await Promise.all([apiFetch(`/api/etapas?obra_id=${obra.id}`), apiFetch(`/api/ferramentas?obra_id=${obra.id}`), apiFetch(`/api/materiais?obra_id=${obra.id}`), apiFetch(`/api/observacoes?obra_id=${obra.id}`)]);
          const etapas = etR.etapas,
            ferramentas = feR.ferramentas,
            materiais = maR.materiais,
            observacoes = obR.observacoes;
          const pendentes = etapas.filter(e => !e.concluida);
          totalPendentes += pendentes.length;
          const doneCount = etapas.filter(e => e.concluida).length;
          const concluidasRecentes = etapas.filter(e => e.concluida && e.concluida_em >= weekAgo);
          const ferRecent = ferramentas.filter(f => f.criado_em >= weekAgo);
          const matRecent = materiais.filter(m => m.criado_em >= weekAgo);
          const obsRecent = observacoes.filter(o => o.criado_em >= weekAgo);
          if (etapas.length === 0 && ferRecent.length === 0 && matRecent.length === 0 && obsRecent.length === 0) continue;
          const bloco = [`*${obra.cliente}* (${ESTADOS[obra.estado].label}) — ${obra.endereco}`];
          if (etapas.length > 0) bloco.push(`  Etapas: ${doneCount}/${etapas.length} concluídas`);
          concluidasRecentes.forEach(e => bloco.push(`  • [Concluída] ${e.texto}`));
          ferRecent.forEach(f => bloco.push(`  • [Ferramenta] ${f.texto}`));
          matRecent.forEach(m => bloco.push(`  • [Material] ${m.texto}`));
          obsRecent.forEach(o => bloco.push(`  • [Observação] ${o.texto}`));
          blocos.push(bloco.join("\n"));
        } catch (e) {}
      }
      if (totalPendentes > 0) lines.push(`*⚠ ETAPAS PENDENTES (${totalPendentes})*`, "");
      lines.push(...blocos.map(b => b + "\n"));
      if (blocos.length === 0 && totalPendentes === 0) lines.push("Sem novidades registradas essa semana.");
      setReportText(lines.join("\n"));
      setLoading(false);
    })();
  }, [obras]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };
  const openWhatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(reportText)}`, "_blank");
  const openEmail = () => {
    const subject = encodeURIComponent(`Relatório semanal — ${fmt(weekAgo)} a ${fmt(cutoff)}`);
    const body = encodeURIComponent(reportText.replace(/\*/g, ""));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-xl font-extrabold uppercase tracking-wide mb-1"
  }, "Relat\xF3rio semanal"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono mb-4"
  }, fmt(weekAgo), " \u2014 ", fmt(cutoff)), loading ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm font-mono text-center py-12"
  }, "Carregando...") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("pre", {
    style: {
      background: C.surface,
      borderColor: C.border,
      color: C.ink
    },
    className: "border rounded-md p-4 text-sm whitespace-pre-wrap font-sans leading-relaxed mb-4"
  }, reportText), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: openWhatsapp,
    style: {
      background: C.green
    },
    className: "text-white font-bold uppercase tracking-wide text-sm rounded px-4 py-2.5"
  }, "\uD83D\uDCAC WhatsApp"), /*#__PURE__*/React.createElement("button", {
    onClick: openEmail,
    style: {
      background: C.blue
    },
    className: "text-white font-bold uppercase tracking-wide text-sm rounded px-4 py-2.5"
  }, "\u2709 Email"), /*#__PURE__*/React.createElement("button", {
    onClick: copy,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "border font-bold uppercase tracking-wide text-sm rounded px-4 py-2.5"
  }, copied ? "✓ Copiado" : "⧉ Copiar"))));
}

// Reparte cada letra con una animación tipo "carta servida por el crupier", en cascada.
// 15 caracteres totales (GESTÃO=6 + &=1 + CONTROLE=8) repartidos en 1 segundo -> ~66.7ms entre letra y letra.
function DealText({
  text,
  startIndex,
  color,
  fontSize
}) {
  return text.split("").map((ch, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "deal-letter splash-letra",
    style: {
      animationDelay: `${1000 + (startIndex + i) * (1000 / 15)}ms`
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "gc-3d"
  }, ch === " " ? "\u00A0" : ch)));
}
function SplashScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.bg,
      minHeight: "100vh",
      position: "relative"
    },
    className: "flex flex-col items-center justify-center overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "logo-pop",
    style: {
      width: "min(280px, 72vw)",
      height: "min(280px, 72vw)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      position: "absolute",
      inset: 0
    }
  }), /*#__PURE__*/React.createElement("img", {
    src: "logo-blink.png",
    alt: "",
    className: "logo-blink-img",
    style: {
      width: "100%",
      height: "100%",
      position: "absolute",
      inset: 0
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "splash-title-wrap font-comic"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(DealText, {
    text: "GEST\xC3O",
    startIndex: 0,
    color: C.ink,
    fontSize: 40
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(DealText, {
    text: "&",
    startIndex: 6,
    color: C.amber,
    fontSize: 40
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(DealText, {
    text: "CONTROLE",
    startIndex: 7,
    color: C.ink,
    fontSize: 40
  }))), /*#__PURE__*/React.createElement("div", {
    className: "xp-loader-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "xp-loader-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "xp-loader-bar"
  }))));
}
function AuthWrap({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.bg,
      minHeight: "100vh"
    },
    className: "flex flex-col items-center justify-center p-6"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      borderColor: C.border
    },
    className: "border rounded-lg p-6 w-full max-w-sm shadow-xl"
  }, children), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono text-center mt-5"
  }, "\xA9 2026 Gest\xE3o & Controle \xB7 ", /*#__PURE__*/React.createElement("a", {
    href: "/termos",
    style: {
      color: C.inkMuted
    },
    className: "underline"
  }, "Termos"), " \xB7 ", /*#__PURE__*/React.createElement("a", {
    href: "/privacidade",
    style: {
      color: C.inkMuted
    },
    className: "underline"
  }, "Privacidade")));
}
function LogoTitulo() {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center gap-2.5 mb-1"
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "G&C",
    className: "w-11 h-11 rounded-full shrink-0"
  }), /*#__PURE__*/React.createElement("h1", {
    className: "font-comic gc-3d text-xl tracking-wide whitespace-nowrap"
  }, "Gest\xE3o & Controle"));
}

// Tela "Confirme seu e-mail" (depois do cadastro, ou ao tentar entrar sem ter confirmado).
function ConfirmeEmailAviso({
  email,
  enviado = true,
  onIrLogin
}) {
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const reenviar = async () => {
    setEnviando(true);
    setMsg("");
    try {
      const r = await apiPublica("/api/auth/reenviar-confirmacao", {
        email
      });
      setMsg(r.mensagem || "Enviado.");
    } catch (err) {
      setMsg(err.message);
    }
    setEnviando(false);
  };
  return /*#__PURE__*/React.createElement(AuthWrap, null, /*#__PURE__*/React.createElement(LogoTitulo, null), /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide text-center mb-3"
  }, "\uD83D\uDCE7 Confirme seu e-mail"), enviado ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm mb-3"
  }, "Enviamos um link para ", /*#__PURE__*/React.createElement("b", null, email), ". Abra o e-mail e toque no link para ativar sua conta. Depois, volte aqui e entre com seu e-mail e senha.") : /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-sm mb-3"
  }, "Sua conta foi criada, mas n\xE3o conseguimos enviar o e-mail agora. Toque em \"Reenviar\" daqui a pouco."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono mb-4"
  }, "N\xE3o chegou? Olhe a caixa de spam ou \"Promo\xE7\xF5es\". O link vale 24 horas."), /*#__PURE__*/React.createElement("button", {
    onClick: reenviar,
    disabled: enviando,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border font-bold uppercase tracking-wide text-sm rounded py-2.5 disabled:opacity-50"
  }, enviando ? "Enviando..." : "Reenviar e-mail"), msg && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.green
    },
    className: "text-xs font-mono mt-2 text-center"
  }, msg), /*#__PURE__*/React.createElement("button", {
    onClick: onIrLogin,
    style: {
      background: C.amber
    },
    className: "w-full mt-4 text-white font-bold uppercase tracking-wide rounded py-2.5"
  }, "J\xE1 confirmei \u2014 entrar"));
}
function CadastroScreen({
  onIrLogin,
  onCadastrado
}) {
  const [confirmar, setConfirmar] = useState(null);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [aceito, setAceito] = useState(false);
  const [tsToken, setTsToken] = useState("");
  const [tsChave, setTsChave] = useState(0);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const cadastrar = async () => {
    setErro("");
    if (!email.trim() || !nome.trim()) {
      setErro("Preencha nome e email.");
      return;
    }
    if (senha.length < 8) {
      setErro("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== senha2) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (!aceito) {
      setErro("Você precisa aceitar os Termos de Uso.");
      return;
    }
    setSalvando(true);
    try {
      if (!tsToken) {
        setErro("Aguarde a verificação \"não sou um robô\" terminar.");
        setSalvando(false);
        return;
      }
      const r = await apiSignup(email.trim(), senha, nome.trim(), aceito, tsToken);
      if (r.token) {
        saveSession(r);
        onCadastrado();
      } else setConfirmar({
        email: r.email || email.trim().toLowerCase(),
        enviado: r.enviado !== false
      });
    } catch (err) {
      setErro(err.message);
      setTsChave(k => k + 1); // o token do Turnstile vale uma vez só: refaz a verificação
    }
    setSalvando(false);
  };
  if (confirmar) return /*#__PURE__*/React.createElement(ConfirmeEmailAviso, {
    email: confirmar.email,
    enviado: confirmar.enviado,
    onIrLogin: onIrLogin
  });
  return /*#__PURE__*/React.createElement(AuthWrap, null, /*#__PURE__*/React.createElement(LogoTitulo, null), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono text-center mb-5"
  }, "Criar conta"), /*#__PURE__*/React.createElement("a", {
    href: "/api/auth/google",
    "aria-label": "Entrar com Google",
    className: "block mb-4 active:opacity-80"
  }, /*#__PURE__*/React.createElement("img", {
    src: "google-login.png",
    alt: "Entrar com Google",
    className: "mx-auto h-14 w-auto",
    draggable: "false"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border
    },
    className: "flex-1 border-t"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono"
  }, "ou com email"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border
    },
    className: "flex-1 border-t"
  })), /*#__PURE__*/React.createElement("div", {
    className: "space-y-3"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Nome"), /*#__PURE__*/React.createElement("input", {
    value: nome,
    onChange: e => setNome(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none",
    placeholder: "Seu nome",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    value: email,
    onChange: e => setEmail(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none",
    placeholder: "voce@exemplo.com"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Senha"), /*#__PURE__*/React.createElement(CampoSenha, {
    value: senha,
    onChange: e => setSenha(e.target.value),
    autoComplete: "new-password",
    placeholder: "M\xEDnimo 8 caracteres",
    margem: "mt-1"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Confirmar senha"), /*#__PURE__*/React.createElement(CampoSenha, {
    value: senha2,
    onChange: e => setSenha2(e.target.value),
    onKeyDown: e => e.key === "Enter" && cadastrar(),
    autoComplete: "new-password",
    margem: "mt-1"
  })), /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-2 text-xs",
    style: {
      color: C.inkMuted
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: aceito,
    onChange: e => setAceito(e.target.checked),
    className: "mt-0.5"
  }), /*#__PURE__*/React.createElement("span", null, "Tenho 18 anos ou mais, li e aceito os ", /*#__PURE__*/React.createElement("a", {
    href: "/termos",
    target: "_blank",
    rel: "noopener",
    style: {
      color: C.amber
    },
    className: "underline"
  }, "Termos de Uso"), " e a ", /*#__PURE__*/React.createElement("a", {
    href: "/privacidade",
    target: "_blank",
    rel: "noopener",
    style: {
      color: C.amber
    },
    className: "underline"
  }, "Pol\xEDtica de Privacidade"), ".")), /*#__PURE__*/React.createElement(Turnstile, {
    onToken: setTsToken,
    chave: tsChave
  }), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono"
  }, erro)), /*#__PURE__*/React.createElement("button", {
    onClick: cadastrar,
    disabled: salvando,
    style: {
      background: C.amber
    },
    className: "w-full mt-5 text-white font-bold uppercase tracking-wide rounded py-2.5 disabled:opacity-50"
  }, salvando ? "Criando..." : "Criar conta"), /*#__PURE__*/React.createElement("button", {
    onClick: onIrLogin,
    style: {
      color: C.inkMuted
    },
    className: "w-full text-xs font-mono uppercase mt-3"
  }, "J\xE1 tenho conta \u2014 entrar"));
}
function LoginScreen({
  onLogado,
  onIrCadastro
}) {
  const [semConfirmar, setSemConfirmar] = useState(null);
  const [pedeTs, setPedeTs] = useState(false);
  const [tsToken, setTsToken] = useState("");
  const [tsChave, setTsChave] = useState(0);
  const [esqueciAberto, setEsqueciAberto] = useState(false);
  const [emailEsqueci, setEmailEsqueci] = useState("");
  const [msgEsqueci, setMsgEsqueci] = useState("");
  const [erroEsqueci, setErroEsqueci] = useState("");
  const [enviandoEsqueci, setEnviandoEsqueci] = useState(false);
  const [modo, setModo] = useState(() => {
    try {
      return localStorage.getItem("gc-login-modo") || "email";
    } catch (e) {
      return "email";
    }
  });
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cpf, setCpf] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const trocarModo = m => {
    setModo(m);
    setErro("");
    try {
      localStorage.setItem("gc-login-modo", m);
    } catch (e) {}
  };
  const entrar = async () => {
    setErro("");
    setEntrando(true);
    try {
      if (pedeTs && !tsToken) {
        setErro("Aguarde a verificação \"não sou um robô\" e toque em Entrar de novo.");
        setEntrando(false);
        return;
      }
      const authData = await apiLogin(email.trim(), senha, tsToken || undefined);
      saveSession(authData);
      onLogado();
    } catch (err) {
      if (err.codigo === "email_nao_confirmado") {
        setSemConfirmar(email.trim().toLowerCase());
        setEntrando(false);
        return;
      }
      if (err.codigo === "turnstile") setPedeTs(true);
      if (pedeTs || err.codigo === "turnstile") setTsChave(k => k + 1);
      setErro(err.message);
    }
    setEntrando(false);
  };
  const abrirEsqueci = () => {
    setEmailEsqueci(email.trim());
    setMsgEsqueci("");
    setErroEsqueci("");
    setEsqueciAberto(true);
  };
  const enviarEsqueci = async () => {
    setErroEsqueci("");
    setMsgEsqueci("");
    if (!/^\S+@\S+\.\S+$/.test(emailEsqueci.trim())) {
      setErroEsqueci("Digite um e-mail válido.");
      return;
    }
    setEnviandoEsqueci(true);
    try {
      const r = await apiPublica("/api/auth/esqueci-senha", {
        email: emailEsqueci.trim()
      });
      setMsgEsqueci((r.mensagem || "") + " O link vale 1 hora.");
    } catch (err) {
      setErroEsqueci(err.message);
    }
    setEnviandoEsqueci(false);
  };
  if (semConfirmar) return /*#__PURE__*/React.createElement(ConfirmeEmailAviso, {
    email: semConfirmar,
    onIrLogin: () => setSemConfirmar(null)
  });
  const entrarCpf = async () => {
    setErro("");
    if (!cpfValido(cpf)) {
      setErro("CPF inválido. Confira os números.");
      return;
    }
    if (!/^(\d{4}|\d{6})$/.test(pin)) {
      setErro("Digite seu PIN (6 números).");
      return;
    }
    setEntrando(true);
    try {
      if (pedeTs && !tsToken) {
        setErro("Aguarde a verificação \"não sou um robô\" e toque em Entrar de novo.");
        setEntrando(false);
        return;
      }
      const authData = await apiPublica("/api/auth/login-cpf", {
        cpf: limparCpf(cpf),
        pin,
        turnstile: tsToken || undefined
      });
      saveSession(authData);
      onLogado();
    } catch (err) {
      if (err.codigo === "turnstile") setPedeTs(true);
      if (pedeTs || err.codigo === "turnstile") setTsChave(k => k + 1);
      setErro(err.message);
    }
    setEntrando(false);
  };
  const abaEstilo = ativa => ({
    background: ativa ? C.ink : "transparent",
    color: ativa ? "#fff" : C.inkMuted,
    borderColor: C.ink
  });
  if (modo === "cpf") {
    return /*#__PURE__*/React.createElement(AuthWrap, null, /*#__PURE__*/React.createElement(LogoTitulo, null), /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-xs font-mono text-center mb-4"
    }, "Entrar"), /*#__PURE__*/React.createElement("div", {
      className: "flex mb-4"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => trocarModo("cpf"),
      style: abaEstilo(true),
      className: "flex-1 border rounded-l py-2 text-xs font-bold uppercase"
    }, "CPF + PIN"), /*#__PURE__*/React.createElement("button", {
      onClick: () => trocarModo("email"),
      style: abaEstilo(false),
      className: "flex-1 border rounded-r py-2 text-xs font-bold uppercase"
    }, "Email / Google")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
      style: {
        color: C.inkMuted
      },
      className: "text-xs font-mono uppercase"
    }, "CPF"), /*#__PURE__*/React.createElement("input", {
      value: cpf,
      onChange: e => setCpf(formatarCpf(e.target.value)),
      inputMode: "numeric",
      placeholder: "000.000.000-00",
      style: {
        borderColor: C.border,
        color: C.ink
      },
      className: "w-full border rounded px-3 py-3 mt-1 outline-none text-lg tracking-wider",
      autoFocus: true
    })), /*#__PURE__*/React.createElement("div", {
      className: "mt-3"
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        color: C.inkMuted
      },
      className: "text-xs font-mono uppercase"
    }, "PIN"), /*#__PURE__*/React.createElement("input", {
      value: pin,
      onChange: e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6)),
      onKeyDown: e => e.key === "Enter" && entrarCpf(),
      type: "password",
      inputMode: "numeric",
      autoComplete: "off",
      placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022",
      style: {
        borderColor: C.border,
        color: C.ink
      },
      className: "w-full border rounded px-3 py-3 mt-1 outline-none text-2xl tracking-[0.5em] text-center"
    })), pedeTs && /*#__PURE__*/React.createElement(Turnstile, {
      onToken: setTsToken,
      chave: tsChave
    }), erro && /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.rust
      },
      className: "text-xs font-mono mt-2"
    }, erro), /*#__PURE__*/React.createElement("button", {
      onClick: entrarCpf,
      disabled: entrando,
      style: {
        background: C.amber
      },
      className: "w-full mt-4 text-white font-bold uppercase tracking-wide rounded py-3 disabled:opacity-50"
    }, entrando ? "Entrando..." : "Entrar"), /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-[11px] font-mono text-center mt-3"
    }, "Esqueceu o PIN? Pe\xE7a um \"Novo PIN\" ao seu chefe."));
  }
  return /*#__PURE__*/React.createElement(AuthWrap, null, /*#__PURE__*/React.createElement(LogoTitulo, null), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono text-center mb-4"
  }, "Entrar"), /*#__PURE__*/React.createElement("div", {
    className: "flex mb-4"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => trocarModo("cpf"),
    style: abaEstilo(false),
    className: "flex-1 border rounded-l py-2 text-xs font-bold uppercase"
  }, "CPF + PIN"), /*#__PURE__*/React.createElement("button", {
    onClick: () => trocarModo("email"),
    style: abaEstilo(true),
    className: "flex-1 border rounded-r py-2 text-xs font-bold uppercase"
  }, "Email / Google")), /*#__PURE__*/React.createElement("a", {
    href: "/api/auth/google",
    "aria-label": "Entrar com Google",
    className: "block mb-4 active:opacity-80"
  }, /*#__PURE__*/React.createElement("img", {
    src: "google-login.png",
    alt: "Entrar com Google",
    className: "mx-auto h-14 w-auto",
    draggable: "false"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-4"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border
    },
    className: "flex-1 border-t"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono"
  }, "ou com email"), /*#__PURE__*/React.createElement("div", {
    style: {
      borderColor: C.border
    },
    className: "flex-1 border-t"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Email"), /*#__PURE__*/React.createElement("input", {
    value: email,
    onChange: e => setEmail(e.target.value),
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none",
    autoFocus: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Senha"), /*#__PURE__*/React.createElement(CampoSenha, {
    value: senha,
    onChange: e => setSenha(e.target.value),
    onKeyDown: e => e.key === "Enter" && entrar(),
    autoComplete: "current-password",
    margem: "mt-1"
  })), pedeTs && /*#__PURE__*/React.createElement(Turnstile, {
    onToken: setTsToken,
    chave: tsChave
  }), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-2"
  }, erro), /*#__PURE__*/React.createElement("button", {
    onClick: entrar,
    disabled: entrando,
    style: {
      background: C.green
    },
    className: "w-full mt-4 text-white font-bold uppercase tracking-wide rounded py-2.5 disabled:opacity-50"
  }, entrando ? "Entrando..." : "Entrar"), /*#__PURE__*/React.createElement("button", {
    onClick: onIrCadastro,
    style: {
      background: C.amber
    },
    className: "w-full mt-2 text-white font-bold uppercase tracking-wide rounded py-2.5"
  }, "Criar conta"), /*#__PURE__*/React.createElement("button", {
    onClick: abrirEsqueci,
    style: {
      color: C.inkMuted
    },
    className: "w-full text-xs font-mono mt-3 underline"
  }, "Esqueci a senha"), esqueciAberto && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50",
    onClick: () => setEsqueciAberto(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-6 w-full max-w-sm shadow-xl",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center mb-3"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide"
  }, "Esqueci a senha"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEsqueciAberto(false),
    style: {
      color: C.inkMuted
    },
    className: "text-xl leading-none"
  }, "\xD7")), msgEsqueci ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.green
    },
    className: "text-sm"
  }, "\uD83D\uDCE7 ", msgEsqueci), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEsqueciAberto(false),
    style: {
      background: C.green
    },
    className: "w-full mt-5 text-white font-bold uppercase tracking-wide rounded py-2.5"
  }, "Fechar")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "E-mail da sua conta"), /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: emailEsqueci,
    onChange: e => setEmailEsqueci(e.target.value),
    onKeyDown: e => e.key === "Enter" && enviarEsqueci(),
    autoFocus: true,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-2 mt-1 outline-none",
    placeholder: "voce@exemplo.com"
  }), erroEsqueci && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-2"
  }, erroEsqueci), /*#__PURE__*/React.createElement("button", {
    onClick: enviarEsqueci,
    disabled: enviandoEsqueci,
    style: {
      background: C.amber
    },
    className: "w-full mt-4 text-white font-bold uppercase tracking-wide rounded py-2.5 disabled:opacity-50"
  }, enviandoEsqueci ? "Enviando..." : "Enviar link por e-mail")))));
}
function ConviteScreen({
  token,
  onEntrou,
  onCancelar
}) {
  const [info, setInfo] = useState(null);
  const [aceito, setAceito] = useState(false);
  const [erroLink, setErroLink] = useState("");
  const [cpf, setCpf] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    apiPublica(`/api/convite-info?token=${encodeURIComponent(token)}`).then(setInfo).catch(e => setErroLink(e.message));
  }, [token]);
  const confirmar = async () => {
    setErro("");
    if (!cpfValido(cpf)) {
      setErro("CPF inválido. Confira os números.");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setErro("O PIN precisa ter 6 números.");
      return;
    }
    if (pin !== pin2) {
      setErro("Os dois PIN não são iguais.");
      return;
    }
    if (!aceito) {
      setErro("Para entrar, aceite os Termos de Uso e a Política de Privacidade.");
      return;
    }
    setSalvando(true);
    try {
      const authData = await apiPublica("/api/auth/aceitar-convite", {
        token,
        cpf: limparCpf(cpf),
        pin,
        aceitouTermos: true
      });
      saveSession(authData);
      try {
        localStorage.setItem("gc-login-modo", "cpf");
      } catch (e) {}
      onEntrou();
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };
  if (erroLink) {
    return /*#__PURE__*/React.createElement(AuthWrap, null, /*#__PURE__*/React.createElement(LogoTitulo, null), /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.rust
      },
      className: "text-sm text-center my-4"
    }, erroLink), /*#__PURE__*/React.createElement("button", {
      onClick: onCancelar,
      style: {
        background: C.ink
      },
      className: "w-full text-white font-bold uppercase tracking-wide rounded py-2.5"
    }, "Ir para o login"));
  }
  if (!info) return /*#__PURE__*/React.createElement(SplashScreen, null);
  const novoPin = info.tipo === "novo-pin";
  return /*#__PURE__*/React.createElement(AuthWrap, null, /*#__PURE__*/React.createElement(LogoTitulo, null), /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold text-center mt-3"
  }, "Ol\xE1, ", info.nome, "!"), novoPin ? /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm text-center mb-4"
  }, "Crie seu novo PIN de 6 n\xFAmeros.") : /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm text-center mb-4"
  }, "Voc\xEA foi convidado", info.obra ? /*#__PURE__*/React.createElement(React.Fragment, null, " para a obra ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.ink
    }
  }, info.obra.cliente)) : null, " como ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.ink
    }
  }, RANK_LABELS[info.rank]), info.funcao ? ` (${info.funcao})` : "", "."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Seu CPF"), /*#__PURE__*/React.createElement("input", {
    value: cpf,
    onChange: e => setCpf(formatarCpf(e.target.value)),
    inputMode: "numeric",
    placeholder: "000.000.000-00",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-3 mt-1 outline-none text-lg tracking-wider"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mt-1"
  }, "\xC9 o que voc\xEA vai usar para entrar.")), /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Crie um PIN (6 n\xFAmeros)"), /*#__PURE__*/React.createElement("input", {
    value: pin,
    onChange: e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6)),
    type: "password",
    inputMode: "numeric",
    autoComplete: "off",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-3 mt-1 outline-none text-2xl tracking-[0.5em] text-center"
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono uppercase"
  }, "Repita o PIN"), /*#__PURE__*/React.createElement("input", {
    value: pin2,
    onChange: e => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6)),
    onKeyDown: e => e.key === "Enter" && confirmar(),
    type: "password",
    inputMode: "numeric",
    autoComplete: "off",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022",
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "w-full border rounded px-3 py-3 mt-1 outline-none text-2xl tracking-[0.5em] text-center"
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mt-1"
  }, "N\xE3o use 123456, n\xFAmeros repetidos nem parte do CPF. N\xE3o conte o PIN para ningu\xE9m.")), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-2"
  }, erro), /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-2 text-xs mt-3",
    style: {
      color: C.inkMuted
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: aceito,
    onChange: e => setAceito(e.target.checked),
    className: "mt-0.5"
  }), /*#__PURE__*/React.createElement("span", null, "Tenho 18 anos ou mais, li e aceito os ", /*#__PURE__*/React.createElement("a", {
    href: "/termos",
    target: "_blank",
    rel: "noopener",
    style: {
      color: C.amber
    },
    className: "underline"
  }, "Termos de Uso"), " e a ", /*#__PURE__*/React.createElement("a", {
    href: "/privacidade",
    target: "_blank",
    rel: "noopener",
    style: {
      color: C.amber
    },
    className: "underline"
  }, "Pol\xEDtica de Privacidade"), ".")), /*#__PURE__*/React.createElement("button", {
    onClick: confirmar,
    disabled: salvando,
    style: {
      background: C.amber
    },
    className: "w-full mt-4 text-white font-bold uppercase tracking-wide rounded py-3 disabled:opacity-50"
  }, salvando ? "Entrando..." : "Entrar"));
}

// Cartão com o link gerado: botão WhatsApp + copiar.
function LinkConviteCard({
  link,
  nome,
  telefone,
  novoPin,
  onFechar
}) {
  const [copiado, setCopiado] = useState(false);
  const texto = novoPin ? `Olá ${nome}! Este é seu link para criar um novo PIN no Gestão & Controle (vale 7 dias, uso único):\n${link}` : `Olá ${nome}! Você foi convidado para a equipe da obra no Gestão & Controle. Toque no link para entrar (vale 7 dias, uso único):\n${link}`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      window.prompt("Copie o link:", link);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.bg,
      borderColor: C.green
    },
    className: "border-2 rounded p-3 mt-2"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.ink
    },
    className: "text-sm font-bold mb-1"
  }, novoPin ? `Link de Novo PIN para ${nome}` : `Convite criado para ${nome}`), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-[11px] font-mono mb-2 break-all"
  }, link), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("a", {
    href: urlWhatsApp(telefone, texto),
    target: "_blank",
    rel: "noopener",
    style: {
      background: "#25D366"
    },
    className: "flex-1 text-white font-bold text-sm rounded py-2 text-center no-underline"
  }, "\uD83D\uDCF2 WhatsApp"), /*#__PURE__*/React.createElement("button", {
    onClick: copiar,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 border font-bold text-sm rounded py-2"
  }, copiado ? "✓ Copiado" : "📋 Copiar link")), /*#__PURE__*/React.createElement("button", {
    onClick: onFechar,
    style: {
      color: C.inkMuted
    },
    className: "w-full text-[11px] font-mono uppercase mt-2"
  }, "Fechar"));
}

// Aparece quando a pessoa ainda não aceitou a versão vigente dos Termos:
// primeiro acesso com Google (inclusive vindo de convite por email), contas antigas, ou Termos atualizados.
function AceiteTermosScreen({
  usuario,
  onAceito,
  onSair
}) {
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const aceitar = async () => {
    if (!aceito) {
      setErro("Marque a caixa para continuar.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await apiFetch("/api/usuarios-me", {
        method: "PATCH",
        body: JSON.stringify({
          aceitarTermos: true
        })
      });
      onAceito();
    } catch (err) {
      setErro(err.message);
      setSalvando(false);
    }
  };
  const novo = !usuario.termos_versao;
  return /*#__PURE__*/React.createElement(AuthWrap, null, /*#__PURE__*/React.createElement(LogoTitulo, null), /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-base font-extrabold text-center mt-3"
  }, novo ? `Bem-vindo, ${usuario.nome}!` : "Atualizamos nossos Termos"), usuario.empresa_nome && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm text-center mt-2"
  }, "Voc\xEA est\xE1 entrando na empresa ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.ink
    }
  }, usuario.empresa_nome), " como ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.ink
    }
  }, RANK_LABELS[usuario.rank]), "."), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs text-center mt-2 mb-4"
  }, "Para usar o aplicativo, leia e aceite os documentos abaixo."), /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-2 text-xs",
    style: {
      color: C.inkMuted
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: aceito,
    onChange: e => setAceito(e.target.checked),
    className: "mt-0.5"
  }), /*#__PURE__*/React.createElement("span", null, "Tenho 18 anos ou mais, li e aceito os ", /*#__PURE__*/React.createElement("a", {
    href: "/termos",
    target: "_blank",
    rel: "noopener",
    style: {
      color: C.amber
    },
    className: "underline"
  }, "Termos de Uso"), " e a ", /*#__PURE__*/React.createElement("a", {
    href: "/privacidade",
    target: "_blank",
    rel: "noopener",
    style: {
      color: C.amber
    },
    className: "underline"
  }, "Pol\xEDtica de Privacidade"), ".")), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono mt-2"
  }, erro), /*#__PURE__*/React.createElement("button", {
    onClick: aceitar,
    disabled: salvando,
    style: {
      background: C.amber
    },
    className: "w-full mt-4 text-white font-bold uppercase tracking-wide rounded py-2.5 disabled:opacity-50"
  }, salvando ? "..." : "Aceitar e continuar"), /*#__PURE__*/React.createElement("button", {
    onClick: onSair,
    style: {
      color: C.inkMuted
    },
    className: "w-full text-xs font-mono uppercase mt-3"
  }, "N\xE3o reconhe\xE7o / sair"));
}
function TrancaBiometricaScreen({
  onDesbloqueado,
  onUsarSenha
}) {
  const [erro, setErro] = useState("");
  const desbloquear = async () => {
    setErro("");
    try {
      const credId = localStorage.getItem("biometria-credential-id");
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: credId ? [{
            id: base64urlToBuf(credId),
            type: "public-key"
          }] : [],
          userVerification: "required",
          timeout: 60000
        }
      });
      onDesbloqueado();
    } catch (err) {
      console.error(err);
      setErro("Não foi possível validar.");
    }
  };
  useEffect(() => {
    desbloquear();
  }, []);
  return /*#__PURE__*/React.createElement(AuthWrap, null, /*#__PURE__*/React.createElement("div", {
    className: "text-center mb-5"
  }, /*#__PURE__*/React.createElement(LogoTitulo, null), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-xs font-mono mt-1"
  }, "Toque para continuar")), /*#__PURE__*/React.createElement("button", {
    onClick: desbloquear,
    style: {
      background: C.ink
    },
    className: "w-full text-white font-bold uppercase tracking-wide rounded py-2.5 mb-2"
  }, "\uD83D\uDD12 Usar digital / PIN"), erro && /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.rust
    },
    className: "text-xs font-mono text-center mb-2"
  }, erro), /*#__PURE__*/React.createElement("button", {
    onClick: onUsarSenha,
    style: {
      color: C.inkMuted
    },
    className: "w-full text-xs font-mono uppercase py-2"
  }, "Sair e entrar de novo com senha"));
}
function ConfigurarBiometriaScreen({
  onFeito
}) {
  const configurar = async () => {
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: {
            name: "Gestão & Controle"
          },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: "usuario",
            displayName: "usuario"
          },
          pubKeyCredParams: [{
            alg: -7,
            type: "public-key"
          }, {
            alg: -257,
            type: "public-key"
          }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000
        }
      });
      localStorage.setItem("biometria-credential-id", bufToBase64url(cred.rawId));
    } catch (err) {
      console.error(err);
    }
    onFeito();
  };
  return /*#__PURE__*/React.createElement(AuthWrap, null, /*#__PURE__*/React.createElement("div", {
    className: "text-center mb-4"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-3xl"
  }, "\uD83D\uDD12"), /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold uppercase tracking-wide mt-2"
  }, "Tranca r\xE1pida")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm mb-4 text-center"
  }, "Quer usar sua digital, PIN ou padr\xE3o do celular para abrir o app mais r\xE1pido da pr\xF3xima vez?"), /*#__PURE__*/React.createElement("button", {
    onClick: configurar,
    style: {
      background: C.amber
    },
    className: "w-full text-white font-bold uppercase tracking-wide rounded py-2.5 mb-2"
  }, "Configurar agora"), /*#__PURE__*/React.createElement("button", {
    onClick: onFeito,
    style: {
      color: C.inkMuted
    },
    className: "w-full text-xs font-mono uppercase py-2"
  }, "Pular por enquanto"));
}
function GestorObras() {
  const [view, setView] = useState("dashboard");
  const [modulo, setModulo] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editandoObra, setEditandoObra] = useState(null);
  const [equipeParaEditar, setEquipeParaEditar] = useState([]);
  const [fileCache, setFileCache] = useState({});
  const [lightboxImg, setLightboxImg] = useState(null);
  const [temaEscuro, setTemaEscuro] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  useEffect(() => {
    if (!sessionLoading && window.gcFecharSplash) window.gcFecharSplash();
  }, [sessionLoading]);
  const [temSessao, setTemSessao] = useState(false);
  const [usuarioAPI, setUsuarioAPI] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [conviteToken, setConviteToken] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("convite");
    } catch (e) {
      return null;
    }
  });
  const sairDoConvite = () => {
    window.history.replaceState(window.history.state, "", "/"); // tira o ?convite= da URL
    setConviteToken(null);
  };
  const [biometriaConfigurada, setBiometriaConfigurada] = useState(false);
  const [biometriaPassada, setBiometriaPassada] = useState(false);
  const [configurandoBiometria, setConfigurandoBiometria] = useState(false);
  const [obras, setObras] = useState([]);
  const obrasRef = useRef([]);
  useEffect(() => {
    obrasRef.current = obras;
  }, [obras]);
  const [obrasLoading, setObrasLoading] = useState(false);
  const [pendentesPorObra, setPendentesPorObra] = useState({});
  const [obraDetalhe, setObraDetalhe] = useState(null);
  const [notificacoes, setNotificacoes] = useState([]);
  const obraDetalheRef = useRef(null);
  const fotosVistasRef = useRef(new Set());
  useEffect(() => {
    obraDetalheRef.current = obraDetalhe;
  }, [obraDetalhe]);
  const notificar = mensagens => {
    const novas = mensagens.map(texto => ({
      id: uid(),
      texto
    }));
    setNotificacoes(prev => [...prev, ...novas]);
    novas.forEach(n => setTimeout(() => setNotificacoes(prev => prev.filter(x => x.id !== n.id)), 6000));
  };
  const [obraDetalheLoading, setObraDetalheLoading] = useState(false);
  const [erroGlobal, setErroGlobal] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [showDefinirSenha, setShowDefinirSenha] = useState(false);
  const [showMeuPin, setShowMeuPin] = useState(false);
  // 🔔 Avisos: carrega ao entrar e a cada 60 s (só com a tela visível).
  const [avisosDados, setAvisosDados] = useState(null);
  const [showAvisos, setShowAvisos] = useState(false);
  const [showAvisosConfig, setShowAvisosConfig] = useState(false);
  const carregarAvisos = async () => {
    try {
      const r = await apiFetch("/api/avisos");
      setAvisosDados(r);
      return r;
    } catch (e) {
      return null;
    }
  };
  useEffect(() => {
    if (!usuarioAPI) return;
    carregarAvisos();
    const t = setInterval(() => {
      if (!document.hidden) carregarAvisos();
    }, 60000);
    const vis = () => {
      if (!document.hidden) carregarAvisos();
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [usuarioAPI?.id]);
  // App já aberto e a pessoa toca numa notificação: o service worker avisa aqui.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const aoMsg = ev => {
      if (!ev.data || ev.data.tipo !== "abrir-aviso") return;
      try {
        const q = new URL(ev.data.url).searchParams;
        const id = Number(q.get("aviso_obra"));
        carregarAvisos();
        if (id && obrasRef.current.some(o => o.id === id)) abrirObra(id, {
          moduloInicial: MODULO_DO_AVISO[q.get("aviso_cat")] || null
        });
      } catch (e) {}
    };
    navigator.serviceWorker.addEventListener("message", aoMsg);
    return () => navigator.serviceWorker.removeEventListener("message", aoMsg);
  }, []);
  const abrirAvisos = async () => {
    setShowAvisos(true);
    const r = await carregarAvisos();
    if (r && r.naoLidos > 0) {
      apiFetch("/api/avisos", {
        method: "PATCH",
        body: JSON.stringify({
          visto: true
        })
      }).catch(() => {});
      setAvisosDados(d => d && {
        ...d,
        naoLidos: 0
      }); // as não lidas continuam destacadas nesta abertura
    }
  };
  const alternarSilencio = async obraId => {
    const silenciada = (avisosDados?.silenciadas || []).includes(obraId);
    await apiFetch("/api/avisos", {
      method: "PATCH",
      body: JSON.stringify({
        obraId,
        silenciar: !silenciada
      })
    });
    setAvisosDados(d => ({
      ...(d || {}),
      silenciadas: silenciada ? (d?.silenciadas || []).filter(x => x !== obraId) : [...(d?.silenciadas || []), obraId]
    }));
  };
  const [showMeusDados, setShowMeusDados] = useState(false);
  const [termosVigente, setTermosVigente] = useState(null);
  const [vendoApresentacao, setVendoApresentacao] = useState(false);
  const [meusNiveis, setMeusNiveis] = useState(null);
  const [fazendoBackup, setFazendoBackup] = useState(false);
  const navRestauradaRef = useRef(false);
  const [sairAberto, setSairAberto] = useState(false);
  const [sairFalhou, setSairFalhou] = useState(false);
  // Histórico do navegador: cada entrada guarda seu "nivel".
  //   -1 = base (voltar daqui sai do app)   0 = guarda do dashboard   1+ = obra / módulo / telas
  // Capturado no primeiro render, antes de qualquer efeito mexer no histórico.
  const arranqueFrioRef = useRef(typeof window.history.state?.nivel !== "number");
  const empurrarHistorico = (extra = {}) => {
    const n = (window.history.state?.nivel ?? 0) + 1;
    window.history.pushState({
      ...extra,
      nivel: n
    }, "");
  };
  // Volta o histórico até a guarda do dashboard (quando se vai ao dashboard por um botão, não pelo "voltar").
  const recuarAteDashboard = () => {
    const n = window.history.state?.nivel ?? 0;
    if (n > 0) window.history.go(-n);
  };
  const carregarUsuarioAPI = async () => {
    const token = await getValidAccessToken();
    if (!token) {
      setTemSessao(false);
      setUsuarioAPI(null);
      return;
    }
    setTemSessao(true);
    try {
      const res = await fetch("/api/usuarios-me", {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const dataRes = await res.json();
      if (dataRes.ok) {
        // D2: sessão renovada (uma vez por dia) — guarda a chave nova.
        if (dataRes.novoToken) {
          const ss = getSession();
          if (ss) saveSession({
            ...ss,
            token: dataRes.novoToken
          });
        }
        setUsuarioAPI(dataRes.usuario);
        setTermosVigente(dataRes.termos_vigente || null);
      } else {
        clearSession();
        setTemSessao(false);
      }
    } catch (e) {
      // sem rede: mantemos a sessão, só não temos os dados do servidor por enquanto
    }
  };
  useEffect(() => {
    (async () => {
      await carregarUsuarioAPI();
      setSessionLoading(false);
      setBiometriaConfigurada(!!localStorage.getItem("biometria-credential-id"));
      try {
        const res = await window.storage.get("tema");
        setTemaEscuro(res ? res.value === "escuro" : false);
      } catch (e) {}
    })();
  }, []);
  useEffect(() => {
    if (!navRestauradaRef.current) return;
    try {
      if (view === "dashboard") localStorage.removeItem("gc-nav");else localStorage.setItem("gc-nav", JSON.stringify({
        view,
        selectedId,
        modulo
      }));
    } catch (e) {}
  }, [view, selectedId, modulo]);
  const carregarPendentes = async lista => {
    const mapa = {};
    await Promise.all(lista.map(async o => {
      try {
        const r = await apiFetch(`/api/etapas?obra_id=${o.id}`);
        mapa[o.id] = r.etapas.filter(e => !e.concluida).length;
      } catch (e) {
        mapa[o.id] = 0;
      }
    }));
    setPendentesPorObra(mapa);
  };
  const restaurarNavegacao = listaObras => {
    // Veio de uma notificação push (?aviso_obra=12&aviso_cat=etapas): abre direto a obra e a gaveta.
    try {
      const q = new URLSearchParams(window.location.search);
      const avObra = Number(q.get("aviso_obra"));
      if (avObra) {
        window.history.replaceState(window.history.state, "", window.location.pathname);
        if (listaObras.some(o => o.id === avObra)) {
          abrirObra(avObra, {
            moduloInicial: MODULO_DO_AVISO[q.get("aviso_cat")] || null
          });
          return;
        }
      }
    } catch (e) {}
    try {
      const saved = JSON.parse(localStorage.getItem("gc-nav") || "null");
      if (!saved) return;
      // App aberta do zero (não F5): o histórico está vazio e o "voltar" do Android sairia do app.
      // Nesse caso criamos as entradas que faltam. No F5 o navegador já as conserva.
      const arranqueFrio = arranqueFrioRef.current;
      if (saved.view === "obra" && saved.selectedId && listaObras.some(o => o.id === saved.selectedId)) {
        abrirObra(saved.selectedId, {
          pushHistory: arranqueFrio,
          moduloInicial: saved.modulo || null
        });
        if (arranqueFrio && saved.modulo) empurrarHistorico({
          gcModulo: true
        });
      } else if (["pendientes", "report", "permissoes", "leads", "ajuda"].includes(saved.view)) {
        setView(saved.view);
        if (arranqueFrio) empurrarHistorico({
          gcView: saved.view
        });
      }
    } catch (e) {}
  };
  const carregarObras = async () => {
    setObrasLoading(true);
    setErroGlobal("");
    try {
      const r = await apiFetch("/api/obras");
      setObras(r.obras);
      carregarPendentes(r.obras);
      if (!navRestauradaRef.current) {
        navRestauradaRef.current = true;
        restaurarNavegacao(r.obras);
      }
    } catch (err) {
      setErroGlobal(err.message);
    }
    setObrasLoading(false);
  };
  const carregarNiveis = async usuario => {
    try {
      const r = await apiFetch("/api/permissoes");
      const meus = {};
      r.permissoes.filter(p => p.rank === usuario.rank).forEach(p => {
        meus[p.modulo] = p.nivel;
      });
      setMeusNiveis(meus);
    } catch (e) {
      setMeusNiveis({});
    }
  };
  useEffect(() => {
    if (usuarioAPI) {
      carregarObras();
      carregarNiveis(usuarioAPI);
    }
  }, [usuarioAPI]);
  const aoLogar = async () => {
    setBiometriaPassada(true);
    await carregarUsuarioAPI();
    if (!localStorage.getItem("biometria-credential-id") && biometriaSuportada()) {
      setConfigurandoBiometria(true);
    }
  };
  const excluirMinhaConta = async () => {
    const r = window.prompt("Excluir sua conta? Você não vai mais conseguir entrar e seus dados pessoais (nome, e-mail, CPF, telefone) serão apagados. O que você registrou nas obras fica, assinado como «Usuário removido». Digite EXCLUIR para confirmar.");
    if (r !== "EXCLUIR") return;
    try {
      await apiFetch("/api/usuarios-me", {
        method: "DELETE"
      });
      setShowConfig(false);
      sair();
    } catch (err) {
      window.alert(err.message);
    }
  };
  const sair = () => {
    // D2: avisa o servidor para encerrar esta sessão (a chave deixa de abrir). Sem esperar: se falhar, sai igual.
    apiFetch("/api/usuarios-me", {
      method: "PATCH",
      body: JSON.stringify({
        sair: true
      })
    }).catch(() => {});
    clearSession();
    setTemSessao(false);
    setUsuarioAPI(null);
    setBiometriaPassada(false);
    setObras([]);
    setObraDetalhe(null);
  };
  const alternarTema = () => {
    const novo = !temaEscuro;
    setTemaEscuro(novo);
    window.storage.set("tema", novo ? "escuro" : "claro").catch(() => {});
  };
  const temaVars = useMemo(() => {
    const p = temaEscuro ? TEMA_ESCURO : TEMA_CLARO;
    return {
      "--c-bg": p.bg,
      "--c-surface": p.surface,
      "--c-ink": p.ink,
      "--c-inkMuted": p.inkMuted,
      "--c-border": p.border,
      "--c-amber": p.amber,
      "--c-blue": p.blue,
      "--c-rust": p.rust,
      "--c-green": p.green,
      "--c-steel": p.steel,
      "--c-teal": p.teal,
      background: p.bg,
      minHeight: "100vh",
      colorScheme: temaEscuro ? "dark" : "light"
    };
  }, [temaEscuro]);
  const saveArquivo = async (id, payload) => {
    try {
      const res = await fetch("/api/arquivo-set", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...cabecalhoAuth()
        },
        body: JSON.stringify({
          id,
          payload: JSON.stringify(payload)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setFileCache(p => ({
          ...p,
          [id]: payload
        }));
        return true;
      }
      console.error("saveArquivo falhou:", res.status, data.error);
      return {
        erro: data.error || `Erro ${res.status}`
      };
    } catch (e) {
      console.error("saveArquivo exceção:", e);
      return {
        erro: e.message
      };
    }
  };
  const loadFile = async id => {
    if (fileCache[id]) return;
    try {
      const res = await fetch(`/api/arquivo-get?id=${encodeURIComponent(id)}`, {
        headers: cabecalhoAuth()
      });
      if (res.status === 404) {
        setFileCache(p => ({
          ...p,
          [id]: "MISSING"
        }));
        return;
      }
      const data = await res.json();
      let f = "MISSING";
      try {
        if (data.ok) {
          const obj = JSON.parse(data.payload);
          if (arquivoSeguro(obj)) f = obj;
        }
      } catch (e) {}
      setFileCache(p => ({
        ...p,
        [id]: f
      }));
    } catch (e) {
      setFileCache(p => ({
        ...p,
        [id]: "MISSING"
      }));
    }
  };
  const deleteArquivoRemoto = id => {
    fetch(`/api/arquivo-delete?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: cabecalhoAuth()
    }).catch(() => {});
  };

  // --- Obras ---
  const criarObra = async form => {
    const r = await apiFetch("/api/obras", {
      method: "POST",
      body: JSON.stringify(form)
    });
    setObras(prev => [r.obra, ...prev]);
    setShowModal(false);
  };
  const changeEstado = async (obraId, estado) => {
    const r = await apiFetch(`/api/obras?id=${obraId}`, {
      method: "PATCH",
      body: JSON.stringify({
        estado
      })
    });
    setObras(prev => prev.map(o => o.id === obraId ? r.obra : o));
  };
  const transferirObra = async (obraId, novoResponsavelId) => {
    const r = await apiFetch(`/api/obras?id=${obraId}`, {
      method: "PATCH",
      body: JSON.stringify({
        novoResponsavelId
      })
    });
    setObras(prev => prev.map(o => o.id === obraId ? r.obra : o));
  };
  const deleteObra = async obraId => {
    if (!window.confirm("Excluir esta obra? Essa ação não pode ser desfeita.")) return;
    await apiFetch(`/api/obras?id=${obraId}`, {
      method: "DELETE"
    });
    setObras(prev => prev.filter(o => o.id !== obraId));
    recuarAteDashboard();
    setView("dashboard");
  };
  const abrirEdicaoObra = async obra => {
    setEditandoObra(obra);
    try {
      const r = await apiFetch(`/api/equipe`);
      setEquipeParaEditar(r.equipe);
    } catch (e) {
      setEquipeParaEditar([]);
    }
  };
  const salvarEdicaoObra = async dados => {
    const r = await apiFetch(`/api/obras?id=${editandoObra.id}`, {
      method: "PATCH",
      body: JSON.stringify(dados)
    });
    setObras(prev => prev.map(o => o.id === editandoObra.id ? r.obra : o));
  };

  // Backup do Dono (C3): monta um .zip com dados.json (todas as obras) + as fotos e os documentos.
  // É montado neste aparelho (não depende de limites do servidor). Pode demorar se houver muitos arquivos.
  const montarBackup = async () => {
    setFazendoBackup("Lendo as obras...");
    const limpo = t => String(t || "").replace(/[\\/:*?"<>|\n\r\t]+/g, "_").slice(0, 60).trim() || "sem-nome";
    const pacote = {
      geradoEm: new Date().toISOString(),
      obras: []
    };
    const arquivos = []; // { id, caminho }
    for (const obra of obras) {
      const [et, eq, fe, ma, ob, doc, fo] = await Promise.all([apiFetch(`/api/etapas?obra_id=${obra.id}`).catch(() => ({
        etapas: []
      })), apiFetch(`/api/equipe?obra_id=${obra.id}`).catch(() => ({
        equipe: []
      })), apiFetch(`/api/ferramentas?obra_id=${obra.id}`).catch(() => ({
        ferramentas: []
      })), apiFetch(`/api/materiais?obra_id=${obra.id}`).catch(() => ({
        materiais: []
      })), apiFetch(`/api/observacoes?obra_id=${obra.id}`).catch(() => ({
        observacoes: []
      })), apiFetch(`/api/documentos?obra_id=${obra.id}`).catch(() => ({
        documentos: []
      })), apiFetch(`/api/etapa-fotos?obra_id=${obra.id}`).catch(() => ({
        fotos: []
      }))]);
      pacote.obras.push({
        obra,
        etapas: et.etapas,
        equipe: eq.equipe,
        ferramentas: fe.ferramentas,
        materiais: ma.materiais,
        observacoes: ob.observacoes,
        documentos: doc.documentos,
        fotos: fo.fotos
      });
      const pasta = `${obra.id}-${limpo(obra.cliente)}`;
      const etapaNome = Object.fromEntries((et.etapas || []).map(e => [e.id, limpo(e.texto)]));
      (doc.documentos || []).forEach(d => arquivos.push({
        id: d.arquivo_id,
        caminho: `${pasta}/documentos/${d.id}-${limpo(d.nome)}`
      }));
      (fo.fotos || []).forEach(f => arquivos.push({
        id: f.arquivo_id,
        caminho: `${pasta}/fotos/${etapaNome[f.etapa_id] || "etapa"}-${f.id}`
      }));
      (et.etapas || []).filter(e => e.foto_conclusao_id).forEach(e => arquivos.push({
        id: e.foto_conclusao_id,
        caminho: `${pasta}/fotos/${limpo(e.texto)}-conclusao`
      }));
    }
    const zip = new JSZip();
    const extensao = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "application/pdf": ".pdf"
    };
    let feitos = 0,
      faltando = 0;
    for (const a of arquivos) {
      setFazendoBackup(`Arquivos ${feitos + 1}/${arquivos.length}...`);
      try {
        const r = await fetch(`/api/arquivo-get?id=${encodeURIComponent(a.id)}`, {
          headers: cabecalhoAuth()
        });
        const d = await r.json();
        const f = d.ok ? JSON.parse(d.payload) : null;
        if (f && arquivoSeguro(f)) {
          const m = f.dataUrl.match(/^data:([^;]+);base64,(.*)$/);
          const ext = /\.[a-z0-9]{2,5}$/i.test(a.caminho) ? "" : extensao[m[1]] || "";
          zip.file(a.caminho + ext, m[2], {
            base64: true
          });
        } else faltando++;
      } catch (e) {
        faltando++;
      }
      feitos++;
    }
    pacote.arquivos = {
      total: arquivos.length,
      incluidos: arquivos.length - faltando,
      faltando
    };
    zip.file("dados.json", JSON.stringify(pacote, null, 2));
    zip.file("LEIA-ME.txt", `Backup do G&C gerado em ${new Date().toLocaleString("pt-BR")}.\n\ndados.json = todas as obras (etapas, equipe, materiais, ferramentas, observações, documentos e fotos).\nAs pastas têm as fotos e os documentos de cada obra.\n${faltando ? faltando + " arquivo(s) não puderam ser incluídos (apagados ou com erro).\n" : ""}`);
    setFazendoBackup("Compactando...");
    return await zip.generateAsync({
      type: "blob"
    });
  };
  const nomeBackup = () => `gc-backup-${todayISO()}.zip`;

  // "📥 Celular Backup": baixa o .zip direto na pasta de downloads do navegador.
  const backupCelular = async () => {
    try {
      const blob = await montarBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeBackup();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      setErroGlobal(err.message);
    }
    setFazendoBackup(false);
  };

  // "Drive Backup": sobe o mesmo .zip para a pasta "G&C backup" no Google Drive do Dono.
  // Permissão mínima do Google (drive.file): o G&C só enxerga os arquivos que ele mesmo criou —
  // nada do resto do Drive. Fica só neste aparelho e só na memória (o token vale ~1 hora).
  // Guarda os 10 backups mais novos; os mais velhos (só os criados pelo G&C) vão para a lixeira do Drive.
  const backupDrive = async () => {
    setFazendoBackup("Conectando ao Drive...");
    try {
      const token = await tokenDrive(usuarioAPI?.email);
      const blob = await montarBackup();
      setFazendoBackup("Enviando ao Drive...");
      await subirParaDrive(token, blob, nomeBackup());
      window.alert("✓ Backup salvo no seu Google Drive, na pasta \"G&C backup\".");
    } catch (err) {
      setErroGlobal(err.message);
    }
    setFazendoBackup(false);
  };

  // --- Abrir una obra: carga todo lo de esa obra en paralelo ---
  const abrirObra = async (id, opts = {}) => {
    const {
      pushHistory = true,
      moduloInicial = null
    } = opts;
    setSelectedId(id);
    setView("obra");
    setModulo(moduloInicial);
    if (pushHistory) empurrarHistorico({
      gcObra: true
    });
    setObraDetalhe(null);
    setObraDetalheLoading(true);
    try {
      const [et, eq, fe, ma, ob, doc, fo] = await Promise.all([apiFetch(`/api/etapas?obra_id=${id}`), apiFetch(`/api/equipe?obra_id=${id}`), apiFetch(`/api/ferramentas?obra_id=${id}`), apiFetch(`/api/materiais?obra_id=${id}`), apiFetch(`/api/observacoes?obra_id=${id}`), apiFetch(`/api/documentos?obra_id=${id}`), apiFetch(`/api/etapa-fotos?obra_id=${id}`)]);
      setObraDetalhe({
        etapas: et.etapas,
        equipe: eq.equipe,
        ferramentas: fe.ferramentas,
        materiais: ma.materiais,
        observacoes: ob.observacoes,
        documentos: doc.documentos
      });
      fotosVistasRef.current = new Set(fo.fotos.map(f => f.id));
    } catch (err) {
      setErroGlobal(err.message);
    }
    setObraDetalheLoading(false);
  };
  const abrirModulo = key => {
    setModulo(key);
    empurrarHistorico({
      gcModulo: true
    });
  };

  // Telas "de passagem" (Permissões, Leads, Pendências, Relatório): lembramos de onde se veio
  // para que o "voltar" devolva ao mesmo lugar (ex.: a gaveta de Equipe), e não ao dashboard.
  const pilhaViewsRef = useRef([]);
  const irParaView = v => {
    pilhaViewsRef.current.push(view);
    setView(v);
    empurrarHistorico({
      gcView: v
    });
  };
  const voltarAoDashboard = () => {
    pilhaViewsRef.current = [];
    setView("dashboard");
    setModulo(null);
    if (selectedId) carregarPendentes(obras);
  };

  // --- Refresco automático cada 15s mientras se está viendo uma obra, com aviso de quem fez o quê ---
  useEffect(() => {
    if (view !== "obra" || !selectedId) return;
    const nomeDe = (equipeAtual, userId) => {
      if (userId === usuarioAPI?.id) return null; // não notifica a própria ação
      const m = equipeAtual.find(e => e.usuario_id === userId);
      return m ? m.nome : "Alguém";
    };

    // Atualização automática: a cada 30 s, e só com a tela visível (aba em segundo plano/celular bloqueado = pausa).
    const interval = setInterval(async () => {
      if (document.hidden) return;
      const atual = obraDetalheRef.current;
      if (!atual) return;
      try {
        const [et, eq, fe, ma, ob, doc, fo] = await Promise.all([apiFetch(`/api/etapas?obra_id=${selectedId}`), apiFetch(`/api/equipe?obra_id=${selectedId}`), apiFetch(`/api/ferramentas?obra_id=${selectedId}`), apiFetch(`/api/materiais?obra_id=${selectedId}`), apiFetch(`/api/observacoes?obra_id=${selectedId}`), apiFetch(`/api/documentos?obra_id=${selectedId}`), apiFetch(`/api/etapa-fotos?obra_id=${selectedId}`)]);
        const msgs = [];
        const idsAntigos = lista => new Set(lista.map(x => x.id));
        et.etapas.filter(x => !idsAntigos(atual.etapas).has(x.id)).forEach(x => {
          const nome = nomeDe(eq.equipe, x.criado_por);
          if (nome) msgs.push(`${nome} adicionou a etapa "${x.texto}"`);
        });
        fe.ferramentas.filter(x => !idsAntigos(atual.ferramentas).has(x.id)).forEach(x => {
          const nome = nomeDe(eq.equipe, x.criado_por);
          if (nome) msgs.push(`${nome} adicionou a ferramenta "${x.texto}"`);
        });
        ma.materiais.filter(x => !idsAntigos(atual.materiais).has(x.id)).forEach(x => {
          const nome = nomeDe(eq.equipe, x.criado_por);
          if (nome) msgs.push(`${nome} adicionou o material "${x.texto}"`);
        });
        ob.observacoes.filter(x => !idsAntigos(atual.observacoes).has(x.id)).forEach(x => {
          const nome = nomeDe(eq.equipe, x.criado_por);
          if (nome) msgs.push(`${nome} adicionou uma observação: "${x.texto}"`);
        });
        doc.documentos.filter(x => !idsAntigos(atual.documentos).has(x.id)).forEach(x => {
          const nome = nomeDe(eq.equipe, x.criado_por);
          if (nome) msgs.push(`${nome} adicionou o documento "${x.nome}"`);
        });
        fo.fotos.filter(x => !fotosVistasRef.current.has(x.id)).forEach(x => {
          const nome = nomeDe(eq.equipe, x.criado_por);
          if (nome) msgs.push(`${nome} adicionou uma foto`);
        });
        fotosVistasRef.current = new Set(fo.fotos.map(x => x.id));
        if (msgs.length) notificar(msgs);
        setObraDetalhe({
          etapas: et.etapas,
          equipe: eq.equipe,
          ferramentas: fe.ferramentas,
          materiais: ma.materiais,
          observacoes: ob.observacoes,
          documentos: doc.documentos
        });
      } catch (e) {/* rede falhou nessa rodada, tenta de novo no próximo ciclo */}
    }, 30000);
    return () => clearInterval(interval);
  }, [view, selectedId, usuarioAPI]);

  // Prepara o histórico: base (-1) + guarda do dashboard (0), para que o 1º "voltar" no dashboard não saia direto.
  useEffect(() => {
    if (typeof window.history.state?.nivel !== "number") window.history.replaceState({
      nivel: -1
    }, "");
    if (window.history.state.nivel === -1) window.history.pushState({
      nivel: 0
    }, "");
  }, []);
  const ficarNoApp = () => {
    window.history.pushState({
      nivel: 0
    }, "");
    setSairAberto(false);
  };
  const sairDoApp = () => {
    window.close();
    // Se o sistema não deixar fechar por código, pedimos o 2º "voltar".
    setTimeout(() => setSairFalhou(true), 300);
  };

  // Único ponto que escuta o botão/gesto nativo de voltar do Android.
  // Fecha primeiro o módulo aberto; se não há módulo, volta pro dashboard a partir de qualquer view.
  useEffect(() => {
    const onPopState = () => {
      if (view === "obra" && modulo) {
        setModulo(null);
      } else if (view !== "obra" && view !== "dashboard" && pilhaViewsRef.current.length) {
        // Saindo de uma tela de passagem: volta pra onde estava (obra + gaveta continuam carregadas)
        setView(pilhaViewsRef.current.pop());
      } else if (view !== "dashboard") {
        voltarAoDashboard();
      } else if (window.history.state?.nivel === -1) {
        // 1º "voltar" no dashboard: pergunta. Um 2º "voltar" (com o aviso aberto) sai do app.
        setSairFalhou(false);
        setSairAberto(true);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [view, modulo, selectedId, obras]);

  // --- Etapas ---
  const addEtapa = async (parentId, texto) => {
    const r = await apiFetch("/api/etapas", {
      method: "POST",
      body: JSON.stringify({
        obraId: selectedId,
        parentId,
        texto
      })
    });
    setObraDetalhe(d => ({
      ...d,
      etapas: [...d.etapas, r.etapa]
    }));
  };
  const toggleEtapa = async (id, concluida) => {
    const r = await apiFetch(`/api/etapas?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        concluida
      })
    });
    setObraDetalhe(d => ({
      ...d,
      etapas: d.etapas.map(e => e.id === id ? r.etapa : e)
    }));
  };
  const addFotoEtapa = async (etapaId, arquivoId) => {
    await apiFetch(`/api/etapa-fotos`, {
      method: "POST",
      body: JSON.stringify({
        etapaId,
        arquivoId
      })
    });
  };
  const deleteFotoEtapa = async fotoRowId => {
    await apiFetch(`/api/etapa-fotos?id=${fotoRowId}`, {
      method: "DELETE"
    });
  };
  const editEtapa = async (id, texto) => {
    const r = await apiFetch(`/api/etapas?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        texto
      })
    });
    setObraDetalhe(d => ({
      ...d,
      etapas: d.etapas.map(e => e.id === id ? r.etapa : e)
    }));
  };
  const removeEtapa = async id => {
    await apiFetch(`/api/etapas?id=${id}`, {
      method: "DELETE"
    });
    // recarrega para reflejar la cascada (subetapas borradas junto con el padre)
    const r = await apiFetch(`/api/etapas?obra_id=${selectedId}`);
    setObraDetalhe(d => ({
      ...d,
      etapas: r.etapas
    }));
  };

  // --- Ferramentas / Materiais / Observações (mismo patrón para los 3) ---
  const criarListaHandlers = (recurso, campo) => ({
    add: async texto => {
      const r = await apiFetch(`/api/${recurso}`, {
        method: "POST",
        body: JSON.stringify({
          obraId: selectedId,
          texto
        })
      });
      setObraDetalhe(d => ({
        ...d,
        [campo]: [r.item, ...d[campo]]
      }));
    },
    del: async id => {
      await apiFetch(`/api/${recurso}?id=${id}`, {
        method: "DELETE"
      });
      setObraDetalhe(d => ({
        ...d,
        [campo]: d[campo].filter(x => x.id !== id)
      }));
    }
  });
  const ferramentasH = criarListaHandlers("ferramentas", "ferramentas");
  const materiaisH = criarListaHandlers("materiais", "materiais");
  const observacoesH = criarListaHandlers("observacoes", "observacoes");
  const editarObservacao = async (id, texto) => {
    const r = await apiFetch(`/api/observacoes?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        texto
      })
    });
    setObraDetalhe(d => ({
      ...d,
      observacoes: d.observacoes.map(o => o.id === id ? r.item : o)
    }));
  };

  // --- Equipe ---
  const addEquipo = async payload => {
    const r = await apiFetch("/api/equipe", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (!r.convite) setObraDetalhe(d => ({
      ...d,
      equipe: [...d.equipe, r.equipe]
    }));
    return r;
  };
  const removeEquipo = async id => {
    await apiFetch(`/api/equipe?id=${id}`, {
      method: "DELETE"
    });
    setObraDetalhe(d => ({
      ...d,
      equipe: d.equipe.filter(m => m.id !== id)
    }));
  };
  const toggleHoje = async (id, hoje) => {
    const r = await apiFetch(`/api/equipe?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        data: hoje
      })
    });
    setObraDetalhe(d => ({
      ...d,
      equipe: d.equipe.map(m => m.id === id ? {
        ...m,
        asistencias: r.equipe.asistencias,
        presencas_por: r.equipe.presencas_por
      } : m)
    }));
  };
  // Edita integrante: { rank }, { funcao } e/ou { excecaoModulos }
  const setExcecao = async (id, campos) => {
    const r = await apiFetch(`/api/equipe?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify(campos)
    });
    setObraDetalhe(d => ({
      ...d,
      equipe: d.equipe.map(m => m.id === id ? {
        ...m,
        ...r.membro
      } : m)
    }));
  };

  // --- Documentos ---
  const addDoc = async payload => {
    const r = await apiFetch("/api/documentos", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setObraDetalhe(d => ({
      ...d,
      documentos: [r.documento, ...d.documentos]
    }));
  };
  const deleteDoc = async (id, arquivoId) => {
    await apiFetch(`/api/documentos?id=${id}`, {
      method: "DELETE"
    });
    if (arquivoId) deleteArquivoRemoto(arquivoId);
    setObraDetalhe(d => ({
      ...d,
      documentos: d.documentos.filter(x => x.id !== id)
    }));
  };
  const selectedObra = obras.find(o => o.id === selectedId);
  const totalPendientes = Object.values(pendentesPorObra).reduce((a, b) => a + b, 0);
  let content;
  if (conviteToken) {
    content = /*#__PURE__*/React.createElement(ConviteScreen, {
      token: conviteToken,
      onEntrou: () => {
        sairDoConvite();
        aoLogar();
      },
      onCancelar: sairDoConvite
    });
  } else if (sessionLoading) {
    content = /*#__PURE__*/React.createElement(SplashScreen, null);
  } else if (!temSessao) {
    content = authView === "cadastro" ? /*#__PURE__*/React.createElement(CadastroScreen, {
      onIrLogin: () => setAuthView("login"),
      onCadastrado: aoLogar
    }) : /*#__PURE__*/React.createElement(LoginScreen, {
      onLogado: aoLogar,
      onIrCadastro: () => setAuthView("cadastro")
    });
  } else if (configurandoBiometria) {
    content = /*#__PURE__*/React.createElement(ConfigurarBiometriaScreen, {
      onFeito: () => {
        setConfigurandoBiometria(false);
        setBiometriaConfigurada(!!localStorage.getItem("biometria-credential-id"));
      }
    });
  } else if (biometriaConfigurada && !biometriaPassada) {
    content = /*#__PURE__*/React.createElement(TrancaBiometricaScreen, {
      onDesbloqueado: () => setBiometriaPassada(true),
      onUsarSenha: sair
    });
  } else if (!usuarioAPI) {
    content = /*#__PURE__*/React.createElement(SplashScreen, null);
  } else if (termosVigente && usuarioAPI.termos_versao !== termosVigente) {
    content = /*#__PURE__*/React.createElement(AceiteTermosScreen, {
      usuario: usuarioAPI,
      onAceito: () => setUsuarioAPI(u => ({
        ...u,
        termos_versao: termosVigente
      })),
      onSair: sair
    });
  } else if (vendoApresentacao || usuarioAPI.apresentacao_vista_em === null) {
    // null = coluna existe e a pessoa ainda não viu. (undefined = SQL ainda não rodado: não mostra.)
    content = /*#__PURE__*/React.createElement(Apresentacao, {
      usuarioAPI: usuarioAPI,
      onFim: () => {
        setVendoApresentacao(false);
        if (usuarioAPI.apresentacao_vista_em === null) {
          setUsuarioAPI(u => ({
            ...u,
            apresentacao_vista_em: new Date().toISOString()
          }));
          apiFetch("/api/usuarios-me", {
            method: "PATCH",
            body: JSON.stringify({
              apresentacaoVista: true
            })
          }).catch(() => {});
        }
      }
    });
  } else {
    content = /*#__PURE__*/React.createElement("div", {
      className: "p-4 pb-24"
    }, view === "dashboard" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "flex items-start gap-3 mb-5 pt-2"
    }, /*#__PURE__*/React.createElement("img", {
      src: "logo.png",
      alt: "G&C",
      className: "w-14 h-14 rounded-full shrink-0"
    }), /*#__PURE__*/React.createElement("div", {
      className: "flex-1 min-w-0"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between gap-2"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.inkMuted
      },
      className: "text-[11px] font-mono truncate"
    }, RANK_LABELS[usuarioAPI.rank] || ""), /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.inkMuted
      },
      className: "text-[11px] font-mono truncate"
    }, usuarioAPI.nome)), /*#__PURE__*/React.createElement("h1", {
      className: "font-comic gc-3d text-2xl tracking-wide leading-tight mt-0.5"
    }, "Gest\xE3o & Controle"))), /*#__PURE__*/React.createElement("div", {
      className: "flex flex-wrap gap-2 mb-4"
    }, [1, 2, 4].includes(usuarioAPI.rank) && /*#__PURE__*/React.createElement("button", {
      onClick: async () => {
        setShowModal(true);
        try {
          const r = await apiFetch(`/api/equipe`);
          setEquipeParaEditar(r.equipe);
        } catch (e) {
          setEquipeParaEditar([]);
        }
      },
      style: {
        background: C.amber
      },
      className: "text-white font-bold uppercase tracking-wide text-sm rounded px-4 py-2.5"
    }, "+ Nova obra"), /*#__PURE__*/React.createElement("button", {
      onClick: () => irParaView("pendientes"),
      style: {
        background: totalPendientes > 0 ? C.rust : "transparent",
        borderColor: C.rust,
        color: totalPendientes > 0 ? "#fff" : C.rust
      },
      className: "border font-bold uppercase tracking-wide text-sm rounded px-4 py-2.5"
    }, "\u25CF Pend\xEAncias ", totalPendientes > 0 && `(${totalPendientes})`), /*#__PURE__*/React.createElement("button", {
      onClick: () => irParaView("report"),
      style: {
        borderColor: C.ink,
        color: C.ink
      },
      className: "border font-bold uppercase tracking-wide text-sm rounded px-4 py-2.5"
    }, "\uD83D\uDCC5 Relat\xF3rio semanal")), erroGlobal && /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.rust
      },
      className: "text-xs font-mono mb-3"
    }, erroGlobal), obrasLoading ? /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-sm font-mono text-center py-16"
    }, "Carregando...") : obras.length === 0 ? /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-sm font-mono text-center py-16"
    }, "Nenhuma obra cadastrada. Comece com \"Nova obra\".") : /*#__PURE__*/React.createElement("div", {
      className: "grid grid-cols-1 sm:grid-cols-2 gap-4"
    }, obras.map(obra => /*#__PURE__*/React.createElement(TicketCard, {
      key: obra.id,
      obra: obra,
      pendCount: pendentesPorObra[obra.id] || 0,
      lastDate: null,
      onOpen: () => abrirObra(obra.id),
      onEdit: usuarioAPI.rank <= 2 ? () => abrirEdicaoObra(obra) : null,
      onDelete: usuarioAPI.rank <= 2 ? () => deleteObra(obra.id) : null
    })))), view === "obra" && selectedObra && (obraDetalheLoading ? /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.inkMuted
      },
      className: "text-sm font-mono text-center py-16"
    }, "Carregando...") : !obraDetalhe ? /*#__PURE__*/React.createElement("div", {
      className: "text-center py-16"
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        color: C.rust
      },
      className: "text-sm font-mono mb-3"
    }, erroGlobal || "Não foi possível carregar a obra."), /*#__PURE__*/React.createElement("button", {
      onClick: () => abrirObra(selectedObra.id, {
        pushHistory: false
      }),
      style: {
        background: C.amber
      },
      className: "text-white font-bold uppercase tracking-wide rounded px-4 py-2 text-sm"
    }, "Tentar de novo")) : /*#__PURE__*/React.createElement(ObraDetail, {
      obra: selectedObra,
      obraDetalhe: obraDetalhe,
      onBack: () => {
        recuarAteDashboard();
        voltarAoDashboard();
      },
      modulo: modulo,
      onAbrirModulo: abrirModulo,
      onChangeEstado: changeEstado,
      onDeleteObra: deleteObra,
      onTransferirObra: transferirObra,
      onAddEtapa: addEtapa,
      onToggleEtapa: toggleEtapa,
      onRemoveEtapa: removeEtapa,
      onEditEtapa: editEtapa,
      onAddFotoEtapa: addFotoEtapa,
      onDeleteFotoEtapa: deleteFotoEtapa,
      onAddFerramenta: ferramentasH.add,
      onDeleteFerramenta: ferramentasH.del,
      onAddMaterial: materiaisH.add,
      onDeleteMaterial: materiaisH.del,
      onAddObservacao: observacoesH.add,
      onDeleteObservacao: observacoesH.del,
      onEditObservacao: editarObservacao,
      onAddEquipo: addEquipo,
      onRemoveEquipo: removeEquipo,
      onToggleHoje: toggleHoje,
      onSetExcecao: setExcecao,
      usuarioRank: usuarioAPI.rank,
      usuarioAPI: usuarioAPI,
      niveis: meusNiveis,
      avisosSilenciados: (avisosDados?.silenciadas || []).includes(selectedObra?.id),
      onAlternarSilencio: () => alternarSilencio(selectedObra.id),
      onAddDoc: addDoc,
      onDeleteDoc: deleteDoc,
      fileCache: fileCache,
      loadFile: loadFile,
      saveArquivo: saveArquivo,
      onViewImage: setLightboxImg
    })), view === "pendientes" && /*#__PURE__*/React.createElement(PendientesView, {
      obras: obras,
      onBack: () => window.history.back(),
      onOpenObra: abrirObra
    }), view === "report" && /*#__PURE__*/React.createElement(ReportView, {
      obras: obras,
      onBack: () => window.history.back()
    }), view === "permissoes" && /*#__PURE__*/React.createElement(PermissoesScreen, {
      onBack: () => window.history.back(),
      usuarioRank: usuarioAPI.rank
    }), view === "leads" && /*#__PURE__*/React.createElement(LeadsScreen, {
      onBack: () => window.history.back()
    }), view === "ajuda" && /*#__PURE__*/React.createElement(AjudaScreen, {
      usuarioAPI: usuarioAPI,
      onVerApresentacao: () => setVendoApresentacao(true)
    }), showModal && /*#__PURE__*/React.createElement(NuevaObraModal, {
      onClose: () => setShowModal(false),
      onSave: criarObra,
      obras: obras,
      equipe: equipeParaEditar
    }), editandoObra && /*#__PURE__*/React.createElement(EditarObraModal, {
      obra: editandoObra,
      equipe: equipeParaEditar,
      onClose: () => setEditandoObra(null),
      onSave: salvarEdicaoObra
    }), lightboxImg && /*#__PURE__*/React.createElement(Lightbox, {
      src: lightboxImg,
      onClose: () => setLightboxImg(null)
    }));
    content = /*#__PURE__*/React.createElement(React.Fragment, null, content, /*#__PURE__*/React.createElement(BottomNav, {
      active: showAvisos ? "avisos" : view === "dashboard" ? "inicio" : view === "ajuda" ? "ajuda" : "",
      onAvisos: () => showAvisos ? setShowAvisos(false) : abrirAvisos(),
      naoLidos: avisosDados?.naoLidos || 0,
      onAjuda: () => {
        if (view !== "ajuda") irParaView("ajuda");
      },
      onInicio: () => {
        recuarAteDashboard();
        pilhaViewsRef.current = [];
        setView("dashboard");
        setSelectedId(null);
        setObraDetalhe(null);
      },
      onConfig: () => setShowConfig(true)
    }), showConfig && /*#__PURE__*/React.createElement(ConfigDrawer, {
      usuario: usuarioAPI,
      temaEscuro: temaEscuro,
      onAlternarTema: alternarTema,
      onSair: () => {
        setShowConfig(false);
        sair();
      },
      onExcluirConta: excluirMinhaConta,
      onAbrirMeuPin: () => {
        setShowConfig(false);
        setShowMeuPin(true);
      },
      onAbrirMeusDados: () => {
        setShowConfig(false);
        setShowMeusDados(true);
      },
      onClose: () => setShowConfig(false),
      onAbrirPermissoes: () => {
        setShowConfig(false);
        irParaView("permissoes");
      },
      onAbrirLeads: () => {
        setShowConfig(false);
        irParaView("leads");
      },
      onAbrirDefinirSenha: () => {
        setShowConfig(false);
        setShowDefinirSenha(true);
      },
      onAbrirAvisos: () => {
        setShowConfig(false);
        setShowAvisosConfig(true);
      },
      onBackupCelular: backupCelular,
      onBackupDrive: backupDrive,
      fazendoBackup: fazendoBackup
    }), showAvisos && /*#__PURE__*/React.createElement(AvisosPainel, {
      dados: avisosDados,
      onFechar: () => setShowAvisos(false),
      onConfigurar: () => {
        setShowAvisos(false);
        setShowAvisosConfig(true);
      },
      onAbrirAviso: a => {
        setShowAvisos(false);
        setShowConfig(false);
        if (a.obra_id && obras.some(o => o.id === a.obra_id)) abrirObra(a.obra_id, {
          moduloInicial: MODULO_DO_AVISO[a.categoria] || null
        });
      }
    }), showAvisosConfig && /*#__PURE__*/React.createElement(AvisosConfigModal, {
      usuario: usuarioAPI,
      prefs: avisosDados?.prefs,
      onClose: () => setShowAvisosConfig(false),
      onSalvo: prefs => {
        setAvisosDados(d => ({
          ...(d || {}),
          prefs
        }));
        carregarAvisos();
      }
    }), showDefinirSenha && /*#__PURE__*/React.createElement(DefinirSenhaModal, {
      usuario: usuarioAPI,
      onClose: () => {
        setShowDefinirSenha(false);
        carregarUsuarioAPI();
      }
    }), showMeusDados && /*#__PURE__*/React.createElement(MeusDadosModal, {
      onClose: () => setShowMeusDados(false)
    }), showMeuPin && /*#__PURE__*/React.createElement(MeuPinModal, {
      usuario: usuarioAPI,
      onClose: () => {
        setShowMeuPin(false);
        carregarUsuarioAPI();
      }
    }), !showMeuPin && usuarioAPI.pin_fraco && usuarioAPI.tem_pin && /*#__PURE__*/React.createElement(MeuPinModal, {
      usuario: usuarioAPI,
      forcado: true,
      onClose: () => {
        setUsuarioAPI(u => ({
          ...u,
          pin_fraco: false
        }));
        carregarUsuarioAPI();
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "fixed top-3 left-1/2 z-[100] flex flex-col gap-2 items-stretch px-4 w-full max-w-sm",
      style: {
        transform: "translateX(-50%)"
      }
    }, notificacoes.map(n => /*#__PURE__*/React.createElement("div", {
      key: n.id,
      style: {
        background: C.ink,
        color: "#fff"
      },
      className: "rounded-lg px-4 py-2.5 text-xs font-mono shadow-lg"
    }, "\uD83D\uDD14 ", n.texto))));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: temaVars
  }, /*#__PURE__*/React.createElement(BarraInstalar, null), content, sairAberto && /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[200]"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface
    },
    className: "rounded-lg p-6 w-full max-w-sm shadow-xl"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      color: C.ink
    },
    className: "text-lg font-extrabold mb-2"
  }, "Deseja sair do aplicativo?"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: C.inkMuted
    },
    className: "text-sm mb-4"
  }, sairFalhou ? "Toque em voltar mais uma vez para sair." : "Toque em voltar de novo para sair."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: ficarNoApp,
    style: {
      borderColor: C.border,
      color: C.ink
    },
    className: "flex-1 border font-bold uppercase tracking-wide text-sm rounded py-2.5"
  }, "N\xE3o"), /*#__PURE__*/React.createElement("button", {
    onClick: sairDoApp,
    style: {
      background: C.rust
    },
    className: "flex-1 text-white font-bold uppercase tracking-wide text-sm rounded py-2.5"
  }, "Sim")))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(GestorObras, null));
