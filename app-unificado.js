// ========================================================
// SISTEMA DE METAS E PREMIAÇÃO — APP-UNIFICADO.JS
// v2.0 — Correções: regra sexta-feira, auditoria,
//         relatório premiação, mobile, exportação marcada
// ========================================================

let turmasCache   = {};
let fazendasCache = {};
let metaAtualSemana   = null;
let semanaAtualMeta   = null;
let colabHistoricoAtual = null;

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ─────────────────────────────────────────────
// TOAST (substitui alert())
// ─────────────────────────────────────────────
function toast(msg, tipo = 'sucesso', duracao = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  const icone = tipo === 'sucesso' ? '✅' : tipo === 'erro' ? '❌' : '⚠️';
  t.className = `toast ${tipo}`;
  t.textContent = `${icone} ${msg}`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, duracao);
}

// ─────────────────────────────────────────────
// AUDITORIA
// ─────────────────────────────────────────────
async function registrarAuditoria(colecao, documentoId, acao, valorAnterior, valorNovo) {
  try {
    if (!window.usuarioLogado) return;
    await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db, 'auditoria'), {
      colecao,
      documentoId: documentoId || '',
      acao,
      valorAnterior: valorAnterior || null,
      valorNovo: valorNovo || null,
      usuarioId:   window.usuarioLogado.uid,
      usuarioNome: window.usuarioLogado.nome,
      usuarioPerfil: window.usuarioLogado.perfil,
      timestamp:   new Date().toISOString()
    });
  } catch(e) { console.warn('Auditoria falhou silenciosamente:', e.message); }
}

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
    if (l.getAttribute('onclick')?.includes(`'${pagina}'`)) l.classList.add('ativo');
  });
  fecharMenu();
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
  if (pagina === 'auditoria')       carregarPaginaAuditoria();
  if (pagina === 'admin')           carregarAdmin();
}

function toggleMenu() {
  const menu = document.getElementById('menu-lateral');
  const overlay = document.getElementById('menu-overlay');
  const fechado = menu.classList.toggle('fechado');
  overlay.classList.toggle('visivel', !fechado);
}
function fecharMenu() {
  document.getElementById('menu-lateral').classList.add('fechado');
  document.getElementById('menu-overlay').classList.remove('visivel');
}

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
function sextaSemana(domStr) {
  // Retorna a sexta-feira da semana que começa no domingo informado
  const d = new Date(domStr + 'T12:00:00');
  d.setDate(d.getDate() + 5);
  return d.toISOString().split('T')[0];
}
function formatarData(dataStr) {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}
function labelSemana(dom, sab) { return `Dom ${formatarData(dom)} – Sáb ${formatarData(sab)}`; }
function padZeros(str, n) { return String(str).padStart(n, '0'); }
function subtrairUmDia(dataStr) {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}
function formatarDataHora(isoStr) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
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

// ─────────────────────────────────────────────
// REGRA CORE: turma do colaborador na sexta-feira
// ─────────────────────────────────────────────
// Dado um domingo de semana, retorna o turmaId
// onde o colaborador estava na sexta-feira dessa semana.
// Usa historicoTurmas. Se não há histórico, usa turmaId atual.
async function turmaDoColabNaSexta(colaboradorId, semanaDomingo) {
  const sexta = sextaSemana(semanaDomingo);
  const q = window.fbFuncs.query(
    window.fbFuncs.collection(window.db, 'historicoTurmas'),
    window.fbFuncs.where('colaboradorId', '==', colaboradorId)
  );
  const snap = await window.fbFuncs.getDocs(q);
  if (snap.empty) return null;

  let turmaId = null;
  snap.forEach(d => {
    const h = d.data();
    const inicio = h.dataInicio || '';
    const fim    = h.dataFim    || '9999-12-31';
    if (inicio <= sexta && sexta <= fim) {
      turmaId = h.turmaIdNova;
    }
  });
  return turmaId;
}

// Versão em lote: recebe array de { colaboradorId } e semanaDomingo
// Retorna Map<colaboradorId, turmaId>
async function turmasDosColabsNaSexta(colaboradorIds, semanaDomingo) {
  const sexta = sextaSemana(semanaDomingo);
  const resultado = new Map();

  if (colaboradorIds.length === 0) return resultado;

  // Buscar histórico de todos de uma vez
  const snapH = await window.fbFuncs.getDocs(
    window.fbFuncs.collection(window.db, 'historicoTurmas')
  );

  const historicoMap = {}; // colaboradorId → [registros]
  snapH.forEach(d => {
    const h = d.data();
    if (!historicoMap[h.colaboradorId]) historicoMap[h.colaboradorId] = [];
    historicoMap[h.colaboradorId].push(h);
  });

  for (const cid of colaboradorIds) {
    const registros = historicoMap[cid] || [];
    let turmaId = null;
    for (const h of registros) {
      const inicio = h.dataInicio || '';
      const fim    = h.dataFim    || '9999-12-31';
      if (inicio <= sexta && sexta <= fim) {
        turmaId = h.turmaIdNova;
        break;
      }
    }
    resultado.set(cid, turmaId);
  }
  return resultado;
}

// Modal genérico
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
  const chapa=document.getElementById('cad-chapa').value.trim();
  const nome=document.getElementById('cad-nome').value.trim();
  const email=document.getElementById('cad-email').value.trim();
  const senha=document.getElementById('cad-senha').value;
  const senha2=document.getElementById('cad-senha2').value;
  const erro=document.getElementById('cad-erro');
  const ok=document.getElementById('cad-ok');
  erro.textContent=''; ok.textContent='';
  if (!chapa||!nome||!email||!senha){erro.textContent='Preencha todos os campos.';return;}
  if (senha!==senha2){erro.textContent='As senhas não coincidem.';return;}
  if (senha.length<6){erro.textContent='Mínimo 6 caracteres.';return;}
  try {
    const cred=await window.fbFuncs.createUserWithEmailAndPassword(window.auth,email,senha);
    await window.fbFuncs.setDoc(window.fbFuncs.doc(window.db,'usuarios',cred.user.uid),
      {chapa,nome,email,perfil:'pendente',aprovado:false,criadoEm:new Date().toISOString()});
    await window.fbFuncs.signOut(window.auth);
    ok.textContent='✅ Solicitação enviada! Aguarde aprovação.';
    setTimeout(()=>mostrarLogin(),3000);
  } catch(e) {
    erro.textContent=e.code==='auth/email-already-in-use'?'E-mail já cadastrado.':'Erro: '+e.message;
  }
}

async function sair() { await window.fbFuncs.signOut(window.auth); }

// ─────────────────────────────────────────────
// CACHES
// ─────────────────────────────────────────────
async function carregarFazendasSelects() {
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'));
  fazendasCache = {};
  snap.forEach(d => fazendasCache[d.id] = { id:d.id,...d.data() });

  ['filtro-fazenda-turma','filtro-fazenda-colab','exp-fazenda','premio-fazenda','meta-fazenda'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = el.value;
    const first = el.options[0]?.text || 'Todas as fazendas';
    el.innerHTML = `<option value="">${first}</option>`;
    Object.values(fazendasCache).sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(f => {
      el.innerHTML += `<option value="${f.id}">${f.nome}</option>`;
    });
    el.value = v;
  });
}

async function carregarTurmasCache() {
  const snap = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas'));
  turmasCache = {};
  snap.forEach(d => turmasCache[d.id] = { id:d.id,...d.data() });
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
async function carregarDashboard() {
  try {
    document.getElementById('ranking-turmas').innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
    const [snapTurmas, snapColab, snapMetas, snapPres] = await Promise.all([
      window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')),
      window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
      window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas')),
      window.fbFuncs.getDocs(window.fbFuncs.query(
        window.fbFuncs.collection(window.db,'presencas'),
        window.fbFuncs.where('presente','==',true)))
    ]);
    const snapRes = await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'resultadosDiarios'));
    const resultMap = {};
    snapRes.forEach(d => {
      const r=d.data(); const key=`${r.turmaId}_${r.semanaDomingo}`;
      if (!resultMap[key]) resultMap[key]=0;
      resultMap[key]+=parseFloat(r.resultado||0);
    });
    const metas=[]; snapMetas.forEach(d=>metas.push(d.data()));
    const metasAvaliadas=metas.map(m=>({...m,somaResultados:resultMap[m.semanaId]||0})).filter(m=>m.somaResultados>0);
    const atingidas=metasAvaliadas.filter(m=>m.somaResultados>=m.meta);
    const pct=metasAvaliadas.length>0?Math.round(atingidas.length/metasAvaliadas.length*100):0;
    document.getElementById('dash-total-turmas').textContent=snapTurmas.size;
    document.getElementById('dash-metas-atingidas').textContent=pct+'%';
    document.getElementById('dash-total-colab').textContent=snapColab.size;
    document.getElementById('dash-premios').textContent=snapPres.size;
    const turmaMap={}; snapTurmas.forEach(d=>turmaMap[d.id]=d.data().nome);
    const ranking=document.getElementById('ranking-turmas');
    if (metasAvaliadas.length===0){ranking.innerHTML='<div class="empty-state"><span class="emoji">📊</span><p>Nenhuma meta com resultados lançados.</p></div>';return;}
    const ord=[...metasAvaliadas].sort((a,b)=>(b.somaResultados/b.meta)-(a.somaResultados/a.meta));
    ranking.innerHTML=ord.slice(0,10).map((m,i)=>{
      const p=Math.round(m.somaResultados/m.meta*100);
      const ganhou=p>=100; const larg=Math.min(p,100);
      return `<div class="ranking-item">
        <div class="ranking-pos">${i+1}º</div>
        <div class="ranking-info">
          <strong>${turmaMap[m.turmaId]||'Turma'}</strong>
          <span>${labelSemana(m.semanaDomingo,m.semanaSabado)} — Meta: ${m.meta} | Resultado: ${m.somaResultados.toFixed(0)}</span>
          <div class="barra-progresso"><div class="barra-fill ${ganhou?'':'perdeu'}" style="width:${larg}%"></div></div>
        </div>
        <div class="ranking-pct ${ganhou?'ganhou':'perdeu'}">${p}%</div>
      </div>`;
    }).join('');
  } catch(e){console.error(e);}
}

// ─────────────────────────────────────────────
// FAZENDAS
// ─────────────────────────────────────────────
async function carregarFazendas() {
  const lista=document.getElementById('lista-fazendas');
  lista.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  const snap=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'));
  if (snap.empty){lista.innerHTML='<div class="empty-state"><span class="emoji">🌿</span><p>Nenhuma fazenda cadastrada.</p></div>';return;}
  lista.innerHTML='';
  snap.forEach(d=>{
    const f=d.data();
    lista.innerHTML+=`<div class="item-card">
      <div class="item-card-info"><strong>${f.nome}</strong><span>${f.endereco||'Sem endereço'}</span></div>
      <button class="btn-primary btn-sm" onclick="editarFazenda('${d.id}')">✏️ Editar</button>
    </div>`;
  });
}

function abrirModalFazenda(id,d){
  abrirModal(id?'Editar Fazenda':'Nova Fazenda',`
    <div class="form-group"><label>Nome</label><input id="m-faz-nome" value="${d?.nome||''}"/></div>
    <div class="form-group"><label>Endereço</label><input id="m-faz-end" value="${d?.endereco||''}"/></div>`,
    ()=>salvarFazenda(id));
}

async function salvarFazenda(id){
  const nome=document.getElementById('m-faz-nome').value.trim();
  if (!nome){toast('Informe o nome.','aviso');return;}
  const dados={nome,endereco:document.getElementById('m-faz-end').value.trim(),atualizadoEm:new Date().toISOString()};
  if (id) {
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'fazendas',id),dados);
    await registrarAuditoria('fazendas',id,'update',null,dados);
  } else {
    const ref=await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'fazendas'),{...dados,criadoEm:new Date().toISOString()});
    await registrarAuditoria('fazendas',ref.id,'create',null,dados);
  }
  fecharModal(); carregarFazendas(); carregarFazendasSelects();
  toast('Fazenda salva!');
}

async function editarFazenda(id){
  const s=await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'fazendas',id));
  abrirModalFazenda(id,s.data());
}

// ─────────────────────────────────────────────
// TURMAS
// ─────────────────────────────────────────────
async function carregarTurmas(){
  const lista=document.getElementById('lista-turmas');
  lista.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  const filtroFaz=document.getElementById('filtro-fazenda-turma')?.value||'';
  const q=filtroFaz
    ?window.fbFuncs.query(window.fbFuncs.collection(window.db,'turmas'),window.fbFuncs.where('fazendaId','==',filtroFaz))
    :window.fbFuncs.collection(window.db,'turmas');
  const [snapT,snapF]=await Promise.all([window.fbFuncs.getDocs(q),window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))]);
  const fazMap={}; snapF.forEach(d=>fazMap[d.id]=d.data().nome);
  if (snapT.empty){lista.innerHTML='<div class="empty-state"><span class="emoji">🏘️</span><p>Nenhuma turma cadastrada.</p></div>';return;}
  lista.innerHTML='';
  snapT.forEach(d=>{
    const t=d.data();
    lista.innerHTML+=`<div class="item-card">
      <div class="item-card-info"><strong>${t.nome}</strong><span>🌿 ${fazMap[t.fazendaId]||'—'} | 👤 ${t.liderNome||'Sem líder'}</span></div>
      <button class="btn-primary btn-sm" onclick="editarTurma('${d.id}')">✏️ Editar</button>
    </div>`;
  });
}

function abrirModalTurma(id,d){
  let ops='<option value="">Selecione</option>';
  Object.values(fazendasCache).sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(f=>{
    ops+=`<option value="${f.id}" ${d?.fazendaId===f.id?'selected':''}>${f.nome}</option>`;
  });
  abrirModal(id?'Editar Turma':'Nova Turma',`
    <div class="form-group"><label>Nome</label><input id="m-tur-nome" value="${d?.nome||''}"/></div>
    <div class="form-group"><label>Fazenda</label><select id="m-tur-faz">${ops}</select></div>
    <div class="form-group"><label>Líder</label><input id="m-tur-lider" value="${d?.liderNome||''}"/></div>`,
    ()=>salvarTurma(id));
}

async function salvarTurma(id){
  const nome=document.getElementById('m-tur-nome').value.trim();
  const fazendaId=document.getElementById('m-tur-faz').value;
  if (!nome||!fazendaId){toast('Informe nome e fazenda.','aviso');return;}
  const dados={nome,fazendaId,liderNome:document.getElementById('m-tur-lider').value.trim(),atualizadoEm:new Date().toISOString()};
  if (id) {
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'turmas',id),dados);
    await registrarAuditoria('turmas',id,'update',null,dados);
  } else {
    const ref=await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'turmas'),{...dados,criadoEm:new Date().toISOString()});
    await registrarAuditoria('turmas',ref.id,'create',null,dados);
  }
  fecharModal(); carregarTurmas(); carregarTurmasCache(); toast('Turma salva!');
}

async function editarTurma(id){
  const s=await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'turmas',id));
  abrirModalTurma(id,s.data());
}

// ─────────────────────────────────────────────
// COLABORADORES
// ─────────────────────────────────────────────
async function carregarColaboradores(){
  const lista=document.getElementById('lista-colaboradores');
  lista.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  const filtroFaz=document.getElementById('filtro-fazenda-colab')?.value||'';
  const filtroTurma=document.getElementById('filtro-turma-colab')?.value||'';
  const filtroNome=document.getElementById('filtro-nome-colab')?.value?.toLowerCase()||'';
  const [snapC,snapT,snapF]=await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))
  ]);
  const turmaMap={}; snapT.forEach(d=>turmaMap[d.id]=d.data());
  const fazMap={};   snapF.forEach(d=>fazMap[d.id]=d.data().nome);
  let colab=[]; snapC.forEach(d=>colab.push({id:d.id,...d.data()}));

  if (window.usuarioLogado.perfil==='lider'){
    const turmasDoLider=Object.values(turmaMap).filter(t=>
      t.liderNome?.toLowerCase().trim()===window.usuarioLogado.nome?.toLowerCase().trim()
    );
    const ids=turmasDoLider.map(t=>t.id);
    colab=colab.filter(c=>ids.includes(c.turmaId));
  }
  if (filtroFaz)   colab=colab.filter(c=>turmaMap[c.turmaId]?.fazendaId===filtroFaz);
  if (filtroTurma) colab=colab.filter(c=>c.turmaId===filtroTurma);
  if (filtroNome)  colab=colab.filter(c=>c.nome?.toLowerCase().includes(filtroNome)||c.chapa?.toLowerCase().includes(filtroNome));

  if (colab.length===0){lista.innerHTML='<div class="empty-state"><span class="emoji">👥</span><p>Nenhum colaborador encontrado.</p></div>';return;}
  lista.innerHTML='';
  colab.sort((a,b)=>a.nome?.localeCompare(b.nome)).forEach(c=>{
    const t=turmaMap[c.turmaId];
    const badge=c.demitido||c.demissao
      ?'<span class="badge badge-vermelho">Desligado</span>'
      :'<span class="badge badge-verde">Ativo</span>';
    lista.innerHTML+=`<div class="item-card">
      <div class="item-card-info">
        <strong>${c.nome} <small style="color:var(--cinza-500);font-weight:400">#${c.chapa}</small></strong>
        <span>🏘️ ${t?.nome||'—'} | 🌿 ${t?fazMap[t.fazendaId]||'—':'—'} | ${c.funcao||''}
        ${c.demissao?`<span style="color:var(--vermelho)"> · Demissão: ${formatarData(c.demissao)}</span>`:''}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">${badge}
        <button class="btn-primary btn-sm" onclick="editarColaborador('${c.id}')">✏️</button>
      </div>
    </div>`;
  });
}

function abrirModalColaborador(id,d){
  let opsTurmas='<option value="">Selecione</option>';
  window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')).then(snap=>{
    snap.forEach(t=>opsTurmas+=`<option value="${t.id}" ${d?.turmaId===t.id?'selected':''}>${t.data().nome}</option>`);
    const sel=document.getElementById('m-col-turma');
    if (sel) sel.innerHTML=opsTurmas;
  });
  abrirModal(id?'Editar Colaborador':'Novo Colaborador',`
    <div class="form-group"><label>Chapa</label><input id="m-col-chapa" value="${d?.chapa||''}"/></div>
    <div class="form-group"><label>Nome</label><input id="m-col-nome" value="${d?.nome||''}"/></div>
    <div class="form-group"><label>Função</label><input id="m-col-funcao" value="${d?.funcao||''}"/></div>
    <div class="form-group"><label>Turma</label><select id="m-col-turma">${opsTurmas}</select></div>
    <div class="form-group"><label>Data Admissão</label><input type="date" id="m-col-adm" value="${d?.admissao||''}"/></div>
    <div class="form-group"><label>Data Demissão</label><input type="date" id="m-col-dem" value="${d?.demissao||''}"/></div>
    <div class="form-group"><label>Hora Início</label><input type="time" id="m-col-hi" value="${d?.inicioJornada||'08:00'}"/></div>
    <div class="form-group"><label>Hora Fim</label><input type="time" id="m-col-hf" value="${d?.fimJornada||'17:00'}"/></div>`,
    ()=>salvarColaborador(id));
}

async function salvarColaborador(id){
  const chapa=document.getElementById('m-col-chapa').value.trim();
  const nome=document.getElementById('m-col-nome').value.trim();
  if (!chapa||!nome){toast('Chapa e nome obrigatórios.','aviso');return;}
  const demissao=document.getElementById('m-col-dem').value;
  const dados={
    chapa,nome,
    funcao:document.getElementById('m-col-funcao').value.trim(),
    turmaId:document.getElementById('m-col-turma').value,
    admissao:document.getElementById('m-col-adm').value,
    demissao,
    inicioJornada:document.getElementById('m-col-hi').value,
    fimJornada:document.getElementById('m-col-hf').value,
    demitido:!!demissao,
    atualizadoEm:new Date().toISOString()
  };
  let anterior = null;
  if (id) {
    const snapAnt = await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'colaboradores',id));
    anterior = snapAnt.data();
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'colaboradores',id),dados);
    await registrarAuditoria('colaboradores',id,'update',anterior,dados);
  } else {
    const ref=await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'colaboradores'),{...dados,criadoEm:new Date().toISOString()});
    await registrarAuditoria('colaboradores',ref.id,'create',null,dados);
  }
  fecharModal(); carregarColaboradores(); toast('Colaborador salvo!');
}

async function editarColaborador(id){
  const s=await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'colaboradores',id));
  abrirModalColaborador(id,s.data());
}

// ══════════════════════════════════════════════
// HISTÓRICO DO COLABORADOR
// ══════════════════════════════════════════════
async function carregarPaginaHistorico(){
  await carregarTurmasCache();
  const sel=document.getElementById('hist-turma-destino');
  if (sel){
    sel.innerHTML='<option value="">Selecione</option>';
    Object.values(turmasCache).sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(t=>{
      sel.innerHTML+=`<option value="${t.id}">${t.nome}</option>`;
    });
  }
}

async function buscarColabHistorico(){
  const termo=document.getElementById('busca-hist-colab').value.trim().toLowerCase();
  const div=document.getElementById('resultado-busca-hist');
  if (termo.length<2){div.innerHTML='';return;}
  const snap=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores'));
  const resultados=[];
  snap.forEach(d=>{const c=d.data();if(c.nome?.toLowerCase().includes(termo)||c.chapa?.toLowerCase().includes(termo))resultados.push({id:d.id,...c});});
  if (resultados.length===0){div.innerHTML='<div class="empty-state"><span class="emoji">🔍</span><p>Nenhum colaborador encontrado.</p></div>';return;}
  div.innerHTML=resultados.slice(0,8).map(c=>{
    const t=turmasCache[c.turmaId];
    return `<div class="item-card" style="cursor:pointer" onclick="abrirHistoricoColab('${c.id}')">
      <div class="item-card-info"><strong>${c.nome} <small style="color:var(--cinza-500)">#${c.chapa}</small></strong>
      <span>🏘️ ${t?.nome||'Sem turma'} | ${c.funcao||''}</span></div>
      <span style="color:var(--verde-medio);font-size:22px">›</span>
    </div>`;
  }).join('');
}

async function abrirHistoricoColab(colabId){
  document.getElementById('resultado-busca-hist').innerHTML='';
  document.getElementById('busca-hist-colab').value='';
  document.getElementById('painel-hist-colab').style.display='block';
  const snap=await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'colaboradores',colabId));
  if (!snap.exists()){toast('Colaborador não encontrado.','erro');return;}
  colabHistoricoAtual={id:colabId,...snap.data()};
  const iniciais=colabHistoricoAtual.nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
  document.getElementById('hist-avatar').textContent=iniciais;
  document.getElementById('hist-nome').textContent=colabHistoricoAtual.nome;
  document.getElementById('hist-detalhes').innerHTML=
    `Chapa: <strong>${colabHistoricoAtual.chapa}</strong> | Função: <strong>${colabHistoricoAtual.funcao||'—'}</strong> | `+
    `Admissão: <strong>${formatarData(colabHistoricoAtual.admissao)||'—'}</strong>`+
    (colabHistoricoAtual.demissao?` | Demissão: <strong style="color:var(--vermelho)">${formatarData(colabHistoricoAtual.demissao)}</strong>`:'');
  document.getElementById('hist-status-badge').innerHTML=colabHistoricoAtual.demitido
    ?'<span class="badge badge-vermelho">Desligado</span>'
    :'<span class="badge badge-verde">Ativo</span>';
  const turmaAtual=turmasCache[colabHistoricoAtual.turmaId];
  document.getElementById('hist-situacao-atual').innerHTML=turmaAtual
    ?`<div class="item-card"><div class="item-card-info"><strong>🏘️ ${turmaAtual.nome}</strong><span>Líder: ${turmaAtual.liderNome||'—'}</span></div><span class="badge badge-verde">Turma Atual</span></div>`
    :'<p style="color:var(--cinza-500)">Sem turma vinculada.</p>';
  await carregarTimelineHistorico(colabId);
  await carregarSolicitacoesColab(colabId);
  const podeSolicitar=['admin','gestao','encarregado','administrativo','lider'].includes(window.usuarioLogado.perfil);
  document.getElementById('hist-painel-solicitar').style.display=podeSolicitar&&!colabHistoricoAtual.demitido?'block':'none';
  document.getElementById('painel-hist-colab').scrollIntoView({behavior:'smooth'});
}

async function carregarTimelineHistorico(colabId){
  const timeline=document.getElementById('hist-timeline');
  const q=window.fbFuncs.query(window.fbFuncs.collection(window.db,'historicoTurmas'),window.fbFuncs.where('colaboradorId','==',colabId));
  const snap=await window.fbFuncs.getDocs(q);
  if (snap.empty){timeline.innerHTML='<p style="color:var(--cinza-500)">Nenhum histórico registrado.</p>';return;}
  const historico=[];
  snap.forEach(d=>historico.push({id:d.id,...d.data()}));
  historico.sort((a,b)=>(b.dataInicio||'').localeCompare(a.dataInicio||''));
  timeline.innerHTML=historico.map(h=>{
    const ativo=h.ativo; const dotCls=ativo?'':'antigo';
    const turma=turmasCache[h.turmaIdNova]||{nome:h.turmaNomeNova||'—'};
    const periodo=h.dataFim?`${formatarData(h.dataInicio)} até ${formatarData(h.dataFim)}`:`${formatarData(h.dataInicio)} — <strong style="color:var(--verde-medio)">até hoje</strong>`;
    const badge=ativo?'<span class="badge badge-verde">Turma atual</span>':'<span class="badge badge-cinza">Histórico</span>';
    return `<div class="timeline-item">
      <div class="timeline-dot ${dotCls}"></div>
      <div class="timeline-card">
        <div class="data">${periodo}</div>
        <div class="titulo">🏘️ ${turma.nome}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
          <span style="font-size:13px;color:var(--cinza-500)">Líder: ${turma.liderNome||'—'}</span>${badge}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function enviarSolicitacaoTransf(){
  const turmaDestinoId=document.getElementById('hist-turma-destino').value;
  const dataTransf=document.getElementById('hist-data-transf').value;
  const motivo=document.getElementById('hist-motivo').value.trim();
  const msg=document.getElementById('hist-msg-solicit');
  msg.textContent='';
  if (!turmaDestinoId){msg.textContent='⚠️ Selecione a turma de destino.';msg.style.color='var(--vermelho)';return;}
  if (!dataTransf){msg.textContent='⚠️ Informe a data de início.';msg.style.color='var(--vermelho)';return;}
  if (turmaDestinoId===colabHistoricoAtual.turmaId){msg.textContent='⚠️ A turma de destino é a mesma turma atual.';msg.style.color='var(--vermelho)';return;}
  const turmaDestino=turmasCache[turmaDestinoId];
  const turmaOrigem=turmasCache[colabHistoricoAtual.turmaId];
  await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'solicitacoesTransferencia'),{
    colaboradorId:colabHistoricoAtual.id,colaboradorNome:colabHistoricoAtual.nome,colaboradorChapa:colabHistoricoAtual.chapa,
    turmaOrigemId:colabHistoricoAtual.turmaId||'',turmaOrigemNome:turmaOrigem?.nome||'—',
    turmaDestinoId,turmaDestinoNome:turmaDestino?.nome||'—',
    dataInicio:dataTransf,motivo,status:'pendente',
    solicitadoPor:window.usuarioLogado.uid,solicitadoPorNome:window.usuarioLogado.nome,
    solicitadoEm:new Date().toISOString()
  });
  msg.textContent='✅ Solicitação enviada!'; msg.style.color='var(--verde-medio)';
  document.getElementById('hist-turma-destino').value='';
  document.getElementById('hist-data-transf').value='';
  document.getElementById('hist-motivo').value='';
  await carregarSolicitacoesColab(colabHistoricoAtual.id);
}

async function carregarSolicitacoesColab(colabId){
  const q=window.fbFuncs.query(window.fbFuncs.collection(window.db,'solicitacoesTransferencia'),window.fbFuncs.where('colaboradorId','==',colabId));
  const snap=await window.fbFuncs.getDocs(q);
  const lista=document.getElementById('hist-lista-solicit');
  if (snap.empty){lista.innerHTML='<p style="color:var(--cinza-500)">Nenhuma solicitação.</p>';return;}
  const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
  items.sort((a,b)=>b.solicitadoEm.localeCompare(a.solicitadoEm));
  lista.innerHTML=items.map(s=>{
    const cls=s.status==='aprovada'?'aprovada':s.status==='recusada'?'recusada':'';
    const badge=s.status==='aprovada'?'<span class="badge badge-verde">✅ Aprovada</span>':s.status==='recusada'?'<span class="badge badge-vermelho">❌ Recusada</span>':'<span class="badge badge-amarelo">⏳ Pendente</span>';
    return `<div class="req-card ${cls}">
      <strong>${s.turmaOrigemNome} → ${s.turmaDestinoNome}</strong>
      <span style="font-size:13px;color:var(--cinza-500);display:block;margin-top:4px">📅 Início em: ${formatarData(s.dataInicio)} | Por: ${s.solicitadoPorNome}</span>
      <span style="font-size:13px;color:var(--cinza-500);display:block">📝 ${s.motivo||'Sem observação'}</span>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        ${badge}${s.observacaoGestao?`<span style="font-size:12px;color:var(--cinza-500)">Gestão: ${s.observacaoGestao}</span>`:''}
      </div>
    </div>`;
  }).join('');
}

// SOLICITAÇÕES PENDENTES
async function carregarSolicitacoesPendentes(){
  const q=window.fbFuncs.query(window.fbFuncs.collection(window.db,'solicitacoesTransferencia'),window.fbFuncs.where('status','==','pendente'));
  const snap=await window.fbFuncs.getDocs(q);
  const lista=document.getElementById('lista-solicit-pendentes');
  if (snap.empty){lista.innerHTML='<div class="empty-state"><span class="emoji">✅</span><p>Nenhuma solicitação pendente.</p></div>';return;}
  const items=[]; snap.forEach(d=>items.push({id:d.id,...d.data()}));
  lista.innerHTML=items.map(s=>`
    <div class="req-card">
      <strong>👤 ${s.colaboradorNome} <small style="color:var(--cinza-500)">#${s.colaboradorChapa}</small></strong>
      <span style="font-size:13px;color:var(--cinza-500);display:block;margin-top:4px">🏘️ ${s.turmaOrigemNome} → ${s.turmaDestinoNome}</span>
      <span style="font-size:13px;color:var(--cinza-500);display:block">📅 Data solicitada: <strong>${formatarData(s.dataInicio)}</strong></span>
      <span style="font-size:13px;color:var(--cinza-500);display:block">📝 ${s.motivo||'Sem observação'}</span>
      <span style="font-size:12px;color:var(--cinza-300);display:block;margin-top:4px">Solicitado por: ${s.solicitadoPorNome} em ${formatarDataHora(s.solicitadoEm)}</span>
      <div class="form-group" style="margin-top:10px">
        <label>Observação (opcional)</label>
        <input type="text" id="obs-${s.id}" placeholder="Ex: Aprovado conforme solicitado"/>
      </div>
      <div class="form-group">
        <label>Confirmar data de início</label>
        <input type="date" id="dt-${s.id}" value="${s.dataInicio}"/>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn-primary btn-sm" onclick="aprovarTransf('${s.id}','${s.colaboradorId}','${s.turmaOrigemId}','${s.turmaDestinoId}','${s.turmaDestinoNome}')">✅ Aprovar</button>
        <button class="btn-danger btn-sm" onclick="recusarTransf('${s.id}')">❌ Recusar</button>
      </div>
    </div>`).join('');
}

async function aprovarTransf(solId,colabId,turmaOrigemId,turmaDestinoId,turmaDestinoNome){
  const dataInicio=document.getElementById('dt-'+solId)?.value;
  const obs=document.getElementById('obs-'+solId)?.value?.trim()||'';
  if (!dataInicio){toast('Informe a data.','aviso');return;}
  const dataFim=subtrairUmDia(dataInicio);
  const qH=window.fbFuncs.query(window.fbFuncs.collection(window.db,'historicoTurmas'),window.fbFuncs.where('colaboradorId','==',colabId),window.fbFuncs.where('ativo','==',true));
  const snapH=await window.fbFuncs.getDocs(qH);
  for (const d of snapH.docs) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'historicoTurmas',d.id),{dataFim,ativo:false});
  await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'historicoTurmas'),{colaboradorId:colabId,turmaIdAntiga:turmaOrigemId||null,turmaIdNova:turmaDestinoId,turmaNomeNova:turmaDestinoNome,dataInicio,dataFim:null,ativo:true,criadoEm:new Date().toISOString()});
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'colaboradores',colabId),{turmaId:turmaDestinoId,turmaNome:turmaDestinoNome,atualizadoEm:new Date().toISOString()});
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'solicitacoesTransferencia',solId),{status:'aprovada',observacaoGestao:obs,aprovadoPor:window.usuarioLogado.uid,aprovadoEm:new Date().toISOString()});
  await registrarAuditoria('solicitacoesTransferencia',solId,'approve',{status:'pendente'},{status:'aprovada',turmaDestinoId,dataInicio});
  toast('Transferência aprovada!');
  await carregarTurmasCache(); await carregarSolicitacoesPendentes();
}

async function recusarTransf(solId){
  const obs=document.getElementById('obs-'+solId)?.value?.trim()||'';
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'solicitacoesTransferencia',solId),{status:'recusada',observacaoGestao:obs,recusadoPor:window.usuarioLogado.uid,recusadoEm:new Date().toISOString()});
  await registrarAuditoria('solicitacoesTransferencia',solId,'reject',{status:'pendente'},{status:'recusada'});
  toast('Solicitação recusada.','aviso'); await carregarSolicitacoesPendentes();
}

// ══════════════════════════════════════════════
// METAS E RESULTADOS
// ══════════════════════════════════════════════
async function carregarPaginaMetas(){
  await carregarFazendasSelects(); await carregarTurmasCache(); preencherSemanasMeta();
  if (window.usuarioLogado.perfil==='lider'){
    const abaImport=document.getElementById('aba-importar-meta'); if (abaImport) abaImport.style.display='none';
    const grupoFaz=document.getElementById('grupo-meta-fazenda'); if (grupoFaz) grupoFaz.style.display='none';
    await carregarTurmasMeta();
  } else {
    const abaImport=document.getElementById('aba-importar-meta'); if (abaImport) abaImport.style.display='inline-flex';
  }
}

function trocarAbaMetas(aba){
  document.querySelectorAll('.aba-interna').forEach(b=>b.classList.remove('ativa'));
  document.querySelectorAll('.painel-aba').forEach(p=>p.classList.remove('ativo'));
  document.getElementById('aba-meta-'+aba).classList.add('ativo');
  document.querySelectorAll('.aba-interna').forEach(b=>{if(b.getAttribute('onclick')?.includes(aba))b.classList.add('ativa');});
  if (aba==='historico') carregarHistoricoMetas();
}

function preencherSemanasMeta(){
  const hoje=new Date();
  const inicio=new Date(hoje); inicio.setDate(hoje.getDate()-84);
  const fim=new Date(hoje); fim.setDate(hoje.getDate()+14);
  const semanas=gerarSemanas(inicio.toISOString().split('T')[0],fim.toISOString().split('T')[0]);
  const sel=document.getElementById('meta-semana');
  if (sel){
    sel.innerHTML='<option value="">Selecione a semana</option>';
    semanas.reverse().forEach(s=>sel.innerHTML+=`<option value="${s.domingo}|${s.sabado}">${s.label}</option>`);
  }
}

async function carregarTurmasMeta(){
  const fazId=document.getElementById('meta-fazenda')?.value||'';
  const sel=document.getElementById('meta-turma');
  sel.innerHTML='<option value="">Selecione a turma</option>';
  let turmasFiltradas=Object.values(turmasCache);
  if (window.usuarioLogado.perfil==='lider'){
    turmasFiltradas=turmasFiltradas.filter(t=>t.liderNome?.toLowerCase().trim()===window.usuarioLogado.nome?.toLowerCase().trim());
  } else if (fazId){
    turmasFiltradas=turmasFiltradas.filter(t=>t.fazendaId===fazId);
  }
  turmasFiltradas.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(t=>sel.innerHTML+=`<option value="${t.id}">${t.nome}</option>`);
}

function carregarSemanasMeta(){
  document.getElementById('painel-meta-semana').style.display=document.getElementById('meta-turma').value?'block':'none';
  if (document.getElementById('meta-turma').value) carregarDadosMetaSemana();
}

async function carregarDadosMetaSemana(){
  const turmaId=document.getElementById('meta-turma').value;
  const semanaV=document.getElementById('meta-semana').value;
  if (!turmaId||!semanaV) return;
  const [dom,sab]=semanaV.split('|');
  semanaAtualMeta={domingo:dom,sabado:sab};
  const qM=window.fbFuncs.query(window.fbFuncs.collection(window.db,'metas'),window.fbFuncs.where('semanaId','==',`${turmaId}_${dom}`));
  const snapM=await window.fbFuncs.getDocs(qM);
  metaAtualSemana=snapM.empty?null:{id:snapM.docs[0].id,...snapM.docs[0].data()};
  document.getElementById('meta-valor-semana').value=metaAtualSemana?.meta||'';
  document.getElementById('btn-excluir-meta-sem').style.display=metaAtualSemana?'inline-flex':'none';
  document.getElementById('meta-msg-sem').textContent='';
  await montarDiasSemana(turmaId,dom,sab);
  atualizarSomatorioMeta();
}

async function montarDiasSemana(turmaId,dom,sab){
  const qR=window.fbFuncs.query(window.fbFuncs.collection(window.db,'resultadosDiarios'),window.fbFuncs.where('turmaId','==',turmaId),window.fbFuncs.where('semanaDomingo','==',dom));
  const snapR=await window.fbFuncs.getDocs(qR);
  const resultMap={};
  snapR.forEach(d=>resultMap[d.data().data]={id:d.id,...d.data()});
  const dias=[];
  for (let i=0;i<7;i++){const d=new Date(dom+'T12:00:00');d.setDate(d.getDate()+i);dias.push(d.toISOString().split('T')[0]);}
  const grid=document.getElementById('meta-dias-grid');
  grid.innerHTML='<div class="dias-grid">'+dias.map((data,i)=>{
    const res=resultMap[data]; const val=res?.resultado??''; const isSab=i===6;
    return `<div class="dia-card ${isSab?'sabado':''}" id="dcard-${data}">
      <div class="dia-data">${DIAS_SEMANA[i]}<br><small>${formatarData(data)}</small></div>
      <input type="number" id="res-${data}" value="${val}" placeholder="—" oninput="atualizarSomatorioMeta()"/>
      ${res?`<button class="btn-del" onclick="excluirResultadoDia('${res.id}','${data}')">🗑️</button>`:''}
    </div>`;
  }).join('')+'</div>';
}

function atualizarSomatorioMeta(){
  if (!semanaAtualMeta) return;
  const dom=semanaAtualMeta.domingo; let soma=0;
  for (let i=0;i<7;i++){const d=new Date(dom+'T12:00:00');d.setDate(d.getDate()+i);const data=d.toISOString().split('T')[0];const val=parseFloat(document.getElementById('res-'+data)?.value||0);soma+=isNaN(val)?0:val;}
  const meta=parseFloat(document.getElementById('meta-valor-semana')?.value||0);
  document.getElementById('meta-soma-res').textContent=soma.toFixed(0);
  document.getElementById('meta-meta-ref').textContent=meta||'—';
  const pct=meta>0?Math.min(Math.round(soma/meta*100),100):0;
  const ganhou=meta>0&&soma>=meta;
  const barra=document.getElementById('meta-barra-prog');
  barra.style.width=pct+'%';
  barra.className='progresso-fill '+(meta===0?'':ganhou?'ok':'no');
  const badge=document.getElementById('meta-status-badge');
  if (!meta){badge.innerHTML='';return;}
  badge.innerHTML=ganhou?'<span class="badge badge-verde">✅ Atingiu!</span>':soma>0?`<span class="badge badge-amarelo">⏳ ${pct}%</span>`:'<span class="badge badge-vermelho">❌ Sem resultados</span>';
}

async function salvarMetaSemana(){
  const turmaId=document.getElementById('meta-turma').value;
  const semanaV=document.getElementById('meta-semana').value;
  const metaVal=document.getElementById('meta-valor-semana').value;
  const msg=document.getElementById('meta-msg-sem');
  if (!turmaId||!semanaV||!metaVal){msg.textContent='⚠️ Preencha todos os campos.';msg.style.color='var(--vermelho)';return;}
  const [dom,sab]=semanaV.split('|');
  const dados={turmaId,semanaId:`${turmaId}_${dom}`,semanaDomingo:dom,semanaSabado:sab,meta:parseFloat(metaVal),lancadoPor:window.usuarioLogado.uid,atualizadoEm:new Date().toISOString()};
  if (metaAtualSemana){
    const anterior={meta:metaAtualSemana.meta};
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'metas',metaAtualSemana.id),dados);
    await registrarAuditoria('metas',metaAtualSemana.id,'update',anterior,dados);
    msg.textContent='✅ Meta atualizada!';
  } else {
    dados.criadoEm=new Date().toISOString();
    const ref=await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'metas'),dados);
    await registrarAuditoria('metas',ref.id,'create',null,dados);
    metaAtualSemana={id:ref.id,...dados};
    document.getElementById('btn-excluir-meta-sem').style.display='inline-flex';
    msg.textContent='✅ Meta salva!';
  }
  msg.style.color='var(--verde-medio)'; atualizarSomatorioMeta();
}

async function excluirMetaSemana(){
  if (!metaAtualSemana) return;
  if (!confirm('Excluir esta meta? Os resultados serão mantidos.')) return;
  await window.fbFuncs.deleteDoc(window.fbFuncs.doc(window.db,'metas',metaAtualSemana.id));
  await registrarAuditoria('metas',metaAtualSemana.id,'delete',{meta:metaAtualSemana.meta},null);
  metaAtualSemana=null;
  document.getElementById('meta-valor-semana').value='';
  document.getElementById('btn-excluir-meta-sem').style.display='none';
  document.getElementById('meta-msg-sem').textContent='Meta excluída.';
  document.getElementById('meta-msg-sem').style.color='var(--vermelho)';
  atualizarSomatorioMeta();
}

async function salvarResultadosDias(){
  const turmaId=document.getElementById('meta-turma').value;
  if (!turmaId||!semanaAtualMeta) return;
  const dom=semanaAtualMeta.domingo; let salvos=0;
  for (let i=0;i<7;i++){
    const d=new Date(dom+'T12:00:00'); d.setDate(d.getDate()+i);
    const data=d.toISOString().split('T')[0];
    const val=document.getElementById('res-'+data)?.value;
    if (!val&&val!=='0') continue;
    const dados={turmaId,data,semanaDomingo:dom,semanaSabado:semanaAtualMeta.sabado,resultado:parseFloat(val),diaSemana:i,lancadoPor:window.usuarioLogado.uid,atualizadoEm:new Date().toISOString()};
    const qE=window.fbFuncs.query(window.fbFuncs.collection(window.db,'resultadosDiarios'),window.fbFuncs.where('turmaId','==',turmaId),window.fbFuncs.where('data','==',data));
    const snapE=await window.fbFuncs.getDocs(qE);
    if (!snapE.empty){
      const anterior={resultado:snapE.docs[0].data().resultado};
      await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'resultadosDiarios',snapE.docs[0].id),dados);
      await registrarAuditoria('resultadosDiarios',snapE.docs[0].id,'update',anterior,{resultado:dados.resultado,turmaId,data});
    } else {
      dados.criadoEm=new Date().toISOString();
      const ref=await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'resultadosDiarios'),dados);
      await registrarAuditoria('resultadosDiarios',ref.id,'create',null,{resultado:dados.resultado,turmaId,data});
    }
    salvos++;
  }
  toast(`${salvos} resultado(s) salvo(s)!`);
  await carregarDadosMetaSemana();
}

async function excluirResultadoDia(resId,data){
  if (!confirm(`Excluir resultado de ${formatarData(data)}?`)) return;
  const snap=await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'resultadosDiarios',resId));
  await window.fbFuncs.deleteDoc(window.fbFuncs.doc(window.db,'resultadosDiarios',resId));
  await registrarAuditoria('resultadosDiarios',resId,'delete',snap.data(),null);
  await carregarDadosMetaSemana();
}

async function carregarHistoricoMetas(){
  const div=document.getElementById('meta-historico-lista');
  div.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  const [snapM,snapR]=await Promise.all([window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas')),window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'resultadosDiarios'))]);
  const resultMap={};
  snapR.forEach(d=>{const r=d.data();const key=`${r.turmaId}_${r.semanaDomingo}`;if(!resultMap[key])resultMap[key]=0;resultMap[key]+=parseFloat(r.resultado||0);});
  let metas=[]; snapM.forEach(d=>metas.push({id:d.id,...d.data()}));
  metas.sort((a,b)=>(b.semanaDomingo||'').localeCompare(a.semanaDomingo||''));
  if (metas.length===0){div.innerHTML='<div class="empty-state"><span class="emoji">🎯</span><p>Nenhuma meta registrada.</p></div>';return;}
  div.innerHTML=metas.map(m=>{
    const soma=resultMap[m.semanaId]||0; const pct=m.meta>0?Math.round(soma/m.meta*100):0;
    const ganhou=soma>=m.meta&&m.meta>0; const semRes=soma===0; const turma=turmasCache[m.turmaId];
    return `<div class="section-box" style="border-left:4px solid ${semRes?'var(--cinza-200)':ganhou?'var(--verde-medio)':'var(--vermelho)'}">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div><h4 style="margin:0 0 4px">🏘️ ${turma?.nome||'—'}</h4><span style="font-size:13px;color:var(--cinza-500)">${labelSemana(m.semanaDomingo,m.semanaSabado)}</span></div>
        <div style="display:flex;gap:8px;align-items:center">
          ${semRes?'<span class="badge badge-amarelo">⏳ Aguardando</span>':ganhou?'<span class="badge badge-verde">✅ Atingiu</span>':'<span class="badge badge-vermelho">❌ Não atingiu</span>'}
          <button class="btn-danger btn-sm" onclick="excluirMetaHist('${m.id}')">🗑️</button>
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:10px">
        <div><small style="color:var(--cinza-500)">META</small><div style="font-size:18px;font-weight:700;color:var(--verde-escuro)">${m.meta}</div></div>
        <div><small style="color:var(--cinza-500)">SOMA</small><div style="font-size:18px;font-weight:700;color:${ganhou?'var(--verde-medio)':'var(--vermelho)'}">${soma.toFixed(0)}</div></div>
        <div><small style="color:var(--cinza-500)">%</small><div style="font-size:18px;font-weight:700">${pct}%</div></div>
      </div>
      <div class="progresso-barra"><div class="progresso-fill ${ganhou?'ok':'no'}" style="width:${Math.min(pct,100)}%"></div></div>
    </div>`;
  }).join('');
}

async function excluirMetaHist(metaId){
  if (!confirm('Excluir meta?')) return;
  await window.fbFuncs.deleteDoc(window.fbFuncs.doc(window.db,'metas',metaId));
  await registrarAuditoria('metas',metaId,'delete',null,null);
  carregarHistoricoMetas();
}

async function importarExcelMeta(event){
  const file=event.target.files[0]; if (!file) return;
  const tipo=document.getElementById('meta-imp-tipo').value;
  const div=document.getElementById('meta-imp-resultado');
  div.innerHTML='<div class="loading"><div class="spinner"></div> Lendo arquivo...</div>';
  const reader=new FileReader();
  reader.onload=async function(e){
    try {
      const wb=XLSX.read(e.target.result,{type:'binary',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if (!rows.length){div.innerHTML='<p style="color:var(--vermelho)">❌ Arquivo vazio.</p>';return;}
      let ok=0,erros=0,log=[];
      for (const row of rows){
        try {
          if (tipo==='metas'){
            const turmaKey=String(row['TURMA']||row['Turma']||'').trim().toLowerCase();
            const semIni=String(row['SEMANA_INICIO']||row['Semana_Inicio']||'').trim();
            const metaVal=parseFloat(row['META']||row['Meta']||0);
            if (!turmaKey||!semIni||!metaVal){erros++;log.push('⚠ Ignorado — dados incompletos');continue;}
            const turma=Object.values(turmasCache).find(t=>t.nome.toLowerCase()===turmaKey);
            if (!turma){erros++;log.push(`❌ Turma não encontrada: ${turmaKey}`);continue;}
            const dom=domingoSemana(semIni); const sab=sabadoSemana(dom);
            const dados={turmaId:turma.id,semanaId:`${turma.id}_${dom}`,semanaDomingo:dom,semanaSabado:sab,meta:metaVal,lancadoPor:window.usuarioLogado.uid,atualizadoEm:new Date().toISOString()};
            const q=window.fbFuncs.query(window.fbFuncs.collection(window.db,'metas'),window.fbFuncs.where('semanaId','==',`${turma.id}_${dom}`));
            const snap=await window.fbFuncs.getDocs(q);
            if (!snap.empty) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'metas',snap.docs[0].id),dados);
            else {dados.criadoEm=new Date().toISOString();await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'metas'),dados);}
            ok++;log.push(`✅ Meta ${turma.nome} — ${labelSemana(dom,sab)}: ${metaVal}`);
          } else {
            const turmaKey=String(row['TURMA']||row['Turma']||'').trim().toLowerCase();
            const dataStr=String(row['DATA']||row['Data']||'').trim();
            const resVal=parseFloat(row['RESULTADO']||row['Resultado']||0);
            if (!turmaKey||!dataStr){erros++;log.push('⚠ Ignorado');continue;}
            const turma=Object.values(turmasCache).find(t=>t.nome.toLowerCase()===turmaKey);
            if (!turma){erros++;log.push(`❌ Turma: ${turmaKey}`);continue;}
            const data=dataStr.includes('-')?dataStr.slice(0,10):dataStr;
            const dom=domingoSemana(data); const sab=sabadoSemana(dom);
            const dados={turmaId:turma.id,data,semanaDomingo:dom,semanaSabado:sab,resultado:resVal,diaSemana:new Date(data+'T12:00:00').getDay(),lancadoPor:window.usuarioLogado.uid,atualizadoEm:new Date().toISOString()};
            const q=window.fbFuncs.query(window.fbFuncs.collection(window.db,'resultadosDiarios'),window.fbFuncs.where('turmaId','==',turma.id),window.fbFuncs.where('data','==',data));
            const snap=await window.fbFuncs.getDocs(q);
            if (!snap.empty) await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'resultadosDiarios',snap.docs[0].id),dados);
            else {dados.criadoEm=new Date().toISOString();await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'resultadosDiarios'),dados);}
            ok++;log.push(`✅ ${turma.nome} — ${formatarData(data)}: ${resVal}`);
          }
        } catch(err){erros++;log.push(`❌ Erro: ${err.message}`);}
      }
      div.innerHTML=`<div style="display:flex;gap:12px;margin-bottom:12px">
        <div class="card" style="min-width:80px"><div class="card-num">${ok}</div><div class="card-label">OK</div></div>
        <div class="card" style="min-width:80px"><div class="card-num" style="color:var(--vermelho)">${erros}</div><div class="card-label">Erros</div></div>
      </div><div class="log-box">${log.map(l=>`<div class="${l.startsWith('✅')?'log-ok':l.startsWith('⚠')?'log-warn':'log-err'}">${l}</div>`).join('')}</div>`;
    } catch(err){div.innerHTML=`<p style="color:var(--vermelho)">❌ Erro: ${err.message}</p>`;}
  };
  reader.readAsBinaryString(file);
}

function baixarModeloMeta(){
  const tipo=document.getElementById('meta-imp-tipo').value;
  const csv=tipo==='metas'?'TURMA;SEMANA_INICIO;META\nTurma A;2026-02-15;500\n':'TURMA;DATA;RESULTADO\nTurma A;2026-02-16;85\n';
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=tipo==='metas'?'modelo-metas.csv':'modelo-resultados.csv'; a.click();
}

// ══════════════════════════════════════════════
// CONTROLE DE SÁBADOS
// ══════════════════════════════════════════════
async function carregarPaginaSabados(){
  await carregarFazendasSelects(); await carregarTurmasCache();
  const sel=document.getElementById('sabado-turma');
  if (sel){
    sel.innerHTML='<option value="">Selecione</option>';
    let turmasFiltradas=Object.values(turmasCache);
    if (window.usuarioLogado.perfil==='lider'){
      turmasFiltradas=turmasFiltradas.filter(t=>t.liderNome?.toLowerCase().trim()===window.usuarioLogado.nome?.toLowerCase().trim());
    }
    turmasFiltradas.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(t=>sel.innerHTML+=`<option value="${t.id}">${t.nome}</option>`);
  }
  const hoje=new Date();
  const inicio=new Date(hoje); inicio.setDate(hoje.getDate()-84);
  const fim=new Date(hoje); fim.setDate(hoje.getDate()+14);
  const semanas=gerarSemanas(inicio.toISOString().split('T')[0],fim.toISOString().split('T')[0]);
  const selSem=document.getElementById('sabado-semana');
  if (selSem){
    selSem.innerHTML='<option value="">Selecione a semana</option>';
    semanas.reverse().forEach(s=>selSem.innerHTML+=`<option value="${s.domingo}|${s.sabado}">${s.label}</option>`);
  }
}

async function carregarControleSab(){
  const turmaId=document.getElementById('sabado-turma').value;
  const semanaV=document.getElementById('sabado-semana').value;
  const painel=document.getElementById('painel-sabado-ctrl');
  if (!turmaId||!semanaV){painel.style.display='none';return;}
  painel.style.display='block';
  const [dom,sab]=semanaV.split('|');
  const qMeta=window.fbFuncs.query(window.fbFuncs.collection(window.db,'metas'),window.fbFuncs.where('semanaId','==',`${turmaId}_${dom}`));
  const snapMeta=await window.fbFuncs.getDocs(qMeta);
  let turmaGanhou=false; let statusHTML='<span style="color:var(--amarelo)">⚠️ Nenhuma meta lançada para esta semana.</span>';
  if (!snapMeta.empty){
    const meta=snapMeta.docs[0].data();
    const qRes=window.fbFuncs.query(window.fbFuncs.collection(window.db,'resultadosDiarios'),window.fbFuncs.where('turmaId','==',turmaId),window.fbFuncs.where('semanaDomingo','==',dom));
    const snapRes=await window.fbFuncs.getDocs(qRes);
    let soma=0; snapRes.forEach(d=>soma+=parseFloat(d.data().resultado||0));
    turmaGanhou=soma>=meta.meta;
    statusHTML=turmaGanhou
      ?`<strong style="color:var(--verde-medio)">✅ Turma ATINGIU a meta!</strong><br><small>Meta: ${meta.meta} | Soma: ${soma.toFixed(0)} | ${labelSemana(dom,sab)}</small><br><br>Marque quem <strong>trabalhou no sábado ${formatarData(sab)}</strong>:`
      :`<strong style="color:var(--vermelho)">❌ Turma NÃO atingiu.</strong> Meta: ${meta.meta} | Soma: ${soma.toFixed(0)}`;
  }
  document.getElementById('sabado-status-msg').innerHTML=statusHTML;
  document.getElementById('btn-salvar-sab').style.display=turmaGanhou?'inline-flex':'none';
  const qColab=window.fbFuncs.query(window.fbFuncs.collection(window.db,'colaboradores'),window.fbFuncs.where('turmaId','==',turmaId),window.fbFuncs.where('demitido','==',false));
  const snapColab=await window.fbFuncs.getDocs(qColab);
  const qPres=window.fbFuncs.query(window.fbFuncs.collection(window.db,'presencas'),window.fbFuncs.where('turmaId','==',turmaId),window.fbFuncs.where('data','==',sab));
  const snapPres=await window.fbFuncs.getDocs(qPres);
  const presMap={}; snapPres.forEach(d=>presMap[d.data().colaboradorId]=d.data().presente);
  const lista=document.getElementById('sabado-lista-colab');
  if (snapColab.empty){lista.innerHTML='<div class="empty-state"><span class="emoji">👥</span><p>Nenhum colaborador nesta turma.</p></div>';return;}
  lista.innerHTML=snapColab.docs.map(d=>{
    const c=d.data(); const checked=presMap[d.id]?'checked':''; const disabled=!turmaGanhou?'disabled':'';
    return `<div style="padding:10px 0;border-bottom:1px solid var(--cinza-100)">
      <label style="display:flex;align-items:center;gap:10px;cursor:${turmaGanhou?'pointer':'not-allowed'};font-size:14px">
        <input type="checkbox" id="pres-${d.id}" ${checked} ${disabled} style="width:18px;height:18px"/>
        <span>${c.nome} <small style="color:var(--cinza-500)">#${c.chapa}</small></span>
      </label>
    </div>`;
  }).join('');
  window._sabadoColab=snapColab.docs.map(d=>({id:d.id,...d.data()}));
  window._sabadoData=sab; window._sabadoTurma=turmaId;
}

async function salvarPresencaSab(){
  const colab=window._sabadoColab||[]; const data=window._sabadoData; const turmaId=window._sabadoTurma;
  for (const c of colab){
    const chk=document.getElementById('pres-'+c.id); if (!chk) continue;
    const qP=window.fbFuncs.query(window.fbFuncs.collection(window.db,'presencas'),window.fbFuncs.where('colaboradorId','==',c.id),window.fbFuncs.where('data','==',data));
    const sp=await window.fbFuncs.getDocs(qP);
    const dados={colaboradorId:c.id,turmaId,data,presente:chk.checked,exportado:false,atualizadoEm:new Date().toISOString()};
    if (!sp.empty){
      const anterior={presente:sp.docs[0].data().presente};
      await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'presencas',sp.docs[0].id),dados);
      await registrarAuditoria('presencas',sp.docs[0].id,'update',anterior,{presente:chk.checked});
    } else {
      dados.criadoEm=new Date().toISOString();
      const ref=await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'presencas'),dados);
      await registrarAuditoria('presencas',ref.id,'create',null,{presente:chk.checked,colaboradorId:c.id,data});
    }
  }
  toast('Presenças salvas!');
}

// ══════════════════════════════════════════════
// PREMIAÇÃO — com regra da sexta-feira
// ══════════════════════════════════════════════
async function carregarPaginaPremiacao(){
  await carregarFazendasSelects(); await carregarTurmasCache();
  const snapM=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas'));
  const semanas=new Map();
  snapM.forEach(d=>{const m=d.data();if(m.semanaDomingo)semanas.set(m.semanaDomingo,{domingo:m.semanaDomingo,sabado:m.semanaSabado});});
  const sel=document.getElementById('premio-semana');
  if (sel){
    sel.innerHTML='<option value="">Todas</option>';
    [...semanas.values()].sort((a,b)=>b.domingo.localeCompare(a.domingo)).forEach(s=>sel.innerHTML+=`<option value="${s.domingo}|${s.sabado}">${labelSemana(s.domingo,s.sabado)}</option>`);
  }
  filtrarPremiacao();
}

async function filtrarPremiacao(){
  const fazendaId=document.getElementById('premio-fazenda')?.value||'';
  const semanaV=document.getElementById('premio-semana')?.value||'';
  const listaA=document.getElementById('lista-conquistaram');
  const listaB=document.getElementById('lista-trabalharam');
  if (listaA) listaA.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  if (listaB) listaB.innerHTML='<div class="loading"><div class="spinner"></div></div>';

  // Buscar metas atingidas
  let qMetas=window.fbFuncs.collection(window.db,'metas');
  if (semanaV){const [dom]=semanaV.split('|');qMetas=window.fbFuncs.query(qMetas,window.fbFuncs.where('semanaDomingo','==',dom));}
  const snapMetas=await window.fbFuncs.getDocs(qMetas);
  const snapRes=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'resultadosDiarios'));
  const resultMap={};
  snapRes.forEach(d=>{const r=d.data();const key=`${r.turmaId}_${r.semanaDomingo}`;if(!resultMap[key])resultMap[key]=0;resultMap[key]+=parseFloat(r.resultado||0);});
  
  // Map: turmaId → metaDados (só turmas que atingiram)
  const turmasGanharam=new Map();
  snapMetas.forEach(d=>{const m=d.data();const soma=resultMap[m.semanaId]||0;if(soma>=m.meta)turmasGanharam.set(m.turmaId,m);});

  if (turmasGanharam.size===0){
    if (listaA) listaA.innerHTML='<div class="empty-state"><span class="emoji">🎯</span><p>Nenhuma turma atingiu meta no período.</p></div>';
    if (listaB) listaB.innerHTML='<div class="empty-state"><span class="emoji">🏆</span><p>—</p></div>';
    document.getElementById('count-conquistaram').textContent=0;
    document.getElementById('count-trabalharam').textContent=0;
    return;
  }

  const [snapC,snapF]=await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))
  ]);
  const colabMap={}; snapC.forEach(d=>colabMap[d.id]={id:d.id,...d.data()});
  const fazMap={};   snapF.forEach(d=>fazMap[d.id]=d.data().nome);

  // ── REGRA DA SEXTA-FEIRA ──────────────────
  // Para cada semana com turmas ganhadoras, verificar
  // em qual turma cada colaborador estava na sexta-feira
  const semanasGanhadoras=[...new Set([...turmasGanharam.values()].map(m=>m.semanaDomingo))];
  
  // Buscar todo o histórico de uma vez
  const snapH=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'historicoTurmas'));
  const historicoMap={};
  snapH.forEach(d=>{const h=d.data();if(!historicoMap[h.colaboradorId])historicoMap[h.colaboradorId]=[];historicoMap[h.colaboradorId].push(h);});

  function turmaDoColabNaSextaLocal(colaboradorId, semanaDomingo){
    const sexta=sextaSemana(semanaDomingo);
    const registros=historicoMap[colaboradorId]||[];
    for (const h of registros){
      const inicio=h.dataInicio||''; const fim=h.dataFim||'9999-12-31';
      if (inicio<=sexta&&sexta<=fim) return h.turmaIdNova;
    }
    return colabMap[colaboradorId]?.turmaId||null;
  }

  // Construir lista de conquistadores usando regra da sexta
  let conquistaram=[];
  for (const [cid, colab] of Object.entries(colabMap)){
    if (colab.demitido) continue;
    // Para cada semana ganhadora, ver se estava na turma ganhadora na sexta
    for (const dom of semanasGanhadoras){
      const turmaIdNaSexta=turmaDoColabNaSextaLocal(cid,dom);
      if (turmaIdNaSexta && turmasGanharam.has(turmaIdNaSexta)){
        const meta=turmasGanharam.get(turmaIdNaSexta);
        if (!fazendaId||turmasCache[turmaIdNaSexta]?.fazendaId===fazendaId){
          conquistaram.push({...colab,turmaIdNaSexta,metaDados:meta});
        }
      }
    }
  }
  // Deduplica por colaborador + semana
  const vistos=new Set();
  conquistaram=conquistaram.filter(c=>{const k=`${c.id}_${c.metaDados.semanaDomingo}`;if(vistos.has(k))return false;vistos.add(k);return true;});

  // Presenças
  const presencasMap={};
  if (semanaV){
    const [,sab]=semanaV.split('|');
    const qPres=window.fbFuncs.query(window.fbFuncs.collection(window.db,'presencas'),window.fbFuncs.where('data','==',sab),window.fbFuncs.where('presente','==',true));
    const snapPres=await window.fbFuncs.getDocs(qPres);
    snapPres.forEach(d=>{const p=d.data();presencasMap[`${p.colaboradorId}_${p.data}`]={...p,docId:d.id};});
  } else {
    const qPres=window.fbFuncs.query(window.fbFuncs.collection(window.db,'presencas'),window.fbFuncs.where('presente','==',true));
    const snapPres=await window.fbFuncs.getDocs(qPres);
    snapPres.forEach(d=>{const p=d.data();presencasMap[`${p.colaboradorId}_${p.data}`]={...p,docId:d.id};});
  }

  const trabalharam=conquistaram.filter(c=>{
    const sab=c.metaDados.semanaSabado;
    return !!presencasMap[`${c.id}_${sab}`];
  });

  // Renderizar Lista A
  if (listaA){
    if (conquistaram.length===0){listaA.innerHTML='<div class="empty-state"><span class="emoji">👥</span><p>Nenhum.</p></div>';}
    else {
      listaA.innerHTML=conquistaram.map(c=>{
        const t=turmasCache[c.turmaIdNaSexta];
        const sab=c.metaDados.semanaSabado;
        const trabalhou=!!presencasMap[`${c.id}_${sab}`];
        const presDoc=presencasMap[`${c.id}_${sab}`];
        const jaExportado=presDoc?.exportado;
        return `<div class="item-card">
          <div class="item-card-info">
            <strong>${c.nome} <small style="color:var(--cinza-500)">#${c.chapa}</small></strong>
            <span>🏘️ ${t?.nome||'—'} | 🌿 ${t?fazMap[t.fazendaId]||'—':'—'}</span>
            <span>📅 Sábado: <strong>${formatarData(sab)}</strong> | Semana: ${labelSemana(c.metaDados.semanaDomingo,sab)}</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            ${trabalhou?'<span class="badge badge-verde">✅ Trabalhou</span>':'<span class="badge badge-amarelo">⏳ Não confirmado</span>'}
            ${jaExportado?'<span class="badge badge-azul">📤 Exportado</span>':''}
          </div>
        </div>`;
      }).join('');
    }
  }

  // Renderizar Lista B
  if (listaB){
    if (trabalharam.length===0){listaB.innerHTML='<div class="empty-state"><span class="emoji">🏆</span><p>Nenhum confirmado.</p></div>';}
    else {
      listaB.innerHTML=trabalharam.map(c=>{
        const t=turmasCache[c.turmaIdNaSexta];
        const sab=c.metaDados.semanaSabado;
        const presDoc=presencasMap[`${c.id}_${sab}`];
        const jaExportado=presDoc?.exportado;
        return `<div class="item-card">
          <div class="item-card-info">
            <strong>${c.nome} <small style="color:var(--cinza-500)">#${c.chapa}</small></strong>
            <span>🏘️ ${t?.nome||'—'} | 🌿 ${t?fazMap[t.fazendaId]||'—':'—'}</span>
            <span>📅 Folga referente ao sábado: <strong>${formatarData(sab)}</strong></span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="badge badge-verde">🏆 Premiado</span>
            ${jaExportado?'<span class="badge badge-azul">📤 Exportado</span>':'<span class="badge badge-amarelo">⏳ Pendente</span>'}
          </div>
        </div>`;
      }).join('');
    }
  }

  document.getElementById('count-conquistaram').textContent=conquistaram.length;
  document.getElementById('count-trabalharam').textContent=trabalharam.length;
}

// ══════════════════════════════════════════════
// EXPORTAÇÃO — marca registros como exportados
// ══════════════════════════════════════════════
async function carregarPaginaExportar(){
  await carregarFazendasSelects();
  const snapM=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'metas'));
  const semanas=new Map();
  snapM.forEach(d=>{const m=d.data();if(m.semanaDomingo)semanas.set(m.semanaDomingo,{domingo:m.semanaDomingo,sabado:m.semanaSabado});});
  const sel=document.getElementById('exp-semana');
  if (sel){
    sel.innerHTML='<option value="">Todas</option>';
    [...semanas.values()].sort((a,b)=>b.domingo.localeCompare(a.domingo)).forEach(s=>sel.innerHTML+=`<option value="${s.domingo}|${s.sabado}">${labelSemana(s.domingo,s.sabado)}</option>`);
  }
}

async function exportarTXT(){
  const msg=document.getElementById('exp-msg'); msg.textContent='Gerando...';
  const fazId=document.getElementById('exp-fazenda').value;
  const semanaV=document.getElementById('exp-semana').value;
  const chapaGer=document.getElementById('exp-chapa-ger').value.trim();
  const horaIni=document.getElementById('exp-hi').value||'08:00';
  const horaFim=document.getElementById('exp-hf').value||'17:00';
  if (!chapaGer){msg.textContent='⚠️ Informe chapa gerador.';msg.style.color='var(--vermelho)';return;}
  const {registros,presDocIds}=await buscarPremiados(fazId,semanaV);
  if (registros.length===0){msg.textContent='⚠️ Nenhum registro.';msg.style.color='var(--vermelho)';return;}
  const linhas=registros.map(r=>{
    const chapa6=padZeros(r.chapa,6); const ger6=padZeros(chapaGer,6);
    return `${chapa6};${formatarData(r.dataSabado)};0034;${horaIni};${horaFim};0;${ger6};0;1;1;FOLGA PREMIO`;
  });
  const blob=new Blob([linhas.join('\n')],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='premiacao.txt'; a.click();
  // Marcar como exportado
  await marcarExportado(presDocIds);
  msg.textContent=`✅ ${linhas.length} registros exportados e marcados!`; msg.style.color='var(--verde-medio)';
  await registrarAuditoria('exportacao','txt','export',null,{quantidade:linhas.length,semana:semanaV,fazenda:fazId});
}

async function exportarCSV(){
  const msg=document.getElementById('exp-msg'); msg.textContent='Gerando...';
  const fazId=document.getElementById('exp-fazenda').value;
  const semanaV=document.getElementById('exp-semana').value;
  const {registros,presDocIds}=await buscarPremiados(fazId,semanaV);
  if (registros.length===0){msg.textContent='⚠️ Nenhum registro.';msg.style.color='var(--vermelho)';return;}
  const cab='CHAPA;NOME;FUNÇÃO;TURMA;FAZENDA;SEMANA;DATA SÁBADO;STATUS\n';
  const linhas=registros.map(r=>`${r.chapa};${r.nome};${r.funcao||''};${r.turmaNome};${r.fazNome};${r.semana};${formatarData(r.dataSabado)};FOLGA PREMIO`);
  const blob=new Blob(['\uFEFF'+cab+linhas.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='premiacao.csv'; a.click();
  await marcarExportado(presDocIds);
  msg.textContent=`✅ ${linhas.length} registros exportados e marcados!`; msg.style.color='var(--verde-medio)';
  await registrarAuditoria('exportacao','csv','export',null,{quantidade:linhas.length,semana:semanaV,fazenda:fazId});
}

async function marcarExportado(presDocIds){
  for (const docId of presDocIds){
    await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'presencas',docId),{exportado:true,exportadoEm:new Date().toISOString(),exportadoPor:window.usuarioLogado.uid});
  }
}

async function buscarPremiados(fazendaId,semanaV){
  await carregarTurmasCache();
  let qMetas=window.fbFuncs.collection(window.db,'metas');
  if (semanaV){const [dom]=semanaV.split('|');qMetas=window.fbFuncs.query(qMetas,window.fbFuncs.where('semanaDomingo','==',dom));}
  const snapMetas=await window.fbFuncs.getDocs(qMetas);
  const snapRes=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'resultadosDiarios'));
  const resultMap={};
  snapRes.forEach(d=>{const r=d.data();const key=`${r.turmaId}_${r.semanaDomingo}`;if(!resultMap[key])resultMap[key]=0;resultMap[key]+=parseFloat(r.resultado||0);});
  const turmasGanharam=new Map();
  snapMetas.forEach(d=>{const m=d.data();const soma=resultMap[m.semanaId]||0;if(soma>=m.meta)turmasGanharam.set(m.turmaId,m);});
  if (turmasGanharam.size===0) return {registros:[],presDocIds:[]};

  // Histórico de turmas
  const snapH=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'historicoTurmas'));
  const historicoMap={};
  snapH.forEach(d=>{const h=d.data();if(!historicoMap[h.colaboradorId])historicoMap[h.colaboradorId]=[];historicoMap[h.colaboradorId].push(h);});

  // Presenças confirmadas
  let qPres;
  if (semanaV){const [,sab]=semanaV.split('|');qPres=window.fbFuncs.query(window.fbFuncs.collection(window.db,'presencas'),window.fbFuncs.where('data','==',sab),window.fbFuncs.where('presente','==',true));}
  else {qPres=window.fbFuncs.query(window.fbFuncs.collection(window.db,'presencas'),window.fbFuncs.where('presente','==',true));}
  const snapPres=await window.fbFuncs.getDocs(qPres);

  const [snapC,snapT,snapF]=await Promise.all([
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'turmas')),
    window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'fazendas'))
  ]);
  const colabMap={}; snapC.forEach(d=>colabMap[d.id]={id:d.id,...d.data()});
  const turmaMap={}; snapT.forEach(d=>turmaMap[d.id]=d.data());
  const fazMap={};   snapF.forEach(d=>fazMap[d.id]=d.data().nome);

  function turmaLocalSexta(colaboradorId,semanaDomingo){
    const sexta=sextaSemana(semanaDomingo);
    const registros=historicoMap[colaboradorId]||[];
    for (const h of registros){const inicio=h.dataInicio||'';const fim=h.dataFim||'9999-12-31';if(inicio<=sexta&&sexta<=fim)return h.turmaIdNova;}
    return colabMap[colaboradorId]?.turmaId||null;
  }

  const resultado=[]; const presDocIds=[];
  snapPres.forEach(d=>{
    const pres=d.data(); const colab=colabMap[pres.colaboradorId];
    if (!colab) return;
    // Buscar qual turma estava na sexta desta semana
    const semanaDomingo=domingoSemana(pres.data);
    const turmaIdNaSexta=turmaLocalSexta(pres.colaboradorId,semanaDomingo);
    if (!turmaIdNaSexta||!turmasGanharam.has(turmaIdNaSexta)) return;
    const turma=turmaMap[turmaIdNaSexta];
    if (fazendaId&&turma?.fazendaId!==fazendaId) return;
    const meta=turmasGanharam.get(turmaIdNaSexta);
    presDocIds.push(d.id);
    resultado.push({chapa:colab.chapa,nome:colab.nome,funcao:colab.funcao||'',turmaNome:turma?.nome||'—',fazNome:turma?fazMap[turma.fazendaId]||'—':'—',semana:labelSemana(meta.semanaDomingo,meta.semanaSabado),dataSabado:meta.semanaSabado});
  });
  return {registros:resultado,presDocIds};
}

// ══════════════════════════════════════════════
// IMPORTAR TOTVS
// ══════════════════════════════════════════════
async function carregarPaginaImportarTotvs(){ await carregarTurmasCache(); }

async function importarTotvs(event){
  const file=event.target.files[0]; if (!file) return;
  const div=document.getElementById('totvs-resultado');
  div.innerHTML='<div class="loading"><div class="spinner"></div> Lendo arquivo...</div>';
  const reader=new FileReader();
  reader.onload=async function(e){
    try {
      const wb=XLSX.read(e.target.result,{type:'binary',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if (!rows.length){div.innerHTML='<p style="color:var(--vermelho)">❌ Arquivo vazio.</p>';return;}
      const MAPA={chapa:['CHAPA','Chapa','MATRICULA'],nome:['NOME','Nome'],funcao:['FUNCAO','Funcao','FUNÇÃO'],turma:['TURMA','Turma','CODSECAO','SECAO'],lider:['LIDER','Lider','NOMECHEFIA'],admissao:['DATAADMISSAO','ADMISSAO','DATAADMISSÃO'],demissao:['DATADEMISSAO','DEMISSAO'],inicioJornada:['HORAINICIO','HORA INICIO'],fimJornada:['HORAFIM','HORA FIM']};
      const normalizar=(row)=>{const obj={};for(const [campo,opcoes] of Object.entries(MAPA)){for(const op of opcoes){if(row[op]!==undefined){obj[campo]=String(row[op]||'').trim();break;}}if(!obj[campo])obj[campo]='';}return obj;};
      let ok=0,erros=0,mudancas=0,log=[];
      const snapC=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'colaboradores'));
      const colabExistente={}; snapC.forEach(d=>{const c=d.data();if(c.chapa)colabExistente[c.chapa.trim()]={id:d.id,...c};});
      for (const row of rows){
        try {
          const item=normalizar(row);
          if (!item.chapa||!item.nome){erros++;log.push('⚠ Sem chapa/nome');continue;}
          let turmaId=null; let turmaNome=item.turma;
          const turmaKey=turmaNome.toLowerCase().trim();
          if (turmaKey){
            const turmaObj=Object.values(turmasCache).find(t=>t.nome.toLowerCase().trim()===turmaKey);
            if (turmaObj){turmaId=turmaObj.id;}
            else {
              const novaRef=await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'turmas'),{nome:turmaNome,liderNome:item.lider||'',fazendaId:'',criadoEm:new Date().toISOString(),criadoViaImport:true});
              turmaId=novaRef.id; turmasCache[turmaId]={id:turmaId,nome:turmaNome,liderNome:item.lider||'',fazendaId:''};
              log.push(`📁 Turma criada: ${turmaNome}`);
            }
          }
          const dados={chapa:item.chapa,nome:item.nome,funcao:item.funcao||'',liderNome:item.lider||'',turmaId:turmaId||'',turmaNome,admissao:item.admissao||'',demissao:item.demissao||'',inicioJornada:item.inicioJornada||'08:00',fimJornada:item.fimJornada||'17:00',demitido:!!item.demissao,atualizadoEm:new Date().toISOString(),importadoTotvs:true};
          const existente=colabExistente[item.chapa];
          if (!existente){
            dados.criadoEm=new Date().toISOString();
            const ref=await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'colaboradores'),dados);
            await registrarAuditoria('colaboradores',ref.id,'import-create',null,{chapa:item.chapa,nome:item.nome});
            colabExistente[item.chapa]={id:ref.id,...dados};
            ok++;log.push(`✅ Novo: ${item.nome}`);
          } else {
            const turmaAntiga=(existente.turmaNome||'').toLowerCase().trim();
            const turmaNovaN=turmaNome.toLowerCase().trim();
            const mudouTurma=turmaNovaN&&turmaAntiga&&turmaNovaN!==turmaAntiga;
            if (mudouTurma){
              await window.fbFuncs.addDoc(window.fbFuncs.collection(window.db,'alertasMudancaTurma'),{colaboradorId:existente.id,chapa:item.chapa,nome:item.nome,turmaAntigaId:existente.turmaId||'',turmaAntigaNome:existente.turmaNome||'',turmaNovaId:turmaId||'',turmaNovaNome:turmaNome,dataDeteccao:new Date().toISOString(),resolvido:false,dadosPendentes:dados});
              mudancas++;log.push(`⚠ Mudança detectada: ${item.nome} (${existente.turmaNome} → ${turmaNome})`);
            } else {
              await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'colaboradores',existente.id),dados);
              await registrarAuditoria('colaboradores',existente.id,'import-update',{turmaNome:existente.turmaNome},{turmaNome});
              ok++;log.push(`↻ Atualizado: ${item.nome}`);
            }
          }
        } catch(err){erros++;log.push(`❌ Erro: ${err.message}`);}
      }
      div.innerHTML=`<div style="display:flex;gap:12px;margin-bottom:12px">
        <div class="card" style="min-width:80px"><div class="card-num">${ok}</div><div class="card-label">OK</div></div>
        <div class="card" style="min-width:80px"><div class="card-num" style="color:var(--amarelo)">${mudancas}</div><div class="card-label">Mudanças</div></div>
        <div class="card" style="min-width:80px"><div class="card-num" style="color:var(--vermelho)">${erros}</div><div class="card-label">Erros</div></div>
      </div><div class="log-box">${log.map(l=>`<div class="${l.startsWith('✅')?'log-ok':l.startsWith('⚠')?'log-warn':'log-err'}">${l}</div>`).join('')}</div>`;
    } catch(err){div.innerHTML=`<p style="color:var(--vermelho)">❌ Erro: ${err.message}</p>`;}
  };
  reader.readAsBinaryString(file);
}

// ══════════════════════════════════════════════
// AUDITORIA
// ══════════════════════════════════════════════
async function carregarPaginaAuditoria(){
  const div=document.getElementById('lista-auditoria');
  div.innerHTML='<div class="loading"><div class="spinner"></div></div>';
  const filtroColecao=document.getElementById('filtro-audit-colecao')?.value||'';
  const filtroUsuario=document.getElementById('filtro-audit-usuario')?.value?.toLowerCase()||'';
  let snap;
  try {
    snap=await window.fbFuncs.getDocs(window.fbFuncs.query(
      window.fbFuncs.collection(window.db,'auditoria'),
      window.fbFuncs.orderBy('timestamp','desc'),
      window.fbFuncs.limit(200)
    ));
  } catch(e){
    // Fallback sem orderBy se índice não existir ainda
    snap=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'auditoria'));
  }
  let registros=[]; snap.forEach(d=>registros.push({id:d.id,...d.data()}));
  registros.sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
  if (filtroColecao) registros=registros.filter(r=>r.colecao===filtroColecao);
  if (filtroUsuario) registros=registros.filter(r=>r.usuarioNome?.toLowerCase().includes(filtroUsuario));
  if (registros.length===0){div.innerHTML='<div class="empty-state"><span class="emoji">📋</span><p>Nenhum registro de auditoria.</p></div>';return;}
  const icones={create:'➕',update:'✏️',delete:'🗑️',approve:'✅',reject:'❌','import-create':'📥','import-update':'📥',export:'📤'};
  div.innerHTML=registros.slice(0,100).map(r=>{
    const icone=icones[r.acao]||'📝';
    const colecaoLabel={colaboradores:'Colaborador',metas:'Meta',resultadosDiarios:'Resultado',presencas:'Presença',turmas:'Turma',fazendas:'Fazenda',solicitacoesTransferencia:'Transferência',exportacao:'Exportação'}[r.colecao]||r.colecao;
    const acaoLabel={create:'Criou',update:'Editou',delete:'Excluiu',approve:'Aprovou',reject:'Recusou','import-create':'Importou','import-update':'Atualizou via import',export:'Exportou'}[r.acao]||r.acao;
    return `<div class="audit-row">
      <div class="audit-icon">${icone}</div>
      <div class="audit-info">
        <strong>${r.usuarioNome} ${acaoLabel} ${colecaoLabel}</strong>
        <small>${r.colecao} ${r.documentoId?`· ID: ${r.documentoId.slice(0,8)}...`:''}</small>
      </div>
      <div class="audit-who">${formatarDataHora(r.timestamp)}</div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
// ADMINISTRAÇÃO
// ══════════════════════════════════════════════
async function carregarAdmin(){
  const qP=window.fbFuncs.query(window.fbFuncs.collection(window.db,'usuarios'),window.fbFuncs.where('aprovado','==',false));
  const snapP=await window.fbFuncs.getDocs(qP);
  const lP=document.getElementById('lista-pendentes');
  if (snapP.empty){lP.innerHTML='<div class="empty-state"><span class="emoji">✅</span><p>Nenhum cadastro pendente.</p></div>';}
  else {
    lP.innerHTML='';
    snapP.docs.forEach(d=>{
      const u=d.data();
      lP.innerHTML+=`<div class="item-card">
        <div class="item-card-info"><strong>${u.nome}</strong><span>Chapa: ${u.chapa} | ${u.email}</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select id="perfil-${d.id}" style="padding:7px 10px;border-radius:var(--radius-md);border:1.5px solid var(--cinza-200);font-size:13px;font-family:var(--font)">
            <option value="lider">Líder</option><option value="administrativo">Administrativo</option>
            <option value="encarregado">Encarregado</option><option value="gestao">Gestão</option><option value="admin">Admin</option>
          </select>
          <button class="btn-primary btn-sm" onclick="aprovarUsuario('${d.id}')">✅ Aprovar</button>
        </div>
      </div>`;
    });
  }
  const snapT=await window.fbFuncs.getDocs(window.fbFuncs.collection(window.db,'usuarios'));
  const lU=document.getElementById('lista-usuarios');
  lU.innerHTML='<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Chapa</th><th>Perfil</th><th>Status</th><th>Ação</th></tr></thead><tbody>';
  snapT.docs.forEach(d=>{
    const u=d.data();
    const st=u.aprovado?'<span class="badge badge-verde">Ativo</span>':'<span class="badge badge-amarelo">Pendente</span>';
    lU.innerHTML+=`<tr><td><strong>${u.nome}</strong><br><small style="color:var(--cinza-500)">${u.email}</small></td><td>${u.chapa}</td><td>${u.perfil}</td><td>${st}</td><td><button class="btn-primary btn-sm" onclick="editarUsuarioCompleto('${d.id}')">✏️</button></td></tr>`;
  });
  lU.innerHTML+='</tbody></table></div>';
}

async function aprovarUsuario(uid){
  const perfil=document.getElementById('perfil-'+uid)?.value||'lider';
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'usuarios',uid),{aprovado:true,perfil,aprovadoPor:window.usuarioLogado?.uid,aprovadoEm:new Date().toISOString()});
  await registrarAuditoria('usuarios',uid,'approve',{aprovado:false},{aprovado:true,perfil});
  toast('Usuário aprovado!'); carregarAdmin();
}

async function editarUsuarioCompleto(uid){
  const snap=await window.fbFuncs.getDoc(window.fbFuncs.doc(window.db,'usuarios',uid));
  if (!snap.exists()) return;
  const u=snap.data();
  abrirModal('Editar Usuário',`
    <div class="form-group"><label>Nome Completo</label><input id="edit-nome" value="${u.nome||''}"/></div>
    <div class="form-group"><label>Chapa</label><input id="edit-chapa" value="${u.chapa||''}"/></div>
    <div class="form-group"><label>E-mail</label><input id="edit-email" value="${u.email||''}" type="email"/></div>
    <div class="form-group"><label>Perfil</label>
      <select id="edit-perfil">
        <option value="lider" ${u.perfil==='lider'?'selected':''}>Líder</option>
        <option value="administrativo" ${u.perfil==='administrativo'?'selected':''}>Administrativo</option>
        <option value="encarregado" ${u.perfil==='encarregado'?'selected':''}>Encarregado</option>
        <option value="gestao" ${u.perfil==='gestao'?'selected':''}>Gestão</option>
        <option value="admin" ${u.perfil==='admin'?'selected':''}>Admin</option>
      </select>
    </div>
    <div class="form-group"><label>Status</label>
      <select id="edit-aprovado">
        <option value="true" ${u.aprovado?'selected':''}>Ativo</option>
        <option value="false" ${!u.aprovado?'selected':''}>Bloqueado</option>
      </select>
    </div>`,
    ()=>salvarEdicaoUsuario(uid));
}

async function salvarEdicaoUsuario(uid){
  const dados={nome:document.getElementById('edit-nome').value.trim(),chapa:document.getElementById('edit-chapa').value.trim(),email:document.getElementById('edit-email').value.trim(),perfil:document.getElementById('edit-perfil').value,aprovado:document.getElementById('edit-aprovado').value==='true',atualizadoEm:new Date().toISOString(),atualizadoPor:window.usuarioLogado.uid};
  if (!dados.nome||!dados.chapa||!dados.email){toast('Preencha todos os campos.','aviso');return;}
  await window.fbFuncs.updateDoc(window.fbFuncs.doc(window.db,'usuarios',uid),dados);
  await registrarAuditoria('usuarios',uid,'update',null,{perfil:dados.perfil,aprovado:dados.aprovado});
  fecharModal(); toast('Usuário atualizado!'); carregarAdmin();
}
