// =============================================
// HISTÓRICO DO COLABORADOR + SOLICITAÇÕES
// =============================================

let usuarioAtual  = null;
let colabAtual    = null;
let turmasCache   = {};

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
async function login() {
  const chapa = document.getElementById('lc').value.trim();
  const senha = document.getElementById('ls').value;
  const erro  = document.getElementById('le');
  erro.textContent = '';
  try {
    const q = window._fb.query(
      window._fb.collection(window._db, 'usuarios'),
      window._fb.where('chapa', '==', chapa)
    );
    const snap = await window._fb.getDocs(q);
    if (snap.empty) { erro.textContent = 'Chapa não encontrada.'; return; }
    const u = snap.docs[0].data();
    await window._fb.signInWithEmailAndPassword(window._auth, u.email, senha);
    usuarioAtual = { uid: snap.docs[0].id, ...u };
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await carregarTurmas();
    await iniciarApp();
  } catch(e) {
    erro.textContent = 'Chapa ou senha incorretos.';
  }
}

async function carregarTurmas() {
  const snap = await window._fb.getDocs(window._fb.collection(window._db, 'turmas'));
  turmasCache = {};
  snap.forEach(d => turmasCache[d.id] = { id: d.id, ...d.data() });
}

async function iniciarApp() {
  // Se gestão/admin: mostrar painel de solicitações pendentes
  if (['admin','gestao','encarregado','administrativo'].includes(usuarioAtual.perfil)) {
    document.getElementById('painel-gestao').style.display = 'block';
    await carregarSolicitacoesPendentes();
  }

  // Popular select de turmas destino
  const sel = document.getElementById('turma-destino');
  Object.values(turmasCache).sort((a,b) => a.nome.localeCompare(b.nome)).forEach(t => {
    sel.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
  });
}

// ─────────────────────────────────────────────
// BUSCAR COLABORADOR
// ─────────────────────────────────────────────
async function buscarColaborador() {
  const termo = document.getElementById('busca-colab').value.trim().toLowerCase();
  const div   = document.getElementById('resultado-busca');
  if (termo.length < 2) { div.innerHTML = ''; return; }

  const snap = await window._fb.getDocs(window._fb.collection(window._db, 'colaboradores'));
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

  div.innerHTML = resultados.slice(0, 8).map(c => {
    const t = turmasCache[c.turmaId];
    return `<div class="item-card" style="cursor:pointer" onclick="abrirHistorico('${c.id}')">
      <div class="item-card-info">
        <strong>${c.nome} <small style="color:#999">#${c.chapa}</small></strong>
        <span>🏘️ ${t?.nome||'Sem turma'} | ${c.funcao||''} | ${c.demitido?'<span style="color:#e53e3e">Demitido</span>':'<span style="color:#2e8b57">Ativo</span>'}</span>
      </div>
      <span style="color:#2e8b57;font-size:20px">›</span>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// ABRIR HISTÓRICO DO COLABORADOR
// ─────────────────────────────────────────────
async function abrirHistorico(colabId) {
  document.getElementById('resultado-busca').innerHTML = '';
  document.getElementById('busca-colab').value = '';
  document.getElementById('painel-colab').style.display = 'block';

  // Buscar dados do colaborador
  const snap = await window._fb.getDoc(window._fb.doc(window._db, 'colaboradores', colabId));
  if (!snap.exists()) { alert('Colaborador não encontrado.'); return; }
  colabAtual = { id: colabId, ...snap.data() };

  // Header
  const iniciais = colabAtual.nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
  document.getElementById('colab-avatar').textContent   = iniciais;
  document.getElementById('colab-nome-tit').textContent = colabAtual.nome;
  document.getElementById('colab-detalhes').innerHTML   =
    `Chapa: <strong>${colabAtual.chapa}</strong> | Função: <strong>${colabAtual.funcao||'—'}</strong> | ` +
    `Admissão: <strong>${formatarData(colabAtual.admissao)||'—'}</strong>` +
    (colabAtual.demissao ? ` | Demissão: <strong style="color:#e53e3e">${formatarData(colabAtual.demissao)}</strong>` : '');

  document.getElementById('colab-status-badge').innerHTML = colabAtual.demitido
    ? '<span class="badge badge-vermelho" style="font-size:14px">Demitido</span>'
    : '<span class="badge badge-verde" style="font-size:14px">Ativo</span>';

  // Situação atual
  const turmaAtual = turmasCache[colabAtual.turmaId];
  document.getElementById('colab-situacao-atual').innerHTML = turmaAtual
    ? `<div class="item-card">
        <div class="item-card-info">
          <strong>🏘️ ${turmaAtual.nome}</strong>
          <span>Líder: ${turmaAtual.liderNome||'—'}</span>
        </div>
        <span class="badge badge-verde">Turma Atual</span>
       </div>`
    : '<p style="color:#888">Sem turma vinculada.</p>';

  // Histórico de turmas
  await carregarHistoricoTurmas(colabId);

  // Solicitações existentes
  await carregarSolicitacoesColab(colabId);

  // Mostrar botão de solicitar (líder ou admin/gestao)
  const podeSolicitar = ['admin','gestao','encarregado','administrativo','lider'].includes(usuarioAtual.perfil);
  document.getElementById('painel-solicitar').style.display = podeSolicitar && !colabAtual.demitido ? 'block' : 'none';

  // Scroll até o painel
  document.getElementById('painel-colab').scrollIntoView({ behavior: 'smooth' });
}

// ─────────────────────────────────────────────
// HISTÓRICO DE TURMAS (TIMELINE)
// ─────────────────────────────────────────────
async function carregarHistoricoTurmas(colabId) {
  const timeline = document.getElementById('timeline-turmas');
  const q = window._fb.query(
    window._fb.collection(window._db, 'historicoTurmas'),
    window._fb.where('colaboradorId', '==', colabId)
  );
  const snap = await window._fb.getDocs(q);
  if (snap.empty) {
    timeline.innerHTML = '<p style="color:#888">Nenhum histórico de turma registrado.</p>'; return;
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
        <div class="detalhe" style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span>Líder: ${turma.liderNome||'—'}</span>
          ${badge}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// ENVIAR SOLICITAÇÃO DE TRANSFERÊNCIA
// ─────────────────────────────────────────────
async function enviarSolicitacao() {
  const turmaDestinoId = document.getElementById('turma-destino').value;
  const dataTransf     = document.getElementById('data-transferencia').value;
  const motivo         = document.getElementById('motivo-transferencia').value.trim();
  const msg            = document.getElementById('msg-solicit');
  msg.textContent      = '';

  if (!turmaDestinoId) { msg.textContent = '⚠️ Selecione a turma de destino.'; msg.style.color='#e53e3e'; return; }
  if (!dataTransf)     { msg.textContent = '⚠️ Informe a data de início.';     msg.style.color='#e53e3e'; return; }
  if (turmaDestinoId === colabAtual.turmaId) {
    msg.textContent = '⚠️ A turma de destino é a mesma turma atual.'; msg.style.color='#e53e3e'; return;
  }

  const turmaDestino = turmasCache[turmaDestinoId];
  const turmaOrigem  = turmasCache[colabAtual.turmaId];

  await window._fb.addDoc(window._fb.collection(window._db, 'solicitacoesTransferencia'), {
    colaboradorId:    colabAtual.id,
    colaboradorNome:  colabAtual.nome,
    colaboradorChapa: colabAtual.chapa,
    turmaOrigemId:    colabAtual.turmaId || '',
    turmaOrigemNome:  turmaOrigem?.nome || '—',
    turmaDestinoId,
    turmaDestinoNome: turmaDestino?.nome || '—',
    dataInicio:       dataTransf,
    motivo,
    status:           'pendente',
    solicitadoPor:    usuarioAtual.uid,
    solicitadoPorNome:usuarioAtual.nome,
    solicitadoEm:     new Date().toISOString()
  });

  msg.textContent = '✅ Solicitação enviada! Aguardando aprovação da gestão.';
  msg.style.color = '#2e8b57';
  document.getElementById('turma-destino').value       = '';
  document.getElementById('data-transferencia').value  = '';
  document.getElementById('motivo-transferencia').value= '';

  await carregarSolicitacoesColab(colabAtual.id);
}

// ─────────────────────────────────────────────
// LISTAR SOLICITAÇÕES DO COLABORADOR
// ─────────────────────────────────────────────
async function carregarSolicitacoesColab(colabId) {
  const q = window._fb.query(
    window._fb.collection(window._db, 'solicitacoesTransferencia'),
    window._fb.where('colaboradorId', '==', colabId)
  );
  const snap = await window._fb.getDocs(q);
  const lista = document.getElementById('lista-solicitacoes');

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
      <span>📅 Início em: ${formatarData(s.dataInicio)} | Solicitado por: ${s.solicitadoPorNome}</span><br/>
      <span>📝 ${s.motivo||'Sem observação'}</span><br/>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        ${badge}
        ${s.observacaoGestao ? `<span style="font-size:12px;color:#555">Gestão: ${s.observacaoGestao}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// SOLICITAÇÕES PENDENTES (GESTÃO/ADMIN)
// ─────────────────────────────────────────────
async function carregarSolicitacoesPendentes() {
  const q = window._fb.query(
    window._fb.collection(window._db, 'solicitacoesTransferencia'),
    window._fb.where('status', '==', 'pendente')
  );
  const snap = await window._fb.getDocs(q);
  const lista = document.getElementById('lista-pendentes-gestao');

  if (snap.empty) { lista.innerHTML = '<p style="color:#888">Nenhuma solicitação pendente. ✅</p>'; return; }

  const items = [];
  snap.forEach(d => items.push({ id: d.id, ...d.data() }));

  lista.innerHTML = items.map(s => `
    <div class="req-card" id="req-${s.id}">
      <strong>👤 ${s.colaboradorNome} <small style="color:#999">#${s.colaboradorChapa}</small></strong>
      <span>🏘️ ${s.turmaOrigemNome} → ${s.turmaDestinoNome}</span><br/>
      <span>📅 Data de início solicitada: <strong>${formatarData(s.dataInicio)}</strong></span><br/>
      <span>📝 ${s.motivo||'Sem observação'}</span><br/>
      <span style="font-size:12px;color:#888">Solicitado por: ${s.solicitadoPorNome} em ${formatarDataHora(s.solicitadoEm)}</span>
      <div class="form-group" style="margin-top:10px">
        <label style="font-size:12px;font-weight:600">Observação (opcional)</label>
        <input type="text" id="obs-${s.id}" placeholder="Ex: Aprovado conforme solicitado"
               style="padding:7px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:100%"/>
      </div>
      <div class="form-group">
        <label style="font-size:12px;font-weight:600">Confirmar data de início na nova turma</label>
        <input type="date" id="dt-${s.id}" value="${s.dataInicio}"
               style="padding:7px;border:1px solid #ddd;border-radius:6px;font-size:13px"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn-primary btn-sm" onclick="aprovarTransferencia('${s.id}','${s.colaboradorId}','${s.turmaOrigemId}','${s.turmaDestinoId}','${s.turmaDestinoNome}')">
          ✅ Aprovar
        </button>
        <button class="btn-secondary btn-sm" onclick="recusarTransferencia('${s.id}')">
          ❌ Recusar
        </button>
      </div>
    </div>`).join('');
}

// ─────────────────────────────────────────────
// APROVAR TRANSFERÊNCIA
// ─────────────────────────────────────────────
async function aprovarTransferencia(solId, colabId, turmaOrigemId, turmaDestinoId, turmaDestinoNome) {
  const dataInicio = document.getElementById('dt-' + solId)?.value;
  const obs        = document.getElementById('obs-' + solId)?.value?.trim() || '';

  if (!dataInicio) { alert('Informe a data de início.'); return; }

  const dataFim = subtrairUmDia(dataInicio);

  // 1. Encerrar histórico anterior
  const qH = window._fb.query(
    window._fb.collection(window._db, 'historicoTurmas'),
    window._fb.where('colaboradorId', '==', colabId),
    window._fb.where('ativo', '==', true)
  );
  const snapH = await window._fb.getDocs(qH);
  for (const d of snapH.docs) {
    await window._fb.updateDoc(
      window._fb.doc(window._db, 'historicoTurmas', d.id),
      { dataFim, ativo: false }
    );
  }

  // 2. Criar novo histórico
  await window._fb.addDoc(window._fb.collection(window._db, 'historicoTurmas'), {
    colaboradorId: colabId,
    turmaIdAntiga: turmaOrigemId || null,
    turmaIdNova:   turmaDestinoId,
    turmaNomeNova: turmaDestinoNome,
    dataInicio,
    dataFim:       null,
    ativo:         true,
    criadoEm:      new Date().toISOString(),
    criadoPorSolicitacao: solId
  });

  // 3. Atualizar colaborador
  await window._fb.updateDoc(
    window._fb.doc(window._db, 'colaboradores', colabId),
    { turmaId: turmaDestinoId, turmaNome: turmaDestinoNome, atualizadoEm: new Date().toISOString() }
  );

  // 4. Marcar solicitação como aprovada
  await window._fb.updateDoc(
    window._fb.doc(window._db, 'solicitacoesTransferencia', solId),
    { status: 'aprovada', observacaoGestao: obs, aprovadoPor: usuarioAtual.uid, aprovadoEm: new Date().toISOString() }
  );

  alert('✅ Transferência aprovada e histórico atualizado!');
  await carregarTurmas();
  await carregarSolicitacoesPendentes();
}

// ─────────────────────────────────────────────
// RECUSAR TRANSFERÊNCIA
// ─────────────────────────────────────────────
async function recusarTransferencia(solId) {
  const obs = document.getElementById('obs-' + solId)?.value?.trim() || '';
  await window._fb.updateDoc(
    window._fb.doc(window._db, 'solicitacoesTransferencia', solId),
    { status: 'recusada', observacaoGestao: obs, recusadoPor: usuarioAtual.uid, recusadoEm: new Date().toISOString() }
  );
  alert('❌ Solicitação recusada.');
  await carregarSolicitacoesPendentes();
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
function formatarData(dataStr) {
  if (!dataStr) return '';
  const [y,m,d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}
function formatarDataHora(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
function subtrairUmDia(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
