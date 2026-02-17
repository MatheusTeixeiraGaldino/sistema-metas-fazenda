// ========================================
// NAVEGAÇÃO E UTILITÁRIOS
// ========================================

function mostrarLogin() {
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.getElementById('app').style.display = 'none';
  document.getElementById('tela-login').classList.add('ativa');
  document.getElementById('tela-login').style.display = 'flex';
}

function mostrarCadastro() {
  document.getElementById('tela-login').classList.remove('ativa');
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-cadastro').classList.add('ativa');
  document.getElementById('tela-cadastro').style.display = 'flex';
}

function mostrarApp() {
  document.querySelectorAll('.tela').forEach(t => {
    t.classList.remove('ativa');
    t.style.display = 'none';
  });
  document.getElementById('app').style.display = 'block';
}

function irPara(pagina) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('ativa'));
  document.querySelectorAll('.menu-lateral li').forEach(l => l.classList.remove('ativo'));
  const pg = document.getElementById('pg-' + pagina);
  if (pg) pg.classList.add('ativa');
  document.querySelectorAll('.menu-lateral li').forEach(l => {
    if (l.getAttribute('onclick') && l.getAttribute('onclick').includes(pagina)) l.classList.add('ativo');
  });
  fecharMenu();
  // Carregar dados da página
  if (pagina === 'dashboard') carregarDashboard();
  if (pagina === 'fazendas') carregarFazendas();
  if (pagina === 'turmas') carregarTurmas();
  if (pagina === 'colaboradores') carregarColaboradores();
  if (pagina === 'metas') carregarPaginaMetas();
  if (pagina === 'sabados') carregarPaginaSabados();
  if (pagina === 'premiacao') carregarPaginaPremiacao();
  if (pagina === 'exportar') carregarPaginaExportar();
  if (pagina === 'admin') carregarAdmin();
}

function toggleMenu() {
  const menu = document.getElementById('menu-lateral');
  menu.classList.toggle('fechado');
}
function fecharMenu() {
  document.getElementById('menu-lateral').classList.add('fechado');
}

// Formatar data DD/MM/AAAA
function formatarData(dataStr) {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return d + '/' + m + '/' + y;
}

// Pegar sábado da semana de uma data
function proximoSabado(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  const dia = d.getDay();
  const diff = (6 - dia + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// Padding zeros
function padZeros(str, n) {
  return String(str).padStart(n, '0');
}

// Mostrar/fechar modal
function abrirModal(titulo, corpo, callbackSalvar) {
  document.getElementById('modal-titulo').textContent = titulo;
  document.getElementById('modal-corpo').innerHTML = corpo;
  document.getElementById('modal-btn-ok').onclick = callbackSalvar;
  document.getElementById('modal').style.display = 'flex';
}
function fecharModal() {
  document.getElementById('modal').style.display = 'none';
}

// ========================================
// AUTENTICAÇÃO
// ========================================

async function fazerLogin() {
  const chapa = document.getElementById('login-chapa').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erro = document.getElementById('login-erro');
  erro.textContent = '';

  if (!chapa || !senha) { erro.textContent = 'Preencha chapa e senha.'; return; }

  try {
    // Buscar e-mail pelo chapa
    const q = window.fbFuncs.query(
      window.fbFuncs.collection(window.db, 'usuarios'),
      window.fbFuncs.where('chapa', '==', chapa)
    );
    const snap = await window.fbFuncs.getDocs(q);
    if (snap.empty) { erro.textContent = 'Chapa não encontrada.'; return; }
    const emailUser = snap.docs[0].data().email;
    await window.fbFuncs.signInWithEmailAndPassword(window.auth, emailUser, senha);
  } catch (e) {
    console.error(e);
    erro.textContent = 'Chapa ou senha incorretos.';
  }
}

async function cadastrarUsuario() {
  const chapa = document.getElementById('cad-chapa').value.trim();
  const nome = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const senha2 = document.getElementById('cad-senha2').value;
  const erro = document.getElementById('cad-erro');
  const ok = document.getElementById('cad-ok');
  erro.textContent = ''; ok.textContent = '';

  if (!chapa || !nome || !email || !senha) { erro.textContent = 'Preencha todos os campos.'; return; }
  if (senha !== senha2) { erro.textContent = 'As senhas não coincidem.'; return; }
  if (senha.length < 6) { erro.textContent = 'A senha deve ter no mínimo 6 caracteres.'; return; }

  try {
    const cred = await window.fbFuncs.createUserWithEmailAndPassword(window.auth, email, senha);
    await window.fbFuncs.setDoc(window.fbFuncs.doc(window.db, 'usuarios', cred.user.uid), {
      chapa, nome, email, perfil: 'pendente', aprovado: false,
      criadoEm: new Date().toISOString()
    });
    await window.fbFuncs.signOut(window.auth);
    ok.textContent = '✅ Solicitação enviada! Aguarde aprovação do administrador.';
    setTimeout(() => mostrarLogin(), 3000);
  } catch (e) {
    console.error(e);
    if (e.code === 'auth/email-already-in-use') erro.textContent = 'E-mail já cadastrado.';
    else erro.textContent = 'Erro ao cadastrar: ' + e.message;
  }
}

async function sair() {
  await window.fbFuncs.signOut(window.auth);
}

// ========================================
// SELECTS GLOBAIS (FAZENDAS)
// ========================================

async function carregarFazendasSelects() {
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'fazendas'));
  const fazendas = [];
  snap.forEach(d => fazendas.push({ id: d.id, ...d.data() }));

  const selects = ['filtro-fazenda-turma', 'filtro-fazenda-colab', 'meta-fazenda',
                   'sabado-turma-fazenda', 'premio-fazenda', 'exp-fazenda'];

  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value;
    el.innerHTML = '<option value="">Todas as fazendas</option>';
    fazendas.forEach(f => {
      el.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
    });
    el.value = val;
  });

  // Selects que precisam de opção padrão diferente
  const selMeta = document.getElementById('meta-fazenda');
  if (selMeta) {
    selMeta.innerHTML = '<option value="">Selecione a fazenda</option>';
    fazendas.forEach(f => selMeta.innerHTML += `<option value="${f.id}">${f.nome}</option>`);
  }
}

// ========================================
// DASHBOARD
// ========================================

async function carregarDashboard() {
  try {
    const [snapTurmas, snapColab, snapMetas] = await Promise.all([
      window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'turmas')),
      window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'colaboradores')),
      window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'metas'))
    ]);

    const turmas = []; snapTurmas.forEach(d => turmas.push({ id: d.id, ...d.data() }));
    const metas = []; snapMetas.forEach(d => metas.push({ id: d.id, ...d.data() }));

    document.getElementById('dash-total-turmas').textContent = turmas.length;
    document.getElementById('dash-total-colab').textContent = snapColab.size;

    const metasComResultado = metas.filter(m => m.resultado !== undefined && m.resultado !== null);
    const metasAtingidas = metasComResultado.filter(m => parseFloat(m.resultado) >= parseFloat(m.meta));
    const pct = metasComResultado.length > 0 ? Math.round((metasAtingidas.length / metasComResultado.length) * 100) : 0;
    document.getElementById('dash-metas-atingidas').textContent = pct + '%';

    // Contar premiados
    const snapPres = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'presencas'));
    let premiados = 0;
    snapPres.forEach(d => { const data = d.data(); if (data.presente) premiados++; });
    document.getElementById('dash-premios').textContent = premiados;

    // Ranking
    const ranking = document.getElementById('ranking-turmas');
    if (metas.length === 0) { ranking.innerHTML = '<p style="color:#888">Nenhuma meta lançada.</p>'; return; }

    const turmaMap = {};
    turmas.forEach(t => turmaMap[t.id] = t.nome);

    const metasOrdenadas = metasComResultado.sort((a, b) => {
      const pctA = parseFloat(a.resultado) / parseFloat(a.meta);
      const pctB = parseFloat(b.resultado) / parseFloat(b.meta);
      return pctB - pctA;
    });

    ranking.innerHTML = metasOrdenadas.slice(0, 10).map((m, i) => {
      const pctM = Math.round((parseFloat(m.resultado) / parseFloat(m.meta)) * 100);
      const ganhou = pctM >= 100;
      const largura = Math.min(pctM, 100);
      return `
        <div class="ranking-item">
          <div class="ranking-pos">${i + 1}º</div>
          <div class="ranking-info">
            <strong>${turmaMap[m.turmaId] || 'Turma'}</strong>
            <span>${formatarData(m.data)} — Meta: ${m.meta} | Resultado: ${m.resultado}</span>
            <div class="barra-progresso"><div class="barra-fill ${ganhou ? '' : 'perdeu'}" style="width:${largura}%"></div></div>
          </div>
          <div class="ranking-pct ${ganhou ? 'ganhou' : 'perdeu'}">${pctM}%</div>
        </div>`;
    }).join('');
  } catch (e) { console.error(e); }
}

// ========================================
// FAZENDAS
// ========================================

async function carregarFazendas() {
  const lista = document.getElementById('lista-fazendas');
  lista.innerHTML = 'Carregando...';
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'fazendas'));
  if (snap.empty) { lista.innerHTML = '<p style="color:#888">Nenhuma fazenda cadastrada.</p>'; return; }
  lista.innerHTML = '';
  snap.forEach(d => {
    const f = d.data();
    lista.innerHTML += `
      <div class="item-card">
        <div class="item-card-info">
          <strong>${f.nome}</strong>
          <span>${f.endereco || ''}</span>
        </div>
        <div class="item-card-acoes">
          <button class="btn-primary btn-sm" onclick="editarFazenda('${d.id}')">✏️</button>
        </div>
      </div>`;
  });
}

function abrirModalFazenda(id, dadosAtuais) {
  const corpo = `
    <div class="form-group"><label>Nome da Fazenda</label><input id="m-faz-nome" value="${dadosAtuais?.nome || ''}" /></div>
    <div class="form-group"><label>Endereço / Localização</label><input id="m-faz-end" value="${dadosAtuais?.endereco || ''}" /></div>
  `;
  abrirModal(id ? 'Editar Fazenda' : 'Nova Fazenda', corpo, () => salvarFazenda(id));
}

async function salvarFazenda(id) {
  const nome = document.getElementById('m-faz-nome').value.trim();
  const endereco = document.getElementById('m-faz-end').value.trim();
  if (!nome) { alert('Informe o nome da fazenda.'); return; }
  const dados = { nome, endereco, atualizadoEm: new Date().toISOString() };
  if (id) {
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db, 'fazendas', id), dados);
  } else {
    dados.criadoEm = new Date().toISOString();
    await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db, 'fazendas'), dados);
  }
  fecharModal();
  carregarFazendas();
  carregarFazendasSelects();
}

async function editarFazenda(id) {
  const snap = await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db, 'fazendas', id));
  abrirModalFazenda(id, snap.data());
}

// ========================================
// TURMAS
// ========================================

async function carregarTurmas() {
  const lista = document.getElementById('lista-turmas');
  lista.innerHTML = 'Carregando...';
  const filtroFaz = document.getElementById('filtro-fazenda-turma')?.value || '';

  let q;
  if (filtroFaz) {
    q = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'turmas'),
      window.fbFuncs.where('fazendaId', '==', filtroFaz));
  } else {
    q = window.fbFuncs.collection(window.db, 'turmas');
  }

  const [snapTurmas, snapFazendas] = await Promise.all([
    window.fbFuncs.getDocs(q),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'fazendas'))
  ]);

  const fazMap = {};
  snapFazendas.forEach(d => fazMap[d.id] = d.data().nome);

  if (snapTurmas.empty) { lista.innerHTML = '<p style="color:#888">Nenhuma turma cadastrada.</p>'; return; }

  lista.innerHTML = '';
  snapTurmas.forEach(d => {
    const t = d.data();
    lista.innerHTML += `
      <div class="item-card">
        <div class="item-card-info">
          <strong>${t.nome}</strong>
          <span>🌿 ${fazMap[t.fazendaId] || 'Fazenda'} | 👤 Líder: ${t.liderNome || '—'}</span>
        </div>
        <div class="item-card-acoes">
          <button class="btn-primary btn-sm" onclick="editarTurma('${d.id}')">✏️</button>
        </div>
      </div>`;
  });
}

function abrirModalTurma(id, dadosAtuais) {
  let opsFazendas = '<option value="">Selecione a fazenda</option>';
  const selFaz = document.getElementById('filtro-fazenda-turma');
  if (selFaz) {
    Array.from(selFaz.options).forEach(o => {
      if (o.value) opsFazendas += `<option value="${o.value}" ${dadosAtuais?.fazendaId === o.value ? 'selected' : ''}>${o.text}</option>`;
    });
  }
  const corpo = `
    <div class="form-group"><label>Nome da Turma</label><input id="m-tur-nome" value="${dadosAtuais?.nome || ''}" /></div>
    <div class="form-group"><label>Fazenda</label><select id="m-tur-faz">${opsFazendas}</select></div>
    <div class="form-group"><label>Nome do Líder</label><input id="m-tur-lider" value="${dadosAtuais?.liderNome || ''}" /></div>
  `;
  abrirModal(id ? 'Editar Turma' : 'Nova Turma', corpo, () => salvarTurma(id));
}

async function salvarTurma(id) {
  const nome = document.getElementById('m-tur-nome').value.trim();
  const fazendaId = document.getElementById('m-tur-faz').value;
  const liderNome = document.getElementById('m-tur-lider').value.trim();
  if (!nome || !fazendaId) { alert('Informe nome e fazenda.'); return; }
  const dados = { nome, fazendaId, liderNome, atualizadoEm: new Date().toISOString() };
  if (id) {
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db, 'turmas', id), dados);
  } else {
    dados.criadoEm = new Date().toISOString();
    await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db, 'turmas'), dados);
  }
  fecharModal(); carregarTurmas();
}

async function editarTurma(id) {
  const snap = await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db, 'turmas', id));
  abrirModalTurma(id, snap.data());
}

// ========================================
// COLABORADORES
// ========================================

async function carregarColaboradores() {
  const lista = document.getElementById('lista-colaboradores');
  lista.innerHTML = 'Carregando...';
  const filtroFaz = document.getElementById('filtro-fazenda-colab')?.value || '';
  const filtroTurma = document.getElementById('filtro-turma-colab')?.value || '';
  const filtroNome = document.getElementById('filtro-nome-colab')?.value?.toLowerCase() || '';

  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'colaboradores'));

  const [snapTurmas, snapFazendas] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'turmas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'fazendas'))
  ]);

  const turmaMap = {}; snapTurmas.forEach(d => turmaMap[d.id] = d.data());
  const fazMap = {}; snapFazendas.forEach(d => fazMap[d.id] = d.data().nome);

  let colab = [];
  snap.forEach(d => colab.push({ id: d.id, ...d.data() }));

  if (filtroFaz) colab = colab.filter(c => turmaMap[c.turmaId]?.fazendaId === filtroFaz);
  if (filtroTurma) colab = colab.filter(c => c.turmaId === filtroTurma);
  if (filtroNome) colab = colab.filter(c =>
    c.nome?.toLowerCase().includes(filtroNome) || c.chapa?.toLowerCase().includes(filtroNome)
  );

  if (colab.length === 0) { lista.innerHTML = '<p style="color:#888">Nenhum colaborador encontrado.</p>'; return; }

  lista.innerHTML = '';
  colab.forEach(c => {
    const turma = turmaMap[c.turmaId];
    const fazNome = turma ? fazMap[turma.fazendaId] || '—' : '—';
    const status = c.demitido
      ? '<span class="badge badge-vermelho">Demitido</span>'
      : '<span class="badge badge-verde">Ativo</span>';
    lista.innerHTML += `
      <div class="item-card">
        <div class="item-card-info">
          <strong>${c.nome} <small style="color:#999">#${c.chapa}</small></strong>
          <span>🏘️ ${turma?.nome || '—'} | 🌿 ${fazNome} | ${c.funcao || ''}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${status}
          <button class="btn-primary btn-sm" onclick="editarColaborador('${c.id}')">✏️</button>
        </div>
      </div>`;
  });
}

function abrirModalColaborador(id, dadosAtuais) {
  let opsTurmas = '<option value="">Selecione a turma</option>';
  // Carrega turmas no select do modal
  window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'turmas')).then(snap => {
    snap.forEach(d => {
      opsTurmas += `<option value="${d.id}" ${dadosAtuais?.turmaId === d.id ? 'selected' : ''}>${d.data().nome}</option>`;
    });
    const sel = document.getElementById('m-col-turma');
    if (sel) sel.innerHTML = opsTurmas;
  });

  const corpo = `
    <div class="form-group"><label>Chapa</label><input id="m-col-chapa" value="${dadosAtuais?.chapa || ''}" /></div>
    <div class="form-group"><label>Nome</label><input id="m-col-nome" value="${dadosAtuais?.nome || ''}" /></div>
    <div class="form-group"><label>Função</label><input id="m-col-funcao" value="${dadosAtuais?.funcao || ''}" /></div>
    <div class="form-group"><label>Turma</label><select id="m-col-turma">${opsTurmas}</select></div>
    <div class="form-group"><label>Data Admissão</label><input type="date" id="m-col-admissao" value="${dadosAtuais?.admissao || ''}" /></div>
    <div class="form-group"><label>Hora Início (para TXT)</label><input type="time" id="m-col-hi" value="${dadosAtuais?.horaInicio || '08:00'}" /></div>
    <div class="form-group"><label>Hora Fim (para TXT)</label><input type="time" id="m-col-hf" value="${dadosAtuais?.horaFim || '17:00'}" /></div>
  `;
  abrirModal(id ? 'Editar Colaborador' : 'Novo Colaborador', corpo, () => salvarColaborador(id));
}

async function salvarColaborador(id) {
  const chapa = document.getElementById('m-col-chapa').value.trim();
  const nome = document.getElementById('m-col-nome').value.trim();
  const funcao = document.getElementById('m-col-funcao').value.trim();
  const turmaId = document.getElementById('m-col-turma').value;
  const admissao = document.getElementById('m-col-admissao').value;
  const horaInicio = document.getElementById('m-col-hi').value;
  const horaFim = document.getElementById('m-col-hf').value;

  if (!chapa || !nome) { alert('Chapa e nome são obrigatórios.'); return; }

  const dados = { chapa, nome, funcao, turmaId, admissao, horaInicio, horaFim, atualizadoEm: new Date().toISOString() };

  if (id) {
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db, 'colaboradores', id), dados);
  } else {
    dados.criadoEm = new Date().toISOString(); dados.demitido = false;
    await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db, 'colaboradores'), dados);
  }
  fecharModal(); carregarColaboradores();
}

async function editarColaborador(id) {
  const snap = await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db, 'colaboradores', id));
  abrirModalColaborador(id, snap.data());
}

// ========================================
// METAS
// ========================================

async function carregarPaginaMetas() {
  await carregarFazendasSelects();
  carregarHistoricoMetas();
}

async function carregarTurmasMeta() {
  const fazendaId = document.getElementById('meta-fazenda').value;
  const sel = document.getElementById('meta-turma');
  sel.innerHTML = '<option value="">Selecione a turma</option>';
  if (!fazendaId) return;
  const q = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'turmas'),
    window.fbFuncs.where('fazendaId', '==', fazendaId));
  const snap = await window.fbFuncs.getDocs(q);
  snap.forEach(d => sel.innerHTML += `<option value="${d.id}">${d.data().nome}</option>`);
}

async function lancarMeta() {
  const turmaId = document.getElementById('meta-turma').value;
  const data = document.getElementById('meta-data').value;
  const meta = document.getElementById('meta-valor').value;
  const resultado = document.getElementById('meta-resultado').value;
  const msg = document.getElementById('meta-msg');
  msg.textContent = '';

  if (!turmaId || !data || !meta) { alert('Preencha turma, data e meta.'); return; }

  // Verificar se já existe meta para essa turma/data
  const q = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'metas'),
    window.fbFuncs.where('turmaId', '==', turmaId),
    window.fbFuncs.where('data', '==', data));
  const snap = await window.fbFuncs.getDocs(q);

  const dados = {
    turmaId, data, meta: parseFloat(meta),
    resultado: resultado ? parseFloat(resultado) : null,
    lancadoPor: window.usuarioLogado?.uid,
    atualizadoEm: new Date().toISOString()
  };

  if (!snap.empty) {
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db, 'metas', snap.docs[0].id), dados);
    msg.textContent = '✅ Meta atualizada com sucesso!';
  } else {
    dados.criadoEm = new Date().toISOString();
    await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db, 'metas'), dados);
    msg.textContent = '✅ Meta lançada com sucesso!';
  }
  carregarHistoricoMetas();
}

async function carregarHistoricoMetas() {
  const lista = document.getElementById('lista-metas');
  lista.innerHTML = 'Carregando...';
  const [snapMetas, snapTurmas] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'metas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'turmas'))
  ]);
  const turmaMap = {}; snapTurmas.forEach(d => turmaMap[d.id] = d.data().nome);
  const metas = []; snapMetas.forEach(d => metas.push({ id: d.id, ...d.data() }));
  metas.sort((a, b) => b.data?.localeCompare(a.data));

  if (metas.length === 0) { lista.innerHTML = '<p style="color:#888">Nenhuma meta lançada.</p>'; return; }

  lista.innerHTML = '<table><tr><th>Turma</th><th>Data</th><th>Meta</th><th>Resultado</th><th>Status</th></tr>' +
    metas.map(m => {
      const ganhou = m.resultado !== null && m.resultado !== undefined && parseFloat(m.resultado) >= parseFloat(m.meta);
      const status = m.resultado !== null && m.resultado !== undefined
        ? `<span class="badge badge-${ganhou ? 'verde' : 'vermelho'}">${ganhou ? '✅ Atingiu' : '❌ Não atingiu'}</span>`
        : '<span class="badge badge-amarelo">Aguardando resultado</span>';
      return `<tr><td>${turmaMap[m.turmaId] || '—'}</td><td>${formatarData(m.data)}</td><td>${m.meta}</td><td>${m.resultado ?? '—'}</td><td>${status}</td></tr>`;
    }).join('') + '</table>';
}

// ========================================
// SÁBADOS / PRESENÇA
// ========================================

async function carregarPaginaSabados() {
  await carregarFazendasSelects();
  const selTurma = document.getElementById('sabado-turma');
  selTurma.innerHTML = '<option value="">Selecione a turma</option>';
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'turmas'));
  snap.forEach(d => selTurma.innerHTML += `<option value="${d.id}">${d.data().nome}</option>`);
}

async function carregarControle() {
  const data = document.getElementById('sabado-data').value;
  const turmaId = document.getElementById('sabado-turma').value;
  const painel = document.getElementById('painel-sabado');

  if (!data || !turmaId) { painel.style.display = 'none'; return; }

  painel.style.display = 'block';

  // Buscar meta para verificar se turma ganhou
  const qMeta = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'metas'),
    window.fbFuncs.where('turmaId', '==', turmaId),
    window.fbFuncs.where('data', '==', data));
  const snapMeta = await window.fbFuncs.getDocs(qMeta);

  let turmaGanhou = false;
  let statusTexto = '⚠️ Nenhuma meta lançada para esta data.';

  if (!snapMeta.empty) {
    const meta = snapMeta.docs[0].data();
    if (meta.resultado !== null && meta.resultado !== undefined) {
      turmaGanhou = parseFloat(meta.resultado) >= parseFloat(meta.meta);
      statusTexto = turmaGanhou
        ? `✅ Turma ATINGIU a meta! (Meta: ${meta.meta} | Resultado: ${meta.resultado}) — Marque quem trabalhou.`
        : `❌ Turma NÃO atingiu a meta. (Meta: ${meta.meta} | Resultado: ${meta.resultado})`;
    } else {
      statusTexto = `⏳ Meta lançada (${meta.meta}), aguardando resultado.`;
    }
  }

  document.getElementById('sabado-status').innerHTML = statusTexto;
  document.getElementById('btn-salvar-presenca').style.display = turmaGanhou ? 'block' : 'none';

  // Buscar colaboradores da turma
  const qColab = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'colaboradores'),
    window.fbFuncs.where('turmaId', '==', turmaId),
    window.fbFuncs.where('demitido', '==', false));
  const snapColab = await window.fbFuncs.getDocs(qColab);

  // Buscar presenças já salvas
  const qPres = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'presencas'),
    window.fbFuncs.where('turmaId', '==', turmaId),
    window.fbFuncs.where('data', '==', data));
  const snapPres = await window.fbFuncs.getDocs(qPres);
  const presMap = {};
  snapPres.forEach(d => presMap[d.data().colaboradorId] = d.data().presente);

  const lista = document.getElementById('lista-sabado');
  if (snapColab.empty) { lista.innerHTML = '<p style="color:#888">Nenhum colaborador nesta turma.</p>'; return; }

  lista.innerHTML = snapColab.docs.map(d => {
    const c = d.data();
    const checked = presMap[d.id] ? 'checked' : '';
    const disabled = !turmaGanhou ? 'disabled' : '';
    return `
      <div class="item-presenca">
        <label>
          <input type="checkbox" id="pres-${d.id}" ${checked} ${disabled} />
          ${c.nome} <small style="color:#999">#${c.chapa}</small>
        </label>
      </div>`;
  }).join('');

  window._sabadoColabIds = snapColab.docs.map(d => ({ id: d.id, ...d.data() }));
  window._sabadoData = data;
  window._sabadoTurmaId = turmaId;
}

async function salvarPresenca() {
  const colab = window._sabadoColabIds || [];
  const data = window._sabadoData;
  const turmaId = window._sabadoTurmaId;

  for (const c of colab) {
    const checkbox = document.getElementById('pres-' + c.id);
    if (!checkbox) continue;
    const presente = checkbox.checked;

    const qPres = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'presencas'),
      window.fbFuncs.where('colaboradorId', '==', c.id),
      window.fbFuncs.where('data', '==', data));
    const snapPres = await window.fbFuncs.getDocs(qPres);

    const dados = { colaboradorId: c.id, turmaId, data, presente, atualizadoEm: new Date().toISOString() };
    if (!snapPres.empty) {
      await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db, 'presencas', snapPres.docs[0].id), dados);
    } else {
      dados.criadoEm = new Date().toISOString();
      await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db, 'presencas'), dados);
    }
  }
  alert('✅ Presenças salvas com sucesso!');
}

// ========================================
// PREMIAÇÃO
// ========================================

async function carregarPaginaPremiacao() {
  await carregarFazendasSelects();
  // Carregar períodos disponíveis
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'metas'));
  const datas = new Set();
  snap.forEach(d => { if (d.data().data) datas.add(d.data().data); });
  const sel = document.getElementById('premio-periodo');
  sel.innerHTML = '<option value="">Todos os períodos</option>';
  [...datas].sort().reverse().forEach(d => sel.innerHTML += `<option value="${d}">${formatarData(d)}</option>`);
}

async function filtrarPremiacao() {
  const lista = document.getElementById('lista-premiacao');
  lista.innerHTML = 'Carregando...';
  const fazendaId = document.getElementById('premio-fazenda').value;
  const periodo = document.getElementById('premio-periodo').value;

  // Buscar presenças marcadas
  let qPres = window.fbFuncs.collection(window.db, 'presencas');
  if (periodo) {
    qPres = window.fbFuncs.query(qPres, window.fbFuncs.where('data', '==', periodo), window.fbFuncs.where('presente', '==', true));
  } else {
    qPres = window.fbFuncs.query(qPres, window.fbFuncs.where('presente', '==', true));
  }
  const snapPres = await window.fbFuncs.getDocs(qPres);

  if (snapPres.empty) { lista.innerHTML = '<p style="color:#888">Nenhum premiado encontrado.</p>'; return; }

  const colabIds = [...new Set(snapPres.docs.map(d => d.data().colaboradorId))];

  const [snapColab, snapTurmas, snapFaz] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'turmas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'fazendas'))
  ]);

  const colabMap = {}; snapColab.forEach(d => colabMap[d.id] = d.data());
  const turmaMap = {}; snapTurmas.forEach(d => turmaMap[d.id] = d.data());
  const fazMap = {}; snapFaz.forEach(d => fazMap[d.id] = d.data().nome);

  lista.innerHTML = '';
  snapPres.docs.forEach(d => {
    const pres = d.data();
    const colab = colabMap[pres.colaboradorId];
    if (!colab) return;
    const turma = turmaMap[colab.turmaId];
    if (fazendaId && turma?.fazendaId !== fazendaId) return;
    const fazNome = turma ? fazMap[turma.fazendaId] || '—' : '—';

    lista.innerHTML += `
      <div class="item-card">
        <div class="item-card-info">
          <strong>${colab.nome} <small style="color:#999">#${colab.chapa}</small></strong>
          <span>📅 ${formatarData(pres.data)} | 🏘️ ${turma?.nome || '—'} | 🌿 ${fazNome}</span>
        </div>
        <span class="badge badge-verde">🏆 Premiado</span>
      </div>`;
  });
  if (lista.innerHTML === '') lista.innerHTML = '<p style="color:#888">Nenhum premiado com esses filtros.</p>';
}

// ========================================
// EXPORTAÇÃO
// ========================================

async function carregarPaginaExportar() {
  await carregarFazendasSelects();
}

async function exportarTXT() {
  const msg = document.getElementById('exp-msg');
  msg.textContent = 'Gerando arquivo...';

  const fazendaId = document.getElementById('exp-fazenda').value;
  const dataIni = document.getElementById('exp-data-ini').value;
  const dataFim = document.getElementById('exp-data-fim').value;
  const chapaGerador = document.getElementById('exp-chapa-gerador').value.trim();
  const horaIni = document.getElementById('exp-hora-ini').value || '08:00';
  const horaFim = document.getElementById('exp-hora-fim').value || '17:00';

  if (!chapaGerador) { msg.textContent = '⚠️ Informe a chapa do gerador.'; return; }

  // Buscar presenças com presente = true
  let q = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'presencas'),
    window.fbFuncs.where('presente', '==', true));
  const snapPres = await window.fbFuncs.getDocs(q);

  const [snapColab, snapTurmas] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'turmas'))
  ]);

  const colabMap = {}; snapColab.forEach(d => colabMap[d.id] = d.data());
  const turmaMap = {}; snapTurmas.forEach(d => turmaMap[d.id] = d.data());

  let linhas = [];
  snapPres.docs.forEach(d => {
    const pres = d.data();
    if (dataIni && pres.data < dataIni) return;
    if (dataFim && pres.data > dataFim) return;

    const colab = colabMap[pres.colaboradorId];
    if (!colab || !colab.chapa) return;

    const turma = turmaMap[colab.turmaId];
    if (fazendaId && turma?.fazendaId !== fazendaId) return;

    const chapa6 = padZeros(colab.chapa, 6);
    const gerador6 = padZeros(chapaGerador, 6);
    const dataFormatada = formatarData(pres.data);

    linhas.push(`${chapa6};${dataFormatada};0034;${horaIni};${horaFim};0;${gerador6};0;1;1;FOLGA PREMIO`);
  });

  if (linhas.length === 0) { msg.textContent = '⚠️ Nenhum registro encontrado com esses filtros.'; return; }

  const conteudo = linhas.join('\n');
  const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'premiacao.txt'; a.click();
  URL.revokeObjectURL(url);
  msg.textContent = `✅ Arquivo gerado com ${linhas.length} registros!`;
}

async function exportarXLSX() {
  const msg = document.getElementById('exp-msg');
  msg.textContent = 'Gerando planilha...';

  const fazendaId = document.getElementById('exp-fazenda').value;
  const dataIni = document.getElementById('exp-data-ini').value;
  const dataFim = document.getElementById('exp-data-fim').value;

  let q = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'presencas'),
    window.fbFuncs.where('presente', '==', true));
  const snapPres = await window.fbFuncs.getDocs(q);

  const [snapColab, snapTurmas, snapFaz] = await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'turmas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'fazendas'))
  ]);

  const colabMap = {}; snapColab.forEach(d => colabMap[d.id] = d.data());
  const turmaMap = {}; snapTurmas.forEach(d => turmaMap[d.id] = d.data());
  const fazMap = {}; snapFaz.forEach(d => fazMap[d.id] = d.data().nome);

  let cabecalho = 'CHAPA;NOME;FUNÇÃO;TURMA;FAZENDA;DATA SÁBADO;STATUS\n';
  let linhas = [];

  snapPres.docs.forEach(d => {
    const pres = d.data();
    if (dataIni && pres.data < dataIni) return;
    if (dataFim && pres.data > dataFim) return;
    const colab = colabMap[pres.colaboradorId];
    if (!colab) return;
    const turma = turmaMap[colab.turmaId];
    if (fazendaId && turma?.fazendaId !== fazendaId) return;
    const fazNome = turma ? fazMap[turma.fazendaId] || '' : '';
    linhas.push(`${colab.chapa};${colab.nome};${colab.funcao || ''};${turma?.nome || ''};${fazNome};${formatarData(pres.data)};PREMIADO`);
  });

  if (linhas.length === 0) { msg.textContent = '⚠️ Nenhum registro encontrado.'; return; }

  const conteudo = '\uFEFF' + cabecalho + linhas.join('\n');
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'premiacao.csv'; a.click();
  URL.revokeObjectURL(url);
  msg.textContent = `✅ Planilha gerada com ${linhas.length} registros!`;
}

// ========================================
// ADMINISTRAÇÃO
// ========================================

async function carregarAdmin() {
  // Listar usuários pendentes
  const qPendente = window.fbFuncs.query(window.fbFuncs.collection(window.db, 'usuarios'),
    window.fbFuncs.where('aprovado', '==', false));
  const snapPend = await window.fbFuncs.getDocs(qPendente);

  const listaPend = document.getElementById('lista-pendentes');
  if (snapPend.empty) {
    listaPend.innerHTML = '<p style="color:#888">Nenhum usuário aguardando aprovação.</p>';
  } else {
    listaPend.innerHTML = '';
    snapPend.docs.forEach(d => {
      const u = d.data();
      listaPend.innerHTML += `
        <div class="item-card">
          <div class="item-card-info">
            <strong>${u.nome}</strong>
            <span>Chapa: ${u.chapa} | ${u.email}</span>
          </div>
          <div style="display:flex;gap:8px">
            <select id="perfil-${d.id}" style="padding:6px;border-radius:6px;border:1px solid #ddd">
              <option value="lider">Líder</option>
              <option value="administrativo">Administrativo</option>
              <option value="encarregado">Encarregado</option>
              <option value="gestao">Gestão</option>
              <option value="admin">Admin</option>
            </select>
            <button class="btn-primary btn-sm" onclick="aprovarUsuario('${d.id}')">✅ Aprovar</button>
          </div>
        </div>`;
    });
  }

  // Listar todos os usuários
  const snapTodos = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db, 'usuarios'));
  const listaUsuarios = document.getElementById('lista-usuarios');
  listaUsuarios.innerHTML = '<table><tr><th>Nome</th><th>Chapa</th><th>Perfil</th><th>Status</th><th>Ação</th></tr>';
  snapTodos.docs.forEach(d => {
    const u = d.data();
    const status = u.aprovado
      ? '<span class="badge badge-verde">Aprovado</span>'
      : '<span class="badge badge-amarelo">Pendente</span>';
    listaUsuarios.innerHTML += `<tr>
      <td>${u.nome}</td>
      <td>${u.chapa}</td>
      <td>${u.perfil}</td>
      <td>${status}</td>
      <td><button class="btn-secondary btn-sm" onclick="alterarPerfil('${d.id}', '${u.perfil}')">✏️</button></td>
    </tr>`;
  });
  listaUsuarios.innerHTML += '</table>';
}

async function aprovarUsuario(uid) {
  const perfil = document.getElementById('perfil-' + uid)?.value || 'lider';
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db, 'usuarios', uid), {
    aprovado: true, perfil, aprovadoPor: window.usuarioLogado?.uid,
    aprovadoEm: new Date().toISOString()
  });
  alert('✅ Usuário aprovado!');
  carregarAdmin();
}

async function alterarPerfil(uid, perfilAtual) {
  const novoPerfil = prompt('Novo perfil (lider / administrativo / encarregado / gestao / admin):', perfilAtual);
  if (!novoPerfil) return;
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db, 'usuarios', uid), { perfil: novoPerfil });
  alert('✅ Perfil atualizado!');
  carregarAdmin();
}
