// ========================================================
// SISTEMA DE METAS E PREMIAÇÃO — UNIFICADO
// ========================================================

// Variáveis globais
let turmasCache = {};
let fazendasCache = {};
let colabCache = {};
let metaAtualSemana = null;
let semanaAtualMeta = null;
let colabHistoricoAtual = null;

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ─────────────────────────────────────────────
// NAVEGAÇÃO
// ─────────────────────────────────────────────
function mostrarLogin() {
  document.querySelectorAll('.tela').forEach(t => { t.classList.remove('ativa'); t.style.display = 'none'; });
  document.getElementById('app').style.display = 'none';
  const tl = document.getElementById('tela-login');
  tl.style.display = 'flex'; tl.classList.add('ativa');
}

function mostrarCadastro() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-login').classList.remove('ativa');
  const tc = document.getElementById('tela-cadastro');
  tc.style.display = 'flex'; tc.classList.add('ativa');
}

function mostrarApp() {
  document.querySelectorAll('.tela').forEach(t => { t.classList.remove('ativa'); t.style.display = 'none'; });
  document.getElementById('app').style.display = 'block';
}

function irPara(pagina) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
  document.querySelectorAll('.menu-lateral li').forEach(l => l.classList.remove('ativo'));
  const pg = document.getElementById('pg-' + pagina);
  if (pg) pg.classList.add('ativa');
  document.querySelectorAll('.menu-lateral li').forEach(l => {
    if (l.getAttribute('onclick')?.includes(pagina)) l.classList.add('ativo');
  });
  fecharMenu();
  
  // Carregar dados da página
  if (pagina === 'dashboard')       carregarDashboard();
  if (pagina === 'fazendas')        carregarFazendas();
  if (pagina === 'turmas')          carregarTurmas();
  if (pagina === 'colaboradores')   carregarColaboradores();
  if (pagina === 'historico-colab') carregarPaginaHistorico();
  if (pagina === 'metas')           carregarPaginaMetas();
  if (pagina === 'sabados')         carregarPaginaSabados();
  if (pagina === 'premiacao')       carregarPaginaPremiacao();
  if (pagina === 'exportar')        carregarPaginaExportar();
  if (pagina === 'importar-totvs')  carregarPaginaImportarTotvs();
  if (pagina === 'solicitacoes')    carregarSolicitacoesPendentes();
  if (pagina === 'admin')           carregarAdmin();
}

function toggleMenu() { document.getElementById('menu-lateral').classList.toggle('fechado'); }
function fecharMenu()  { document.getElementById('menu-lateral').classList.add('fechado'); }

// ─────────────────────────────────────────────
// UTILITÁRIOS DE DATA
// ─────────────────────────────────────────────
function domingoSemana(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

function sabadoSemana(domStr) {
  const d = new Date(domStr + 'T12:00:00');
  d.setDate(d.getDate() + 6);
  return d.toISOString().split('T')[0];
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

function labelSemana(dom, sab) {
  return `Dom ${formatarData(dom)} – Sáb ${formatarData(sab)}`;
}

function padZeros(str, n) { return String(str).padStart(n, '0'); }

function gerarSemanas(dataIni, dataFim) {
  const semanas = [];
  let atual = domingoSemana(dataIni);
  const fim = new Date(dataFim + 'T12:00:00');
  while (true) {
    const sab = sabadoSemana(atual);
    if (new Date(atual + 'T12:00:00') > fim) break;
    semanas.push({ domingo: atual, sabado: sab, label: labelSemana(atual, sab) });
    const prox = new Date(atual + 'T12:00:00');
    prox.setDate(prox.getDate() + 7);
    atual = prox.toISOString().split('T')[0];
    if (semanas.length > 60) break;
  }
  return semanas;
}

function subtrairUmDia(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function formatarDataHora(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// Modal
function abrirModal(titulo, corpo, callbackSalvar) {
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-corpo').innerHTML = corpo;
  document.getElementById('modal-btn-ok').onclick = callbackSalvar;
  document.getElementById('modal').style.display = 'flex';
}
function fecharModal() { document.getElementById('modal').style.display = 'none'; }

// ─────────────────────────────────────────────
// AUTENTICAÇÃO
// ─────────────────────────────────────────────
async function fazerLogin() {
  const chapa = document.getElementById('login-chapa').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erro  = document.getElementById('login-erro');
  erro.textContent = '';
  if (!chapa || !senha) { erro.textContent = 'Preencha chapa e senha.'; return; }
  try {
    const q = window.fbFuncs.query(
      window.fbFuncs.collection(window.db, 'usuarios'),
      window.fbFuncs.where('chapa', '==', chapa)
    );
    const snap = await window.fbFuncs.getDocs(q);
    if (snap.empty) { erro.textContent = 'Chapa não encontrada.'; return; }
    await window.fbFuncs.signInWithEmailAndPassword(window.auth, snap.docs[0].data().email, senha);
  } catch(e) { erro.textContent = 'Chapa ou senha incorretos.'; }
}

async function cadastrarUsuario() {
  const chapa  = document.getElementById('cad-chapa').value.trim();
  const nome   = document.getElementById('cad-nome').value.trim();
  const email  = document.getElementById('cad-email').value.trim();
  const senha  = document.getElementById('cad-senha').value;
  const senha2 = document.getElementById('cad-senha2').value;
  const erro   = document.getElementById('cad-erro');
  const ok     = document.getElementById('cad-ok');
  erro.textContent = ''; ok.textContent = '';
  if (!chapa||!nome||!email||!senha) { erro.textContent='Preencha todos os campos.'; return; }
  if (senha !== senha2)              { erro.textContent='As senhas não coincidem.'; return; }
  if (senha.length < 6)              { erro.textContent='Mínimo 6 caracteres.'; return; }
  try {
    const cred = await window.fbFuncs.createUserWithEmailAndPassword(window.auth, email, senha);
    await window.fbFuncs.setDoc(window.fbFuncs.doc(window.db,'usuarios',cred.user.uid),
      { chapa, nome, email, perfil:'pendente', aprovado:false, criadoEm:new Date().toISOString() });
    await window.fbFuncs.signOut(window.auth);
    ok.textContent = '✅ Solicitação enviada! Aguarde aprovação.';
    setTimeout(() => mostrarLogin(), 3000);
  } catch(e) {
    erro.textContent = e.code === 'auth/email-already-in-use'
      ? 'E-mail já cadastrado.' : 'Erro: ' + e.message;
  }
}

async function sair() { await window.fbFuncs.signOut(window.auth); }

// ─────────────────────────────────────────────
// CARREGAR CACHES
// ─────────────────────────────────────────────
async function carregarFazendasSelects() {
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'));
  fazendasCache = {};
  snap.forEach(d => fazendasCache[d.id] = { id: d.id, ...d.data() });

  ['filtro-fazenda-turma','filtro-fazenda-colab','exp-fazenda',
   'premio-fazenda','meta-fazenda','meta-hist-fazenda'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = el.value;
    el.innerHTML = '<option value="">Todas as fazendas</option>';
    Object.values(fazendasCache).sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(f => {
      el.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
    });
    el.value = v;
  });

  const selMeta = document.getElementById('meta-fazenda');
  if (selMeta && selMeta.innerHTML === '<option value="">Todas as fazendas</option>') {
    selMeta.innerHTML = '<option value="">Selecione a fazenda</option>';
    Object.values(fazendasCache).sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(f => {
      selMeta.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
    });
  }
}

async function carregarTurmasCache() {
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas'));
  turmasCache = {};
  snap.forEach(d => turmasCache[d.id] = { id: d.id, ...d.data() });
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
async function carregarDashboard() {
  try {
    const [snapTurmas, snapColab, snapMetas, snapPres] = await Promise.all([
      window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')),
      window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
      window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas')),
      window.fbFuncs.getDocs(window.fbFuncs.query(
        window.fbFuncs.collection(window.db,'presencas'),
        window.fbFuncs.where('presente','==',true)))
    ]);

    // Buscar resultados diários
    const snapRes = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'resultadosDiarios'));
    const resultMap = {};
    snapRes.forEach(d => {
      const r = d.data();
      const key = `${r.turmaId}_${r.semanaDomingo}`;
      if (!resultMap[key]) resultMap[key] = 0;
      resultMap[key] += parseFloat(r.resultado || 0);
    });

    const metas = []; snapMetas.forEach(d => metas.push(d.data()));
    const metasAvaliadas = metas.map(m => ({
      ...m,
      somaResultados: resultMap[m.semanaId] || 0
    })).filter(m => m.somaResultados > 0);

    const atingidas = metasAvaliadas.filter(m => m.somaResultados >= m.meta);
    const pct = metasAvaliadas.length > 0 ? Math.round(atingidas.length/metasAvaliadas.length*100) : 0;

    document.getElementById('dash-total-turmas').textContent   = snapTurmas.size;
    document.getElementById('dash-metas-atingidas').textContent = pct + '%';
    document.getElementById('dash-total-colab').textContent    = snapColab.size;
    document.getElementById('dash-premios').textContent        = snapPres.size;

    // Ranking
    const turmaMap = {};
    snapTurmas.forEach(d => turmaMap[d.id] = d.data().nome);
    const ranking = document.getElementById('ranking-turmas');
    if (metasAvaliadas.length === 0) { 
      ranking.innerHTML = '<p style="color:#888">Nenhuma meta com resultados lançados.</p>'; 
      return; 
    }

    const ord = [...metasAvaliadas].sort((a,b) => 
      (b.somaResultados/b.meta) - (a.somaResultados/a.meta)
    );

    ranking.innerHTML = ord.slice(0,10).map((m,i) => {
      const p = Math.round(m.somaResultados/m.meta*100);
      const ganhou = p >= 100;
      const larg = Math.min(p,100);
      return `<div class="ranking-item">
        <div class="ranking-pos">${i+1}º</div>
        <div class="ranking-info">
          <strong>${turmaMap[m.turmaId]||'Turma'}</strong>
          <span>${labelSemana(m.semanaDomingo, m.semanaSabado)} — Meta: ${m.meta} | Resultado: ${m.somaResultados.toFixed(0)}</span>
          <div class="barra-progresso"><div class="barra-fill ${ganhou?'':'perdeu'}" style="width:${larg}%"></div></div>
        </div>
        <div class="ranking-pct ${ganhou?'ganhou':'perdeu'}">${p}%</div>
      </div>`;
    }).join('');
  } catch(e) { console.error(e); }
}

// ─────────────────────────────────────────────
// FAZENDAS
// ─────────────────────────────────────────────
async function carregarFazendas() {
  const lista = document.getElementById('lista-fazendas');
  lista.innerHTML = 'Carregando...';
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'));
  if (snap.empty) { lista.innerHTML = '<p style="color:#888">Nenhuma fazenda cadastrada.</p>'; return; }
  lista.innerHTML = '';
  snap.forEach(d => {
    const f = d.data();
    lista.innerHTML += `<div class="item-card">
      <div class="item-card-info"><strong>${f.nome}</strong><span>${f.endereco||''}</span></div>
      <button class="btn-primary btn-sm" onclick="editarFazenda('${d.id}')">✏️</button>
    </div>`;
  });
}

function abrirModalFazenda(id, d) {
  abrirModal(id?'Editar Fazenda':'Nova Fazenda',`
    <div class="form-group"><label>Nome</label><input id="m-faz-nome" value="${d?.nome||''}"/></div>
    <div class="form-group"><label>Endereço</label><input id="m-faz-end" value="${d?.endereco||''}"/></div>`,
    () => salvarFazenda(id));
}

async function salvarFazenda(id) {
  const nome = document.getElementById('m-faz-nome').value.trim();
  if (!nome) { alert('Informe o nome.'); return; }
  const dados = { nome, endereco: document.getElementById('m-faz-end').value.trim(), atualizadoEm: new Date().toISOString() };
  if (id) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'fazendas',id), dados);
  else await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'fazendas'), { ...dados, criadoEm: new Date().toISOString() });
  fecharModal(); carregarFazendas(); carregarFazendasSelects();
}

async function editarFazenda(id) {
  const s = await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'fazendas',id));
  abrirModalFazenda(id, s.data());
}

// ─────────────────────────────────────────────
// TURMAS
// ─────────────────────────────────────────────
async function carregarTurmas() {
  const lista = document.getElementById('lista-turmas');
  lista.innerHTML = 'Carregando...';
  const filtroFaz = document.getElementById('filtro-fazenda-turma')?.value || '';
  const q = filtroFaz
    ? window.fbFuncs.query(window.fbFuncs.collection(window.db,'turmas'), window.fbFuncs.where('fazendaId','==',filtroFaz))
    : window.fbFuncs.collection(window.db,'turmas');
  const [snapT, snapF] = await Promise.all([
    window.fbFuncs.getDocs(q), 
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))
  ]);
  const fazMap = {}; snapF.forEach(d => fazMap[d.id] = d.data().nome);
  if (snapT.empty) { lista.innerHTML = '<p style="color:#888">Nenhuma turma.</p>'; return; }
  lista.innerHTML = '';
  snapT.forEach(d => {
    const t = d.data();
    lista.innerHTML += `<div class="item-card">
      <div class="item-card-info"><strong>${t.nome}</strong><span>🌿 ${fazMap[t.fazendaId]||'—'} | 👤 ${t.liderNome||'—'}</span></div>
      <button class="btn-primary btn-sm" onclick="editarTurma('${d.id}')">✏️</button>
    </div>`;
  });
}

function abrirModalTurma(id, d) {
  let ops = '<option value="">Selecione</option>';
  const selF = document.getElementById('filtro-fazenda-turma');
  if (selF) Array.from(selF.options).forEach(o => { 
    if (o.value) ops += `<option value="${o.value}" ${d?.fazendaId===o.value?'selected':''}>${o.text}</option>`; 
  });
  abrirModal(id?'Editar Turma':'Nova Turma',`
    <div class="form-group"><label>Nome</label><input id="m-tur-nome" value="${d?.nome||''}"/></div>
    <div class="form-group"><label>Fazenda</label><select id="m-tur-faz">${ops}</select></div>
    <div class="form-group"><label>Líder</label><input id="m-tur-lider" value="${d?.liderNome||''}"/></div>`,
    () => salvarTurma(id));
}

async function salvarTurma(id) {
  const nome = document.getElementById('m-tur-nome').value.trim();
  const fazendaId = document.getElementById('m-tur-faz').value;
  if (!nome||!fazendaId) { alert('Informe nome e fazenda.'); return; }
  const dados = { nome, fazendaId, liderNome: document.getElementById('m-tur-lider').value.trim(), atualizadoEm: new Date().toISOString() };
  if (id) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'turmas',id), dados);
  else await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'turmas'), { ...dados, criadoEm: new Date().toISOString() });
  fecharModal(); carregarTurmas(); carregarTurmasCache();
}

async function editarTurma(id) {
  const s = await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'turmas',id));
  abrirModalTurma(id, s.data());
}

// ─────────────────────────────────────────────
// COLABORADORES
// ─────────────────────────────────────────────
async function carregarColaboradores() {
  const lista = document.getElementById('lista-colaboradores');
  lista.innerHTML = 'Carregando...';
  const filtroFaz   = document.getElementById('filtro-fazenda-colab')?.value||'';
  const filtroTurma = document.getElementById('filtro-turma-colab')?.value||'';
  const filtroNome  = document.getElementById('filtro-nome-colab')?.value?.toLowerCase()||'';
  
  const [snapC, snapT, snapF] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))
  ]);
  
  const turmaMap={}; snapT.forEach(d=>turmaMap[d.id]=d.data());
  const fazMap={}; snapF.forEach(d=>fazMap[d.id]=d.data().nome);
  let colab=[]; snapC.forEach(d=>colab.push({id:d.id,...d.data()}));
  
  if (filtroFaz)   colab = colab.filter(c => turmaMap[c.turmaId]?.fazendaId===filtroFaz);
  if (filtroTurma) colab = colab.filter(c => c.turmaId===filtroTurma);
  if (filtroNome)  colab = colab.filter(c => c.nome?.toLowerCase().includes(filtroNome)||c.chapa?.toLowerCase().includes(filtroNome));
  
  if (colab.length===0) { lista.innerHTML='<p style="color:#888">Nenhum colaborador encontrado.</p>'; return; }
  lista.innerHTML = '';
  colab.forEach(c => {
    const t=turmaMap[c.turmaId];
    const badge = c.demitido
      ? '<span class="badge badge-vermelho">Demitido</span>'
      : '<span class="badge badge-verde">Ativo</span>';
    lista.innerHTML += `<div class="item-card">
      <div class="item-card-info">
        <strong>${c.nome} <small style="color:#999">#${c.chapa}</small></strong>
        <span>🏘️ ${t?.nome||'—'} | 🌿 ${t?fazMap[t.fazendaId]||'—':'—'} | ${c.funcao||''}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">${badge}
        <button class="btn-primary btn-sm" onclick="editarColaborador('${c.id}')">✏️</button>
      </div>
    </div>`;
  });
}

function abrirModalColaborador(id, d) {
  let opsTurmas = '<option value="">Selecione</option>';
  window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')).then(snap => {
    snap.forEach(t => opsTurmas += `<option value="${t.id}" ${d?.turmaId===t.id?'selected':''}>${t.data().nome}</option>`);
    const sel = document.getElementById('m-col-turma');
    if (sel) sel.innerHTML = opsTurmas;
  });
  abrirModal(id?'Editar Colaborador':'Novo Colaborador',`
    <div class="form-group"><label>Chapa</label><input id="m-col-chapa" value="${d?.chapa||''}"/></div>
    <div class="form-group"><label>Nome</label><input id="m-col-nome" value="${d?.nome||''}"/></div>
    <div class="form-group"><label>Função</label><input id="m-col-funcao" value="${d?.funcao||''}"/></div>
    <div class="form-group"><label>Turma</label><select id="m-col-turma">${opsTurmas}</select></div>
    <div class="form-group"><label>Data Admissão</label><input type="date" id="m-col-adm" value="${d?.admissao||''}"/></div>
    <div class="form-group"><label>Hora Início</label><input type="time" id="m-col-hi" value="${d?.inicioJornada||'08:00'}"/></div>
    <div class="form-group"><label>Hora Fim</label><input type="time" id="m-col-hf" value="${d?.fimJornada||'17:00'}"/></div>`,
    () => salvarColaborador(id));
}

async function salvarColaborador(id) {
  const chapa  = document.getElementById('m-col-chapa').value.trim();
  const nome   = document.getElementById('m-col-nome').value.trim();
  if (!chapa||!nome) { alert('Chapa e nome obrigatórios.'); return; }
  const dados = { 
    chapa, nome,
    funcao:       document.getElementById('m-col-funcao').value.trim(),
    turmaId:      document.getElementById('m-col-turma').value,
    admissao:     document.getElementById('m-col-adm').value,
    inicioJornada:document.getElementById('m-col-hi').value,
    fimJornada:   document.getElementById('m-col-hf').value,
    atualizadoEm: new Date().toISOString()
  };
  if (id) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'colaboradores',id), dados);
  else await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'colaboradores'), { ...dados, demitido:false, criadoEm:new Date().toISOString() });
  fecharModal(); carregarColaboradores();
}

async function editarColaborador(id) {
  const s = await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'colaboradores',id));
  abrirModalColaborador(id, s.data());
}

// ══════════════════════════════════════════════
// HISTÓRICO DO COLABORADOR
// ══════════════════════════════════════════════
async function carregarPaginaHistorico() {
  await carregarTurmasCache();
  // Preencher select de turmas destino
  const sel = document.getElementById('hist-turma-destino');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione</option>';
    Object.values(turmasCache).sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(t => {
      sel.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
    });
  }
}

async function buscarColabHistorico() {
  const termo = document.getElementById('busca-hist-colab').value.trim().toLowerCase();
  const div   = document.getElementById('resultado-busca-hist');
  if (termo.length < 2) { div.innerHTML = ''; return; }

  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores'));
  const resultados = [];
  snap.forEach(d => {
    const c = d.data();
    if (c.nome?.toLowerCase().includes(termo) || c.chapa?.toLowerCase().includes(termo)) {
      resultados.push({ id: d.id, ...c });
    }
  });

  if (resultados.length === 0) {
    div.innerHTML = '<p style="color:#888">Nenhum colaborador encontrado.</p>'; return;
  }

  div.innerHTML = resultados.slice(0,8).map(c => {
    const t = turmasCache[c.turmaId];
    return `<div class="item-card" style="cursor:pointer" onclick="abrirHistoricoColab('${c.id}')">
      <div class="item-card-info">
        <strong>${c.nome} <small style="color:#999">#${c.chapa}</small></strong>
        <span>🏘️ ${t?.nome||'Sem turma'} | ${c.funcao||''}</span>
      </div>
      <span style="color:#2e8b57;font-size:20px">›</span>
    </div>`;
  }).join('');
}

async function abrirHistoricoColab(colabId) {
  document.getElementById('resultado-busca-hist').innerHTML = '';
  document.getElementById('busca-hist-colab').value = '';
  document.getElementById('painel-hist-colab').style.display = 'block';

  const snap = await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'colaboradores',colabId));
  if (!snap.exists()) { alert('Colaborador não encontrado.'); return; }
  colabHistoricoAtual = { id: colabId, ...snap.data() };

  // Header
  const iniciais = colabHistoricoAtual.nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
  document.getElementById('hist-avatar').textContent = iniciais;
  document.getElementById('hist-nome').textContent = colabHistoricoAtual.nome;
  document.getElementById('hist-detalhes').innerHTML =
    `Chapa: <strong>${colabHistoricoAtual.chapa}</strong> | Função: <strong>${colabHistoricoAtual.funcao||'—'}</strong> | ` +
    `Admissão: <strong>${formatarData(colabHistoricoAtual.admissao)||'—'}</strong>` +
    (colabHistoricoAtual.demissao ? ` | Demissão: <strong style="color:#e53e3e">${formatarData(colabHistoricoAtual.demissao)}</strong>` : '');

  document.getElementById('hist-status-badge').innerHTML = colabHistoricoAtual.demitido
    ? '<span class="badge badge-vermelho">Demitido</span>'
    : '<span class="badge badge-verde">Ativo</span>';

  // Situação atual
  const turmaAtual = turmasCache[colabHistoricoAtual.turmaId];
  document.getElementById('hist-situacao-atual').innerHTML = turmaAtual
    ? `<div class="item-card">
        <div class="item-card-info">
          <strong>🏘️ ${turmaAtual.nome}</strong>
          <span>Líder: ${turmaAtual.liderNome||'—'}</span>
        </div>
        <span class="badge badge-verde">Turma Atual</span>
       </div>`
    : '<p style="color:#888">Sem turma vinculada.</p>';

  // Timeline
  await carregarTimelineHistorico(colabId);

  // Solicitações
  await carregarSolicitacoesColab(colabId);

  // Mostrar botão solicitar
  const podeSolicitar = ['admin','gestao','encarregado','administrativo','lider'].includes(window.usuarioLogado.perfil);
  document.getElementById('hist-painel-solicitar').style.display = podeSolicitar && !colabHistoricoAtual.demitido ? 'block' : 'none';

  document.getElementById('painel-hist-colab').scrollIntoView({ behavior: 'smooth' });
}

async function carregarTimelineHistorico(colabId) {
  const timeline = document.getElementById('hist-timeline');
  const q = window.fbFuncs.query(
    window.fbFuncs.collection(window.db, 'historicoTurmas'),
    window.fbFuncs.where('colaboradorId', '==', colabId)
  );
  const snap = await window.fbFuncs.getDocs(q);
  if (snap.empty) {
    timeline.innerHTML = '<p style="color:#888">Nenhum histórico registrado.</p>'; return;
  }

  const historico = [];
  snap.forEach(d => historico.push({ id: d.id, ...d.data() }));
  historico.sort((a,b) => (b.dataInicio||'').localeCompare(a.dataInicio||''));

  timeline.innerHTML = historico.map((h, i) => {
    const ativo  = h.ativo;
    const dotCls = ativo ? '' : 'antigo';
    const turma  = turmasCache[h.turmaIdNova] || { nome: h.turmaNomeNova || '—' };
    const periodo = h.dataFim
      ? `${formatarData(h.dataInicio)} até ${formatarData(h.dataFim)}`
      : `${formatarData(h.dataInicio)} — <strong style="color:#2e8b57">até hoje</strong>`;
    const badge = ativo
      ? '<span class="badge badge-verde">Turma atual</span>'
      : '<span class="badge" style="background:#eee;color:#666">Histórico</span>';

    return `<div class="timeline-item">
      <div class="timeline-dot ${dotCls}"></div>
      <div class="timeline-card">
        <div class="data">${periodo}</div>
        <div class="titulo">🏘️ ${turma.nome}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="font-size:13px;color:#666">Líder: ${turma.liderNome||'—'}</span>
          ${badge}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function enviarSolicitacaoTransf() {
  const turmaDestinoId = document.getElementById('hist-turma-destino').value;
  const dataTransf     = document.getElementById('hist-data-transf').value;
  const motivo         = document.getElementById('hist-motivo').value.trim();
  const msg            = document.getElementById('hist-msg-solicit');
  msg.textContent      = '';

  if (!turmaDestinoId) { msg.textContent = '⚠️ Selecione a turma de destino.'; msg.style.color='#e53e3e'; return; }
  if (!dataTransf)     { msg.textContent = '⚠️ Informe a data de início.';     msg.style.color='#e53e3e'; return; }
  if (turmaDestinoId === colabHistoricoAtual.turmaId) {
    msg.textContent = '⚠️ A turma de destino é a mesma turma atual.'; msg.style.color='#e53e3e'; return;
  }

  const turmaDestino = turmasCache[turmaDestinoId];
  const turmaOrigem  = turmasCache[colabHistoricoAtual.turmaId];

  await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db, 'solicitacoesTransferencia'), {
    colaboradorId:    colabHistoricoAtual.id,
    colaboradorNome:  colabHistoricoAtual.nome,
    colaboradorChapa: colabHistoricoAtual.chapa,
    turmaOrigemId:    colabHistoricoAtual.turmaId || '',
    turmaOrigemNome:  turmaOrigem?.nome || '—',
    turmaDestinoId,
    turmaDestinoNome: turmaDestino?.nome || '—',
    dataInicio:       dataTransf,
    motivo,
    status:           'pendente',
    solicitadoPor:    window.usuarioLogado.uid,
    solicitadoPorNome:window.usuarioLogado.nome,
    solicitadoEm:     new Date().toISOString()
  });

  msg.textContent = '✅ Solicitação enviada!';
  msg.style.color = '#2e8b57';
  document.getElementById('hist-turma-destino').value = '';
  document.getElementById('hist-data-transf').value  = '';
  document.getElementById('hist-motivo').value= '';

  await carregarSolicitacoesColab(colabHistoricoAtual.id);
}

async function carregarSolicitacoesColab(colabId) {
  const q = window.fbFuncs.query(
    window.fbFuncs.collection(window.db, 'solicitacoesTransferencia'),
    window.fbFuncs.where('colaboradorId', '==', colabId)
  );
  const snap = await window.fbFuncs.getDocs(q);
  const lista = document.getElementById('hist-lista-solicit');

  if (snap.empty) { lista.innerHTML = '<p style="color:#888">Nenhuma solicitação.</p>'; return; }

  const items = [];
  snap.forEach(d => items.push({ id: d.id, ...d.data() }));
  items.sort((a,b) => b.solicitadoEm.localeCompare(a.solicitadoEm));

  lista.innerHTML = items.map(s => {
    const cls   = s.status === 'aprovada' ? 'aprovada' : s.status === 'recusada' ? 'recusada' : '';
    const badge = s.status === 'aprovada'
      ? '<span class="badge badge-verde">✅ Aprovada</span>'
      : s.status === 'recusada'
      ? '<span class="badge badge-vermelho">❌ Recusada</span>'
      : '<span class="badge badge-amarelo">⏳ Pendente</span>';
    return `<div class="req-card ${cls}">
      <strong>${s.turmaOrigemNome} → ${s.turmaDestinoNome}</strong>
      <span style="font-size:13px;color:#666;display:block;margin-top:4px">📅 Início em: ${formatarData(s.dataInicio)} | Solicitado por: ${s.solicitadoPorNome}</span>
      <span style="font-size:13px;color:#666;display:block">📝 ${s.motivo||'Sem observação'}</span>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        ${badge}
        ${s.observacaoGestao ? `<span style="font-size:12px;color:#555">Gestão: ${s.observacaoGestao}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// SOLICITAÇÕES PENDENTES (Gestão/Admin)
async function carregarSolicitacoesPendentes() {
  const q = window.fbFuncs.query(
    window.fbFuncs.collection(window.db, 'solicitacoesTransferencia'),
    window.fbFuncs.where('status', '==', 'pendente')
  );
  const snap = await window.fbFuncs.getDocs(q);
  const lista = document.getElementById('lista-solicit-pendentes');

  if (snap.empty) { lista.innerHTML = '<p style="color:#888">Nenhuma solicitação pendente. ✅</p>'; return; }

  const items = [];
  snap.forEach(d => items.push({ id: d.id, ...d.data() }));

  lista.innerHTML = items.map(s => `
    <div class="req-card">
      <strong>👤 ${s.colaboradorNome} <small style="color:#999">#${s.colaboradorChapa}</small></strong>
      <span style="font-size:13px;color:#666;display:block;margin-top:4px">🏘️ ${s.turmaOrigemNome} → ${s.turmaDestinoNome}</span>
      <span style="font-size:13px;color:#666;display:block">📅 Data de início solicitada: <strong>${formatarData(s.dataInicio)}</strong></span>
      <span style="font-size:13px;color:#666;display:block">📝 ${s.motivo||'Sem observação'}</span>
      <span style="font-size:12px;color:#888;display:block;margin-top:4px">Solicitado por: ${s.solicitadoPorNome} em ${formatarDataHora(s.solicitadoEm)}</span>
      <div class="form-group" style="margin-top:10px">
        <label style="font-size:12px">Observação (opcional)</label>
        <input type="text" id="obs-${s.id}" placeholder="Ex: Aprovado" style="padding:7px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:100%"/>
      </div>
      <div class="form-group">
        <label style="font-size:12px">Confirmar data</label>
        <input type="date" id="dt-${s.id}" value="${s.dataInicio}" style="padding:7px;border:1px solid #ddd;border-radius:6px;font-size:13px"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn-primary btn-sm" onclick="aprovarTransf('${s.id}','${s.colaboradorId}','${s.turmaOrigemId}','${s.turmaDestinoId}','${s.turmaDestinoNome}')">✅ Aprovar</button>
        <button class="btn-secondary btn-sm" onclick="recusarTransf('${s.id}')">❌ Recusar</button>
      </div>
    </div>`).join('');
}

async function aprovarTransf(solId, colabId, turmaOrigemId, turmaDestinoId, turmaDestinoNome) {
  const dataInicio = document.getElementById('dt-' + solId)?.value;
  const obs        = document.getElementById('obs-' + solId)?.value?.trim() || '';
  if (!dataInicio) { alert('Informe a data.'); return; }
  const dataFim = subtrairUmDia(dataInicio);

  // Encerrar histórico anterior
  const qH = window.fbFuncs.query(
    window.fbFuncs.collection(window.db, 'historicoTurmas'),
    window.fbFuncs.where('colaboradorId', '==', colabId),
    window.fbFuncs.where('ativo', '==', true)
  );
  const snapH = await window.fbFuncs.getDocs(qH);
  for (const d of snapH.docs) {
    await window.fbFuncs.updateDoc(
      window.fbFuncs.doc(window.db, 'historicoTurmas', d.id),
      { dataFim, ativo: false }
    );
  }

  // Criar novo histórico
  await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db, 'historicoTurmas'), {
    colaboradorId,
    turmaIdAntiga: turmaOrigemId || null,
    turmaIdNova:   turmaDestinoId,
    turmaNomeNova: turmaDestinoNome,
    dataInicio,
    dataFim:       null,
    ativo:         true,
    criadoEm:      new Date().toISOString()
  });

  // Atualizar colaborador
  await window.fbFuncs.updateDoc(
    window.fbFuncs.doc(window.db, 'colaboradores', colabId),
    { turmaId: turmaDestinoId, turmaNome: turmaDestinoNome, atualizadoEm: new Date().toISOString() }
  );

  // Marcar aprovada
  await window.fbFuncs.updateDoc(
    window.fbFuncs.doc(window.db, 'solicitacoesTransferencia', solId),
    { status: 'aprovada', observacaoGestao: obs, aprovadoPor: window.usuarioLogado.uid, aprovadoEm: new Date().toISOString() }
  );

  alert('✅ Transferência aprovada!');
  await carregarTurmasCache();
  await carregarSolicitacoesPendentes();
}

async function recusarTransf(solId) {
  const obs = document.getElementById('obs-' + solId)?.value?.trim() || '';
  await window.fbFuncs.updateDoc(
    window.fbFuncs.doc(window.db, 'solicitacoesTransferencia', solId),
    { status: 'recusada', observacaoGestao: obs, recusadoPor: window.usuarioLogado.uid, recusadoEm: new Date().toISOString() }
  );
  alert('❌ Solicitação recusada.');
  await carregarSolicitacoesPendentes();
}

// ══════════════════════════════════════════════
// METAS E RESULTADOS DIÁRIOS
// ══════════════════════════════════════════════
async function carregarPaginaMetas() {
  await carregarFazendasSelects();
  await carregarTurmasCache();
  preencherSemanasMeta();
}

function trocarAbaMetas(aba) {
  document.querySelectorAll('.aba-interna').forEach(b => b.classList.remove('ativa'));
  document.querySelectorAll('.painel-aba').forEach(p => p.classList.remove('ativo'));
  document.getElementById('aba-meta-' + aba).classList.add('ativo');
  document.querySelectorAll('.aba-interna').forEach(b => {
    if (b.getAttribute('onclick')?.includes(aba)) b.classList.add('ativa');
  });
  if (aba === 'historico') carregarHistoricoMetas();
}

function preencherSemanasMeta() {
  const hoje = new Date();
  const inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 84);
  const fim = new Date(hoje); fim.setDate(hoje.getDate() + 28);
  const semanas = gerarSemanas(inicio.toISOString().split('T')[0], fim.toISOString().split('T')[0]);
  
  const sel = document.getElementById('meta-semana');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione a semana</option>';
    semanas.reverse().forEach(s => {
      sel.innerHTML += `<option value="${s.domingo}|${s.sabado}">${s.label}</option>`;
    });
  }
}

async function carregarTurmasMeta() {
  const fazId = document.getElementById('meta-fazenda').value;
  const sel = document.getElementById('meta-turma');
  sel.innerHTML = '<option value="">Selecione a turma</option>';
  if (!fazId) return;
  
  Object.values(turmasCache)
    .filter(t => t.fazendaId === fazId)
    .sort((a,b) => a.nome.localeCompare(b.nome))
    .forEach(t => sel.innerHTML += `<option value="${t.id}">${t.nome}</option>`);
}

function carregarSemanasMeta() {
  document.getElementById('painel-meta-semana').style.display = 
    document.getElementById('meta-turma').value ? 'block' : 'none';
  if (document.getElementById('meta-turma').value) carregarDadosMetaSemana();
}

async function carregarDadosMetaSemana() {
  const turmaId = document.getElementById('meta-turma').value;
  const semanaV = document.getElementById('meta-semana').value;
  if (!turmaId || !semanaV) return;

  const [dom, sab] = semanaV.split('|');
  semanaAtualMeta = { domingo: dom, sabado: sab };

  // Buscar meta
  const qM = window.fbFuncs.query(
    window.fbFuncs.collection(window.db, 'metas'),
    window.fbFuncs.where('semanaId', '==', `${turmaId}_${dom}`)
  );
  const snapM = await window.fbFuncs.getDocs(qM);
  metaAtualSemana = snapM.empty ? null : { id: snapM.docs[0].id, ...snapM.docs[0].data() };

  document.getElementById('meta-valor-semana').value = metaAtualSemana?.meta || '';
  document.getElementById('btn-excluir-meta-sem').style.display = metaAtualSemana ? 'inline-block' : 'none';
  document.getElementById('meta-msg-sem').textContent = '';

  await montarDiasSemana(turmaId, dom, sab);
  atualizarSomatorioMeta();
}

async function montarDiasSemana(turmaId, dom, sab) {
  // Buscar resultados
  const qR = window.fbFuncs.query(
    window.fbFuncs.collection(window.db, 'resultadosDiarios'),
    window.fbFuncs.where('turmaId', '==', turmaId),
    window.fbFuncs.where('semanaDomingo', '==', dom)
  );
  const snapR = await window.fbFuncs.getDocs(qR);
  const resultMap = {};
  snapR.forEach(d => resultMap[d.data().data] = { id: d.id, ...d.data() });

  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(dom + 'T12:00:00');
    d.setDate(d.getDate() + i);
    dias.push(d.toISOString().split('T')[0]);
  }

  const grid = document.getElementById('meta-dias-grid');
  grid.innerHTML = '<div class="dias-grid">' + dias.map((data, i) => {
    const res = resultMap[data];
    const val = res?.resultado ?? '';
    const isSab = i === 6;
    return `<div class="dia-card ${isSab?'sabado':''}" id="dcard-${data}">
      <div class="dia-data">${DIAS_SEMANA[i]} ${formatarData(data)}</div>
      <input type="number" id="res-${data}" value="${val}" placeholder="—"
             oninput="atualizarSomatorioMeta()"
             style="color:${val?'#2e8b57':'#bbb'}"/>
      ${res ? `<button class="btn-secondary btn-sm" style="color:#e53e3e;padding:4px 8px;font-size:12px;margin-top:4px" 
                       onclick="excluirResultadoDia('${res.id}','${data}')">🗑️</button>` : ''}
    </div>`;
  }).join('') + '</div>';
}

function atualizarSomatorioMeta() {
  if (!semanaAtualMeta) return;
  const dom = semanaAtualMeta.domingo;
  let soma = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(dom + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const data = d.toISOString().split('T')[0];
    const val = parseFloat(document.getElementById('res-' + data)?.value || 0);
    soma += isNaN(val) ? 0 : val;
  }
  
  const meta = parseFloat(document.getElementById('meta-valor-semana')?.value || 0);
  document.getElementById('meta-soma-res').textContent = soma.toFixed(0);
  document.getElementById('meta-meta-ref').textContent = meta || '—';

  const pct = meta > 0 ? Math.min(Math.round(soma/meta*100), 100) : 0;
  const ganhou = meta > 0 && soma >= meta;
  const barra = document.getElementById('meta-barra-prog');
  barra.style.width = pct + '%';
  barra.className = 'progresso-fill ' + (meta === 0 ? '' : ganhou ? 'ok' : 'no');

  const badge = document.getElementById('meta-status-badge');
  if (!meta) { badge.innerHTML = ''; return; }
  badge.innerHTML = ganhou
    ? '<span class="badge badge-verde">✅ Atingiu!</span>'
    : soma > 0
    ? `<span class="badge badge-amarelo">⏳ ${pct}%</span>`
    : '<span class="badge badge-vermelho">❌ Sem resultados</span>';
}

async function salvarMetaSemana() {
  const turmaId = document.getElementById('meta-turma').value;
  const semanaV = document.getElementById('meta-semana').value;
  const metaVal = document.getElementById('meta-valor-semana').value;
  const msg = document.getElementById('meta-msg-sem');
  if (!turmaId||!semanaV||!metaVal) { msg.textContent='⚠️ Preencha todos os campos.'; msg.style.color='#e53e3e'; return; }
  
  const [dom, sab] = semanaV.split('|');
  const dados = {
    turmaId, semanaId: `${turmaId}_${dom}`,
    semanaDomingo: dom, semanaSabado: sab,
    meta: parseFloat(metaVal),
    lancadoPor: window.usuarioLogado.uid,
    atualizadoEm: new Date().toISOString()
  };
  
  if (metaAtualSemana) {
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'metas',metaAtualSemana.id), dados);
    msg.textContent = '✅ Meta atualizada!';
  } else {
    dados.criadoEm = new Date().toISOString();
    const ref = await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'metas'), dados);
    metaAtualSemana = { id: ref.id, ...dados };
    document.getElementById('btn-excluir-meta-sem').style.display = 'inline-block';
    msg.textContent = '✅ Meta salva!';
  }
  msg.style.color = '#2e8b57';
  atualizarSomatorioMeta();
}

async function excluirMetaSemana() {
  if (!metaAtualSemana) return;
  if (!confirm('Excluir esta meta? Os resultados serão mantidos.')) return;
  await window.fbFuncs.deleteDoc(window.fbFuncs.doc(window.db,'metas',metaAtualSemana.id));
  metaAtualSemana = null;
  document.getElementById('meta-valor-semana').value = '';
  document.getElementById('btn-excluir-meta-sem').style.display = 'none';
  document.getElementById('meta-msg-sem').textContent = '✅ Meta excluída.';
  document.getElementById('meta-msg-sem').style.color = '#e53e3e';
  atualizarSomatorioMeta();
}

async function salvarResultadosDias() {
  const turmaId = document.getElementById('meta-turma').value;
  if (!turmaId || !semanaAtualMeta) return;
  const dom = semanaAtualMeta.domingo;
  let salvos = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(dom + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const data = d.toISOString().split('T')[0];
    const val = document.getElementById('res-' + data)?.value;
    if (!val && val !== '0') continue;

    const dados = {
      turmaId, data, semanaDomingo: dom, semanaSabado: semanaAtualMeta.sabado,
      resultado: parseFloat(val), diaSemana: i,
      lancadoPor: window.usuarioLogado.uid,
      atualizadoEm: new Date().toISOString()
    };

    const qE = window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'resultadosDiarios'),
      window.fbFuncs.where('turmaId','==',turmaId),
      window.fbFuncs.where('data','==',data)
    );
    const snapE = await window.fbFuncs.getDocs(qE);
    if (!snapE.empty) {
      await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'resultadosDiarios',snapE.docs[0].id), dados);
    } else {
      dados.criadoEm = new Date().toISOString();
      await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'resultadosDiarios'), dados);
    }
    salvos++;
  }
  alert(`✅ ${salvos} resultado(s) salvo(s)!`);
  await carregarDadosMetaSemana();
}

async function excluirResultadoDia(resId, data) {
  if (!confirm(`Excluir resultado de ${formatarData(data)}?`)) return;
  await window.fbFuncs.deleteDoc(window.fbFuncs.doc(window.db,'resultadosDiarios',resId));
  await carregarDadosMetaSemana();
}

async function carregarHistoricoMetas() {
  const div = document.getElementById('meta-historico-lista');
  div.innerHTML = 'Carregando...';

  const [snapM, snapR] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'resultadosDiarios'))
  ]);

  const resultMap = {};
  snapR.forEach(d => {
    const r = d.data();
    const key = `${r.turmaId}_${r.semanaDomingo}`;
    if (!resultMap[key]) resultMap[key] = 0;
    resultMap[key] += parseFloat(r.resultado || 0);
  });

  let metas = [];
  snapM.forEach(d => metas.push({ id:d.id,...d.data() }));
  metas.sort((a,b) => (b.semanaDomingo||'').localeCompare(a.semanaDomingo||''));

  if (metas.length === 0) { div.innerHTML = '<p style="color:#888">Nenhuma meta.</p>'; return; }

  div.innerHTML = metas.map(m => {
    const soma = resultMap[m.semanaId] || 0;
    const pct = m.meta > 0 ? Math.round(soma/m.meta*100) : 0;
    const ganhou = soma >= m.meta && m.meta > 0;
    const semRes = soma === 0;
    const turma = turmasCache[m.turmaId];

    return `<div class="section-box" style="border-left:4px solid ${semRes?'#ddd':ganhou?'#2e8b57':'#e53e3e'}">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <h4 style="margin:0 0 4px">🏘️ ${turma?.nome||'—'}</h4>
          <span style="font-size:13px;color:#666">${labelSemana(m.semanaDomingo,m.semanaSabado)}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${semRes
            ? '<span class="badge badge-amarelo">⏳ Aguardando</span>'
            : ganhou
            ? '<span class="badge badge-verde">✅ Atingiu</span>'
            : '<span class="badge badge-vermelho">❌ Não atingiu</span>'}
          <button class="btn-secondary btn-sm" style="color:#e53e3e" onclick="excluirMetaHist('${m.id}')">🗑️</button>
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:10px">
        <div><small style="color:#888">META</small><div style="font-size:18px;font-weight:700;color:#1a5e38">${m.meta}</div></div>
        <div><small style="color:#888">SOMA</small><div style="font-size:18px;font-weight:700;color:${ganhou?'#2e8b57':'#e53e3e'}">${soma.toFixed(0)}</div></div>
        <div><small style="color:#888">%</small><div style="font-size:18px;font-weight:700">${pct}%</div></div>
      </div>
      <div class="progresso-barra"><div class="progresso-fill ${ganhou?'ok':'no'}" style="width:${Math.min(pct,100)}%"></div></div>
    </div>`;
  }).join('');
}

async function excluirMetaHist(metaId) {
  if (!confirm('Excluir meta?')) return;
  await window.fbFuncs.deleteDoc(window.fbFuncs.doc(window.db,'metas',metaId));
  carregarHistoricoMetas();
}

// Importar Excel
async function importarExcelMeta(event) {
  const file = event.target.files[0];
  if (!file) return;
  const tipo = document.getElementById('meta-imp-tipo').value;
  const div = document.getElementById('meta-imp-resultado');
  div.innerHTML = '⏳ Lendo...';

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type:'binary', cellDates:true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
      if (!rows.length) { div.innerHTML = '❌ Vazio.'; return; }

      let ok=0, erros=0, log=[];
      for (const row of rows) {
        try {
          if (tipo === 'metas') {
            const turmaKey = String(row['TURMA']||row['Turma']||'').trim().toLowerCase();
            const semIni = String(row['SEMANA_INICIO']||row['Semana_Inicio']||'').trim();
            const metaVal = parseFloat(row['META']||row['Meta']||0);
            if (!turmaKey||!semIni||!metaVal) { erros++; log.push('⚠ Ignorado'); continue; }

            const turma = Object.values(turmasCache).find(t => t.nome.toLowerCase()===turmaKey);
            if (!turma) { erros++; log.push(`❌ Turma não encontrada: ${turmaKey}`); continue; }

            const dom = domingoSemana(semIni);
            const sab = sabadoSemana(dom);
            const dados = {
              turmaId: turma.id, semanaId: `${turma.id}_${dom}`,
              semanaDomingo: dom, semanaSabado: sab, meta: metaVal,
              lancadoPor: window.usuarioLogado.uid, atualizadoEm: new Date().toISOString()
            };
            const q = window.fbFuncs.query(
              window.fbFuncs.collection(window.db,'metas'),
              window.fbFuncs.where('semanaId','==',`${turma.id}_${dom}`)
            );
            const snap = await window.fbFuncs.getDocs(q);
            if (!snap.empty) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'metas',snap.docs[0].id), dados);
            else { dados.criadoEm=new Date().toISOString(); await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'metas'),dados); }
            ok++; log.push(`✅ Meta ${turma.nome} — ${labelSemana(dom,sab)}: ${metaVal}`);
          } else {
            // resultados
            const turmaKey = String(row['TURMA']||row['Turma']||'').trim().toLowerCase();
            const dataStr = String(row['DATA']||row['Data']||'').trim();
            const resVal = parseFloat(row['RESULTADO']||row['Resultado']||0);
            if (!turmaKey||!dataStr) { erros++; log.push('⚠ Ignorado'); continue; }

            const turma = Object.values(turmasCache).find(t => t.nome.toLowerCase()===turmaKey);
            if (!turma) { erros++; log.push(`❌ Turma: ${turmaKey}`); continue; }

            const data = dataStr.includes('-') ? dataStr.slice(0,10) : dataStr;
            const dom = domingoSemana(data);
            const sab = sabadoSemana(dom);
            const dados = {
              turmaId: turma.id, data, semanaDomingo: dom, semanaSabado: sab,
              resultado: resVal, diaSemana: new Date(data+'T12:00:00').getDay(),
              lancadoPor: window.usuarioLogado.uid, atualizadoEm: new Date().toISOString()
            };
            const q = window.fbFuncs.query(
              window.fbFuncs.collection(window.db,'resultadosDiarios'),
              window.fbFuncs.where('turmaId','==',turma.id),
              window.fbFuncs.where('data','==',data)
            );
            const snap = await window.fbFuncs.getDocs(q);
            if (!snap.empty) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'resultadosDiarios',snap.docs[0].id), dados);
            else { dados.criadoEm=new Date().toISOString(); await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'resultadosDiarios'),dados); }
            ok++; log.push(`✅ ${turma.nome} — ${formatarData(data)}: ${resVal}`);
          }
        } catch(err) { erros++; log.push(`❌ Erro: ${err.message}`); }
      }

      div.innerHTML = `
        <div style="display:flex;gap:12px;margin-bottom:12px">
          <div class="stat" style="background:white;border-radius:8px;padding:12px;text-align:center;min-width:80px">
            <div style="font-size:20px;font-weight:700;color:#2e8b57">${ok}</div>
            <div style="font-size:11px;color:#888">OK</div>
          </div>
          <div class="stat" style="background:white;border-radius:8px;padding:12px;text-align:center;min-width:80px">
            <div style="font-size:20px;font-weight:700;color:#e53e3e">${erros}</div>
            <div style="font-size:11px;color:#888">Erros</div>
          </div>
        </div>
        <div style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:12px;font-family:monospace;font-size:11px;max-height:180px;overflow-y:auto">
          ${log.map(l => `<div>${l}</div>`).join('')}
        </div>`;
    } catch(err) { div.innerHTML = '❌ Erro: ' + err.message; }
  };
  reader.readAsBinaryString(file);
}

function baixarModeloMeta() {
  const tipo = document.getElementById('meta-imp-tipo').value;
  let csv = '';
  if (tipo === 'metas') {
    csv = 'TURMA;SEMANA_INICIO;META\nTurma A;2026-02-15;500\n';
  } else {
    csv = 'TURMA;DATA;RESULTADO\nTurma A;2026-02-16;85\n';
  }
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = tipo === 'metas' ? 'modelo-metas.csv' : 'modelo-resultados.csv';
  a.click();
}

// ══════════════════════════════════════════════
// CONTROLE DE SÁBADOS
// ══════════════════════════════════════════════
async function carregarPaginaSabados() {
  await carregarFazendasSelects();
  await carregarTurmasCache();
  
  // Preencher turmas
  const sel = document.getElementById('sabado-turma');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione</option>';
    Object.values(turmasCache).sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(t => {
      sel.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
    });
  }
  
  // Preencher semanas
  const hoje = new Date();
  const inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 84);
  const fim = new Date(hoje); fim.setDate(hoje.getDate() + 28);
  const semanas = gerarSemanas(inicio.toISOString().split('T')[0], fim.toISOString().split('T')[0]);
  
  const selSem = document.getElementById('sabado-semana');
  if (selSem) {
    selSem.innerHTML = '<option value="">Selecione a semana</option>';
    semanas.reverse().forEach(s => {
      selSem.innerHTML += `<option value="${s.domingo}|${s.sabado}">${s.label}</option>`;
    });
  }
}

async function carregarControleSab() {
  const turmaId = document.getElementById('sabado-turma').value;
  const semanaV = document.getElementById('sabado-semana').value;
  const painel = document.getElementById('painel-sabado-ctrl');
  
  if (!turmaId||!semanaV) { painel.style.display='none'; return; }
  painel.style.display='block';
  
  const [dom, sab] = semanaV.split('|');
  
  // Buscar meta + resultados da semana
  const qMeta = window.fbFuncs.query(
    window.fbFuncs.collection(window.db,'metas'),
    window.fbFuncs.where('semanaId','==',`${turmaId}_${dom}`)
  );
  const snapMeta = await window.fbFuncs.getDocs(qMeta);
  
  let turmaGanhou = false;
  let statusHTML = '⚠️ Nenhuma meta lançada para esta semana.';
  
  if (!snapMeta.empty) {
    const meta = snapMeta.docs[0].data();
    
    // Buscar soma dos resultados
    const qRes = window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'resultadosDiarios'),
      window.fbFuncs.where('turmaId','==',turmaId),
      window.fbFuncs.where('semanaDomingo','==',dom)
    );
    const snapRes = await window.fbFuncs.getDocs(qRes);
    let soma = 0;
    snapRes.forEach(d => soma += parseFloat(d.data().resultado || 0));
    
    turmaGanhou = soma >= meta.meta;
    statusHTML = turmaGanhou
      ? `✅ <strong>Turma ATINGIU a meta!</strong> Meta: ${meta.meta} | Soma: ${soma.toFixed(0)}<br>
         <small>${labelSemana(dom,sab)}</small><br>
         Marque quem <strong>trabalhou no sábado ${formatarData(sab)}</strong>.`
      : `❌ <strong>Turma NÃO atingiu</strong>. Meta: ${meta.meta} | Soma: ${soma.toFixed(0)}`;
  }
  
  document.getElementById('sabado-status-msg').innerHTML = statusHTML;
  document.getElementById('btn-salvar-sab').style.display = turmaGanhou ? 'block' : 'none';
  
  // Colaboradores
  const qColab = window.fbFuncs.query(
    window.fbFuncs.collection(window.db,'colaboradores'),
    window.fbFuncs.where('turmaId','==',turmaId),
    window.fbFuncs.where('demitido','==',false)
  );
  const snapColab = await window.fbFuncs.getDocs(qColab);
  
  // Presenças
  const qPres = window.fbFuncs.query(
    window.fbFuncs.collection(window.db,'presencas'),
    window.fbFuncs.where('turmaId','==',turmaId),
    window.fbFuncs.where('data','==',sab)
  );
  const snapPres = await window.fbFuncs.getDocs(qPres);
  const presMap = {};
  snapPres.forEach(d => presMap[d.data().colaboradorId]=d.data().presente);
  
  const lista = document.getElementById('sabado-lista-colab');
  if (snapColab.empty) { lista.innerHTML='<p style="color:#888">Nenhum colaborador.</p>'; return; }
  
  lista.innerHTML = snapColab.docs.map(d => {
    const c = d.data();
    const checked = presMap[d.id] ? 'checked' : '';
    const disabled = !turmaGanhou ? 'disabled' : '';
    return `<div style="padding:8px;border-bottom:1px solid #eee">
      <label style="display:flex;align-items:center;gap:8px;cursor:${turmaGanhou?'pointer':'not-allowed'}">
        <input type="checkbox" id="pres-${d.id}" ${checked} ${disabled}/>
        <span>${c.nome} <small style="color:#999">#${c.chapa}</small></span>
      </label>
    </div>`;
  }).join('');
  
  window._sabadoColab = snapColab.docs.map(d => ({ id:d.id,...d.data() }));
  window._sabadoData = sab;
  window._sabadoTurma = turmaId;
}

async function salvarPresencaSab() {
  const colab = window._sabadoColab||[];
  const data = window._sabadoData;
  const turmaId = window._sabadoTurma;
  
  for (const c of colab) {
    const chk = document.getElementById('pres-'+c.id);
    if (!chk) continue;
    
    const qP = window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'presencas'),
      window.fbFuncs.where('colaboradorId','==',c.id),
      window.fbFuncs.where('data','==',data)
    );
    const sp = await window.fbFuncs.getDocs(qP);
    const dados = { 
      colaboradorId:c.id, turmaId, data, presente:chk.checked,
      atualizadoEm:new Date().toISOString()
    };
    
    if (!sp.empty) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'presencas',sp.docs[0].id), dados);
    else { dados.criadoEm=new Date().toISOString(); await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'presencas'), dados); }
  }
  alert('✅ Presenças salvas!');
}

// ══════════════════════════════════════════════
// PREMIAÇÃO
// ══════════════════════════════════════════════
async function carregarPaginaPremiacao() {
  await carregarFazendasSelects();
  await carregarTurmasCache();
  
  // Preencher semanas
  const snapM = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas'));
  const semanas = new Map();
  snapM.forEach(d => {
    const m = d.data();
    if (m.semanaDomingo) semanas.set(m.semanaDomingo, { domingo:m.semanaDomingo, sabado:m.semanaSabado });
  });
  
  const sel = document.getElementById('premio-semana');
  if (sel) {
    sel.innerHTML = '<option value="">Todas</option>';
    [...semanas.values()].sort((a,b) => b.domingo.localeCompare(a.domingo)).forEach(s => {
      sel.innerHTML += `<option value="${s.domingo}|${s.sabado}">${labelSemana(s.domingo,s.sabado)}</option>`;
    });
  }
  
  filtrarPremiacao();
}

async function filtrarPremiacao() {
  const fazendaId = document.getElementById('premio-fazenda')?.value||'';
  const semanaV = document.getElementById('premio-semana')?.value||'';
  const listaA = document.getElementById('lista-conquistaram');
  const listaB = document.getElementById('lista-trabalharam');
  if (listaA) listaA.innerHTML = 'Carregando...';
  if (listaB) listaB.innerHTML = 'Carregando...';
  
  // Buscar metas + resultados
  let qMetas = window.fbFuncs.collection(window.db,'metas');
  if (semanaV) {
    const [dom] = semanaV.split('|');
    qMetas = window.fbFuncs.query(qMetas, window.fbFuncs.where('semanaDomingo','==',dom));
  }
  const snapMetas = await window.fbFuncs.getDocs(qMetas);
  
  const snapRes = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'resultadosDiarios'));
  const resultMap = {};
  snapRes.forEach(d => {
    const r = d.data();
    const key = `${r.turmaId}_${r.semanaDomingo}`;
    if (!resultMap[key]) resultMap[key] = 0;
    resultMap[key] += parseFloat(r.resultado || 0);
  });
  
  const turmasGanharam = new Map();
  snapMetas.forEach(d => {
    const m = d.data();
    const soma = resultMap[m.semanaId] || 0;
    if (soma >= m.meta) turmasGanharam.set(m.turmaId, m);
  });
  
  if (turmasGanharam.size===0) {
    if (listaA) listaA.innerHTML='<p style="color:#888">Nenhuma turma atingiu meta.</p>';
    if (listaB) listaB.innerHTML='<p style="color:#888">—</p>';
    document.getElementById('count-conquistaram').textContent = 0;
    document.getElementById('count-trabalharam').textContent = 0;
    return;
  }
  
  const [snapC, snapF] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))
  ]);
  const colabMap = {}; snapC.forEach(d => colabMap[d.id]={id:d.id,...d.data()});
  const fazMap = {}; snapF.forEach(d => fazMap[d.id]=d.data().nome);
  
  let conquistaram = Object.values(colabMap).filter(c =>
    turmasGanharam.has(c.turmaId) && !c.demitido
  );
  if (fazendaId) conquistaram = conquistaram.filter(c => turmasCache[c.turmaId]?.fazendaId===fazendaId);
  
  // Presenças
  let presencasMap = {};
  if (semanaV) {
    const [,sab] = semanaV.split('|');
    const qPres = window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'presencas'),
      window.fbFuncs.where('data','==',sab),
      window.fbFuncs.where('presente','==',true)
    );
    const snapPres = await window.fbFuncs.getDocs(qPres);
    snapPres.forEach(d => presencasMap[d.data().colaboradorId] = true);
  } else {
    const qPres = window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'presencas'),
      window.fbFuncs.where('presente','==',true)
    );
    const snapPres = await window.fbFuncs.getDocs(qPres);
    snapPres.forEach(d => presencasMap[d.data().colaboradorId] = true);
  }
  
  const trabalharam = conquistaram.filter(c => presencasMap[c.id]);
  
  // Renderizar A
  if (listaA) {
    if (conquistaram.length===0) {
      listaA.innerHTML='<p style="color:#888">Nenhum.</p>';
    } else {
      listaA.innerHTML = conquistaram.map(c => {
        const t = turmasCache[c.turmaId];
        const trabalhou = presencasMap[c.id];
        return `<div class="item-card">
          <div class="item-card-info">
            <strong>${c.nome} <small style="color:#999">#${c.chapa}</small></strong>
            <span>🏘️ ${t?.nome||'—'} | 🌿 ${t?fazMap[t.fazendaId]||'—':'—'}</span>
          </div>
          ${trabalhou
            ? '<span class="badge badge-verde">✅ Trabalhou</span>'
            : '<span class="badge badge-amarelo">⏳ Sem confirmação</span>'}
        </div>`;
      }).join('');
    }
  }
  
  // Renderizar B
  if (listaB) {
    if (trabalharam.length===0) {
      listaB.innerHTML='<p style="color:#888">Nenhum confirmado.</p>';
    } else {
      listaB.innerHTML = trabalharam.map(c => {
        const t = turmasCache[c.turmaId];
        const meta = turmasGanharam.get(c.turmaId);
        const semLabel = meta ? labelSemana(meta.semanaDomingo,meta.semanaSabado) : '—';
        return `<div class="item-card">
          <div class="item-card-info">
            <strong>${c.nome} <small style="color:#999">#${c.chapa}</small></strong>
            <span>🏘️ ${t?.nome||'—'} | 🌿 ${t?fazMap[t.fazendaId]||'—':'—'} | 📅 ${semLabel}</span>
          </div>
          <span class="badge badge-verde">🏆 Premiado</span>
        </div>`;
      }).join('');
    }
  }
  
  document.getElementById('count-conquistaram').textContent = conquistaram.length;
  document.getElementById('count-trabalharam').textContent = trabalharam.length;
}

// ══════════════════════════════════════════════
// EXPORTAÇÃO
// ══════════════════════════════════════════════
async function carregarPaginaExportar() {
  await carregarFazendasSelects();
  
  const snapM = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas'));
  const semanas = new Map();
  snapM.forEach(d => {
    const m = d.data();
    if (m.semanaDomingo) semanas.set(m.semanaDomingo, { domingo:m.semanaDomingo, sabado:m.semanaSabado });
  });
  
  const sel = document.getElementById('exp-semana');
  if (sel) {
    sel.innerHTML = '<option value="">Todas</option>';
    [...semanas.values()].sort((a,b) => b.domingo.localeCompare(a.domingo)).forEach(s => {
      sel.innerHTML += `<option value="${s.domingo}|${s.sabado}">${labelSemana(s.domingo,s.sabado)}</option>`;
    });
  }
}

async function exportarTXT() {
  const msg = document.getElementById('exp-msg');
  msg.textContent = 'Gerando...';
  const fazId = document.getElementById('exp-fazenda').value;
  const semanaV = document.getElementById('exp-semana').value;
  const chapaGer = document.getElementById('exp-chapa-ger').value.trim();
  const horaIni = document.getElementById('exp-hi').value||'08:00';
  const horaFim = document.getElementById('exp-hf').value||'17:00';
  
  if (!chapaGer) { msg.textContent='⚠️ Informe chapa gerador.'; msg.style.color='#e53e3e'; return; }
  
  const registros = await buscarPremiados(fazId, semanaV);
  if (registros.length===0) { msg.textContent='⚠️ Nenhum registro.'; msg.style.color='#e53e3e'; return; }
  
  const linhas = registros.map(r => {
    const chapa6 = padZeros(r.chapa, 6);
    const ger6 = padZeros(chapaGer, 6);
    return `${chapa6};${formatarData(r.dataSabado)};0034;${horaIni};${horaFim};0;${ger6};0;1;1;FOLGA PREMIO`;
  });
  
  const blob = new Blob([linhas.join('\n')], { type:'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download='premiacao.txt'; a.click();
  msg.textContent = `✅ ${linhas.length} registros!`;
  msg.style.color = '#2e8b57';
}

async function exportarCSV() {
  const msg = document.getElementById('exp-msg');
  msg.textContent = 'Gerando...';
  const fazId = document.getElementById('exp-fazenda').value;
  const semanaV = document.getElementById('exp-semana').value;
  
  const registros = await buscarPremiados(fazId, semanaV);
  if (registros.length===0) { msg.textContent='⚠️ Nenhum.'; msg.style.color='#e53e3e'; return; }
  
  const cab = 'CHAPA;NOME;FUNÇÃO;TURMA;FAZENDA;SEMANA;DATA SÁBADO;STATUS\n';
  const linhas = registros.map(r =>
    `${r.chapa};${r.nome};${r.funcao||''};${r.turmaNome};${r.fazNome};${r.semana};${formatarData(r.dataSabado)};PREMIADO`
  );
  const blob = new Blob(['\uFEFF'+cab+linhas.join('\n')], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download='premiacao.csv'; a.click();
  msg.textContent = `✅ ${linhas.length} registros!`;
  msg.style.color = '#2e8b57';
}

async function buscarPremiados(fazendaId, semanaV) {
  // Metas atingidas
  let qMetas = window.fbFuncs.collection(window.db,'metas');
  if (semanaV) {
    const [dom] = semanaV.split('|');
    qMetas = window.fbFuncs.query(qMetas, window.fbFuncs.where('semanaDomingo','==',dom));
  }
  const snapMetas = await window.fbFuncs.getDocs(qMetas);
  
  const snapRes = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'resultadosDiarios'));
  const resultMap = {};
  snapRes.forEach(d => {
    const r = d.data();
    const key = `${r.turmaId}_${r.semanaDomingo}`;
    if (!resultMap[key]) resultMap[key] = 0;
    resultMap[key] += parseFloat(r.resultado || 0);
  });
  
  const turmasGanharam = new Map();
  snapMetas.forEach(d => {
    const m = d.data();
    const soma = resultMap[m.semanaId] || 0;
    if (soma >= m.meta) turmasGanharam.set(m.turmaId, m);
  });
  if (turmasGanharam.size===0) return [];
  
  // Presenças
  let qPres;
  if (semanaV) {
    const [,sab] = semanaV.split('|');
    qPres = window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'presencas'),
      window.fbFuncs.where('data','==',sab),
      window.fbFuncs.where('presente','==',true)
    );
  } else {
    qPres = window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'presencas'),
      window.fbFuncs.where('presente','==',true)
    );
  }
  const snapPres = await window.fbFuncs.getDocs(qPres);
  
  const [snapC, snapT, snapF] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))
  ]);
  const colabMap = {}; snapC.forEach(d => colabMap[d.id]={id:d.id,...d.data()});
  const turmaMap = {}; snapT.forEach(d => turmaMap[d.id]=d.data());
  const fazMap = {}; snapF.forEach(d => fazMap[d.id]=d.data().nome);
  
  const resultado = [];
  snapPres.forEach(d => {
    const pres = d.data();
    const colab = colabMap[pres.colaboradorId];
    if (!colab) return;
    if (!turmasGanharam.has(colab.turmaId)) return;
    const turma = turmaMap[colab.turmaId];
    if (fazendaId && turma?.fazendaId!==fazendaId) return;
    const meta = turmasGanharam.get(colab.turmaId);
    resultado.push({
      chapa: colab.chapa,
      nome: colab.nome,
      funcao: colab.funcao||'',
      turmaNome: turma?.nome||'—',
      fazNome: turma ? fazMap[turma.fazendaId]||'—' : '—',
      semana: labelSemana(meta.semanaDomingo, meta.semanaSabado),
      dataSabado: meta.semanaSabado
    });
  });
  return resultado;
}

// ══════════════════════════════════════════════
// IMPORTAR TOTVS
// ══════════════════════════════════════════════
async function carregarPaginaImportarTotvs() {
  await carregarTurmasCache();
}

async function importarTotvs(event) {
  const file = event.target.files[0];
  if (!file) return;
  const div = document.getElementById('totvs-resultado');
  div.innerHTML = '⏳ Lendo...';
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type:'binary', cellDates:true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
      if (!rows.length) { div.innerHTML = '❌ Vazio.'; return; }
      
      const MAPA = {
        chapa: ['CHAPA','Chapa','MATRICULA'],
        nome: ['NOME','Nome'],
        funcao: ['FUNCAO','Funcao','FUNÇÃO'],
        turma: ['TURMA','Turma','CODSECAO','SECAO'],
        lider: ['LIDER','Lider','NOMECHEFIA'],
        admissao: ['DATAADMISSAO','ADMISSAO','DATAADMISSÃO'],
        demissao: ['DATADEMISSAO','DEMISSAO'],
        inicioJornada: ['HORAINICIO','HORA INICIO'],
        fimJornada: ['HORAFIM','HORA FIM']
      };
      
      const normalizar = (row) => {
        const obj = {};
        for (const [campo, opcoes] of Object.entries(MAPA)) {
          for (const op of opcoes) {
            if (row[op] !== undefined) { obj[campo] = String(row[op]||'').trim(); break; }
          }
          if (!obj[campo]) obj[campo] = '';
        }
        return obj;
      };
      
      let ok=0, erros=0, mudancas=0, log=[];
      
      const snapC = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores'));
      const colabExistente = {};
      snapC.forEach(d => { const c=d.data(); if (c.chapa) colabExistente[c.chapa.trim()]={id:d.id,...c}; });
      
      for (const row of rows) {
        try {
          const item = normalizar(row);
          if (!item.chapa||!item.nome) { erros++; log.push('⚠ Sem chapa/nome'); continue; }
          
          // Resolver turma
          let turmaId = null;
          let turmaNome = item.turma;
          const turmaKey = turmaNome.toLowerCase().trim();
          if (turmaKey) {
            const turmaObj = Object.values(turmasCache).find(t => t.nome.toLowerCase().trim()===turmaKey);
            if (turmaObj) {
              turmaId = turmaObj.id;
            } else {
              const novaRef = await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'turmas'), {
                nome: turmaNome, liderNome: item.lider||'', fazendaId: '',
                criadoEm: new Date().toISOString(), criadoViaImport: true
              });
              turmaId = novaRef.id;
              turmasCache[turmaId] = { id:turmaId, nome:turmaNome, liderNome:item.lider||'', fazendaId:'' };
              log.push(`📁 Turma criada: ${turmaNome}`);
            }
          }
          
          const dados = {
            chapa: item.chapa, nome: item.nome, funcao: item.funcao||'',
            liderNome: item.lider||'', turmaId: turmaId||'', turmaNome,
            admissao: item.admissao||'', demissao: item.demissao||'',
            inicioJornada: item.inicioJornada||'08:00', fimJornada: item.fimJornada||'17:00',
            demitido: !!item.demissao, atualizadoEm: new Date().toISOString(), importadoTotvs: true
          };
          
          const existente = colabExistente[item.chapa];
          if (!existente) {
            dados.criadoEm = new Date().toISOString();
            const ref = await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'colaboradores'), dados);
            colabExistente[item.chapa] = { id:ref.id, ...dados };
            ok++; log.push(`✅ Novo: ${item.nome}`);
          } else {
            const turmaAntiga = (existente.turmaNome||'').toLowerCase().trim();
            const turmaNovaN = turmaNome.toLowerCase().trim();
            const mudouTurma = turmaNovaN && turmaAntiga && turmaNovaN !== turmaAntiga;
            
            if (mudouTurma) {
              await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'alertasMudancaTurma'), {
                colaboradorId: existente.id, chapa: item.chapa, nome: item.nome,
                turmaAntigaId: existente.turmaId||'', turmaAntigaNome: existente.turmaNome||'',
                turmaNovaId: turmaId||'', turmaNovaNome: turmaNome,
                dataDeteccao: new Date().toISOString(), resolvido: false,
                dadosPendentes: dados
              });
              mudancas++; log.push(`⚠ Mudança detectada: ${item.nome} (${existente.turmaNome} → ${turmaNome})`);
            } else {
              await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'colaboradores',existente.id), dados);
              ok++; log.push(`↻ Atualizado: ${item.nome}`);
            }
          }
        } catch(err) { erros++; log.push(`❌ Erro: ${err.message}`); }
      }
      
      div.innerHTML = `
        <div style="display:flex;gap:12px;margin-bottom:12px">
          <div style="background:white;border-radius:8px;padding:12px;text-align:center;min-width:80px">
            <div style="font-size:20px;font-weight:700;color:#2e8b57">${ok}</div>
            <div style="font-size:11px;color:#888">OK</div>
          </div>
          <div style="background:white;border-radius:8px;padding:12px;text-align:center;min-width:80px">
            <div style="font-size:20px;font-weight:700;color:#f59e0b">${mudancas}</div>
            <div style="font-size:11px;color:#888">Mudanças</div>
          </div>
          <div style="background:white;border-radius:8px;padding:12px;text-align:center;min-width:80px">
            <div style="font-size:20px;font-weight:700;color:#e53e3e">${erros}</div>
            <div style="font-size:11px;color:#888">Erros</div>
          </div>
        </div>
        <div style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:12px;font-family:monospace;font-size:11px;max-height:200px;overflow-y:auto">
          ${log.map(l => `<div>${l}</div>`).join('')}
        </div>`;
    } catch(err) { div.innerHTML = '❌ Erro: ' + err.message; }
  };
  reader.readAsBinaryString(file);
}

// ══════════════════════════════════════════════
// ADMINISTRAÇÃO
// ══════════════════════════════════════════════
async function carregarAdmin() {
  const qP = window.fbFuncs.query(
    window.fbFuncs.collection(window.db,'usuarios'),
    window.fbFuncs.where('aprovado','==',false)
  );
  const snapP = await window.fbFuncs.getDocs(qP);
  const lP = document.getElementById('lista-pendentes');
  
  if (snapP.empty) { lP.innerHTML='<p style="color:#888">Nenhum pendente.</p>'; }
  else {
    lP.innerHTML = '';
    snapP.docs.forEach(d => {
      const u = d.data();
      lP.innerHTML += `<div class="item-card">
        <div class="item-card-info"><strong>${u.nome}</strong><span>Chapa: ${u.chapa} | ${u.email}</span></div>
        <div style="display:flex;gap:8px">
          <select id="perfil-${d.id}" style="padding:6px;border-radius:6px;border:1px solid #ddd;font-size:13px">
            <option value="lider">Líder</option>
            <option value="administrativo">Administrativo</option>
            <option value="encarregado">Encarregado</option>
            <option value="gestao">Gestão</option>
            <option value="admin">Admin</option>
          </select>
          <button class="btn-primary btn-sm" onclick="aprovarUsuario('${d.id}')">✅</button>
        </div>
      </div>`;
    });
  }
  
  const snapT = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'usuarios'));
  const lU = document.getElementById('lista-usuarios');
  lU.innerHTML = '<table><tr><th>Nome</th><th>Chapa</th><th>Perfil</th><th>Status</th><th></th></tr>';
  snapT.docs.forEach(d => {
    const u = d.data();
    const st = u.aprovado ? '<span class="badge badge-verde">Ativo</span>' : '<span class="badge badge-amarelo">Pendente</span>';
    lU.innerHTML += `<tr><td>${u.nome}</td><td>${u.chapa}</td><td>${u.perfil}</td><td>${st}</td>
      <td><button class="btn-secondary btn-sm" onclick="alterarPerfil('${d.id}','${u.perfil}')">✏️</button></td></tr>`;
  });
  lU.innerHTML += '</table>';
}

async function aprovarUsuario(uid) {
  const perfil = document.getElementById('perfil-'+uid)?.value||'lider';
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'usuarios',uid),
    { aprovado:true, perfil, aprovadoPor:window.usuarioLogado?.uid, aprovadoEm:new Date().toISOString() });
  alert('✅ Aprovado!'); carregarAdmin();
}

async function alterarPerfil(uid, perfilAtual) {
  const novo = prompt('Novo perfil (lider/administrativo/encarregado/gestao/admin):', perfilAtual);
  if (!novo) return;
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'usuarios',uid), { perfil:novo });
  alert('✅ Atualizado!'); carregarAdmin();
}
