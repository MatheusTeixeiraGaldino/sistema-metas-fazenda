// =============================================
// METAS E RESULTADOS DIÁRIOS
// =============================================

let usuarioAtual = null;
let turmasCache  = {};
let fazendasCache= {};
let metaAtual    = null;   // meta da semana selecionada
let semanaAtual  = null;   // { domingo, sabado }

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

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
    if (!['admin','gestao'].includes(u.perfil)) {
      erro.textContent = 'Apenas Gestão ou Admin podem lançar metas.'; return;
    }
    await window._fb.signInWithEmailAndPassword(window._auth, u.email, senha);
    usuarioAtual = { uid: snap.docs[0].id, ...u };
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await carregarBase();
  } catch(e) { erro.textContent = 'Chapa ou senha incorretos.'; }
}

async function carregarBase() {
  const [snapF, snapT] = await Promise.all([
    window._fb.getDocs(window._fb.collection(window._db, 'fazendas')),
    window._fb.getDocs(window._fb.collection(window._db, 'turmas'))
  ]);
  snapF.forEach(d => fazendasCache[d.id] = { id:d.id,...d.data() });
  snapT.forEach(d => turmasCache[d.id]   = { id:d.id,...d.data() });

  // Preencher fazendas em todos os selects
  ['l-fazenda','h-fazenda'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    Object.values(fazendasCache).sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(f => {
      sel.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
    });
  });

  // Preencher semanas (últimas 12 + próximas 4)
  preencherSemanas('l-semana');
  carregarHistoricoMetas();
}

// ─────────────────────────────────────────────
// ABAS
// ─────────────────────────────────────────────
function trocarAba(aba) {
  document.querySelectorAll('.aba').forEach((b,i) => b.classList.remove('ativa'));
  document.querySelectorAll('.painel-aba').forEach(p => p.classList.remove('ativo'));
  document.getElementById('aba-' + aba).classList.add('ativo');
  document.querySelectorAll('.aba').forEach(b => {
    if (b.getAttribute('onclick')?.includes(aba)) b.classList.add('ativa');
  });
  if (aba === 'historico') carregarHistoricoMetas();
}

// ─────────────────────────────────────────────
// SEMANAS
// ─────────────────────────────────────────────
function preencherSemanas(selId) {
  const sel  = document.getElementById(selId);
  if (!sel) return;
  const hoje  = new Date();
  const semanas = [];
  // 12 semanas atrás até 4 semanas à frente
  for (let i = -12; i <= 4; i++) {
    const ref = new Date(hoje);
    ref.setDate(hoje.getDate() + i * 7);
    const dom = domingoSemana(ref.toISOString().split('T')[0]);
    const sab = sabadoSemana(dom);
    const key = dom;
    if (!semanas.find(s => s.dom === key)) semanas.push({ dom, sab });
  }
  semanas.sort((a,b) => b.dom.localeCompare(a.dom));
  sel.innerHTML = '<option value="">Selecione a semana</option>';
  semanas.forEach(s => {
    sel.innerHTML += `<option value="${s.dom}|${s.sab}">${labelSemana(s.dom, s.sab)}</option>`;
  });
}

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
function labelSemana(dom, sab) {
  return `Dom ${formatarData(dom)} – Sáb ${formatarData(sab)}`;
}

// ─────────────────────────────────────────────
// CARREGAR TURMAS DO SELECT
// ─────────────────────────────────────────────
async function carregarTurmasLancar() {
  const fazId = document.getElementById('l-fazenda').value;
  const sel   = document.getElementById('l-turma');
  sel.innerHTML = '<option value="">Selecione a turma</option>';
  Object.values(turmasCache)
    .filter(t => !fazId || t.fazendaId === fazId)
    .sort((a,b) => a.nome.localeCompare(b.nome))
    .forEach(t => sel.innerHTML += `<option value="${t.id}">${t.nome}</option>`);
  document.getElementById('painel-semana').style.display = 'none';
}

function carregarSemanaLancar() {
  document.getElementById('painel-semana').style.display =
    document.getElementById('l-turma').value ? 'block' : 'none';
  if (document.getElementById('l-turma').value) carregarDadosSemana();
}

// ─────────────────────────────────────────────
// CARREGAR DADOS DA SEMANA SELECIONADA
// ─────────────────────────────────────────────
async function carregarDadosSemana() {
  const turmaId  = document.getElementById('l-turma').value;
  const semanaV  = document.getElementById('l-semana').value;
  if (!turmaId || !semanaV) return;

  const [dom, sab] = semanaV.split('|');
  semanaAtual = { domingo: dom, sabado: sab };

  // Buscar meta da semana
  const qM = window._fb.query(
    window._fb.collection(window._db, 'metas'),
    window._fb.where('semanaId', '==', `${turmaId}_${dom}`)
  );
  const snapM = await window._fb.getDocs(qM);
  metaAtual = snapM.empty ? null : { id: snapM.docs[0].id, ...snapM.docs[0].data() };

  document.getElementById('l-meta-valor').value = metaAtual?.meta || '';
  document.getElementById('btn-excluir-meta').style.display = metaAtual ? 'inline-block' : 'none';
  document.getElementById('msg-meta').textContent = '';

  // Montar formulário de dias
  await montarDiasSemana(turmaId, dom, sab);
  atualizarSomatorio();
}

// ─────────────────────────────────────────────
// FORMULÁRIO DE DIAS DA SEMANA
// ─────────────────────────────────────────────
async function montarDiasSemana(turmaId, dom, sab) {
  // Buscar resultados já lançados
  const qR = window._fb.query(
    window._fb.collection(window._db, 'resultadosDiarios'),
    window._fb.where('turmaId', '==', turmaId),
    window._fb.where('semanaDomingo', '==', dom)
  );
  const snapR = await window._fb.getDocs(qR);
  const resultMap = {};
  snapR.forEach(d => resultMap[d.data().data] = { id: d.id, ...d.data() });

  // Gerar os 7 dias
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(dom + 'T12:00:00');
    d.setDate(d.getDate() + i);
    dias.push(d.toISOString().split('T')[0]);
  }

  const form = document.getElementById('dias-semana-form');
  form.innerHTML = '<div class="dias-grid">' + dias.map((data, i) => {
    const res = resultMap[data];
    const val = res?.resultado ?? '';
    const isSab = i === 6;
    return `<div class="dia-card ${!val ? 'sem-resultado' : ''}" id="dcard-${data}">
      <div class="dia-data">${DIAS_SEMANA[i]} ${formatarData(data)}</div>
      <input type="number" id="res-${data}"
             value="${val}"
             placeholder="—"
             oninput="atualizarSomatorio()"
             style="width:100%;text-align:center;font-size:18px;font-weight:700;
                    border:1px solid #ddd;border-radius:6px;padding:4px;
                    color:${val?'#2e8b57':'#bbb'};background:${isSab?'#f0f9f4':'white'}"/>
      <div class="dia-label">${isSab?'🏁 Sábado':'resultado'}</div>
      ${res ? `<button class="btn-del" onclick="excluirResultadoDia('${res.id}','${data}')" title="Excluir resultado">🗑️</button>` : ''}
    </div>`;
  }).join('') + '</div>';

  form.innerHTML += `<button class="btn-primary" style="width:auto;margin-top:16px" onclick="salvarResultadosDiarios()">
    💾 Salvar Resultados
  </button>`;
}

// ─────────────────────────────────────────────
// SOMATÓRIO EM TEMPO REAL
// ─────────────────────────────────────────────
function atualizarSomatorio() {
  if (!semanaAtual) return;
  const dom = semanaAtual.domingo;
  let soma = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(dom + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const data = d.toISOString().split('T')[0];
    const val  = parseFloat(document.getElementById('res-' + data)?.value || 0);
    soma += isNaN(val) ? 0 : val;
  }
  const meta = parseFloat(document.getElementById('l-meta-valor')?.value || 0);
  document.getElementById('soma-resultados').textContent   = soma.toFixed(0);
  document.getElementById('meta-referencia').textContent   = meta || '—';

  const pct    = meta > 0 ? Math.min(Math.round(soma/meta*100), 100) : 0;
  const ganhou = meta > 0 && soma >= meta;
  const barra  = document.getElementById('barra-progresso');
  barra.style.width = pct + '%';
  barra.className   = 'progresso-fill ' + (meta === 0 ? '' : ganhou ? 'ok' : soma > 0 ? 'par' : 'no');

  const badge = document.getElementById('status-semana-badge');
  if (!meta) { badge.innerHTML = ''; return; }
  badge.innerHTML = ganhou
    ? '<span class="badge badge-verde">✅ Meta Atingida!</span>'
    : soma > 0
    ? `<span class="badge badge-amarelo">⏳ ${pct}% da meta</span>`
    : '<span class="badge badge-vermelho">❌ Sem resultados</span>';
}

// ─────────────────────────────────────────────
// SALVAR META
// ─────────────────────────────────────────────
async function salvarMeta() {
  const turmaId = document.getElementById('l-turma').value;
  const semanaV = document.getElementById('l-semana').value;
  const metaVal = document.getElementById('l-meta-valor').value;
  const msg     = document.getElementById('msg-meta');
  if (!turmaId||!semanaV||!metaVal) { msg.textContent='⚠️ Preencha turma, semana e meta.'; msg.style.color='#e53e3e'; return; }
  const [dom, sab] = semanaV.split('|');
  const dados = {
    turmaId, semanaId: `${turmaId}_${dom}`,
    semanaDomingo: dom, semanaSabado: sab,
    meta: parseFloat(metaVal),
    lancadoPor: usuarioAtual.uid, atualizadoEm: new Date().toISOString()
  };
  if (metaAtual) {
    await window._fb.updateDoc(window._fb.doc(window._db,'metas',metaAtual.id), dados);
    msg.textContent = '✅ Meta atualizada!';
  } else {
    dados.criadoEm = new Date().toISOString();
    const ref = await window._fb.addDoc(window._fb.collection(window._db,'metas'), dados);
    metaAtual = { id: ref.id, ...dados };
    document.getElementById('btn-excluir-meta').style.display = 'inline-block';
    msg.textContent = '✅ Meta salva!';
  }
  msg.style.color = '#2e8b57';
  atualizarSomatorio();
}

// ─────────────────────────────────────────────
// EXCLUIR META
// ─────────────────────────────────────────────
async function excluirMeta() {
  if (!metaAtual) return;
  if (!confirm('Tem certeza que deseja excluir esta meta? Os resultados diários serão mantidos.')) return;
  await window._fb.deleteDoc(window._fb.doc(window._db,'metas',metaAtual.id));
  metaAtual = null;
  document.getElementById('l-meta-valor').value = '';
  document.getElementById('btn-excluir-meta').style.display = 'none';
  document.getElementById('msg-meta').textContent = '✅ Meta excluída.';
  document.getElementById('msg-meta').style.color = '#e53e3e';
  atualizarSomatorio();
}

// ─────────────────────────────────────────────
// SALVAR RESULTADOS DIÁRIOS
// ─────────────────────────────────────────────
async function salvarResultadosDiarios() {
  const turmaId = document.getElementById('l-turma').value;
  if (!turmaId || !semanaAtual) return;
  const dom = semanaAtual.domingo;
  let salvos = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(dom + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const data = d.toISOString().split('T')[0];
    const val  = document.getElementById('res-' + data)?.value;
    if (!val && val !== '0') continue;

    const dados = {
      turmaId, data, semanaDomingo: dom, semanaSabado: semanaAtual.sabado,
      resultado: parseFloat(val), diaSemana: i,
      lancadoPor: usuarioAtual.uid, atualizadoEm: new Date().toISOString()
    };

    // Verificar se já existe
    const qE = window._fb.query(
      window._fb.collection(window._db,'resultadosDiarios'),
      window._fb.where('turmaId','==',turmaId),
      window._fb.where('data','==',data)
    );
    const snapE = await window._fb.getDocs(qE);
    if (!snapE.empty) {
      await window._fb.updateDoc(window._fb.doc(window._db,'resultadosDiarios',snapE.docs[0].id), dados);
    } else {
      dados.criadoEm = new Date().toISOString();
      await window._fb.addDoc(window._fb.collection(window._db,'resultadosDiarios'), dados);
    }
    salvos++;
  }
  alert(`✅ ${salvos} resultado(s) salvo(s)!`);
  await carregarDadosSemana();
}

// ─────────────────────────────────────────────
// EXCLUIR RESULTADO DE UM DIA
// ─────────────────────────────────────────────
async function excluirResultadoDia(resId, data) {
  if (!confirm(`Excluir resultado de ${formatarData(data)}?`)) return;
  await window._fb.deleteDoc(window._fb.doc(window._db,'resultadosDiarios',resId));
  const inp = document.getElementById('res-' + data);
  if (inp) inp.value = '';
  const card = document.getElementById('dcard-' + data);
  if (card) card.classList.add('sem-resultado');
  await carregarDadosSemana();
}

// ─────────────────────────────────────────────
// HISTÓRICO DE METAS
// ─────────────────────────────────────────────
async function carregarHistoricoMetas() {
  const div    = document.getElementById('historico-metas');
  const fazId  = document.getElementById('h-fazenda')?.value || '';
  const turmaF = document.getElementById('h-turma')?.value   || '';
  div.innerHTML = 'Carregando...';

  const [snapM, snapR] = await Promise.all([
    window._fb.getDocs(window._fb.collection(window._db,'metas')),
    window._fb.getDocs(window._fb.collection(window._db,'resultadosDiarios'))
  ]);

  // Agrupar resultados por semanaId (turmaId_domingo)
  const resultMap = {};
  snapR.forEach(d => {
    const r = d.data();
    const key = `${r.turmaId}_${r.semanaDomingo}`;
    if (!resultMap[key]) resultMap[key] = 0;
    resultMap[key] += parseFloat(r.resultado || 0);
  });

  let metas = []; snapM.forEach(d => metas.push({ id:d.id,...d.data() }));
  if (fazId)  metas = metas.filter(m => turmasCache[m.turmaId]?.fazendaId === fazId);
  if (turmaF) metas = metas.filter(m => m.turmaId === turmaF);
  metas.sort((a,b) => (b.semanaDomingo||'').localeCompare(a.semanaDomingo||''));

  if (metas.length === 0) { div.innerHTML = '<p style="color:#888">Nenhuma meta encontrada.</p>'; return; }

  div.innerHTML = metas.map(m => {
    const soma    = resultMap[m.semanaId] || 0;
    const pct     = m.meta > 0 ? Math.round(soma/m.meta*100) : 0;
    const ganhou  = soma >= m.meta && m.meta > 0;
    const semRes  = soma === 0;
    const cls     = semRes ? '' : ganhou ? 'ganhou' : 'perdeu';
    const corB    = semRes ? '' : ganhou ? 'ok' : 'no';
    const turma   = turmasCache[m.turmaId];

    return `<div class="semana-card ${cls}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <h4>🏘️ ${turma?.nome||'—'}</h4>
          <span style="font-size:13px;color:#666">${labelSemana(m.semanaDomingo, m.semanaSabado)}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${semRes
            ? '<span class="badge badge-amarelo">⏳ Aguardando resultados</span>'
            : ganhou
            ? '<span class="badge badge-verde">✅ Atingiu</span>'
            : '<span class="badge badge-vermelho">❌ Não atingiu</span>'}
          <button class="btn-secondary btn-sm" style="color:#e53e3e;border-color:#e53e3e" onclick="excluirMetaHistorico('${m.id}')">🗑️</button>
        </div>
      </div>
      <div style="display:flex;gap:24px;margin-top:10px;flex-wrap:wrap">
        <div><span style="font-size:12px;color:#888">META</span><div style="font-size:20px;font-weight:700;color:#1a5e38">${m.meta}</div></div>
        <div><span style="font-size:12px;color:#888">SOMA RESULTADOS</span><div style="font-size:20px;font-weight:700;color:${ganhou?'#2e8b57':'#e53e3e'}">${soma.toFixed(0)}</div></div>
        <div><span style="font-size:12px;color:#888">PROGRESSO</span><div style="font-size:20px;font-weight:700">${pct}%</div></div>
      </div>
      <div class="progresso-barra"><div class="progresso-fill ${corB}" style="width:${Math.min(pct,100)}%"></div></div>
    </div>`;
  }).join('');
}

async function excluirMetaHistorico(metaId) {
  if (!confirm('Excluir esta meta? Os resultados diários serão mantidos.')) return;
  await window._fb.deleteDoc(window._fb.doc(window._db,'metas',metaId));
  carregarHistoricoMetas();
}

// ─────────────────────────────────────────────
// IMPORTAR EXCEL
// ─────────────────────────────────────────────
async function importarExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  const tipo = document.getElementById('imp-tipo').value;
  const div  = document.getElementById('imp-resultado');
  div.innerHTML = '⏳ Lendo arquivo...';

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const wb   = XLSX.read(e.target.result, { type:'binary', cellDates:true });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });

      if (!rows.length) { div.innerHTML = '❌ Arquivo vazio.'; return; }

      let ok=0, erros=0, log=[];

      for (const row of rows) {
        try {
          if (tipo === 'metas') {
            const turmaKey = String(row['TURMA']||row['Turma']||'').trim().toLowerCase();
            const semIni   = String(row['SEMANA_INICIO']||row['Semana_Inicio']||'').trim();
            const metaVal  = parseFloat(row['META']||row['Meta']||0);
            if (!turmaKey||!semIni||!metaVal) { erros++; log.push(`⚠ Linha ignorada — dados incompletos`); continue; }

            const turma = Object.values(turmasCache).find(t => t.nome.toLowerCase()===turmaKey);
            if (!turma) { erros++; log.push(`❌ Turma não encontrada: ${turmaKey}`); continue; }

            const dom = domingoSemana(semIni);
            const sab = sabadoSemana(dom);
            const dados = {
              turmaId: turma.id, semanaId: `${turma.id}_${dom}`,
              semanaDomingo: dom, semanaSabado: sab,
              meta: metaVal, lancadoPor: usuarioAtual.uid,
              atualizadoEm: new Date().toISOString()
            };
            const q = window._fb.query(window._fb.collection(window._db,'metas'), window._fb.where('semanaId','==',`${turma.id}_${dom}`));
            const snap = await window._fb.getDocs(q);
            if (!snap.empty) await window._fb.updateDoc(window._fb.doc(window._db,'metas',snap.docs[0].id), dados);
            else { dados.criadoEm=new Date().toISOString(); await window._fb.addDoc(window._fb.collection(window._db,'metas'),dados); }
            ok++; log.push(`✅ Meta ${turma.nome} — semana ${labelSemana(dom,sab)}: ${metaVal}`);

          } else {
            // resultados diários
            const turmaKey = String(row['TURMA']||row['Turma']||'').trim().toLowerCase();
            const dataStr  = String(row['DATA']||row['Data']||'').trim();
            const resVal   = parseFloat(row['RESULTADO']||row['Resultado']||0);
            if (!turmaKey||!dataStr) { erros++; log.push(`⚠ Linha ignorada`); continue; }

            const turma = Object.values(turmasCache).find(t => t.nome.toLowerCase()===turmaKey);
            if (!turma) { erros++; log.push(`❌ Turma não encontrada: ${turmaKey}`); continue; }

            const data = normalizarData(dataStr);
            const dom  = domingoSemana(data);
            const sab  = sabadoSemana(dom);
            const dados = {
              turmaId: turma.id, data, semanaDomingo: dom, semanaSabado: sab,
              resultado: resVal, diaSemana: new Date(data+'T12:00:00').getDay(),
              lancadoPor: usuarioAtual.uid, atualizadoEm: new Date().toISOString()
            };
            const q = window._fb.query(window._fb.collection(window._db,'resultadosDiarios'),
              window._fb.where('turmaId','==',turma.id), window._fb.where('data','==',data));
            const snap = await window._fb.getDocs(q);
            if (!snap.empty) await window._fb.updateDoc(window._fb.doc(window._db,'resultadosDiarios',snap.docs[0].id), dados);
            else { dados.criadoEm=new Date().toISOString(); await window._fb.addDoc(window._fb.collection(window._db,'resultadosDiarios'),dados); }
            ok++; log.push(`✅ Resultado ${turma.nome} — ${formatarData(data)}: ${resVal}`);
          }
        } catch(err) { erros++; log.push(`❌ Erro: ${err.message}`); }
      }

      div.innerHTML = `
        <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
          <div class="stat-card" style="background:white;border-radius:8px;padding:12px;text-align:center;min-width:80px">
            <div style="font-size:22px;font-weight:700;color:#2e8b57">${ok}</div>
            <div style="font-size:11px;color:#888">Importados</div>
          </div>
          <div class="stat-card" style="background:white;border-radius:8px;padding:12px;text-align:center;min-width:80px">
            <div style="font-size:22px;font-weight:700;color:#e53e3e">${erros}</div>
            <div style="font-size:11px;color:#888">Erros</div>
          </div>
        </div>
        <div style="background:#1e1e1e;color:#d4d4d4;border-radius:8px;padding:12px;font-family:monospace;font-size:12px;max-height:200px;overflow-y:auto">
          ${log.map(l => `<div style="color:${l.startsWith('✅')?'#4ec9b0':l.startsWith('⚠')?'#ffd700':'#f44747'}">${l}</div>`).join('')}
        </div>`;

    } catch(err) { div.innerHTML = '❌ Erro ao ler arquivo: ' + err.message; }
  };
  reader.readAsBinaryString(file);
}

// ─────────────────────────────────────────────
// BAIXAR MODELO EXCEL
// ─────────────────────────────────────────────
function baixarModelo() {
  const tipo = document.getElementById('imp-tipo').value;
  let csv = '';
  if (tipo === 'metas') {
    csv = 'TURMA;SEMANA_INICIO;META\nTurma A;2026-02-15;500\nTurma B;2026-02-15;480\n';
  } else {
    csv = 'TURMA;DATA;RESULTADO\nTurma A;2026-02-16;80\nTurma A;2026-02-17;95\nTurma A;2026-02-18;100\n';
  }
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = tipo === 'metas' ? 'modelo-metas.csv' : 'modelo-resultados.csv';
  a.click();
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
function formatarData(s) {
  if (!s) return '';
  const [y,m,d] = s.split('-');
  return `${d}/${m}/${y}`;
}
function normalizarData(s) {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [d,m,y]=s.split('/'); return `${y}-${m}-${d}`; }
  if (s.includes('T')) return s.slice(0,10);
  return s;
}
