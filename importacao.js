// =============================================
// IMPORTAÇÃO DE COLABORADORES VIA JSON
// =============================================

let dadosJSON = [];
let alertasMudanca = [];
let turmasFirebase = {};
let colaboradoresFirebase = {};

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
async function loginImportacao() {
  const chapa = document.getElementById('imp-chapa').value.trim();
  const senha = document.getElementById('imp-senha').value;
  const erro = document.getElementById('imp-login-erro');
  erro.textContent = '';

  if (!chapa || !senha) { erro.textContent = 'Preencha chapa e senha.'; return; }

  try {
    // Buscar e-mail pela chapa
    const q = window._fb.query(
      window._fb.collection(window._db, 'usuarios'),
      window._fb.where('chapa', '==', chapa)
    );
    const snap = await window._fb.getDocs(q);
    if (snap.empty) { erro.textContent = 'Chapa não encontrada.'; return; }

    const usuario = snap.docs[0].data();
    if (!['admin', 'gestao'].includes(usuario.perfil)) {
      erro.textContent = 'Acesso negado. Apenas Admin ou Gestão podem importar.';
      return;
    }

    await window._fb.signInWithEmailAndPassword(window._auth, usuario.email, senha);

    document.getElementById('tela-login-imp').style.display = 'none';
    document.getElementById('app-importacao').style.display = 'block';

    // Pré-carregar turmas e colaboradores do Firebase
    await carregarDadosFirebase();

  } catch (e) {
    console.error(e);
    erro.textContent = 'Chapa ou senha incorretos.';
  }
}

// ─────────────────────────────────────────────
// PRÉ-CARREGAR DADOS DO FIREBASE
// ─────────────────────────────────────────────
async function carregarDadosFirebase() {
  const [snapTurmas, snapColab] = await Promise.all([
    window._fb.getDocs(window._fb.collection(window._db, 'turmas')),
    window._fb.getDocs(window._fb.collection(window._db, 'colaboradores'))
  ]);

  // Mapear turmas por nome (lowercase) → { id, dados }
  turmasFirebase = {};
  snapTurmas.forEach(d => {
    const nome = d.data().nome?.toLowerCase().trim();
    turmasFirebase[nome] = { id: d.id, ...d.data() };
  });

  // Mapear colaboradores por chapa → { id, dados }
  colaboradoresFirebase = {};
  snapColab.forEach(d => {
    const chapa = d.data().chapa?.trim();
    if (chapa) colaboradoresFirebase[chapa] = { id: d.id, ...d.data() };
  });
}

// ─────────────────────────────────────────────
// LER ARQUIVO JSON
// ─────────────────────────────────────────────
function lerArquivo(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const conteudo = JSON.parse(e.target.result);

      if (!Array.isArray(conteudo)) {
        alert('❌ O arquivo deve ser um array JSON. Verifique o formato.');
        return;
      }

      // Validar campos obrigatórios
      const camposObrigatorios = ['chapa', 'nome'];
      const invalidos = conteudo.filter(item =>
        camposObrigatorios.some(c => !item[c])
      );
      if (invalidos.length > 0) {
        alert(`❌ ${invalidos.length} registro(s) sem chapa ou nome. Corrija o arquivo.`);
        return;
      }

      dadosJSON = conteudo;

      // Mostrar preview
      document.getElementById('preview-arquivo').style.display = 'block';
      document.getElementById('nome-arquivo').textContent = '📄 ' + file.name;
      document.getElementById('qtd-registros').textContent =
        `✅ ${conteudo.length} colaboradores encontrados no arquivo`;

      analisarMudancas();

    } catch (err) {
      alert('❌ Arquivo JSON inválido. Verifique se o formato está correto.');
      console.error(err);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ─────────────────────────────────────────────
// ANALISAR MUDANÇAS DE TURMA
// ─────────────────────────────────────────────
function analisarMudancas() {
  alertasMudanca = [];

  let novos = 0;
  let atualizados = 0;
  let mudancaTurma = 0;
  let demitidos = 0;

  dadosJSON.forEach((item, idx) => {
    const chapa = item.chapa?.trim();
    const existente = colaboradoresFirebase[chapa];
    const turmaNova = item.turma?.toLowerCase().trim();

    if (item.demissao) demitidos++;

    if (!existente) {
      novos++;
    } else {
      const turmaAtual = existente.turmaNome?.toLowerCase().trim();
      if (turmaNova && turmaAtual && turmaNova !== turmaAtual) {
        mudancaTurma++;
        alertasMudanca.push({
          idx,
          chapa,
          nome: item.nome,
          turmaAntiga: existente.turmaNome || '—',
          turmaNova: item.turma,
          dataInicio: ''
        });
      } else {
        atualizados++;
      }
    }
  });

  // Mostrar stats
  document.getElementById('stats-preview').innerHTML = `
    <div class="stat-card"><div class="stat-num azul">${dadosJSON.length}</div><div class="stat-label">Total</div></div>
    <div class="stat-card"><div class="stat-num verde">${novos}</div><div class="stat-label">Novos</div></div>
    <div class="stat-card"><div class="stat-num amarelo">${mudancaTurma}</div><div class="stat-label">Mudança de Turma</div></div>
  `;

  // Mostrar alertas se houver mudanças de turma
  if (alertasMudanca.length > 0) {
    document.getElementById('secao-alertas').style.display = 'block';
    const listaAlertas = document.getElementById('lista-alertas');
    listaAlertas.innerHTML = alertasMudanca.map((a, i) => `
      <div class="alerta-item">
        <strong>👤 ${a.nome} — Chapa: ${a.chapa}</strong>
        <span style="font-size:13px;color:#666">
          De: <b>${a.turmaAntiga}</b> → Para: <b>${a.turmaNova}</b>
        </span>
        <label style="display:block;font-size:13px;margin-top:8px;font-weight:600;color:#856404">
          📅 Data de início na nova turma:
        </label>
        <input type="date" id="data-mudanca-${i}"
          onchange="registrarDataMudanca(${i}, this.value)"
          style="max-width:200px" />
        <p style="font-size:12px;color:#999;margin-top:4px">
          Obrigatório para manter o histórico correto
        </p>
      </div>
    `).join('');
  } else {
    document.getElementById('secao-alertas').style.display = 'none';
  }

  document.getElementById('secao-importar').style.display = 'block';
}

function registrarDataMudanca(idx, data) {
  if (alertasMudanca[idx]) {
    alertasMudanca[idx].dataInicio = data;
  }
}

// ─────────────────────────────────────────────
// CONFIRMAR IMPORTAÇÃO
// ─────────────────────────────────────────────
async function confirmarImportacao() {
  const msg = document.getElementById('imp-msg');
  msg.textContent = '';

  // Validar datas de mudança de turma
  const semData = alertasMudanca.filter(a => !a.dataInicio);
  if (semData.length > 0) {
    msg.textContent = `⚠️ Informe a data de início para ${semData.length} mudança(s) de turma antes de continuar.`;
    msg.style.color = '#e53e3e';
    return;
  }

  document.getElementById('btn-importar').disabled = true;
  document.getElementById('btn-importar').textContent = '⏳ Importando...';

  const log = [];
  let contNovos = 0, contAtualizados = 0, contMudancas = 0, contErros = 0;

  for (const item of dadosJSON) {
    try {
      const chapa = item.chapa?.trim();
      const turmaNome = item.turma?.trim();

      // Buscar/criar turma no Firebase
      let turmaId = null;
      let turmaNomeFinal = turmaNome || '';
      if (turmaNome) {
        const turmaKey = turmaNome.toLowerCase();
        if (turmasFirebase[turmaKey]) {
          turmaId = turmasFirebase[turmaKey].id;
        } else {
          // Criar nova turma automaticamente
          const novaRef = await window._fb.addDoc(
            window._fb.collection(window._db, 'turmas'),
            {
              nome: turmaNome,
              liderNome: item.lider || '',
              fazendaId: '',
              criadoEm: new Date().toISOString(),
              criadoViaAPI: true
            }
          );
          turmaId = novaRef.id;
          turmasFirebase[turmaKey] = { id: turmaId, nome: turmaNome };
          log.push(`<span class="log-warn">⚠ Turma criada automaticamente: ${turmaNome}</span>`);
        }
      }

      const dadosColab = {
        chapa,
        nome: item.nome?.trim() || '',
        funcao: item.funcao?.trim() || '',
        liderNome: item.lider?.trim() || '',
        turmaId: turmaId || '',
        turmaNome: turmaNomeFinal,
        admissao: item.admissao || '',
        demissao: item.demissao || '',
        inicioJornada: item.inicioJornada || '08:00',
        fimJornada: item.fimJornada || '17:00',
        demitido: !!item.demissao,
        atualizadoEm: new Date().toISOString(),
        atualizadoViaAPI: true
      };

      const existente = colaboradoresFirebase[chapa];

      if (!existente) {
        // NOVO colaborador
        dadosColab.criadoEm = new Date().toISOString();
        const ref = await window._fb.addDoc(
          window._fb.collection(window._db, 'colaboradores'), dadosColab
        );
        colaboradoresFirebase[chapa] = { id: ref.id, ...dadosColab };
        contNovos++;
        log.push(`<span class="log-ok">✓ Novo: ${item.nome} (${chapa})</span>`);

        // Registrar histórico inicial
        await registrarHistorico(ref.id, null, turmaId, turmaNomeFinal, new Date().toISOString().split('T')[0]);

      } else {
        const turmaAtual = existente.turmaNome?.toLowerCase().trim();
        const turmaNova = turmaNomeFinal?.toLowerCase().trim();
        const mudou = turmaNova && turmaAtual && turmaNova !== turmaAtual;

        if (mudou) {
          // Buscar data de início informada pelo usuário
          const alertaIdx = alertasMudanca.findIndex(a => a.chapa === chapa);
          const dataInicio = alertasMudanca[alertaIdx]?.dataInicio || new Date().toISOString().split('T')[0];

          // Encerrar histórico anterior (data fim = dia anterior)
          const dataFim = subtrairUmDia(dataInicio);
          await encerrarHistoricoAtivo(existente.id, dataFim);

          // Atualizar colaborador
          await window._fb.updateDoc(
            window._fb.doc(window._db, 'colaboradores', existente.id), dadosColab
          );

          // Criar novo histórico
          await registrarHistorico(existente.id, existente.turmaId, turmaId, turmaNomeFinal, dataInicio);

          colaboradoresFirebase[chapa] = { ...existente, ...dadosColab };
          contMudancas++;
          log.push(`<span class="log-warn">↔ Mudança de turma: ${item.nome} → ${turmaNomeFinal} (a partir de ${dataInicio})</span>`);

        } else {
          // Apenas atualizar dados
          await window._fb.updateDoc(
            window._fb.doc(window._db, 'colaboradores', existente.id), dadosColab
          );
          colaboradoresFirebase[chapa] = { ...existente, ...dadosColab };
          contAtualizados++;
          log.push(`<span class="log-ok">↻ Atualizado: ${item.nome} (${chapa})</span>`);
        }
      }

    } catch (e) {
      contErros++;
      log.push(`<span class="log-err">✗ Erro em ${item.chapa}: ${e.message}</span>`);
      console.error('Erro ao importar', item.chapa, e);
    }
  }

  // Registrar log da importação no Firebase
  await window._fb.addDoc(window._fb.collection(window._db, 'logsImportacao'), {
    data: new Date().toISOString(),
    total: dadosJSON.length,
    novos: contNovos,
    atualizados: contAtualizados,
    mudancasTurma: contMudancas,
    erros: contErros
  });

  // Mostrar resultado
  document.getElementById('secao-resultado').style.display = 'block';
  document.getElementById('secao-importar').style.display = 'none';
  document.getElementById('secao-alertas').style.display = 'none';

  document.getElementById('stats-resultado').innerHTML = `
    <div class="stat-card"><div class="stat-num verde">${contNovos}</div><div class="stat-label">Novos</div></div>
    <div class="stat-card"><div class="stat-num azul">${contAtualizados}</div><div class="stat-label">Atualizados</div></div>
    <div class="stat-card"><div class="stat-num amarelo">${contMudancas}</div><div class="stat-label">Turma Alterada</div></div>
  `;

  document.getElementById('log-importacao').innerHTML = log.join('<br>');
  document.getElementById('log-importacao').scrollTop = 999999;
}

// ─────────────────────────────────────────────
// HISTÓRICO DE TURMA
// ─────────────────────────────────────────────
async function registrarHistorico(colaboradorId, turmaIdAntiga, turmaIdNova, turmaNomeNova, dataInicio) {
  await window._fb.addDoc(window._fb.collection(window._db, 'historicoTurmas'), {
    colaboradorId,
    turmaIdAntiga: turmaIdAntiga || null,
    turmaIdNova,
    turmaNomeNova,
    dataInicio,
    dataFim: null,
    ativo: true,
    criadoEm: new Date().toISOString()
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

function subtrairUmDia(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────
// NOVA IMPORTAÇÃO
// ─────────────────────────────────────────────
function novaImportacao() {
  dadosJSON = [];
  alertasMudanca = [];
  document.getElementById('arquivo-json').value = '';
  document.getElementById('preview-arquivo').style.display = 'none';
  document.getElementById('secao-alertas').style.display = 'none';
  document.getElementById('secao-importar').style.display = 'none';
  document.getElementById('secao-resultado').style.display = 'none';
  document.getElementById('btn-importar').disabled = false;
  document.getElementById('btn-importar').textContent = '🚀 Importar para o Firebase';
  document.getElementById('imp-msg').textContent = '';
  window.scrollTo(0, 0);
}
