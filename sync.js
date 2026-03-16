// =============================================
// SINCRONIZAÇÃO AUTOMÁTICA — RH → FIREBASE
// v2.0 — Com auditoria de log
// Roda via GitHub Actions todo dia às 06h (Brasília)
// =============================================

const { initializeApp } = require('firebase/app');
const {
  getFirestore, collection, doc,
  addDoc, getDocs, updateDoc, query, where
} = require('firebase/firestore');
const {
  getAuth, signInWithEmailAndPassword
} = require('firebase/auth');

// ─────────────────────────────────────────────
// FIREBASE
// ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.FIREBASE_API_KEY,
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.FIREBASE_PROJECT_ID,
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.FIREBASE_APP_ID
};

// ─────────────────────────────────────────────
// API DO RH
// ─────────────────────────────────────────────
const RH_CONFIG = {
  url:     process.env.RH_API_URL,
  token:   process.env.RH_API_TOKEN,
  usuario: process.env.RH_API_USUARIO,
  senha:   process.env.RH_API_SENHA
};

const MODO = process.env.MODO_EXECUCAO || 'normal';

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

const stats = { total:0, novos:0, atualizados:0, mudancasTurma:0, demitidos:0, erros:0 };

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  console.log('\n================================================');
  console.log('🔄 SINCRONIZAÇÃO RH → FIREBASE');
  console.log(`📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  console.log(`🔧 Modo: ${MODO}`);
  console.log('================================================\n');

  await autenticarFirebase();

  console.log('📡 Buscando dados da API do RH...');
  const colaboradoresRH = await buscarDadosRH();
  if (!colaboradoresRH || colaboradoresRH.length === 0) {
    console.log('⚠️  Nenhum dado retornado pela API do RH. Abortando.');
    process.exit(1);
  }
  console.log(`✅ ${colaboradoresRH.length} colaboradores recebidos`);
  stats.total = colaboradoresRH.length;

  console.log('\n📦 Carregando dados do Firebase...');
  const { colabMap, turmaMap } = await carregarFirebase();
  console.log(`   ${Object.keys(colabMap).length} colaboradores | ${Object.keys(turmaMap).length} turmas`);

  console.log('\n🔄 Processando...\n');
  if (MODO === 'teste-apenas') console.log('⚠️  MODO TESTE — nenhuma alteração será salva\n');

  for (const item of colaboradoresRH) {
    await processarColaborador(item, colabMap, turmaMap);
  }

  if (MODO !== 'teste-apenas') await gravarLog();

  console.log('\n================================================');
  console.log('📊 RELATÓRIO FINAL');
  console.log('================================================');
  console.log(`Total      : ${stats.total}`);
  console.log(`Novos      : ${stats.novos}`);
  console.log(`Atualizados: ${stats.atualizados}`);
  console.log(`Mudança    : ${stats.mudancasTurma}`);
  console.log(`Demitidos  : ${stats.demitidos}`);
  console.log(`Erros      : ${stats.erros}`);
  console.log('================================================');

  if (stats.erros > 0) { console.log('\n⚠️  Verifique os erros acima.'); process.exit(1); }
  else console.log('\n✅ Sincronização concluída com sucesso!');
}

// ─────────────────────────────────────────────
// AUTENTICAR
// ─────────────────────────────────────────────
async function autenticarFirebase() {
  try {
    console.log('🔐 Autenticando no Firebase...');
    await signInWithEmailAndPassword(auth, process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_SENHA);
    console.log('✅ Firebase autenticado');
  } catch(e) { console.error('❌ Erro ao autenticar:', e.message); process.exit(1); }
}

// ─────────────────────────────────────────────
// BUSCAR DADOS DO RH
// ─────────────────────────────────────────────
async function buscarDadosRH() {
  try {
    if (!RH_CONFIG.url) {
      console.log('⚠️  RH_API_URL não configurada — usando dados de exemplo');
      return gerarDadosExemplo();
    }

    // ── PASSO 1: Montar headers ───────────────
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

    // Autenticação por token fixo (mais comum no Totvs RM)
    if (RH_CONFIG.token) {
      headers['Authorization'] = `Bearer ${RH_CONFIG.token}`;
      // Alternativas — descomente conforme seu Totvs:
      // headers['token'] = RH_CONFIG.token;
      // headers['x-api-key'] = RH_CONFIG.token;
    }

    // ── PASSO 2: Login com usuário/senha (se necessário) ─
    // Descomente se o seu Totvs exige obter um token antes:
    /*
    if (RH_CONFIG.usuario && RH_CONFIG.senha) {
      const loginResp = await fetch(`${RH_CONFIG.url}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'password', username: RH_CONFIG.usuario, password: RH_CONFIG.senha })
      });
      if (!loginResp.ok) throw new Error(`Login falhou: ${loginResp.status}`);
      const loginData = await loginResp.json();
      headers['Authorization'] = `Bearer ${loginData.access_token}`;
    }
    */

    // ── PASSO 3: Buscar colaboradores ────────
    // URLs comuns no Totvs RM — ajuste conforme seu ambiente:
    // https://SEU_SERVIDOR/api/rh/v1/funcionarios
    // https://SEU_SERVIDOR/totvsrm/api/rh/v1/funcionarios?codColigada=1
    // https://SEU_SERVIDOR/RM/api/rh/v1/funcionarios
    const resposta = await fetch(RH_CONFIG.url, { headers });
    if (!resposta.ok) throw new Error(`API retornou ${resposta.status}: ${resposta.statusText}`);

    const dados = await resposta.json();

    // Normalizar o array conforme formato da resposta
    if (Array.isArray(dados))                          return dados.map(normalizar);
    if (dados.items && Array.isArray(dados.items))     return dados.items.map(normalizar);
    if (dados.data && Array.isArray(dados.data))       return dados.data.map(normalizar);
    if (dados.colaboradores && Array.isArray(dados.colaboradores)) return dados.colaboradores.map(normalizar);

    console.error('❌ Formato não reconhecido:', JSON.stringify(dados).slice(0, 200));
    return [];

  } catch(e) { console.error('❌ Erro ao buscar RH:', e.message); stats.erros++; return []; }
}

// ─────────────────────────────────────────────
// NORMALIZAR CAMPOS
// Ajuste os nomes dos campos conforme a sua API do RH
// ─────────────────────────────────────────────
function normalizar(item) {
  return {
    chapa:         String(item.chapa         || item.Chapa         || item.CHAPA         || item.matricula    || item.CODSERVIDOR   || '').trim(),
    nome:          String(item.nome          || item.Nome          || item.NOME          || item.nomeCompleto || item.NOMEFUNCIONARIO|| '').trim(),
    funcao:        String(item.funcao        || item.Funcao        || item.cargo         || item.Cargo        || item.DESCRICAOFUNCAO|| '').trim(),
    lider:         String(item.lider         || item.Lider         || item.nomeChefia    || item.NOMECHEFIA   || item.supervisor     || '').trim(),
    turma:         String(item.turma         || item.Turma         || item.TURMA         || item.grupo        || item.DESCRICAOSECAO || item.CODSECAO || '').trim(),
    admissao:      formatarDataAPI(item.admissao      || item.Admissao      || item.dataAdmissao  || item.DATAADMISSAO  || item.dt_admissao   || ''),
    demissao:      formatarDataAPI(item.demissao      || item.Demissao      || item.dataDemissao  || item.DATADEMISSAO  || item.dt_demissao   || ''),
    inicioJornada: String(item.inicioJornada || item.horaEntrada   || item.HORAINICIO    || item.hr_entrada   || '08:00').trim(),
    fimJornada:    String(item.fimJornada    || item.horaSaida     || item.HORAFIM       || item.hr_saida     || '17:00').trim(),
  };
}

function formatarDataAPI(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) { const [d,m,y] = s.split('/'); return `${y}-${m}-${d}`; }
  if (s.includes('T')) return s.slice(0, 10);
  return '';
}

// ─────────────────────────────────────────────
// CARREGAR FIREBASE
// ─────────────────────────────────────────────
async function carregarFirebase() {
  const [snapColab, snapTurmas] = await Promise.all([
    getDocs(collection(db, 'colaboradores')),
    getDocs(collection(db, 'turmas'))
  ]);
  const colabMap = {};
  snapColab.forEach(d => { const c = d.data(); if (c.chapa) colabMap[c.chapa.trim()] = { id: d.id, ...c }; });
  const turmaMap = {};
  snapTurmas.forEach(d => { const t = d.data(); if (t.nome) turmaMap[t.nome.toLowerCase().trim()] = { id: d.id, ...t }; });
  return { colabMap, turmaMap };
}

// ─────────────────────────────────────────────
// PROCESSAR COLABORADOR
// ─────────────────────────────────────────────
async function processarColaborador(item, colabMap, turmaMap) {
  try {
    const chapa = item.chapa;
    if (!chapa || !item.nome) { console.log(`  ⚠️  Ignorado — sem chapa ou nome`); return; }

    // Resolver turma
    let turmaId = null; let turmaNome = item.turma || '';
    const turmaKey = turmaNome.toLowerCase().trim();
    if (turmaKey) {
      if (turmaMap[turmaKey]) {
        turmaId = turmaMap[turmaKey].id;
      } else if (MODO !== 'teste-apenas') {
        const novaRef = await addDoc(collection(db, 'turmas'), {
          nome: turmaNome, liderNome: item.lider || '', fazendaId: '',
          criadoEm: new Date().toISOString(), criadoViaSync: true
        });
        turmaId = novaRef.id;
        turmaMap[turmaKey] = { id: turmaId, nome: turmaNome };
        console.log(`  📁 Turma criada: ${turmaNome}`);
      }
    }

    const dadosNovos = {
      chapa, nome: item.nome, funcao: item.funcao || '', liderNome: item.lider || '',
      turmaId: turmaId || '', turmaNome,
      admissao: item.admissao || '', demissao: item.demissao || '',
      inicioJornada: item.inicioJornada || '08:00',
      fimJornada:    item.fimJornada    || '17:00',
      demitido: !!item.demissao,
      atualizadoEm: new Date().toISOString(), syncAuto: true
    };

    const existente = colabMap[chapa];

    if (!existente) {
      if (MODO !== 'teste-apenas') {
        dadosNovos.criadoEm = new Date().toISOString();
        const ref = await addDoc(collection(db, 'colaboradores'), dadosNovos);
        await registrarHistorico(ref.id, null, turmaId, turmaNome, hoje());
        await registrarAuditoria('colaboradores', ref.id, 'sync-create', null, { chapa, nome: item.nome });
        colabMap[chapa] = { id: ref.id, ...dadosNovos };
      }
      console.log(`  ✅ Novo: ${item.nome} (${chapa})`);
      stats.novos++;

    } else {
      const turmaAtual  = (existente.turmaNome || '').toLowerCase().trim();
      const turmaNovaN  = turmaNome.toLowerCase().trim();
      const mudouTurma  = turmaNovaN && turmaAtual && turmaNovaN !== turmaAtual;

      if (mudouTurma) {
        if (MODO !== 'teste-apenas') {
          await addDoc(collection(db, 'alertasMudancaTurma'), {
            colaboradorId: existente.id, chapa, nome: item.nome,
            turmaAntigaId: existente.turmaId || '', turmaAntigaNome: existente.turmaNome || '',
            turmaNovaId: turmaId || '', turmaNovaNome: turmaNome,
            dataDeteccao: new Date().toISOString(), resolvido: false, dadosPendentes: dadosNovos
          });
        }
        console.log(`  ⚠️  Mudança detectada: ${item.nome} → "${turmaNome}" (aguarda confirmação de data)`);
        stats.mudancasTurma++;

      } else {
        if (MODO !== 'teste-apenas') {
          await updateDoc(doc(db, 'colaboradores', existente.id), dadosNovos);
          await registrarAuditoria('colaboradores', existente.id, 'sync-update', { turmaNome: existente.turmaNome }, { turmaNome });
        }
        if (item.demissao && !existente.demitido) {
          console.log(`  🔴 Demitido: ${item.nome} (${chapa})`);
          stats.demitidos++;
        } else {
          stats.atualizados++;
        }
      }
    }

  } catch(e) { console.error(`  ❌ Erro ${item.chapa}: ${e.message}`); stats.erros++; }
}

// ─────────────────────────────────────────────
// HISTÓRICO DE TURMA
// ─────────────────────────────────────────────
async function registrarHistorico(colaboradorId, turmaIdAntiga, turmaIdNova, turmaNomeNova, dataInicio) {
  const q = query(collection(db,'historicoTurmas'), where('colaboradorId','==',colaboradorId), where('ativo','==',true));
  const snap = await getDocs(q);
  for (const d of snap.docs) await updateDoc(doc(db,'historicoTurmas',d.id),{dataFim:subtrairUmDia(dataInicio),ativo:false});
  await addDoc(collection(db,'historicoTurmas'),{colaboradorId,turmaIdAntiga:turmaIdAntiga||null,turmaIdNova,turmaNomeNova,dataInicio,dataFim:null,ativo:true,criadoEm:new Date().toISOString()});
}

// ─────────────────────────────────────────────
// AUDITORIA
// ─────────────────────────────────────────────
async function registrarAuditoria(colecao, documentoId, acao, valorAnterior, valorNovo) {
  try {
    await addDoc(collection(db,'auditoria'),{
      colecao, documentoId: documentoId||'', acao,
      valorAnterior: valorAnterior||null, valorNovo: valorNovo||null,
      usuarioId:'sync-automatico', usuarioNome:'Sync Automático', usuarioPerfil:'sistema',
      timestamp: new Date().toISOString()
    });
  } catch(e) { console.warn('Auditoria ignorada:', e.message); }
}

// ─────────────────────────────────────────────
// LOG DA SINCRONIZAÇÃO
// ─────────────────────────────────────────────
async function gravarLog() {
  await addDoc(collection(db,'logsSync'),{data:new Date().toISOString(),...stats,modo:MODO});
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
function hoje()              { return new Date().toISOString().split('T')[0]; }
function subtrairUmDia(s)    { const d=new Date(s+'T12:00:00');d.setDate(d.getDate()-1);return d.toISOString().split('T')[0]; }
function gerarDadosExemplo() {
  return [
    { chapa:'000001',nome:'Colaborador Exemplo 1',funcao:'Operador',lider:'Líder A',turma:'Turma A',admissao:'2023-01-10',demissao:'',inicioJornada:'07:00',fimJornada:'17:00' },
    { chapa:'000002',nome:'Colaborador Exemplo 2',funcao:'Auxiliar',lider:'Líder B',turma:'Turma B',admissao:'2022-05-20',demissao:'',inicioJornada:'08:00',fimJornada:'18:00' }
  ];
}

main().catch(e=>{console.error('❌ Erro fatal:',e);process.exit(1);});
