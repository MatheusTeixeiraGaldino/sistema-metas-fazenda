// ========================================================
// SISTEMA DE METAS E PREMIAÇÃO — app.js
// ========================================================

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
  if (pagina === 'dashboard')    carregarDashboard();
  if (pagina === 'fazendas')     carregarFazendas();
  if (pagina === 'turmas')       carregarTurmas();
  if (pagina === 'colaboradores') carregarColaboradores();
  if (pagina === 'metas')        carregarPaginaMetas();
  if (pagina === 'sabados')      carregarPaginaSabados();
  if (pagina === 'premiacao')    carregarPaginaPremiacao();
  if (pagina === 'exportar')     carregarPaginaExportar();
  if (pagina === 'admin')        carregarAdmin();
}
function toggleMenu() { document.getElementById('menu-lateral').classList.toggle('fechado'); }
function fecharMenu()  { document.getElementById('menu-lateral').classList.add('fechado'); }

// ─────────────────────────────────────────────
// UTILITÁRIOS DE DATA
// ─────────────────────────────────────────────

// Retorna o domingo da semana de uma data
function domingoSemana(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  const dia = d.getDay(); // 0=dom
  d.setDate(d.getDate() - dia);
  return d.toISOString().split('T')[0];
}

// Retorna o sábado da semana de uma data
function sabadoSemana(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  const dia = d.getDay();
  d.setDate(d.getDate() + (6 - dia));
  return d.toISOString().split('T')[0];
}

// Formata YYYY-MM-DD → DD/MM/AAAA
function formatarData(dataStr) {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

// Label "Dom DD/MM – Sáb DD/MM/AAAA"
function labelSemana(domingoStr, sabadoStr) {
  return `Dom ${formatarData(domingoStr)} – Sáb ${formatarData(sabadoStr)}`;
}

function padZeros(str, n) { return String(str).padStart(n, '0'); }

// Gerar lista de semanas (domingo→sábado) de um período
function gerarSemanas(dataIni, dataFim) {
  const semanas = [];
  let atual = domingoSemana(dataIni);
  const fim  = new Date(dataFim + 'T12:00:00');
  while (true) {
    const sab = sabadoSemana(atual);
    if (new Date(atual + 'T12:00:00') > fim) break;
    semanas.push({ domingo: atual, sabado: sab, label: labelSemana(atual, sab) });
    const prox = new Date(atual + 'T12:00:00');
    prox.setDate(prox.getDate() + 7);
    atual = prox.toISOString().split('T')[0];
    if (semanas.length > 60) break; // segurança
  }
  return semanas;
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
// SELECTS GLOBAIS DE FAZENDA
// ─────────────────────────────────────────────
async function carregarFazendasSelects() {
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'));
  const fazendas = [];
  snap.forEach(d => fazendas.push({ id: d.id, ...d.data() }));

  ['filtro-fazenda-turma','filtro-fazenda-colab','exp-fazenda',
   'premio-fazenda','sabado-fazenda'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = el.value;
    el.innerHTML = '<option value="">Todas as fazendas</option>';
    fazendas.forEach(f => el.innerHTML += `<option value="${f.id}">${f.nome}</option>`);
    el.value = v;
  });

  const selMeta = document.getElementById('meta-fazenda');
  if (selMeta) {
    selMeta.innerHTML = '<option value="">Selecione a fazenda</option>';
    fazendas.forEach(f => selMeta.innerHTML += `<option value="${f.id}">${f.nome}</option>`);
  }
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
    const metas = []; snapMetas.forEach(d => metas.push(d.data()));
    const comRes = metas.filter(m => m.resultado != null);
    const atingidas = comRes.filter(m => parseFloat(m.resultado) >= parseFloat(m.meta));
    const pct = comRes.length > 0 ? Math.round(atingidas.length/comRes.length*100) : 0;

    document.getElementById('dash-total-turmas').textContent   = snapTurmas.size;
    document.getElementById('dash-metas-atingidas').textContent = pct + '%';
    document.getElementById('dash-total-colab').textContent    = snapColab.size;
    document.getElementById('dash-premios').textContent        = snapPres.size;

    // Ranking
    const turmaMap = {};
    snapTurmas.forEach(d => turmaMap[d.id] = d.data().nome);
    const ranking = document.getElementById('ranking-turmas');
    if (comRes.length === 0) { ranking.innerHTML = '<p style="color:#888">Nenhuma meta lançada ainda.</p>'; return; }
    const ord = [...comRes].sort((a,b) => (parseFloat(b.resultado)/parseFloat(b.meta)) - (parseFloat(a.resultado)/parseFloat(a.meta)));
    ranking.innerHTML = ord.slice(0,10).map((m,i) => {
      const p = Math.round(parseFloat(m.resultado)/parseFloat(m.meta)*100);
      const ganhou = p >= 100;
      const larg = Math.min(p,100);
      return `<div class="ranking-item">
        <div class="ranking-pos">${i+1}º</div>
        <div class="ranking-info">
          <strong>${turmaMap[m.turmaId]||'Turma'}</strong>
          <span>${labelSemana(m.semanaDomingo, m.semanaSabado)} — Meta: ${m.meta} | Resultado: ${m.resultado}</span>
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
  else    await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'fazendas'), { ...dados, criadoEm: new Date().toISOString() });
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
  const [snapT, snapF] = await Promise.all([window.fbFuncs.getDocs(q), window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))]);
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
  if (selF) Array.from(selF.options).forEach(o => { if (o.value) ops += `<option value="${o.value}" ${d?.fazendaId===o.value?'selected':''}>${o.text}</option>`; });
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
  else    await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'turmas'), { ...dados, criadoEm: new Date().toISOString() });
  fecharModal(); carregarTurmas();
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
    <div class="form-group"><label>Hora Início Jornada</label><input type="time" id="m-col-hi" value="${d?.inicioJornada||'08:00'}"/></div>
    <div class="form-group"><label>Hora Fim Jornada</label><input type="time" id="m-col-hf" value="${d?.fimJornada||'17:00'}"/></div>`,
    () => salvarColaborador(id));
}
async function salvarColaborador(id) {
  const chapa  = document.getElementById('m-col-chapa').value.trim();
  const nome   = document.getElementById('m-col-nome').value.trim();
  if (!chapa||!nome) { alert('Chapa e nome obrigatórios.'); return; }
  const dados = { chapa, nome,
    funcao:       document.getElementById('m-col-funcao').value.trim(),
    turmaId:      document.getElementById('m-col-turma').value,
    admissao:     document.getElementById('m-col-adm').value,
    inicioJornada:document.getElementById('m-col-hi').value,
    fimJornada:   document.getElementById('m-col-hf').value,
    atualizadoEm: new Date().toISOString()
  };
  if (id) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'colaboradores',id), dados);
  else    await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'colaboradores'), { ...dados, demitido:false, criadoEm:new Date().toISOString() });
  fecharModal(); carregarColaboradores();
}
async function editarColaborador(id) {
  const s = await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'colaboradores',id));
  abrirModalColaborador(id, s.data());
}

// ─────────────────────────────────────────────
// METAS — SELEÇÃO POR SEMANA (DOM → SÁB)
// ─────────────────────────────────────────────
async function carregarPaginaMetas() {
  await carregarFazendasSelects();
  // Preencher select de semanas (últimas 12 semanas + próximas 4)
  const hoje   = new Date();
  const inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 84); // 12 semanas atrás
  const fim    = new Date(hoje); fim.setDate(hoje.getDate() + 28);    // 4 semanas à frente
  const semanas = gerarSemanas(inicio.toISOString().split('T')[0], fim.toISOString().split('T')[0]);
  const sel = document.getElementById('meta-semana');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione a semana</option>';
    semanas.reverse().forEach(s => {
      sel.innerHTML += `<option value="${s.domingo}|${s.sabado}">${s.label}</option>`;
    });
  }
  carregarHistoricoMetas();
}

async function carregarTurmasMeta() {
  const fazendaId = document.getElementById('meta-fazenda').value;
  const sel = document.getElementById('meta-turma');
  sel.innerHTML = '<option value="">Selecione a turma</option>';
  if (!fazendaId) return;
  const q = window.fbFuncs.query(window.fbFuncs.collection(window.db,'turmas'), window.fbFuncs.where('fazendaId','==',fazendaId));
  const snap = await window.fbFuncs.getDocs(q);
  snap.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.data().nome}</option>`);
}

async function lancarMeta() {
  const turmaId  = document.getElementById('meta-turma').value;
  const semanaV  = document.getElementById('meta-semana').value;
  const meta     = document.getElementById('meta-valor').value;
  const resultado= document.getElementById('meta-resultado').value;
  const msg      = document.getElementById('meta-msg');
  msg.textContent = '';

  if (!turmaId||!semanaV||!meta) { alert('Selecione turma, semana e informe a meta.'); return; }

  const [domingo, sabado] = semanaV.split('|');

  // Verificar se já existe meta para essa turma/semana
  const q = window.fbFuncs.query(
    window.fbFuncs.collection(window.db,'metas'),
    window.fbFuncs.where('turmaId','==',turmaId),
    window.fbFuncs.where('semanaId','==',`${turmaId}_${domingo}`)
  );
  const snap = await window.fbFuncs.getDocs(q);

  const dados = {
    turmaId,
    semanaId:       `${turmaId}_${domingo}`,
    semanaDomingo:  domingo,
    semanaSabado:   sabado,
    meta:           parseFloat(meta),
    resultado:      resultado ? parseFloat(resultado) : null,
    lancadoPor:     window.usuarioLogado?.uid,
    atualizadoEm:   new Date().toISOString()
  };

  if (!snap.empty) {
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'metas',snap.docs[0].id), dados);
    msg.textContent = '✅ Meta atualizada!';
  } else {
    dados.criadoEm = new Date().toISOString();
    await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'metas'), dados);
    msg.textContent = '✅ Meta lançada!';
  }
  msg.style.color = '#2e8b57';
  carregarHistoricoMetas();
}

async function carregarHistoricoMetas() {
  const lista = document.getElementById('lista-metas');
  lista.innerHTML = 'Carregando...';
  const [snapM, snapT] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas'))
  ]);
  const turmaMap = {}; snapT.forEach(d => turmaMap[d.id] = d.data().nome);
  const metas = []; snapM.forEach(d => metas.push({ id:d.id,...d.data() }));
  metas.sort((a,b) => (b.semanaDomingo||'').localeCompare(a.semanaDomingo||''));
  if (metas.length===0) { lista.innerHTML='<p style="color:#888">Nenhuma meta lançada.</p>'; return; }
  lista.innerHTML = `<table>
    <tr><th>Turma</th><th>Semana</th><th>Meta</th><th>Resultado</th><th>Status</th></tr>
    ${metas.map(m => {
      const ganhou = m.resultado!=null && parseFloat(m.resultado)>=parseFloat(m.meta);
      const status = m.resultado!=null
        ? `<span class="badge badge-${ganhou?'verde':'vermelho'}">${ganhou?'✅ Atingiu':'❌ Não atingiu'}</span>`
        : '<span class="badge badge-amarelo">⏳ Aguardando</span>';
      return `<tr>
        <td>${turmaMap[m.turmaId]||'—'}</td>
        <td style="font-size:12px">${labelSemana(m.semanaDomingo,m.semanaSabado)}</td>
        <td>${m.meta}</td>
        <td>${m.resultado??'—'}</td>
        <td>${status}</td>
      </tr>`;
    }).join('')}
  </table>`;
}

// ─────────────────────────────────────────────
// CONTROLE DE SÁBADOS
// ─────────────────────────────────────────────
async function carregarPaginaSabados() {
  await carregarFazendasSelects();
  // Preencher turmas
  const sel = document.getElementById('sabado-turma');
  sel.innerHTML = '<option value="">Selecione a turma</option>';
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas'));
  snap.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.data().nome}</option>`);
}

async function carregarControleSabado() {
  const turmaId = document.getElementById('sabado-turma').value;
  const dataStr = document.getElementById('sabado-data').value;
  const painel  = document.getElementById('painel-sabado');

  if (!turmaId||!dataStr) { painel.style.display='none'; return; }

  // Garantir que é sábado
  const d = new Date(dataStr+'T12:00:00');
  if (d.getDay()!==6) {
    document.getElementById('sabado-status').innerHTML =
      '<span style="color:#e53e3e">⚠️ Selecione um sábado (a data escolhida não é sábado).</span>';
    painel.style.display='block';
    document.getElementById('lista-sabado').innerHTML='';
    document.getElementById('btn-salvar-presenca').style.display='none';
    return;
  }

  painel.style.display='block';
  const domingo = domingoSemana(dataStr);

  // Buscar meta da semana para essa turma
  const qMeta = window.fbFuncs.query(
    window.fbFuncs.collection(window.db,'metas'),
    window.fbFuncs.where('semanaId','==',`${turmaId}_${domingo}`)
  );
  const snapMeta = await window.fbFuncs.getDocs(qMeta);

  let turmaGanhou = false;
  let statusHTML  = '⚠️ Nenhuma meta lançada para a semana deste sábado.';

  if (!snapMeta.empty) {
    const meta = snapMeta.docs[0].data();
    if (meta.resultado!=null) {
      turmaGanhou = parseFloat(meta.resultado)>=parseFloat(meta.meta);
      statusHTML = turmaGanhou
        ? `✅ <strong>Turma ATINGIU a meta!</strong> Meta: ${meta.meta} | Resultado: ${meta.resultado}<br>
           <small>Semana: ${labelSemana(meta.semanaDomingo,meta.semanaSabado)}</small><br>
           Marque abaixo quem <strong>trabalhou neste sábado</strong>.`
        : `❌ <strong>Turma NÃO atingiu</strong> a meta. Meta: ${meta.meta} | Resultado: ${meta.resultado}`;
    } else {
      statusHTML = `⏳ Meta lançada (${meta.meta}), mas o resultado ainda não foi informado.`;
    }
  }

  document.getElementById('sabado-status').innerHTML = statusHTML;
  document.getElementById('btn-salvar-presenca').style.display = turmaGanhou ? 'block' : 'none';

  // Colaboradores da turma
  const qColab = window.fbFuncs.query(
    window.fbFuncs.collection(window.db,'colaboradores'),
    window.fbFuncs.where('turmaId','==',turmaId),
    window.fbFuncs.where('demitido','==',false)
  );
  const snapColab = await window.fbFuncs.getDocs(qColab);

  // Presenças já salvas
  const qPres = window.fbFuncs.query(
    window.fbFuncs.collection(window.db,'presencas'),
    window.fbFuncs.where('turmaId','==',turmaId),
    window.fbFuncs.where('data','==',dataStr)
  );
  const snapPres = await window.fbFuncs.getDocs(qPres);
  const presMap = {}; snapPres.forEach(d => presMap[d.data().colaboradorId]=d.data().presente);

  const lista = document.getElementById('lista-sabado');
  if (snapColab.empty) { lista.innerHTML='<p style="color:#888">Nenhum colaborador nesta turma.</p>'; return; }

  lista.innerHTML = snapColab.docs.map(d => {
    const c = d.data();
    const checked   = presMap[d.id] ? 'checked' : '';
    const disabled  = !turmaGanhou ? 'disabled' : '';
    return `<div class="item-presenca">
      <label>
        <input type="checkbox" id="pres-${d.id}" ${checked} ${disabled}/>
        ${c.nome} <small style="color:#999">#${c.chapa}</small>
      </label>
    </div>`;
  }).join('');

  window._sabadoColab  = snapColab.docs.map(d => ({ id:d.id,...d.data() }));
  window._sabadoData   = dataStr;
  window._sabadoTurma  = turmaId;
}

async function salvarPresenca() {
  const colab  = window._sabadoColab||[];
  const data   = window._sabadoData;
  const turmaId= window._sabadoTurma;
  for (const c of colab) {
    const chk = document.getElementById('pres-'+c.id);
    if (!chk) continue;
    const qP = window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'presencas'),
      window.fbFuncs.where('colaboradorId','==',c.id),
      window.fbFuncs.where('data','==',data)
    );
    const sp = await window.fbFuncs.getDocs(qP);
    const dados = { colaboradorId:c.id, turmaId, data, presente:chk.checked, atualizadoEm:new Date().toISOString() };
    if (!sp.empty) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'presencas',sp.docs[0].id), dados);
    else           await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'presencas'), { ...dados, criadoEm:new Date().toISOString() });
  }
  alert('✅ Presenças salvas!');
}

// ─────────────────────────────────────────────
// PREMIAÇÃO — DUAS LISTAS
// ─────────────────────────────────────────────
async function carregarPaginaPremiacao() {
  await carregarFazendasSelects();
  // Preencher semanas disponíveis
  const snapM = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas'));
  const semanas = new Map();
  snapM.forEach(d => {
    const m = d.data();
    if (m.semanaDomingo) semanas.set(m.semanaDomingo, { domingo:m.semanaDomingo, sabado:m.semanaSabado });
  });
  const sel = document.getElementById('premio-semana');
  if (sel) {
    sel.innerHTML = '<option value="">Todas as semanas</option>';
    [...semanas.values()]
      .sort((a,b) => b.domingo.localeCompare(a.domingo))
      .forEach(s => sel.innerHTML += `<option value="${s.domingo}|${s.sabado}">${labelSemana(s.domingo,s.sabado)}</option>`);
  }
  filtrarPremiacao();
}

async function filtrarPremiacao() {
  const fazendaId = document.getElementById('premio-fazenda')?.value||'';
  const semanaV   = document.getElementById('premio-semana')?.value||'';
  const listaA    = document.getElementById('lista-conquistaram');
  const listaB    = document.getElementById('lista-trabalharam');
  if (listaA) listaA.innerHTML = 'Carregando...';
  if (listaB) listaB.innerHTML = 'Carregando...';

  // Buscar metas com resultado atingido
  let qMetas = window.fbFuncs.collection(window.db,'metas');
  if (semanaV) {
    const [dom] = semanaV.split('|');
    qMetas = window.fbFuncs.query(qMetas, window.fbFuncs.where('semanaDomingo','==',dom));
  }
  const snapMetas = await window.fbFuncs.getDocs(qMetas);
  const turmasGanharam = new Set();
  const metaMap = {};
  snapMetas.forEach(d => {
    const m = d.data();
    if (m.resultado!=null && parseFloat(m.resultado)>=parseFloat(m.meta)) {
      turmasGanharam.add(m.turmaId);
      metaMap[m.turmaId] = m;
    }
  });

  if (turmasGanharam.size===0) {
    if (listaA) listaA.innerHTML='<p style="color:#888">Nenhuma turma atingiu a meta no período selecionado.</p>';
    if (listaB) listaB.innerHTML='<p style="color:#888">—</p>';
    atualizarContadores(0,0);
    return;
  }

  // Buscar colaboradores dessas turmas
  const [snapC, snapT, snapF] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))
  ]);
  const colabMap = {}; snapC.forEach(d => colabMap[d.id] = { id:d.id,...d.data() });
  const turmaMap = {}; snapT.forEach(d => turmaMap[d.id] = d.data());
  const fazMap   = {}; snapF.forEach(d => fazMap[d.id]   = d.data().nome);

  // Colaboradores de turmas que ganharam (Lista A — conquistaram)
  let conquistaram = Object.values(colabMap).filter(c =>
    turmasGanharam.has(c.turmaId) && !c.demitido
  );
  if (fazendaId) conquistaram = conquistaram.filter(c => turmaMap[c.turmaId]?.fazendaId===fazendaId);

  // Buscar presenças no sábado da semana selecionada
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
    // Sem filtro de semana: buscar todas as presenças
    const qPres = window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'presencas'),
      window.fbFuncs.where('presente','==',true)
    );
    const snapPres = await window.fbFuncs.getDocs(qPres);
    snapPres.forEach(d => presencasMap[d.data().colaboradorId] = true);
  }

  // Lista B — conquistaram E trabalharam no sábado
  const trabalharam = conquistaram.filter(c => presencasMap[c.id]);

  // Renderizar Lista A
  if (listaA) {
    if (conquistaram.length===0) {
      listaA.innerHTML='<p style="color:#888">Nenhum colaborador encontrado.</p>';
    } else {
      listaA.innerHTML = conquistaram.map(c => {
        const t = turmaMap[c.turmaId];
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

  // Renderizar Lista B
  if (listaB) {
    if (trabalharam.length===0) {
      listaB.innerHTML='<p style="color:#888">Nenhum colaborador confirmado no sábado ainda.</p>';
    } else {
      listaB.innerHTML = trabalharam.map(c => {
        const t = turmaMap[c.turmaId];
        const meta = metaMap[c.turmaId];
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

  atualizarContadores(conquistaram.length, trabalharam.length);
}

function atualizarContadores(a, b) {
  const ca = document.getElementById('count-conquistaram');
  const cb = document.getElementById('count-trabalharam');
  if (ca) ca.textContent = a;
  if (cb) cb.textContent = b;
}

// ─────────────────────────────────────────────
// EXPORTAÇÃO
// ─────────────────────────────────────────────
async function carregarPaginaExportar() {
  await carregarFazendasSelects();
  // Preencher semanas
  const snapM = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas'));
  const semanas = new Map();
  snapM.forEach(d => {
    const m = d.data();
    if (m.semanaDomingo) semanas.set(m.semanaDomingo, { domingo:m.semanaDomingo, sabado:m.semanaSabado });
  });
  const sel = document.getElementById('exp-semana');
  if (sel) {
    sel.innerHTML = '<option value="">Todas as semanas</option>';
    [...semanas.values()]
      .sort((a,b) => b.domingo.localeCompare(a.domingo))
      .forEach(s => sel.innerHTML += `<option value="${s.domingo}|${s.sabado}">${labelSemana(s.domingo,s.sabado)}</option>`);
  }
}

async function exportarTXT() {
  const msg         = document.getElementById('exp-msg');
  msg.textContent   = 'Gerando...';
  const fazendaId   = document.getElementById('exp-fazenda').value;
  const semanaV     = document.getElementById('exp-semana').value;
  const chapaGerador= document.getElementById('exp-chapa-gerador').value.trim();
  const horaIni     = document.getElementById('exp-hora-ini').value||'08:00';
  const horaFim     = document.getElementById('exp-hora-fim').value||'17:00';

  if (!chapaGerador) { msg.textContent='⚠️ Informe a chapa do gerador.'; msg.style.color='#e53e3e'; return; }

  // Apenas quem conquistou E trabalhou
  const registros = await buscarPremiados(fazendaId, semanaV);
  if (registros.length===0) { msg.textContent='⚠️ Nenhum registro encontrado.'; msg.style.color='#e53e3e'; return; }

  const linhas = registros.map(r => {
    const chapa6   = padZeros(r.chapa, 6);
    const gerador6 = padZeros(chapaGerador, 6);
    return `${chapa6};${formatarData(r.dataSabado)};0034;${horaIni};${horaFim};0;${gerador6};0;1;1;FOLGA PREMIO`;
  });

  const blob = new Blob([linhas.join('\n')], { type:'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download='premiacao.txt'; a.click();
  msg.textContent = `✅ ${linhas.length} registros exportados!`;
  msg.style.color = '#2e8b57';
}

async function exportarCSV() {
  const msg       = document.getElementById('exp-msg');
  msg.textContent = 'Gerando planilha...';
  const fazendaId = document.getElementById('exp-fazenda').value;
  const semanaV   = document.getElementById('exp-semana').value;

  const registros = await buscarPremiados(fazendaId, semanaV);
  if (registros.length===0) { msg.textContent='⚠️ Nenhum registro.'; msg.style.color='#e53e3e'; return; }

  const cab   = 'CHAPA;NOME;FUNÇÃO;TURMA;FAZENDA;SEMANA;DATA SÁBADO;STATUS\n';
  const linhas= registros.map(r =>
    `${r.chapa};${r.nome};${r.funcao||''};${r.turmaNome};${r.fazNome};${r.semana};${formatarData(r.dataSabado)};PREMIADO`
  );
  const blob = new Blob(['\uFEFF'+cab+linhas.join('\n')], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download='premiacao.csv'; a.click();
  msg.textContent = `✅ ${linhas.length} registros exportados!`;
  msg.style.color = '#2e8b57';
}

// Buscar premiados (conquistaram E trabalharam)
async function buscarPremiados(fazendaId, semanaV) {
  // Metas atingidas
  let qMetas = window.fbFuncs.collection(window.db,'metas');
  if (semanaV) {
    const [dom] = semanaV.split('|');
    qMetas = window.fbFuncs.query(qMetas, window.fbFuncs.where('semanaDomingo','==',dom));
  }
  const snapMetas = await window.fbFuncs.getDocs(qMetas);
  const turmasGanharam = new Map(); // turmaId → meta
  snapMetas.forEach(d => {
    const m = d.data();
    if (m.resultado!=null && parseFloat(m.resultado)>=parseFloat(m.meta)) turmasGanharam.set(m.turmaId, m);
  });
  if (turmasGanharam.size===0) return [];

  // Presenças no sábado
  let qPres;
  if (semanaV) {
    const [,sab] = semanaV.split('|');
    qPres = window.fbFuncs.query(window.fbFuncs.collection(window.db,'presencas'),
      window.fbFuncs.where('data','==',sab), window.fbFuncs.where('presente','==',true));
  } else {
    qPres = window.fbFuncs.query(window.fbFuncs.collection(window.db,'presencas'), window.fbFuncs.where('presente','==',true));
  }
  const snapPres = await window.fbFuncs.getDocs(qPres);

  const [snapC, snapT, snapF] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))
  ]);
  const colabMap = {}; snapC.forEach(d => colabMap[d.id]={id:d.id,...d.data()});
  const turmaMap = {}; snapT.forEach(d => turmaMap[d.id]=d.data());
  const fazMap   = {}; snapF.forEach(d => fazMap[d.id]=d.data().nome);

  const resultado = [];
  snapPres.forEach(d => {
    const pres  = d.data();
    const colab = colabMap[pres.colaboradorId];
    if (!colab) return;
    if (!turmasGanharam.has(colab.turmaId)) return;
    const turma = turmaMap[colab.turmaId];
    if (fazendaId && turma?.fazendaId!==fazendaId) return;
    const meta  = turmasGanharam.get(colab.turmaId);
    resultado.push({
      chapa:     colab.chapa,
      nome:      colab.nome,
      funcao:    colab.funcao||'',
      turmaNome: turma?.nome||'—',
      fazNome:   turma ? fazMap[turma.fazendaId]||'—' : '—',
      semana:    labelSemana(meta.semanaDomingo, meta.semanaSabado),
      dataSabado:meta.semanaSabado
    });
  });
  return resultado;
}

// ─────────────────────────────────────────────
// ADMINISTRAÇÃO
// ─────────────────────────────────────────────
async function carregarAdmin() {
  const qP = window.fbFuncs.query(window.fbFuncs.collection(window.db,'usuarios'), window.fbFuncs.where('aprovado','==',false));
  const snapP = await window.fbFuncs.getDocs(qP);
  const lP = document.getElementById('lista-pendentes');
  if (snapP.empty) { lP.innerHTML='<p style="color:#888">Nenhum usuário aguardando aprovação.</p>'; }
  else {
    lP.innerHTML = '';
    snapP.docs.forEach(d => {
      const u = d.data();
      lP.innerHTML += `<div class="item-card">
        <div class="item-card-info"><strong>${u.nome}</strong><span>Chapa: ${u.chapa} | ${u.email}</span></div>
        <div style="display:flex;gap:8px;align-items:center">
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
  alert('✅ Usuário aprovado!'); carregarAdmin();
}
async function alterarPerfil(uid, perfilAtual) {
  const novo = prompt('Novo perfil (lider/administrativo/encarregado/gestao/admin):', perfilAtual);
  if (!novo) return;
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'usuarios',uid), { perfil:novo });
  alert('✅ Perfil atualizado!'); carregarAdmin();
}
