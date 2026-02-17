// =============================================
// IMPORTAÇÃO EXCEL TOTVS RM → FIREBASE
// =============================================

// Mapeamento automático — nomes mais comuns no Totvs RM
const MAPA_TOTVS = {
  chapa:         ['CHAPA','Chapa','chapa','MATRICULA','Matricula','CODSERVIDOR'],
  nome:          ['NOME','Nome','nome','NOMEFUNCIONARIO','NOME FUNCIONARIO','NomeFuncionario'],
  funcao:        ['FUNCAO','Funcao','FUNÇÃO','Função','CODFUNCAO','DESCRICAOFUNCAO','CARGO','Cargo','NOME FUNÇÃO'],
  turma:         ['TURMA','Turma','turma','CODSECAO','SECAO','Seção','SECÇÃO','CODTURMA','NOME SEÇÃO','NOME TURMA'],
  lider:         ['LIDER','Lider','Líder','NOMECHEFIA','CHEFIA','LIDERANÇA','SUPERVISOR','Supervisor'],
  admissao:      ['DATAADMISSAO','ADMISSAO','DATAADMISSÃO','DATA ADMISSAO','DataAdmissao','Admissão','DTADMISSAO'],
  demissao:      ['DATADEMISSAO','DEMISSAO','DATADEMISSÃO','DATA DEMISSAO','DataDemissao','Demissão','DTDEMISSAO'],
  inicioJornada: ['HORAINICIO','HORA INICIO','HoraInicio','INICIO','ENTRADAJORNADA','HRINI','HR_INICIO'],
  fimJornada:    ['HORAFIM','HORA FIM','HoraFim','FIM','SAIDAJORNADA','HRFIM','HR_FIM'],
};

let dadosPlanilha   = [];   // linhas brutas da planilha
let colunasArquivo  = [];   // cabeçalhos do arquivo
let mapaAtual       = {};   // campo → coluna selecionada
let alertasMudanca  = [];   // colaboradores com mudança de turma
let colabFirebase   = {};   // chapa → dados do Firebase
let turmasFirebase  = {};   // nome.lower → { id, nome }
let logLinhas       = [];
let stats           = { total:0, novos:0, atualizados:0, mudancas:0, demitidos:0, erros:0 };

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
async function fazerLogin() {
  const chapa = document.getElementById('login-chapa').value.trim();
  const senha = document.getElementById('login-senha').value;
  const erro  = document.getElementById('login-erro');
  erro.textContent = '';

  if (!chapa || !senha) { erro.textContent = 'Preencha chapa e senha.'; return; }

  try {
    const q = window._fb.query(
      window._fb.collection(window._db, 'usuarios'),
      window._fb.where('chapa', '==', chapa)
    );
    const snap = await window._fb.getDocs(q);
    if (snap.empty) { erro.textContent = 'Chapa não encontrada.'; return; }

    const u = snap.docs[0].data();
    if (!['admin','gestao'].includes(u.perfil)) {
      erro.textContent = 'Apenas Admin ou Gestão podem importar.'; return;
    }

    await window._fb.signInWithEmailAndPassword(window._auth, u.email, senha);
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    await carregarFirebase();

  } catch(e) {
    erro.textContent = 'Chapa ou senha incorretos.';
  }
}

// ─────────────────────────────────────────────
// CARREGAR FIREBASE
// ─────────────────────────────────────────────
async function carregarFirebase() {
  const [sc, st] = await Promise.all([
    window._fb.getDocs(window._fb.collection(window._db, 'colaboradores')),
    window._fb.getDocs(window._fb.collection(window._db, 'turmas'))
  ]);
  sc.forEach(d => { const c = d.data(); if (c.chapa) colabFirebase[c.chapa.trim()] = { id: d.id, ...c }; });
  st.forEach(d => { const t = d.data(); if (t.nome) turmasFirebase[t.nome.toLowerCase().trim()] = { id: d.id, ...t }; });
}

// ─────────────────────────────────────────────
// DRAG AND DROP
// ─────────────────────────────────────────────
function dragOver(e)  { e.preventDefault(); document.getElementById('drop-zone').classList.add('over'); }
function dragLeave(e) { document.getElementById('drop-zone').classList.remove('over'); }
function dropFile(e)  {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('over');
  const file = e.dataTransfer.files[0];
  if (file) processarArquivo(file);
}
function lerArquivo(e) {
  const file = e.target.files[0];
  if (file) processarArquivo(file);
}

// ─────────────────────────────────────────────
// LER ARQUIVO (XLSX ou CSV)
// ─────────────────────────────────────────────
function processarArquivo(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls','csv'].includes(ext)) {
    alert('Arquivo não suportado. Use .xlsx, .xls ou .csv'); return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const dados = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

      if (!dados || dados.length === 0) {
        alert('Planilha vazia ou sem dados.'); return;
      }

      dadosPlanilha  = dados;
      colunasArquivo = Object.keys(dados[0]);

      document.getElementById('passo-upload').style.display = 'none';
      montarMapeamento();
      document.getElementById('passo-mapa').style.display = 'block';

    } catch(err) {
      alert('Erro ao ler o arquivo: ' + err.message);
    }
  };
  reader.readAsBinaryString(file);
}

// ─────────────────────────────────────────────
// MONTAR MAPEAMENTO AUTOMÁTICO
// ─────────────────────────────────────────────
function montarMapeamento() {
  // Detectar automaticamente qual coluna corresponde a cada campo
  mapaAtual = {};
  for (const [campo, opcoes] of Object.entries(MAPA_TOTVS)) {
    mapaAtual[campo] = '';
    for (const opcao of opcoes) {
      if (colunasArquivo.includes(opcao)) {
        mapaAtual[campo] = opcao;
        break;
      }
    }
  }

  const labels = {
    chapa: 'Chapa *', nome: 'Nome *', funcao: 'Função',
    turma: 'Turma', lider: 'Líder', admissao: 'Data Admissão',
    demissao: 'Data Demissão', inicioJornada: 'Hora Início', fimJornada: 'Hora Fim'
  };

  const obrigatorios = ['chapa','nome'];
  const grid = document.getElementById('mapa-colunas');
  grid.innerHTML = '';

  for (const [campo, label] of Object.entries(labels)) {
    const detectado = mapaAtual[campo];
    const div = document.createElement('div');
    div.className = 'mapa-linha';
    div.innerHTML = `
      <label>${label}</label>
      <select id="mapa-${campo}" onchange="atualizarMapa('${campo}', this.value)"
              class="${detectado ? 'mapa-ok' : (obrigatorios.includes(campo) ? 'mapa-err' : '')}">
        <option value="">— não usar —</option>
        ${colunasArquivo.map(c =>
          `<option value="${c}" ${c === detectado ? 'selected' : ''}>${c}</option>`
        ).join('')}
      </select>
    `;
    grid.appendChild(div);
  }

  // Prévia dos primeiros 3 registros
  montarPrevia();
}

function atualizarMapa(campo, valor) {
  mapaAtual[campo] = valor;
  const sel = document.getElementById('mapa-' + campo);
  sel.className = 'mapa-linha select ' + (valor ? 'mapa-ok' : (['chapa','nome'].includes(campo) ? 'mapa-err' : ''));
  montarPrevia();
}

function montarPrevia() {
  const campos = Object.keys(MAPA_TOTVS);
  const ativos = campos.filter(c => mapaAtual[c]);
  const preview = dadosPlanilha.slice(0, 3);

  const table = document.getElementById('preview-table');
  table.innerHTML =
    '<tr>' + ativos.map(c => `<th>${c}</th>`).join('') + '</tr>' +
    preview.map(row =>
      '<tr>' + ativos.map(c => `<td>${row[mapaAtual[c]] || '—'}</td>`).join('') + '</tr>'
    ).join('');
}

// ─────────────────────────────────────────────
// ANALISAR DADOS (detectar mudanças de turma)
// ─────────────────────────────────────────────
async function analisarDados() {
  if (!mapaAtual.chapa || !mapaAtual.nome) {
    alert('Os campos Chapa e Nome são obrigatórios. Mapeie-os antes de continuar.'); return;
  }

  alertasMudanca = [];
  stats = { total: dadosPlanilha.length, novos: 0, atualizados: 0, mudancas: 0, demitidos: 0, erros: 0 };

  dadosPlanilha.forEach((row, idx) => {
    const chapa      = String(row[mapaAtual.chapa] || '').trim();
    const turmaNova  = String(row[mapaAtual.turma] || '').trim();
    const existente  = colabFirebase[chapa];

    if (!chapa) return;

    if (!existente) {
      stats.novos++;
    } else {
      const turmaAtual = (existente.turmaNome || '').toLowerCase().trim();
      const turmaNovaN = turmaNova.toLowerCase().trim();
      if (turmaNovaN && turmaAtual && turmaNovaN !== turmaAtual) {
        stats.mudancas++;
        alertasMudanca.push({
          idx, chapa,
          nome:       String(row[mapaAtual.nome] || '').trim(),
          turmaAntiga: existente.turmaNome || '—',
          turmaNova,
          dataInicio: ''
        });
      } else {
        if (row[mapaAtual.demissao]) stats.demitidos++;
        else stats.atualizados++;
      }
    }
  });

  // Mostrar alertas
  if (alertasMudanca.length > 0) {
    document.getElementById('lista-alertas').innerHTML = alertasMudanca.map((a, i) => `
      <div class="alerta-item">
        <strong>👤 ${a.nome} — Chapa: ${a.chapa}</strong>
        <span style="font-size:13px;color:#666;display:block;margin-bottom:8px">
          De: <b>${a.turmaAntiga}</b> &rarr; Para: <b>${a.turmaNova}</b>
        </span>
        <label style="font-size:13px;font-weight:600;color:#856404">
          📅 Data de início na nova turma (obrigatório):
        </label>
        <input type="date" id="dt-mudanca-${i}"
               onchange="alertasMudanca[${i}].dataInicio = this.value"/>
        <p style="font-size:12px;color:#999;margin-top:4px">
          O sistema encerrará o histórico anterior automaticamente no dia anterior a esta data.
        </p>
      </div>
    `).join('');
    document.getElementById('passo-alertas').style.display = 'block';
  } else {
    document.getElementById('passo-alertas').style.display = 'none';
  }

  // Mostrar stats preview
  document.getElementById('stats-preview').innerHTML = `
    <div class="stat"><div class="stat-n c-azul">${stats.total}</div><div class="stat-l">Total</div></div>
    <div class="stat"><div class="stat-n c-verde">${stats.novos}</div><div class="stat-l">Novos</div></div>
    <div class="stat"><div class="stat-n c-laranja">${stats.mudancas}</div><div class="stat-l">Mudança Turma</div></div>
    <div class="stat"><div class="stat-n c-vermelho">${stats.demitidos}</div><div class="stat-l">Demitidos</div></div>
  `;

  document.getElementById('passo-mapa').style.display = 'none';
  document.getElementById('passo-confirmar').style.display = 'block';
}

// ─────────────────────────────────────────────
// EXECUTAR IMPORTAÇÃO
// ─────────────────────────────────────────────
async function executarImportacao() {
  const msg = document.getElementById('msg-importar');

  // Validar datas de mudança
  const semData = alertasMudanca.filter(a => !a.dataInicio);
  if (semData.length > 0) {
    msg.textContent = `⚠️ Informe a data de início para ${semData.length} mudança(s) de turma.`;
    msg.style.color = '#e53e3e';
    return;
  }

  document.getElementById('btn-importar').disabled = true;
  document.getElementById('btn-importar').textContent = '⏳ Importando...';
  msg.textContent = '';
  logLinhas = [];
  const contFinal = { novos:0, atualizados:0, mudancas:0, demitidos:0, erros:0 };

  for (const row of dadosPlanilha) {
    try {
      const chapa = String(row[mapaAtual.chapa] || '').trim();
      if (!chapa) continue;

      const nome         = String(row[mapaAtual.nome]         || '').trim();
      const funcao       = String(row[mapaAtual.funcao]       || '').trim();
      const turmaNome    = String(row[mapaAtual.turma]        || '').trim();
      const lider        = String(row[mapaAtual.lider]        || '').trim();
      const admissao     = formatarData(row[mapaAtual.admissao]);
      const demissao     = formatarData(row[mapaAtual.demissao]);
      const inicioJornada= String(row[mapaAtual.inicioJornada]|| '08:00').trim();
      const fimJornada   = String(row[mapaAtual.fimJornada]   || '17:00').trim();

      // Resolver turma
      let turmaId = null;
      if (turmaNome) {
        const key = turmaNome.toLowerCase().trim();
        if (turmasFirebase[key]) {
          turmaId = turmasFirebase[key].id;
        } else {
          const ref = await window._fb.addDoc(
            window._fb.collection(window._db, 'turmas'),
            { nome: turmaNome, liderNome: lider, fazendaId: '', criadoEm: new Date().toISOString(), criadoViaImport: true }
          );
          turmaId = ref.id;
          turmasFirebase[key] = { id: turmaId, nome: turmaNome };
          log(`⚠ Turma criada: ${turmaNome}`, 'warn');
        }
      }

      const dados = {
        chapa, nome, funcao, liderNome: lider,
        turmaId: turmaId || '', turmaNome,
        admissao, demissao,
        inicioJornada: formatarHora(inicioJornada),
        fimJornada:    formatarHora(fimJornada),
        demitido: !!demissao,
        atualizadoEm: new Date().toISOString(),
        atualizadoViaImport: true
      };

      const existente = colabFirebase[chapa];

      if (!existente) {
        // NOVO
        dados.criadoEm = new Date().toISOString();
        const ref = await window._fb.addDoc(window._fb.collection(window._db, 'colaboradores'), dados);
        colabFirebase[chapa] = { id: ref.id, ...dados };
        await registrarHistorico(ref.id, null, turmaId, turmaNome, hoje());
        contFinal.novos++;
        log(`✓ Novo: ${nome} (${chapa})`, 'ok');

      } else {
        const turmaAtual  = (existente.turmaNome || '').toLowerCase().trim();
        const turmaNovaN  = turmaNome.toLowerCase().trim();
        const mudouTurma  = turmaNovaN && turmaAtual && turmaNovaN !== turmaAtual;

        if (mudouTurma) {
          const alerta = alertasMudanca.find(a => a.chapa === chapa);
          const dataInicio = alerta?.dataInicio || hoje();
          const dataFim    = subtrairUmDia(dataInicio);

          await encerrarHistoricoAtivo(existente.id, dataFim);
          await window._fb.updateDoc(window._fb.doc(window._db, 'colaboradores', existente.id), dados);
          await registrarHistorico(existente.id, existente.turmaId, turmaId, turmaNome, dataInicio);

          colabFirebase[chapa] = { ...existente, ...dados };
          contFinal.mudancas++;
          log(`↔ Mudança de turma: ${nome} → ${turmaNome} (desde ${dataInicio})`, 'warn');

        } else {
          await window._fb.updateDoc(window._fb.doc(window._db, 'colaboradores', existente.id), dados);
          colabFirebase[chapa] = { ...existente, ...dados };
          if (demissao && !existente.demitido) {
            contFinal.demitidos++;
            log(`✗ Demitido: ${nome} (${chapa})`, 'warn');
          } else {
            contFinal.atualizados++;
            log(`↻ Atualizado: ${nome} (${chapa})`, 'ok');
          }
        }
      }

    } catch(e) {
      contFinal.erros++;
      log(`✗ Erro: ${row[mapaAtual.chapa]} — ${e.message}`, 'err');
    }
  }

  // Gravar log
  await window._fb.addDoc(window._fb.collection(window._db, 'logsImportacao'), {
    data: new Date().toISOString(), fonte: 'excel-totvs', ...contFinal
  });

  // Mostrar resultado
  document.getElementById('stats-resultado').innerHTML = `
    <div class="stat"><div class="stat-n c-verde">${contFinal.novos}</div><div class="stat-l">Novos</div></div>
    <div class="stat"><div class="stat-n c-azul">${contFinal.atualizados}</div><div class="stat-l">Atualizados</div></div>
    <div class="stat"><div class="stat-n c-laranja">${contFinal.mudancas}</div><div class="stat-l">Turma Alterada</div></div>
    <div class="stat"><div class="stat-n c-vermelho">${contFinal.erros}</div><div class="stat-l">Erros</div></div>
  `;
  document.getElementById('log-box').innerHTML = logLinhas.join('<br>');
  document.getElementById('passo-confirmar').style.display = 'none';
  document.getElementById('passo-alertas').style.display  = 'none';
  document.getElementById('passo-resultado').style.display = 'block';
}

// ─────────────────────────────────────────────
// HISTÓRICO DE TURMA
// ─────────────────────────────────────────────
async function registrarHistorico(colaboradorId, turmaIdAntiga, turmaIdNova, turmaNomeNova, dataInicio) {
  await window._fb.addDoc(window._fb.collection(window._db, 'historicoTurmas'), {
    colaboradorId, turmaIdAntiga: turmaIdAntiga || null,
    turmaIdNova, turmaNomeNova, dataInicio, dataFim: null,
    ativo: true, criadoEm: new Date().toISOString()
  });
}

async function encerrarHistoricoAtivo(colaboradorId, dataFim) {
  const q = window._fb.query(
    window._fb.collection(window._db, 'historicoTurmas'),
    window._fb.where('colaboradorId', '==', colaboradorId),
    window._fb.where('ativo', '==', true)
  );
  const snap = await window._fb.getDocs(q);
  for (const d of snap.docs) {
    await window._fb.updateDoc(
      window._fb.doc(window._db, 'historicoTurmas', d.id),
      { dataFim, ativo: false }
    );
  }
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
function hoje() { return new Date().toISOString().split('T')[0]; }

function subtrairUmDia(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function formatarData(val) {
  if (!val) return '';
  const s = String(val).trim();
  // Já está no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [d,m,y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  // Objeto Date (SheetJS com cellDates:true)
  if (s.includes('T')) return s.slice(0,10);
  return '';
}

function formatarHora(val) {
  if (!val) return '';
  const s = String(val).trim();
  // HH:MM ou HH:MM:SS
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return m[1].padStart(2,'0') + ':' + m[2];
  return s.slice(0,5) || '';
}

function log(msg, tipo) {
  const cls = tipo === 'ok' ? 'log-ok' : tipo === 'warn' ? 'log-warn' : 'log-err';
  logLinhas.push(`<span class="${cls}">${msg}</span>`);
}

function novaImportacao() {
  dadosPlanilha = []; colunasArquivo = []; mapaAtual = {};
  alertasMudanca = []; logLinhas = [];
  document.getElementById('file-input').value = '';
  ['passo-mapa','passo-alertas','passo-confirmar','passo-resultado']
    .forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('passo-upload').style.display = 'block';
  document.getElementById('btn-importar').disabled = false;
  document.getElementById('btn-importar').textContent = '🚀 Importar para o Firebase';
  window.scrollTo(0,0);
}
