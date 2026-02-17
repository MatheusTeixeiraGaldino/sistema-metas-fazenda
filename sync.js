// =============================================
// SINCRONIZAÇÃO AUTOMÁTICA — RH → FIREBASE
// Roda via GitHub Actions todo dia às 06h
// =============================================

const { initializeApp } = require('firebase/app');
const {
  getFirestore,
  collection, doc,
  addDoc, getDocs, updateDoc,
  query, where
} = require('firebase/firestore');
const {
  getAuth,
  signInWithEmailAndPassword
} = require('firebase/auth');

// ─────────────────────────────────────────────
// CONFIGURAÇÃO FIREBASE (via secrets do GitHub)
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
// CONFIGURAÇÃO DA API DO RH
// ─────────────────────────────────────────────
const RH_CONFIG = {
  url:      process.env.RH_API_URL,      // URL da API do RH
  token:    process.env.RH_API_TOKEN,    // Token fixo (se tiver)
  usuario:  process.env.RH_API_USUARIO,  // Usuário (se precisar de login)
  senha:    process.env.RH_API_SENHA     // Senha (se precisar de login)
};

const MODO = process.env.MODO_EXECUCAO || 'normal';

// ─────────────────────────────────────────────
// INICIALIZAR
// ─────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

// Contadores para o relatório final
const stats = {
  total: 0, novos: 0, atualizados: 0,
  mudancasTurma: 0, demitidos: 0, erros: 0
};

// ─────────────────────────────────────────────
// FUNÇÃO PRINCIPAL
// ─────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('================================================');
  console.log('🔄 SINCRONIZAÇÃO RH → FIREBASE');
  console.log(`📅 ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  console.log(`🔧 Modo: ${MODO}`);
  console.log('================================================');
  console.log('');

  // 1. Autenticar no Firebase
  await autenticarFirebase();

  // 2. Buscar dados do RH
  console.log('📡 Buscando dados da API do RH...');
  const colaboradoresRH = await buscarDadosRH();
  if (!colaboradoresRH || colaboradoresRH.length === 0) {
    console.log('⚠️  Nenhum dado retornado pela API do RH. Abortando.');
    process.exit(1);
  }
  console.log(`✅ ${colaboradoresRH.length} colaboradores recebidos da API`);
  stats.total = colaboradoresRH.length;

  // 3. Carregar dados atuais do Firebase
  console.log('\n📦 Carregando dados do Firebase...');
  const { colabMap, turmaMap } = await carregarFirebase();
  console.log(`   ${Object.keys(colabMap).length} colaboradores no Firebase`);
  console.log(`   ${Object.keys(turmaMap).length} turmas no Firebase`);

  // 4. Processar cada colaborador
  console.log('\n🔄 Processando colaboradores...\n');

  if (MODO === 'teste-apenas') {
    console.log('⚠️  MODO TESTE — nenhuma alteração será salva no Firebase\n');
  }

  for (const item of colaboradoresRH) {
    await processarColaborador(item, colabMap, turmaMap);
  }

  // 5. Gravar log no Firebase
  if (MODO !== 'teste-apenas') {
    await gravarLog();
  }

  // 6. Relatório final
  console.log('');
  console.log('================================================');
  console.log('📊 RELATÓRIO FINAL');
  console.log('================================================');
  console.log(`Total processados : ${stats.total}`);
  console.log(`Novos             : ${stats.novos}`);
  console.log(`Atualizados       : ${stats.atualizados}`);
  console.log(`Mudança de turma  : ${stats.mudancasTurma}`);
  console.log(`Demitidos         : ${stats.demitidos}`);
  console.log(`Erros             : ${stats.erros}`);
  console.log('================================================');

  if (stats.erros > 0) {
    console.log('\n⚠️  Houve erros — verifique os logs acima');
    process.exit(1);
  } else {
    console.log('\n✅ Sincronização concluída com sucesso!');
  }
}

// ─────────────────────────────────────────────
// AUTENTICAR NO FIREBASE
// ─────────────────────────────────────────────
async function autenticarFirebase() {
  try {
    console.log('🔐 Autenticando no Firebase...');
    await signInWithEmailAndPassword(
      auth,
      process.env.FIREBASE_ADMIN_EMAIL,
      process.env.FIREBASE_ADMIN_SENHA
    );
    console.log('✅ Firebase autenticado');
  } catch (e) {
    console.error('❌ Erro ao autenticar no Firebase:', e.message);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────
// BUSCAR DADOS DA API DO RH
// ─────────────────────────────────────────────
async function buscarDadosRH() {
  try {
    if (!RH_CONFIG.url) {
      // ── MODO SIMULAÇÃO ──────────────────────────
      // Use isso para testar enquanto a API do RH não está pronta
      console.log('⚠️  RH_API_URL não configurada — usando dados de exemplo');
      return gerarDadosExemplo();
    }

    // ── AUTENTICAÇÃO NA API DO RH ────────────────
    // Descomente e ajuste conforme o tipo de autenticação do seu RH:

    // OPÇÃO 1: Token fixo no header (mais comum)
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (RH_CONFIG.token) {
      headers['Authorization'] = `Bearer ${RH_CONFIG.token}`;
      // Ou use: headers['token'] = RH_CONFIG.token;
      // Ou use: headers['x-api-key'] = RH_CONFIG.token;
    }

    // OPÇÃO 2: Login com usuário e senha para obter token
    // Descomente se seu RH exige login primeiro:
    /*
    if (RH_CONFIG.usuario && RH_CONFIG.senha) {
      const loginResp = await fetch('https://SUA_API/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: RH_CONFIG.usuario,
          senha: RH_CONFIG.senha
        })
      });
      const loginData = await loginResp.json();
      headers['Authorization'] = `Bearer ${loginData.token}`;
    }
    */

    // ── CHAMAR A API ─────────────────────────────
    const resposta = await fetch(RH_CONFIG.url, { headers });

    if (!resposta.ok) {
      throw new Error(`API retornou status ${resposta.status}: ${resposta.statusText}`);
    }

    const dados = await resposta.json();

    // Normalizar o retorno — adapte conforme o formato da sua API
    // Caso a API retorne { data: [...] } ou { colaboradores: [...] }:
    if (Array.isArray(dados)) return dados.map(normalizar);
    if (dados.data && Array.isArray(dados.data)) return dados.data.map(normalizar);
    if (dados.colaboradores && Array.isArray(dados.colaboradores)) return dados.colaboradores.map(normalizar);

    console.error('❌ Formato de resposta não reconhecido:', JSON.stringify(dados).slice(0, 200));
    return [];

  } catch (e) {
    console.error('❌ Erro ao buscar dados do RH:', e.message);
    stats.erros++;
    return [];
  }
}

// ─────────────────────────────────────────────
// NORMALIZAR CAMPOS DA API
// Ajuste os nomes dos campos conforme sua API
// ─────────────────────────────────────────────
function normalizar(item) {
  return {
    // Tente os nomes mais comuns — ajuste se necessário
    chapa:         String(item.chapa         || item.Chapa         || item.CHAPA         || item.matricula || '').trim(),
    nome:          String(item.nome          || item.Nome          || item.NOME          || item.nomeCompleto || '').trim(),
    funcao:        String(item.funcao        || item.Funcao        || item.funcção       || item.cargo || item.Cargo || '').trim(),
    lider:         String(item.lider         || item.Lider         || item.liderança     || item.supervisor || '').trim(),
    turma:         String(item.turma         || item.Turma         || item.TURMA         || item.grupo || '').trim(),
    admissao:      String(item.admissao      || item.Admissao      || item.dataAdmissao  || item.dt_admissao || '').trim(),
    demissao:      String(item.demissao      || item.Demissao      || item.dataDemissao  || item.dt_demissao || '').trim(),
    inicioJornada: String(item.inicioJornada || item.horaEntrada   || item.hr_entrada    || '08:00').trim(),
    fimJornada:    String(item.fimJornada    || item.horaSaida     || item.hr_saida      || '17:00').trim(),
  };
}

// ─────────────────────────────────────────────
// CARREGAR DADOS ATUAIS DO FIREBASE
// ─────────────────────────────────────────────
async function carregarFirebase() {
  const [snapColab, snapTurmas] = await Promise.all([
    getDocs(collection(db, 'colaboradores')),
    getDocs(collection(db, 'turmas'))
  ]);

  const colabMap = {};
  snapColab.forEach(d => {
    const chapa = d.data().chapa?.trim();
    if (chapa) colabMap[chapa] = { id: d.id, ...d.data() };
  });

  const turmaMap = {};
  snapTurmas.forEach(d => {
    const nome = d.data().nome?.toLowerCase().trim();
    if (nome) turmaMap[nome] = { id: d.id, ...d.data() };
  });

  return { colabMap, turmaMap };
}

// ─────────────────────────────────────────────
// PROCESSAR CADA COLABORADOR
// ─────────────────────────────────────────────
async function processarColaborador(item, colabMap, turmaMap) {
  try {
    const chapa = item.chapa;
    if (!chapa || !item.nome) {
      console.log(`  ⚠️  Registro ignorado — sem chapa ou nome`);
      return;
    }

    // Resolver turma
    let turmaId = null;
    let turmaNome = item.turma || '';
    const turmaKey = turmaNome.toLowerCase().trim();

    if (turmaKey) {
      if (turmaMap[turmaKey]) {
        turmaId = turmaMap[turmaKey].id;
      } else if (MODO !== 'teste-apenas') {
        // Criar turma nova automaticamente
        const novaRef = await addDoc(collection(db, 'turmas'), {
          nome: turmaNome,
          liderNome: item.lider || '',
          fazendaId: '',
          criadoEm: new Date().toISOString(),
          criadoViaSync: true
        });
        turmaId = novaRef.id;
        turmaMap[turmaKey] = { id: turmaId, nome: turmaNome };
        console.log(`  📁 Nova turma criada: ${turmaNome}`);
      }
    }

    const dadosNovos = {
      chapa,
      nome: item.nome,
      funcao: item.funcao || '',
      liderNome: item.lider || '',
      turmaId: turmaId || '',
      turmaNome,
      admissao: item.admissao || '',
      demissao: item.demissao || '',
      inicioJornada: item.inicioJornada || '08:00',
      fimJornada: item.fimJornada || '17:00',
      demitido: !!item.demissao,
      atualizadoEm: new Date().toISOString(),
      syncAuto: true
    };

    const existente = colabMap[chapa];

    if (!existente) {
      // ── NOVO COLABORADOR ──────────────────────
      if (MODO !== 'teste-apenas') {
        dadosNovos.criadoEm = new Date().toISOString();
        const ref = await addDoc(collection(db, 'colaboradores'), dadosNovos);
        await registrarHistorico(ref.id, null, turmaId, turmaNome, hoje());
        colabMap[chapa] = { id: ref.id, ...dadosNovos };
      }
      console.log(`  ✅ Novo: ${item.nome} (${chapa})`);
      stats.novos++;

    } else {
      // ── COLABORADOR EXISTENTE ─────────────────
      const turmaAtual = (existente.turmaNome || '').toLowerCase().trim();
      const turmaNovaNorm = turmaNome.toLowerCase().trim();
      const mudouTurma = turmaNovaNorm && turmaAtual && turmaNovaNorm !== turmaAtual;

      if (mudouTurma) {
        // ── MUDANÇA DE TURMA ──────────────────────
        // Gerar alerta — data de início será preenchida pelo usuário no sistema
        if (MODO !== 'teste-apenas') {
          await addDoc(collection(db, 'alertasMudancaTurma'), {
            colaboradorId: existente.id,
            chapa,
            nome: item.nome,
            turmaAntigaId: existente.turmaId || '',
            turmaAntigaNome: existente.turmaNome || '',
            turmaNovaId: turmaId || '',
            turmaNovaNome: turmaNome,
            dataDeteccao: new Date().toISOString(),
            resolvido: false,
            dadosPendentes: dadosNovos
          });
        }
        console.log(`  ⚠️  Mudança de turma detectada: ${item.nome} (${chapa})`);
        console.log(`      De: "${existente.turmaNome}" → Para: "${turmaNome}"`);
        console.log(`      ℹ️  Aguardando confirmação de data no sistema`);
        stats.mudancasTurma++;

      } else {
        // ── ATUALIZAÇÃO NORMAL ────────────────────
        if (MODO !== 'teste-apenas') {
          await updateDoc(doc(db, 'colaboradores', existente.id), dadosNovos);
        }
        if (item.demissao && !existente.demitido) {
          console.log(`  🔴 Demitido: ${item.nome} (${chapa})`);
          stats.demitidos++;
        } else {
          stats.atualizados++;
        }
      }
    }

  } catch (e) {
    console.error(`  ❌ Erro ao processar ${item.chapa} — ${item.nome}:`, e.message);
    stats.erros++;
  }
}

// ─────────────────────────────────────────────
// REGISTRAR HISTÓRICO DE TURMA
// ─────────────────────────────────────────────
async function registrarHistorico(colaboradorId, turmaIdAntiga, turmaIdNova, turmaNomeNova, dataInicio) {
  // Encerrar histórico anterior
  const q = query(
    collection(db, 'historicoTurmas'),
    where('colaboradorId', '==', colaboradorId),
    where('ativo', '==', true)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await updateDoc(doc(db, 'historicoTurmas', d.id), {
      dataFim: subtrairUmDia(dataInicio),
      ativo: false
    });
  }

  // Criar novo registro
  await addDoc(collection(db, 'historicoTurmas'), {
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

// ─────────────────────────────────────────────
// GRAVAR LOG DA SINCRONIZAÇÃO
// ─────────────────────────────────────────────
async function gravarLog() {
  await addDoc(collection(db, 'logsSync'), {
    data: new Date().toISOString(),
    ...stats,
    modo: MODO
  });
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
function hoje() {
  return new Date().toISOString().split('T')[0];
}

function subtrairUmDia(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function gerarDadosExemplo() {
  return [
    { chapa: '000001', nome: 'Colaborador Exemplo 1', funcao: 'Operador', lider: 'Líder A', turma: 'Turma A', admissao: '2023-01-10', demissao: '', inicioJornada: '07:00', fimJornada: '17:00' },
    { chapa: '000002', nome: 'Colaborador Exemplo 2', funcao: 'Auxiliar', lider: 'Líder B', turma: 'Turma B', admissao: '2022-05-20', demissao: '', inicioJornada: '08:00', fimJornada: '18:00' }
  ];
}

// ─────────────────────────────────────────────
// EXECUTAR
// ─────────────────────────────────────────────
main().catch(e => {
  console.error('❌ Erro fatal:', e);
  process.exit(1);
});
