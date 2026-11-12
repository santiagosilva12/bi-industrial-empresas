/**
 * METALÚRGICA BRILHO & MODERNA - INDUSTRIAL INTELLIGENCE DASHBOARD
 * Core Logic & Interactive Controller
 */

// Estado Global da Aplicação
const state = {
  currentCompany: 'consolidado', // 'consolidado', 'mb', 'moderna'
  activeTab: 'tab-visao-geral',
  filters: {
    ano: 'todos',
    mes: 'todos',
    categoria: 'todas',
    uf: 'todos'
  },
  productsPage: 1,
  productsPerPage: 20,
  churnPage: 1,
  churnPerPage: 20,
  charts: {}
};

// Formatação Monetária e Numérica Brasileira
const formatBRL = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const formatNumber = (val) => {
  return new Intl.NumberFormat('pt-BR').format(val || 0);
};

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.DASHBOARD_DATA !== 'undefined') {
    initDashboard(window.DASHBOARD_DATA);
  } else {
    // Tentar carregar via fetch (se rodando via http server)
    fetch('Arquivos.js/data_dashboard.json')
      .catch(() => fetch('data_dashboard.json'))
      .then(res => res.json())
      .then(data => {
        window.DASHBOARD_DATA = data;
        initDashboard(data);
      })
      .catch(err => {
        console.error('Erro ao carregar dados do dashboard:', err);
        alert('Atenção: Não foi possível carregar os dados. Verifique se o arquivo data.js ou data_dashboard.json está presente.');
      });
  }

  // Evento do botão de atualização
  document.getElementById('btn-refresh-data')?.addEventListener('click', () => {
    alert('Para atualizar a base com os arquivos mais recentes, basta executar o arquivo ATUALIZAR_DASHBOARD.bat na pasta do sistema!\n\nEm seguida recarregue esta página.');
  });
});

function initDashboard(data) {
  // Inicializar Tema (Claro / Escuro)
  initTheme();

  // Restaurar estado da sidebar (recolhido/expandido)
  if (localStorage.getItem('mb_sidebar_collapsed') === '1' && window.innerWidth > 900) {
    document.getElementById('app-sidebar')?.classList.add('collapsed');
  }

  renderHeaderStatus(data);
  updateAllViews();
  setupEventListeners();
  renderGuiaFiles(data);
}

// =========================================================================
// CONTROLE DE TEMA (MODO CLARO & ESCURO / DIA & NOITE)
// =========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('mb_theme') || 'dark';
  applyTheme(savedTheme, false);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme, true);
}

function applyTheme(theme, reRender = false) {
  const icon = document.getElementById('theme-toggle-icon');
  const text = document.getElementById('theme-toggle-text');
  const btn = document.getElementById('btn-theme-toggle');

  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('mb_theme', 'light');
    if (icon) icon.innerText = '🌙';
    if (text) text.innerText = 'Modo Escuro';
    if (btn) btn.setAttribute('title', 'Alternar para Modo Escuro (Noite)');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('mb_theme', 'dark');
    if (icon) icon.innerText = '☀️';
    if (text) text.innerText = 'Modo Claro';
    if (btn) btn.setAttribute('title', 'Alternar para Modo Claro (Dia)');
  }

  if (reRender && window.DASHBOARD_DATA) {
    updateAllViews();
  }
}
window.toggleTheme = toggleTheme;


// Alternar Recolhimento da Sidebar
function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;

  if (window.innerWidth <= 900) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('mb_sidebar_collapsed', isCollapsed ? '1' : '0');
  }

  // Ajustar redimensionamento dos gráficos Chart.js suavemente
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    Object.values(state.charts).forEach(c => c && c.resize && c.resize());
  }, 300);
}

// Atualizar Status do Cabeçalho
function renderHeaderStatus(data) {
  const comp = data.empresas[state.currentCompany] || data.empresas['consolidado'];
  const res = comp.resumo_executivo;
  const labelTotal = document.getElementById('label-registros-total');
  if (labelTotal) {
    labelTotal.innerText = `${formatNumber(res.total_pedidos)} pedidos • ${formatNumber(res.total_itens)} peças`;
  }
  
  if (document.getElementById('badge-data-atualizacao')) {
    document.getElementById('badge-data-atualizacao').innerText = `Atualizado em: ${data.data_atualizacao}`;
  }
}

// Trocar Empresa Ativa (Consolidado, MB, Moderna)
function setCompany(companyKey) {
  state.currentCompany = companyKey;

  // Atualizar botões no cabeçalho
  document.querySelectorAll('.company-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const activeBtn = document.getElementById(`btn-comp-${companyKey}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Ajustar títulos
  const title = document.getElementById('brand-title');
  const subtitle = document.getElementById('brand-subtitle');
  const topbarComp = document.getElementById('topbar-empresa-name');
  if (title) title.innerText = 'BI INDUSTRIAL';

  if (companyKey === 'consolidado') {
    if (subtitle) subtitle.innerText = 'Empresa 1 & Empresa 2';
    if (topbarComp) topbarComp.innerText = 'Grupo Consolidado';
  } else if (companyKey === 'mb') {
    if (subtitle) subtitle.innerText = 'Empresa 1';
    if (topbarComp) topbarComp.innerText = 'Empresa 1';
  } else {
    if (subtitle) subtitle.innerText = 'Empresa 2';
    if (topbarComp) topbarComp.innerText = 'Empresa 2';
  }

  state.productsPage = 1;
  syncReportFiltersUI();
  updateAllViews();
}

// Alternar Abas
function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  // Atualizar breadcrumb no Topbar
  const tabTitles = {
    'tab-visao-geral': 'Visão Geral Executiva',
    'tab-producao': 'Produção & Curva ABC',
    'tab-estados': 'Vendas por Estado (UF)',
    'tab-budget': 'Budget & Metas Planejadas',
    'tab-gastos': 'Plano de Gastos e Investimentos',
    'tab-split': 'Equilíbrio Fiscal & Split',
    'tab-colaboradores': 'Produtividade & RH',
    'tab-custos': 'Custos & Formação de Preço',
    'tab-backlog': 'Backlog & Pendências Fabris',
    'tab-churn': 'Clientes Inativos & Churn',
    'tab-relatorio': 'Relatório Executivo para Impressão'
  };

  if (tabId === 'tab-relatorio') {
    renderExecutiveReport();
  } else if (tabId === 'tab-custos') {
    renderCustosModule();
  } else if (tabId === 'tab-budget') {
    renderBudgetModule();
  } else if (tabId === 'tab-gastos') {
    renderGastosModule();
  }

  const activeTitleElem = document.getElementById('topbar-active-title');
  if (activeTitleElem && tabTitles[tabId]) {
    activeTitleElem.innerText = tabTitles[tabId];
  }

  // Fechar menu mobile se estiver aberto
  if (window.innerWidth <= 900) {
    document.getElementById('app-sidebar')?.classList.remove('mobile-open');
  }

  // Re-renderizar gráficos específicos da aba quando ativada
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    Object.values(state.charts).forEach(c => c && c.resize && c.resize());
  }, 50);
}

// Mapeamentos Auxiliares
const UF_TO_REGIAO = {
  SP: 'Sudeste', RJ: 'Sudeste', MG: 'Sudeste', ES: 'Sudeste',
  PR: 'Sul', SC: 'Sul', RS: 'Sul',
  GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste', DF: 'Centro-Oeste',
  BA: 'Nordeste', PE: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste', RN: 'Nordeste', AL: 'Nordeste', PI: 'Nordeste', SE: 'Nordeste',
  PA: 'Norte', AM: 'Norte', RO: 'Norte', TO: 'Norte', AC: 'Norte', AP: 'Norte', RR: 'Norte',
  EX: 'Exterior'
};

const MESES_MAP = {
  '1': 'Janeiro', '2': 'Fevereiro', '3': 'Março', '4': 'Abril',
  '5': 'Maio', '6': 'Junho', '7': 'Julho', '8': 'Agosto',
  '9': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
};

// Extrair Dados Filtrados por Período (Ano, Mês, Categoria, UF)
function getPeriodData(empresaData) {
  const ano = state.filters.ano;
  const mes = state.filters.mes;
  const catFilter = state.filters.categoria;
  const ufFilter = state.filters.uf;
  const data = window.DASHBOARD_DATA;

  let periodData = null;
  let periodLabel = 'Histórico Total (2020 a 2026)';

  if (ano !== 'todos' && mes !== 'todos') {
    const key = `${ano}-${String(mes).padStart(2, '0')}`;
    periodData = empresaData.dados_mensais?.[key] || null;
    periodLabel = `${MESES_MAP[mes] || mes} de ${ano}`;
  } else if (ano !== 'todos' && mes === 'todos') {
    periodData = empresaData.dados_anuais?.[ano] || null;
    periodLabel = `Ano ${ano}`;
  } else if (ano === 'todos' && mes !== 'todos') {
    const key = String(parseInt(mes, 10));
    periodData = empresaData.dados_por_mes_geral?.[key] || null;
    periodLabel = `${MESES_MAP[mes] || mes} (Todos os Anos)`;
  } else {
    periodData = {
      faturamento: empresaData.resumo_executivo?.total_faturamento || 0,
      quantidade: empresaData.resumo_executivo?.total_itens || 0,
      pedidos: empresaData.resumo_executivo?.total_pedidos || 0,
      clientes: empresaData.resumo_executivo?.total_clientes || 0,
      ticket_medio: empresaData.resumo_executivo?.ticket_medio || 0,
      preco_medio: empresaData.resumo_executivo?.preco_medio_peca || 0,
      categorias: empresaData.categorias || [],
      vendas_por_uf: empresaData.vendas_por_uf || [],
      produtos: empresaData.produtos_estrategia || [],
      top_clientes: empresaData.top_clientes || [],
      top_cidades: empresaData.top_cidades || []
    };
    periodLabel = 'Histórico Consolidado (2020 a 2026)';
  }

  if (!periodData) {
    periodData = {
      faturamento: 0,
      quantidade: 0,
      pedidos: 0,
      clientes: 0,
      ticket_medio: 0,
      preco_medio: 0,
      categorias: [],
      vendas_por_uf: [],
      produtos: [],
      top_clientes: [],
      top_cidades: []
    };
  }

  let filteredResult = { ...periodData };

  // Sub-filtro de Categoria
  if (catFilter !== 'todas') {
    const catItem = (periodData.categorias || []).find(c => c.categoria === catFilter);
    if (catItem) {
      filteredResult.faturamento = catItem.faturamento;
      filteredResult.quantidade = catItem.quantidade;
      filteredResult.pedidos = catItem.pedidos;
      filteredResult.ticket_medio = catItem.pedidos > 0 ? catItem.faturamento / catItem.pedidos : 0;
      filteredResult.preco_medio = catItem.quantidade > 0 ? catItem.faturamento / catItem.quantidade : 0;
    }
    periodLabel += ` • ${catFilter}`;
  }

  // Sub-filtro de UF
  if (ufFilter !== 'todos') {
    const ufItem = (periodData.vendas_por_uf || []).find(u => u.uf === ufFilter);
    if (ufItem) {
      filteredResult.faturamento = ufItem.faturamento;
      filteredResult.quantidade = ufItem.quantidade;
      filteredResult.pedidos = ufItem.pedidos;
      filteredResult.clientes = ufItem.clientes;
      filteredResult.ticket_medio = ufItem.ticket_medio;
      filteredResult.preco_medio = ufItem.quantidade > 0 ? ufItem.faturamento / ufItem.quantidade : 0;
    }
    periodLabel += ` • Estado ${ufFilter}`;
  }

  return { periodData: filteredResult, rawPeriodData: periodData, periodLabel };
}

// Calcular Curva ABC Dinamicamente a partir dos Produtos
function computeCurvaABCFromProducts(produtos) {
  if (!produtos || produtos.length === 0) {
    return {
      A: { itens: 0, faturamento: 0 },
      B: { itens: 0, faturamento: 0 },
      C: { itens: 0, faturamento: 0 }
    };
  }
  const sorted = [...produtos].sort((a, b) => (b.faturamento || 0) - (a.faturamento || 0));
  const totalFat = sorted.reduce((acc, p) => acc + (p.faturamento || 0), 0) || 1;
  let accum = 0;
  const aList = [], bList = [], cList = [];
  sorted.forEach(p => {
    accum += (p.faturamento || 0);
    const pctAccum = (accum / totalFat) * 100;
    if (pctAccum <= 80 || aList.length === 0) {
      aList.push(p);
      p.curva_abc = 'A';
    } else if (pctAccum <= 95) {
      bList.push(p);
      p.curva_abc = 'B';
    } else {
      cList.push(p);
      p.curva_abc = 'C';
    }
  });
  return {
    A: { itens: aList.length, faturamento: aList.reduce((acc, p) => acc + (p.faturamento || 0), 0) },
    B: { itens: bList.length, faturamento: bList.reduce((acc, p) => acc + (p.faturamento || 0), 0) },
    C: { itens: cList.length, faturamento: cList.reduce((acc, p) => acc + (p.faturamento || 0), 0) }
  };
}

// Aplicar Filtros Globais Dinâmicos
function applyGlobalFilters() {
  state.filters.ano = document.getElementById('filter-ano')?.value || 'todos';
  state.filters.mes = document.getElementById('filter-mes')?.value || 'todos';
  state.filters.categoria = document.getElementById('filter-categoria')?.value || 'todas';
  state.filters.uf = document.getElementById('filter-uf')?.value || 'todos';
  state.productsPage = 1;

  // Sincronizar filtro de mês do Topbar com os seletores de Holerite do RH
  if (state.filters.mes && state.filters.mes !== 'todos') {
    const mNum = parseInt(state.filters.mes, 10);
    if (!isNaN(mNum)) {
      const mStr = String(mNum).padStart(2, '0');
      // Na base de holerites temos Nov/2025 e Dez/2025, e Jan/2026 a Set/2026
      const targetAno = (mNum === 11 || mNum === 12) ? '2025' : '2026';
      state.rhSelectedPeriodo = `${targetAno}-${mStr}`;
    }
  } else {
    state.rhSelectedPeriodo = 'acumulado';
  }

  syncReportFiltersUI();
  updateAllViews();
}

// Atualização Dinâmica de Todas as Visões
function updateAllViews() {
  const data = window.DASHBOARD_DATA;
  if (!data) return;

  const currentEmpresaData = data.empresas[state.currentCompany];
  if (!currentEmpresaData) return;

  const { periodData, rawPeriodData, periodLabel } = getPeriodData(currentEmpresaData);

  renderKPIs(currentEmpresaData, periodData, periodLabel);
  renderChartsVisaoGeral(currentEmpresaData, periodData, periodLabel);
  renderBudgetModule();
  renderGastosModule();
  renderCurvaABC(currentEmpresaData, periodData);
  renderProdutosTable(currentEmpresaData, periodData);
  renderGeografia(currentEmpresaData, rawPeriodData, periodLabel);
  renderSplitAnalysis();
  renderColaboradores(currentEmpresaData.produtividade_rh || data.produtividade_rh);
  renderBacklog(data.backlog_fabril);
  renderTopClientes(currentEmpresaData, periodData);
  renderChurnAnalysis(currentEmpresaData);
  renderCustosModule();
  renderExecutiveReport();
}

// =========================================================================
// MOTOR DE BUDGET VS. REALIZADO, RUN RATE & CONTROLADORIA (fato_budget)
// =========================================================================

const COMP_KEY_TO_ENTIDADE = {
  consolidado: 'Consolidado',
  mb: 'Empresa 1',
  moderna: 'Empresa 2'
};

const PESOS_SAZONAIS_MES = {
  1: 0.072, 2: 0.076, 3: 0.088, 4: 0.084, 5: 0.085, 6: 0.080,
  7: 0.084, 8: 0.088, 9: 0.094, 10: 0.090, 11: 0.084, 12: 0.075
};

const DEFAULT_METAS = {
  consolidado: { anual: 8000000, mensal: 750000 },
  mb: { anual: 4800000, mensal: 450000 },
  moderna: { anual: 3200000, mensal: 300000 }
};

function getCustomMetaOverride(type) {
  const comp = state.currentCompany || 'consolidado';
  const saved = localStorage.getItem(`mb_meta_${type}_${comp}`);
  if (saved !== null) {
    const num = parseFloat(saved);
    return (!isNaN(num) && num > 0) ? num : null;
  }
  return null;
}

function getCompanyMeta(type) {
  const custom = getCustomMetaOverride(type);
  if (custom !== null) return custom;
  const comp = state.currentCompany || 'consolidado';
  return DEFAULT_METAS[comp]?.[type] || 0;
}

const BUDGET_CUSTOM_STORAGE_KEY = 'mb_fato_budget_custom_v1';

function getCustomBudgetStore() {
  try {
    const raw = localStorage.getItem(BUDGET_CUSTOM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveCustomBudgetStore(store) {
  try {
    localStorage.setItem(BUDGET_CUSTOM_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {}
}

function parseBrNumberInput(valStr) {
  if (typeof valStr === 'number') return valStr;
  const s = String(valStr || '').replace(/[^\d.,-]/g, '').trim();
  if (!s) return NaN;
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(s.replace(/\./g, ''));
}

/**
 * Retorna o registro original (padrão) da tabela `fato_budget` sem overrides de usuário.
 */
function getBaseFatoBudgetRecord(periodo, compKey = state.currentCompany) {
  const pStr = String(periodo);
  const data = window.DASHBOARD_DATA;
  const entidade = COMP_KEY_TO_ENTIDADE[compKey] || 'Consolidado';
  const fatoList = data?.fato_budget || [];
  let rec = fatoList.find(b => b.entidade === entidade && b.periodo === pStr);

  if (!rec) {
    const isMonthly = pStr.includes('-');
    const yearPart = isMonthly ? pStr.split('-')[0] : pStr;
    // Para 2027 (planejamento futuro), iniciar em 0 para o usuário começar a preencher do zero
    const isFuturePlanning = parseInt(yearPart, 10) >= 2027;
    const baseAnual = isFuturePlanning ? 0 : (DEFAULT_METAS[compKey]?.anual || 8000000);
    if (isMonthly) {
      const m = parseInt(pStr.split('-')[1], 10) || 1;
      const peso = PESOS_SAZONAIS_MES[m] || (1 / 12);
      rec = {
        periodo: pStr,
        entidade,
        budget_faturamento: Math.round(baseAnual * peso),
        budget_volume_pecas: Math.round((isFuturePlanning ? 0 : 1480000) * peso),
        budget_custo_folha: 92000,
        budget_ticket_medio: 2700
      };
    } else {
      rec = {
        periodo: pStr,
        entidade,
        budget_faturamento: baseAnual,
        budget_volume_pecas: isFuturePlanning ? 0 : 1480000,
        budget_custo_folha: 92000 * 12,
        budget_custo_folha_mensal: 92000,
        budget_ticket_medio: 2700
      };
    }
  } else {
    rec = { ...rec };
  }
  return rec;
}

/**
 * Busca um registro na tabela `fato_budget` considerando as edições personalizadas
 * feitas pelo usuário na aba Budget & Metas (mês a mês ou em lote).
 * Quando consultado um período anual (ex: '2026'), consolida a soma exata dos 12 meses.
 */
function getFatoBudgetRecord(periodo, compKey = state.currentCompany) {
  const pStr = String(periodo);
  const isMonthly = pStr.includes('-');
  const store = getCustomBudgetStore();
  const compStore = store[compKey] || {};

  if (isMonthly) {
    const rec = getBaseFatoBudgetRecord(pStr, compKey);
    const customMonth = compStore[pStr];
    if (customMonth) {
      if (typeof customMonth.fat === 'number' && !isNaN(customMonth.fat)) {
        rec.budget_faturamento = customMonth.fat;
        rec.isCustomFat = true;
      }
      if (typeof customMonth.pecas === 'number' && !isNaN(customMonth.pecas)) {
        rec.budget_volume_pecas = Math.round(customMonth.pecas);
        rec.isCustomPecas = true;
      }
    }
    return rec;
  }

  // Período Anual (ex: '2026'): soma os 12 meses para garantir 100% de consistência com a tabela
  const recAnual = getBaseFatoBudgetRecord(pStr, compKey);
  let sumFat = 0;
  let sumPecas = 0;
  let anyCustom = false;

  for (let m = 1; m <= 12; m++) {
    const ym = `${pStr}-${String(m).padStart(2, '0')}`;
    const mRec = getFatoBudgetRecord(ym, compKey);
    sumFat += (mRec.budget_faturamento || 0);
    sumPecas += (mRec.budget_volume_pecas || 0);
    if (mRec.isCustomFat || mRec.isCustomPecas) anyCustom = true;
  }

  recAnual.budget_faturamento = Math.round(sumFat * 100) / 100;
  recAnual.budget_volume_pecas = Math.round(sumPecas);
  recAnual.isCustom = anyCustom;

  const metaAno = compStore[`${pStr}_meta`];
  if (metaAno) {
    if (typeof metaAno.ticket === 'number' && !isNaN(metaAno.ticket) && metaAno.ticket > 0) {
      recAnual.budget_ticket_medio = metaAno.ticket;
    }
    if (typeof metaAno.folhaMes === 'number' && !isNaN(metaAno.folhaMes) && metaAno.folhaMes > 0) {
      recAnual.budget_custo_folha_mensal = metaAno.folhaMes;
      recAnual.budget_custo_folha = metaAno.folhaMes * 12;
    }
  }

  return recAnual;
}

/**
 * Calcula todas as Medidas Analíticas de Budget vs. Realizado, Run Rate (EOM/EOY),
 * Índice de Folha Orçado e Alerta de Sublimite Simples Nacional.
 */
function calculateBudgetAnalytics(empresaData, periodData) {
  const anoFilter = state.filters.ano;
  const mesFilter = state.filters.mes;
  const compKey = state.currentCompany || 'consolidado';

  // 1. Determinar o Budget do Período Selecionado
  let budgetFat = 0;
  let budgetPecas = 0;
  let budgetFolhaMes = 92000;
  let budgetTicket = 2700;
  let refPeriodoLabel = '';

  if (anoFilter !== 'todos' && mesFilter !== 'todos') {
    const ym = `${anoFilter}-${String(mesFilter).padStart(2, '0')}`;
    const rec = getFatoBudgetRecord(ym, compKey);
    budgetFat = rec.budget_faturamento;
    budgetPecas = rec.budget_volume_pecas;
    budgetFolhaMes = rec.budget_custo_folha;
    budgetTicket = rec.budget_ticket_medio;
    refPeriodoLabel = `${(MESES_MAP[mesFilter] || mesFilter).substring(0, 3)}/${anoFilter}`;
  } else if (anoFilter !== 'todos') {
    const rec = getFatoBudgetRecord(anoFilter, compKey);
    budgetFat = rec.budget_faturamento;
    budgetPecas = rec.budget_volume_pecas;
    budgetFolhaMes = rec.budget_custo_folha_mensal || (rec.budget_custo_folha / 12);
    budgetTicket = rec.budget_ticket_medio;
    refPeriodoLabel = `Ano ${anoFilter}`;
  } else if (mesFilter !== 'todos') {
    // Mês específico somado em todos os anos (2020-2026)
    const anos = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
    anos.forEach(a => {
      const ym = `${a}-${String(mesFilter).padStart(2, '0')}`;
      const r = getFatoBudgetRecord(ym, compKey);
      budgetFat += r.budget_faturamento;
      budgetPecas += r.budget_volume_pecas;
    });
    const r26 = getFatoBudgetRecord('2026', compKey);
    budgetFolhaMes = r26.budget_custo_folha_mensal || 92000;
    budgetTicket = r26.budget_ticket_medio || 2700;
    refPeriodoLabel = `${MESES_MAP[mesFilter]} (2020-2026)`;
  } else {
    // Quando 'todos' os anos estão selecionados no filtro global,
    // para o Sumário Executivo de Controladoria focamos no exercício corrente (2026 YTD) ou acumulado
    const r26 = getFatoBudgetRecord('2026', compKey);
    budgetFat = r26.budget_faturamento;
    budgetPecas = r26.budget_volume_pecas;
    budgetFolhaMes = r26.budget_custo_folha_mensal || 92000;
    budgetTicket = r26.budget_ticket_medio || 2700;
    refPeriodoLabel = 'Exercício 2026';
  }

  // Realizado de referência (se filtro for 'todos', comparar com 2026 para o painel de metas, e manter o total histórico no card principal)
  const isAllYears = (anoFilter === 'todos' && mesFilter === 'todos');
  const realizadoFat = isAllYears
    ? (empresaData.dados_anuais?.['2026']?.faturamento || periodData.faturamento || 0)
    : (periodData.faturamento || 0);
  const realizadoPecas = isAllYears
    ? (empresaData.dados_anuais?.['2026']?.quantidade || periodData.quantidade || 0)
    : (periodData.quantidade || 0);
  const realizadoTicket = isAllYears
    ? (empresaData.dados_anuais?.['2026']?.ticket_medio || periodData.ticket_medio || 0)
    : (periodData.ticket_medio || 0);

  // Variância Absoluta, % Atingimento e GAP Restante
  const varianciaFat = realizadoFat - budgetFat;
  const atingimentoFatPct = budgetFat > 0 ? (realizadoFat / budgetFat) * 100 : 0;
  const gapRestanteFat = Math.max(0, budgetFat - realizadoFat);

  const varianciaPecas = realizadoPecas - budgetPecas;
  const atingimentoPecasPct = budgetPecas > 0 ? (realizadoPecas / budgetPecas) * 100 : 0;
  const gapRestantePecas = Math.max(0, budgetPecas - realizadoPecas);

  const varianciaTicket = realizadoTicket - budgetTicket;
  const atingimentoTicketPct = budgetTicket > 0 ? (realizadoTicket / budgetTicket) * 100 : 0;

  // 2. Cálculo de Projeção / Run Rate (EOM e EOY)
  // Baseado em dias úteis comerciais (22 dias úteis/mês; 252 dias úteis/ano)
  const dadosMensais = empresaData.dados_mensais || {};
  const validMonths2026 = Object.keys(dadosMensais)
    .filter(k => k.startsWith('2026-') && (dadosMensais[k]?.faturamento || 0) > 0)
    .sort();

  const currentYM = validMonths2026[validMonths2026.length - 1] || '2026-10';
  const fatMesAtual = dadosMensais[currentYM]?.faturamento || 0;
  // Out/2026 parcial (aprox. 5 dias úteis faturados na planilha atual vs 22 dias úteis totais do mês)
  const closedMonths2026 = validMonths2026.slice(0, -1);
  const mediaMensalFechada = closedMonths2026.length > 0
    ? closedMonths2026.reduce((acc, k) => acc + (dadosMensais[k]?.faturamento || 0), 0) / closedMonths2026.length
    : 575000;

  // Estimar dias úteis decorridos no mês em aberto com base no ritmo diário médio
  const fatDiaUtilMedio = mediaMensalFechada / 22;
  const diasUteisDecorridosMes = fatDiaUtilMedio > 0
    ? Math.max(1, Math.min(21, Math.round(fatMesAtual / fatDiaUtilMedio)))
    : 10;
  const diasUteisRestantesMes = Math.max(0, 22 - diasUteisDecorridosMes);
  const projecaoEOM = fatMesAtual + (fatDiaUtilMedio * diasUteisRestantesMes);

  // Projeção EOY (Fechamento do Ano 2026): Acumulado fechado + EOM Outubro + 2 meses restantes (Nov/Dez) no ritmo atual
  const fatFechadoYTD = closedMonths2026.reduce((acc, k) => acc + (dadosMensais[k]?.faturamento || 0), 0);
  const mesesRestantesAno = Math.max(0, 12 - validMonths2026.length);
  const projecaoEOY = fatFechadoYTD + projecaoEOM + (mediaMensalFechada * mesesRestantesAno);

  // 3. Índice Folha vs. Faturamento Orçado (Meta: manter < 20%)
  const rhData = empresaData.produtividade_rh || window.DASHBOARD_DATA?.produtividade_rh || {};
  const folhaRealMensal = rhData.custo_folha_mensal || 90899.26;
  const budgetMesRef = (budgetFat / 12) || mediaMensalFechada || 666666;
  const indiceFolhaRealPct = mediaMensalFechada > 0 ? (folhaRealMensal / mediaMensalFechada) * 100 : 16.4;
  const indiceFolhaOrcadoPct = budgetMesRef > 0 ? (folhaRealMensal / budgetMesRef) * 100 : 13.6;
  const tetoFolhaIdeal20Pct = budgetMesRef * 0.20;

  // 4. Alerta de Sublimite Simples Nacional (Budget Fiscal R$ 3,6M ICMS / R$ 4,8M Teto Federal)
  const targetYearFiscal = anoFilter !== 'todos' ? anoFilter : '2026';
  const recMbAnual = getFatoBudgetRecord(targetYearFiscal, 'mb');
  const recModAnual = getFatoBudgetRecord(targetYearFiscal, 'moderna');
  const realMbAnual = window.DASHBOARD_DATA?.empresas?.mb?.dados_anuais?.[targetYearFiscal]?.faturamento || 3538180.48;
  const realModAnual = window.DASHBOARD_DATA?.empresas?.moderna?.dados_anuais?.[targetYearFiscal]?.faturamento || 1776656.18;

  const SUBLIMITE_ICMS = 3600000;
  const TETO_SIMPLES = 4800000;

  return {
    refPeriodoLabel,
    realizadoFat,
    budgetFat,
    varianciaFat,
    atingimentoFatPct,
    gapRestanteFat,
    realizadoPecas,
    budgetPecas,
    varianciaPecas,
    atingimentoPecasPct,
    gapRestantePecas,
    realizadoTicket,
    budgetTicket,
    varianciaTicket,
    atingimentoTicketPct,
    runRate: {
      currentYM,
      fatMesAtual,
      fatDiaUtilMedio,
      diasUteisRestantesMes,
      projecaoEOM,
      projecaoEOY,
      mediaMensalFechada
    },
    folha: {
      folhaRealMensal,
      budgetFolhaMes,
      indiceFolhaRealPct,
      indiceFolhaOrcadoPct,
      tetoFolhaIdeal20Pct,
      dentroMeta20Pct: indiceFolhaRealPct < 20 && indiceFolhaOrcadoPct < 20
    },
    fiscal: {
      ano: targetYearFiscal,
      sublimiteIcms: SUBLIMITE_ICMS,
      tetoSimples: TETO_SIMPLES,
      mbBudget: recMbAnual.budget_faturamento,
      modBudget: recModAnual.budget_faturamento,
      mbReal: realMbAnual,
      modReal: realModAnual,
      mbUltrapassaSublimiteBudget: recMbAnual.budget_faturamento > SUBLIMITE_ICMS,
      modUltrapassaSublimiteBudget: recModAnual.budget_faturamento > SUBLIMITE_ICMS,
      mbFaltaParaSublimite: Math.max(0, SUBLIMITE_ICMS - realMbAnual)
    }
  };
}

// Renderizar KPIs Executivos Dinâmicos (Visão Geral Limpa)
function renderKPIs(empresaData, periodData, periodLabel) {
  const faturamento = periodData.faturamento || 0;
  const quantidade = periodData.quantidade || 0;
  const pedidos = periodData.pedidos || 0;
  const clientes = periodData.clientes || 0;
  const ticket = periodData.ticket_medio || 0;
  const precoMedio = periodData.preco_medio || 0;

  document.getElementById('kpi-faturamento').innerText = formatBRL(faturamento);
  document.getElementById('kpi-quantidade').innerText = formatNumber(quantidade);
  document.getElementById('kpi-ticket').innerText = formatBRL(ticket);
  document.getElementById('kpi-preco-medio').innerText = formatBRL(precoMedio);
  document.getElementById('kpi-clientes').innerText = formatNumber(clientes);

  // Subtítulos dos KPIs com o período atual
  const subFat = document.getElementById('kpi-faturamento-sub');
  if (subFat) subFat.innerHTML = `<span class="kpi-trend-up">▲ ${periodLabel}</span>`;

  const subQtd = document.getElementById('kpi-quantidade-sub');
  if (subQtd) subQtd.innerHTML = `<span class="kpi-trend-up">▲ ${formatNumber(quantidade)} peças</span> &bull; Volume no período`;

  const subTick = document.getElementById('kpi-ticket-sub');
  if (subTick) subTick.innerHTML = `<span class="kpi-trend-neutral">${formatNumber(pedidos)} pedidos</span> faturados`;

  const subCli = document.getElementById('kpi-clientes-sub');
  if (subCli) subCli.innerHTML = `${formatNumber(clientes)} compradores ativos`;

  // Banner executivo
  const banner = document.getElementById('banner-text');
  if (banner) {
    if (state.currentCompany === 'consolidado') {
      banner.innerHTML = `No período selecionado (<strong>${periodLabel}</strong>), o grupo industrial consolidou <strong>${formatBRL(faturamento)}</strong> em faturamento e <strong>${formatNumber(quantidade)} peças</strong> fabricadas em <strong>${formatNumber(pedidos)} pedidos</strong>.`;
    } else if (state.currentCompany === 'mb') {
      banner.innerHTML = `No período (<strong>${periodLabel}</strong>), a Empresa 1 consolidou <strong>${formatBRL(faturamento)}</strong> e <strong>${formatNumber(quantidade)} peças</strong> em <strong>${formatNumber(pedidos)} pedidos</strong>.`;
    } else {
      banner.innerHTML = `No período (<strong>${periodLabel}</strong>), a Empresa 2 consolidou <strong>${formatBRL(faturamento)}</strong> e <strong>${formatNumber(quantidade)} peças</strong> em <strong>${formatNumber(pedidos)} pedidos</strong>.`;
    }
  }

  // Destaques do Banner Executivo
  const statUf = document.getElementById('stat-uf-lider');
  if (statUf && periodData.vendas_por_uf && periodData.vendas_por_uf.length > 0) {
    const topU = periodData.vendas_por_uf[0];
    statUf.innerText = `${topU.uf} (${topU.pct}%)`;
  }
}

// Destruir ou Criar Gráficos Chart.js com Adaptação Automática de Tema
function getOrCreateChart(canvasId, config) {
  if (state.charts[canvasId]) {
    state.charts[canvasId].destroy();
  }
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  if (config && config.options) {
    // 1. Adaptação dos Eixos (Scales)
    if (config.options.scales) {
      for (const axisKey of Object.keys(config.options.scales)) {
        const axis = config.options.scales[axisKey];
        if (!axis) continue;
        if (axis.grid) {
          if (axis.grid.color && typeof axis.grid.color === 'string') {
            axis.grid.color = isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.05)';
          }
        }
        if (axis.ticks) {
          const highlightTickColors = ['#e5e7eb', '#f3f4f6', '#f8fafc', '#cbd5e1', '#d1d5db', '#1e293b', '#0f172a'];
          const stdTickColors = ['#9ca3af', '#475569', '#334155', '#64748b'];
          if (highlightTickColors.includes(axis.ticks.color)) {
            axis.ticks.color = isLight ? '#1e293b' : '#f3f4f6';
            axis.ticks.font = Object.assign({ size: 11 }, axis.ticks.font || {}, { weight: '600' });
          } else if (!axis.ticks.color || stdTickColors.includes(axis.ticks.color)) {
            axis.ticks.color = isLight ? '#334155' : '#cbd5e1';
          }
        }
      }
    }

    // 2. Legendas (Legend)
    if (config.options.plugins && config.options.plugins.legend) {
      const leg = config.options.plugins.legend;
      if (leg.labels) {
        if (!leg.labels.color || leg.labels.color === '#e5e7eb' || leg.labels.color === '#ffffff' || leg.labels.color === '#1e293b' || leg.labels.color === '#334155') {
          leg.labels.color = isLight ? '#1e293b' : '#e5e7eb';
        }
      }
    }

    // 3. Tooltips com alto contraste e elegância
    config.options.plugins = config.options.plugins || {};
    config.options.plugins.tooltip = config.options.plugins.tooltip || {};
    if (isLight) {
      config.options.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.94)';
      config.options.plugins.tooltip.titleColor = '#ffffff';
      config.options.plugins.tooltip.bodyColor = '#f1f5f9';
      config.options.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.15)';
      config.options.plugins.tooltip.borderWidth = 1;
    } else {
      config.options.plugins.tooltip.backgroundColor = 'rgba(17, 24, 39, 0.94)';
      config.options.plugins.tooltip.titleColor = '#ffffff';
      config.options.plugins.tooltip.bodyColor = '#e5e7eb';
      config.options.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
      config.options.plugins.tooltip.borderWidth = 1;
    }
  }

  // 4. Bordas em gráficos circulares (Doughnut / Pie)
  if (config && (config.type === 'doughnut' || config.type === 'pie')) {
    if (config.data && config.data.datasets) {
      config.data.datasets.forEach(ds => {
        ds.borderColor = isLight ? '#ffffff' : '#162032';
      });
    }
  }

  state.charts[canvasId] = new Chart(ctx, config);
  return state.charts[canvasId];
}

// Gráficos da Aba Visão Geral Dinâmicos (Integrados à Tabela fato_budget)
function formatMetaInputVal(val) {
  if (!val || val <= 0) return '';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(val));
}

function syncMetaInputsUI() {
  const inputAnual = document.getElementById('input-meta-anual');
  const inputMensal = document.getElementById('input-meta-mensal');
  if (inputAnual && document.activeElement !== inputAnual) {
    const recAnual = getFatoBudgetRecord('2026', state.currentCompany);
    inputAnual.value = formatMetaInputVal(recAnual.budget_faturamento);
  }
  if (inputMensal && document.activeElement !== inputMensal) {
    const customM = getCustomMetaOverride('mensal');
    const baseM = customM || DEFAULT_METAS[state.currentCompany]?.mensal || 750000;
    inputMensal.value = formatMetaInputVal(baseM);
  }
}

function onMetaInput(type, rawValue) {
  const digits = String(rawValue || '').replace(/\D/g, '');
  const num = digits ? parseInt(digits, 10) : 0;
  const comp = state.currentCompany || 'consolidado';
  if (num > 0) {
    localStorage.setItem(`mb_meta_${type}_${comp}`, String(num));
  } else {
    localStorage.removeItem(`mb_meta_${type}_${comp}`);
  }

  const inputEl = document.getElementById(`input-meta-${type}`);
  if (inputEl) {
    inputEl.value = num > 0 ? formatMetaInputVal(num) : '';
  }

  const data = window.DASHBOARD_DATA;
  if (data && data.empresas[comp]) {
    const { periodData, periodLabel } = getPeriodData(data.empresas[comp]);
    renderKPIs(data.empresas[comp], periodData, periodLabel);
    renderChartsVisaoGeral(data.empresas[comp], periodData, periodLabel);
    renderSplitAnalysis();
  }
}
window.onMetaInput = onMetaInput;

function updatePrevMonthComparisonBadge(empresaData) {
  const badgeEl = document.getElementById('badge-superar-mes-ant');
  if (!badgeEl) return;

  const anoFilter = state.filters.ano;
  const mesFilter = state.filters.mes;
  const dadosMensais = empresaData.dados_mensais || {};

  // Lista ordenada de meses com faturamento > 0
  const validKeys = Object.keys(dadosMensais)
    .filter(k => (dadosMensais[k]?.faturamento || 0) > 0)
    .sort();

  if (validKeys.length < 2) {
    badgeEl.innerHTML = '';
    return;
  }

  let currKey = null;
  let prevKey = null;

  if (anoFilter !== 'todos' && mesFilter !== 'todos') {
    const mNum = parseInt(mesFilter, 10);
    const yNum = parseInt(anoFilter, 10);
    currKey = `${yNum}-${String(mNum).padStart(2, '0')}`;
    if (mNum > 1) {
      prevKey = `${yNum}-${String(mNum - 1).padStart(2, '0')}`;
    } else {
      prevKey = `${yNum - 1}-12`;
    }
  } else if (anoFilter !== 'todos') {
    const yearKeys = validKeys.filter(k => k.startsWith(`${anoFilter}-`));
    if (yearKeys.length > 0) {
      currKey = yearKeys[yearKeys.length - 1];
      const idx = validKeys.indexOf(currKey);
      if (idx > 0) prevKey = validKeys[idx - 1];
    }
  } else {
    currKey = validKeys[validKeys.length - 1];
    prevKey = validKeys[validKeys.length - 2];
  }

  if (!currKey || !prevKey) {
    badgeEl.innerHTML = '';
    return;
  }

  const currVal = dadosMensais[currKey]?.faturamento || 0;
  const prevVal = dadosMensais[prevKey]?.faturamento || 0;

  if (prevVal <= 0) {
    badgeEl.innerHTML = '';
    return;
  }

  const formatShortYM = (ym) => {
    const [y, m] = ym.split('-');
    const mName = MESES_MAP[String(parseInt(m, 10))] || m;
    return `${mName.substring(0, 3)}/${y.slice(-2)}`;
  };

  const currLbl = formatShortYM(currKey);
  const prevLbl = formatShortYM(prevKey);
  const diff = prevVal - currVal;

  if (diff > 0) {
    badgeEl.className = 'prev-month-badge pending';
    badgeEl.innerHTML = `<span class="dot-indicator"></span><span>Faltam <strong>${formatBRL(diff)}</strong> em ${currLbl} p/ superar ${prevLbl} (${formatBRL(prevVal)})</span>`;
  } else {
    const superou = Math.abs(diff);
    const pct = ((superou / prevVal) * 100).toFixed(1);
    badgeEl.className = 'prev-month-badge surpassed';
    badgeEl.innerHTML = `<span class="dot-indicator"></span><span>${currLbl} superou ${prevLbl} em <strong>+${formatBRL(superou)}</strong> (+${pct}%)</span>`;
  }
}

function updateAnnualGoalBadge(empresaData) {
  const badgeEl = document.getElementById('badge-meta-anual-status');
  if (!badgeEl) return;

  const anoFilter = state.filters.ano;
  const mesFilter = state.filters.mes;
  const metaAnual = getCompanyMeta('anual');
  const metaMensal = getCompanyMeta('mensal');

  const targetYear = anoFilter !== 'todos' ? anoFilter : '2026';

  if (mesFilter !== 'todos') {
    const mesPad = String(mesFilter).padStart(2, '0');
    const key = `${targetYear}-${mesPad}`;
    const currVal = empresaData.dados_mensais?.[key]?.faturamento || 0;
    const mName = (MESES_MAP[String(mesFilter)] || mesFilter).substring(0, 3);
    const lbl = `${mName}/${targetYear}`;

    if (!metaMensal || metaMensal <= 0) {
      badgeEl.innerHTML = '';
      return;
    }

    const diff = metaMensal - currVal;
    const pct = ((currVal / metaMensal) * 100).toFixed(1);
    if (diff > 0) {
      badgeEl.className = 'prev-month-badge pending';
      badgeEl.innerHTML = `<span class="dot-indicator"></span><span>Faltam <strong>${formatBRL(diff)}</strong> em ${lbl} p/ bater a meta (${pct}% atingido)</span>`;
    } else {
      const superou = Math.abs(diff);
      badgeEl.className = 'prev-month-badge surpassed';
      badgeEl.innerHTML = `<span class="dot-indicator"></span><span>Meta de ${lbl} atingida! <strong>+${formatBRL(superou)}</strong> (${pct}%)</span>`;
    }
    return;
  }

  if (!metaAnual || metaAnual <= 0) {
    badgeEl.innerHTML = '';
    return;
  }

  const currVal = empresaData.dados_anuais?.[targetYear]?.faturamento || 0;
  const diff = metaAnual - currVal;
  const pct = ((currVal / metaAnual) * 100).toFixed(1);

  if (diff > 0) {
    badgeEl.className = 'prev-month-badge pending';
    badgeEl.innerHTML = `<span class="dot-indicator"></span><span>Faltam <strong>${formatBRL(diff)}</strong> em ${targetYear} p/ bater a meta (${pct}% atingido)</span>`;
  } else {
    const superou = Math.abs(diff);
    badgeEl.className = 'prev-month-badge surpassed';
    badgeEl.innerHTML = `<span class="dot-indicator"></span><span>Meta de ${targetYear} atingida! <strong>+${formatBRL(superou)}</strong> (${pct}%)</span>`;
  }
}

function renderChartsVisaoGeral(empresaData, periodData, periodLabel) {
  syncMetaInputsUI();
  updateAnnualGoalBadge(empresaData);
  updatePrevMonthComparisonBadge(empresaData);

  const mesFilter = state.filters.mes;
  const anoFilter = state.filters.ano;
  const metaAnual = getCompanyMeta('anual');
  const metaMensal = getCompanyMeta('mensal');

  // 1. Gráfico Anual na Visão Geral (Original Limpo com Linha de Meta)
  const anosLabels = ['2020', '2021', '2022', '2023', '2024', '2025', '2026'];
  let anosValores = [];
  let barLabel = 'Faturamento Anual (R$)';

  if (mesFilter !== 'todos') {
    const mesPad = String(mesFilter).padStart(2, '0');
    barLabel = `Faturamento de ${MESES_MAP[mesFilter] || mesFilter} (R$)`;
    anosValores = anosLabels.map(a => {
      const key = `${a}-${mesPad}`;
      return empresaData.dados_mensais?.[key]?.faturamento || 0;
    });
  } else {
    anosValores = anosLabels.map(a => empresaData.dados_anuais?.[a]?.faturamento || 0);
  }

  const activeMetaAnual = mesFilter !== 'todos' ? metaMensal : metaAnual;
  const maxAnual = Math.max(...anosValores, activeMetaAnual || 0, 0);

  const anualDatasets = [{
    type: 'bar',
    label: barLabel,
    data: anosValores,
    backgroundColor: anosLabels.map(a => a === anoFilter ? '#38bdf8' : 'rgba(6, 182, 212, 0.75)'),
    borderColor: '#06b6d4',
    borderWidth: 1.5,
    borderRadius: 6,
    order: 2
  }];

  if (activeMetaAnual > 0) {
    anualDatasets.push({
      type: 'line',
      label: mesFilter !== 'todos' ? 'Meta do Mês (R$)' : 'Meta Anual (R$)',
      data: anosLabels.map(() => activeMetaAnual),
      borderColor: '#f59e0b',
      borderWidth: 2,
      borderDash: [6, 5],
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: '#f59e0b',
      fill: false,
      order: 1
    });
  }

  getOrCreateChart('chart-anual', {
    type: 'bar',
    data: {
      labels: anosLabels,
      datasets: anualDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatBRL(ctx.raw)}`
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => maxAnual >= 1000000 ? 'R$ ' + (v / 1000000).toFixed(1) + 'M' : 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });

  // 2. Gráfico Mensal na Visão Geral (Original Limpo com Linha de Meta)
  let mensalLabels = [];
  let mensalValores = [];
  let barColors = [];
  let borderColors = [];

  if (anoFilter !== 'todos') {
    for (let m = 1; m <= 12; m++) {
      const mesStr = String(m);
      const mesPad = String(m).padStart(2, '0');
      const key = `${anoFilter}-${mesPad}`;
      mensalLabels.push(`${MESES_MAP[mesStr].substring(0, 3)}/${anoFilter}`);
      const val = empresaData.dados_mensais?.[key]?.faturamento || 0;
      mensalValores.push(val);

      const isSelected = (mesFilter === mesStr);
      if (isSelected) {
        barColors.push('#38bdf8');
        borderColors.push('#67e8f9');
      } else if (mesFilter !== 'todos') {
        barColors.push('rgba(56, 189, 248, 0.35)');
        borderColors.push('rgba(56, 189, 248, 0.5)');
      } else {
        barColors.push('rgba(14, 165, 233, 0.75)');
        borderColors.push('#0284c7');
      }
    }
  } else {
    const mensalSlice = (empresaData.evolucao_mensal || []).slice(-24);
    mensalLabels = mensalSlice.map(m => m.ano_mes);
    mensalValores = mensalSlice.map(m => m.faturamento);
    mensalLabels.forEach(l => {
      const mNum = parseInt(l.split('-')[1], 10);
      const isSelected = (mesFilter !== 'todos' && mNum === parseInt(mesFilter, 10));
      if (isSelected) {
        barColors.push('#38bdf8');
        borderColors.push('#67e8f9');
      } else if (mesFilter !== 'todos') {
        barColors.push('rgba(56, 189, 248, 0.35)');
        borderColors.push('rgba(56, 189, 248, 0.5)');
      } else {
        barColors.push('rgba(14, 165, 233, 0.75)');
        borderColors.push('#0284c7');
      }
    });
  }

  const maxMensal = Math.max(...mensalValores, metaMensal || 0, 0);

  const mensalDatasets = [{
    type: 'bar',
    label: 'Faturamento Mensal (R$)',
    data: mensalValores,
    backgroundColor: barColors,
    borderColor: borderColors,
    borderWidth: 1.5,
    borderRadius: 6,
    order: 2
  }];

  if (metaMensal > 0) {
    mensalDatasets.push({
      type: 'line',
      label: 'Meta Mensal (R$)',
      data: mensalLabels.map(() => metaMensal),
      borderColor: '#f59e0b',
      borderWidth: 2,
      borderDash: [6, 5],
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: '#f59e0b',
      fill: false,
      order: 1
    });
  }

  getOrCreateChart('chart-mensal', {
    type: 'bar',
    data: {
      labels: mensalLabels,
      datasets: mensalDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatBRL(ctx.raw)}`
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => maxMensal >= 1000000 ? 'R$ ' + (v / 1000000).toFixed(1) + 'M' : 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 45 }
        }
      }
    }
  });

  // 3. Gráfico de Sazonalidade com destaque no mês selecionado
  const sazonLabels = (empresaData.sazonalidade || []).map(s => s.mes_nome);
  const sazonValores = (empresaData.sazonalidade || []).map(s => s.faturamento_medio);
  const sazonPointSizes = sazonLabels.map((s, idx) => {
    return (mesFilter !== 'todos' && (idx + 1) === parseInt(mesFilter, 10)) ? 8 : 4;
  });

  getOrCreateChart('chart-sazonalidade', {
    type: 'line',
    data: {
      labels: sazonLabels,
      datasets: [{
        label: 'Média Histórica (R$)',
        data: sazonValores,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: sazonPointSizes,
        pointBackgroundColor: '#34d399'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => 'Média: ' + formatBRL(ctx.raw)
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });

  // 4. Gráfico de Famílias / Categorias Dinâmico
  const catList = (periodData && periodData.categorias && periodData.categorias.length > 0)
    ? periodData.categorias
    : (empresaData.categorias || []);
  const catSlice = catList.slice(0, 7);
  const catLabels = catSlice.map(c => c.categoria);
  const catValores = catSlice.map(c => c.faturamento);

  getOrCreateChart('chart-categorias', {
    type: 'doughnut',
    data: {
      labels: catLabels,
      datasets: [{
        data: catValores,
        backgroundColor: [
          '#06b6d4',
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#8b5cf6',
          '#ec4899',
          '#64748b'
        ],
        borderWidth: 2,
        borderColor: '#162032'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#e5e7eb', boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatBRL(ctx.raw)} (${catSlice[ctx.dataIndex]?.pct || 0}%)`
          }
        }
      }
    }
  });
}

// =========================================================================
// MÓDULO EXCLUSIVO: BUDGET & METAS PLANEJADAS (ABA #tab-budget)
// =========================================================================
function renderBudgetModule() {
  const data = window.DASHBOARD_DATA;
  if (!data) return;

  const compKey = state.currentCompany || 'consolidado';
  const empresaData = data.empresas[compKey];
  if (!empresaData) return;

  const anoSelect = document.getElementById('budget-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2026';

  const periodDataAno = empresaData.dados_anuais?.[selectedAno] || {
    faturamento: 0,
    quantidade: 0,
    pedidos: 0,
    ticket_medio: 0
  };

  // Calcular analíticos de Budget para o ano selecionado na aba Budget
  const recAnual = getFatoBudgetRecord(selectedAno, compKey);
  const budgetFat = recAnual.budget_faturamento || 0;
  const budgetPecas = recAnual.budget_volume_pecas || 0;
  const budgetTicket = recAnual.budget_ticket_medio || 2700;
  const budgetFolhaMes = recAnual.budget_custo_folha_mensal || (recAnual.budget_custo_folha / 12) || 92000;

  const realizadoFat = periodDataAno.faturamento || 0;
  const realizadoPecas = periodDataAno.quantidade || 0;
  const realizadoTicket = periodDataAno.ticket_medio || 0;

  const varianciaFat = realizadoFat - budgetFat;
  const atingimentoFatPct = budgetFat > 0 ? (realizadoFat / budgetFat) * 100 : 0;
  const gapRestanteFat = Math.max(0, budgetFat - realizadoFat);

  const varianciaPecas = realizadoPecas - budgetPecas;
  const atingimentoPecasPct = budgetPecas > 0 ? (realizadoPecas / budgetPecas) * 100 : 0;
  const gapRestantePecas = Math.max(0, budgetPecas - realizadoPecas);

  const varianciaTicket = realizadoTicket - budgetTicket;
  const atingimentoTicketPct = budgetTicket > 0 ? (realizadoTicket / budgetTicket) * 100 : 0;

  // Run Rate (EOM / EOY)
  const bMetricsGlobal = calculateBudgetAnalytics(empresaData, periodDataAno);
  const rr = bMetricsGlobal.runRate;
  const fl = bMetricsGlobal.folha;
  const fs = bMetricsGlobal.fiscal;

  // 1. Renderizar os 5 KPI Cards Exclusivos da Aba Budget
  const kpiGrid = document.getElementById('budget-kpi-grid');
  if (kpiGrid) {
    const pctFatStr = atingimentoFatPct.toFixed(1);
    const pillFatClass = atingimentoFatPct >= 100 ? 'ok' : (atingimentoFatPct >= 65 ? 'warn' : 'danger');
    const barFatColor = atingimentoFatPct >= 100 ? '#10b981' : '#f59e0b';
    const desvioSinal = varianciaFat >= 0 ? '+' : '';

    const pctPecasStr = atingimentoPecasPct.toFixed(1);
    const pillPecasClass = atingimentoPecasPct >= 100 ? 'ok' : (atingimentoPecasPct >= 65 ? 'warn' : 'danger');
    const desvioPecasSinal = varianciaPecas >= 0 ? '+' : '';

    const pctTickStr = atingimentoTicketPct.toFixed(1);
    const pillTickClass = atingimentoTicketPct >= 100 ? 'ok' : 'warn';
    const desvioTickSinal = varianciaTicket >= 0 ? '+' : '';

    kpiGrid.innerHTML = `
      <div class="kpi-card cyan">
        <div class="kpi-header">
          <span class="kpi-title">Faturamento Realizado (${selectedAno})</span>
        </div>
        <div class="kpi-value">${formatBRL(realizadoFat)}</div>
        <div class="kpi-budget-badge">
          <div class="kpi-budget-row">
            <span>Meta: <strong>${formatBRL(budgetFat)}</strong></span>
            <span class="kpi-budget-pill ${pillFatClass}">${pctFatStr}%</span>
          </div>
          <div class="kpi-budget-row" style="font-size: 0.68rem;">
            <span>Desvio: <strong style="color: ${varianciaFat >= 0 ? '#34d399' : '#fbbf24'};">${desvioSinal}${formatBRL(varianciaFat)}</strong></span>
          </div>
          <div class="kpi-mini-progress">
            <div class="kpi-mini-progress-bar" style="width: ${Math.min(100, atingimentoFatPct)}%; background: ${barFatColor};"></div>
          </div>
        </div>
      </div>

      <div class="kpi-card amber">
        <div class="kpi-header">
          <span class="kpi-title">GAP Restante p/ Meta (${selectedAno})</span>
        </div>
        <div class="kpi-value">${gapRestanteFat > 0 ? formatBRL(gapRestanteFat) : 'Meta Superada!'}</div>
        <div class="kpi-budget-badge">
          <div class="kpi-budget-row">
            <span>Budget Anual: <strong>${formatBRL(budgetFat)}</strong></span>
          </div>
          <div class="kpi-budget-row" style="font-size: 0.68rem;">
            <span>${gapRestanteFat > 0 ? `Faltam ${(100 - atingimentoFatPct).toFixed(1)}% para fechar o budget` : `Superávit de +${formatBRL(Math.abs(varianciaFat))}`}</span>
          </div>
        </div>
      </div>

      <div class="kpi-card emerald">
        <div class="kpi-header">
          <span class="kpi-title">Meta Mensal Necessária (${selectedAno})</span>
        </div>
        <div class="kpi-value">${budgetFat <= 0 ? 'Preencha o Budget' : (gapRestanteFat > 0 ? `${formatBRL(gapRestanteFat / (parseInt(selectedAno, 10) >= 2027 ? 12 : 3))}/mês` : 'Meta Batida!')}</div>
        <div class="kpi-budget-badge">
          <div class="kpi-budget-row">
            <span>${parseInt(selectedAno, 10) >= 2027 ? 'Média mensal planejada (/12)' : 'Média necessária no trimestre final (Out–Dez)'}</span>
            <span class="kpi-budget-pill ${gapRestanteFat <= 0 && budgetFat > 0 ? 'ok' : 'warn'}">${parseInt(selectedAno, 10) >= 2027 ? 'Média /12' : (gapRestanteFat <= 0 ? 'Concluído' : 'Ritmo Alvo')}</span>
          </div>
        </div>
      </div>
    `;
  }

  // 3. Gráfico 1 da Aba Budget: Comparativo Anual (2026 Atual e 2027 Planejamento)
  const anosLabels = ['2026', '2027'];
  const anosValores = anosLabels.map(a => empresaData.dados_anuais?.[a]?.faturamento || 0);
  const anosBudgets = anosLabels.map(a => getFatoBudgetRecord(a, compKey).budget_faturamento || 0);

  const anualBarBgColors = anosValores.map((realVal, idx) => {
    const budVal = anosBudgets[idx] || 0;
    if (budVal > 0 && realVal >= budVal) return 'rgba(16, 185, 129, 0.82)'; // Verde
    const pct = budVal > 0 ? (realVal / budVal) : 1;
    return pct >= 0.70 ? 'rgba(245, 158, 11, 0.80)' : 'rgba(244, 63, 94, 0.78)'; // Âmbar ou Vermelho
  });

  const anualBarBorderColors = anosValores.map((realVal, idx) => {
    const budVal = anosBudgets[idx] || 0;
    if (budVal > 0 && realVal >= budVal) return '#10b981';
    const pct = budVal > 0 ? (realVal / budVal) : 1;
    return pct >= 0.70 ? '#f59e0b' : '#f43f5e';
  });

  const maxAnualB = Math.max(...anosValores, ...anosBudgets, 0);

  getOrCreateChart('chart-budget-anual', {
    type: 'bar',
    data: {
      labels: anosLabels,
      datasets: [
        {
          type: 'bar',
          label: 'Realizado Anual (R$)',
          data: anosValores,
          backgroundColor: anualBarBgColors,
          borderColor: anualBarBorderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2
        },
        {
          type: 'line',
          label: 'Budget Planejado (R$)',
          data: anosBudgets,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          borderWidth: 2.5,
          borderDash: [6, 4],
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: '#0f172a',
          pointBorderWidth: 1.5,
          tension: 0.25,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatBRL(ctx.raw)}`,
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return [];
              const real = anosValores[idx] || 0;
              const bud = anosBudgets[idx] || 0;
              if (bud <= 0) return [];
              const variancia = real - bud;
              const pct = ((real / bud) * 100).toFixed(1);
              const sinal = variancia >= 0 ? '+' : '';
              return [
                `────────────────────────`,
                `Variância (R$): ${sinal}${formatBRL(variancia)}`,
                `% Atingido: ${pct}% (${variancia >= 0 ? 'Acima do Budget' : 'Abaixo do Budget'})`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => maxAnualB >= 1000000 ? 'R$ ' + (v / 1000000).toFixed(1) + 'M' : 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });

  // 4. Gráfico 2 da Aba Budget: Mensal Sazonalizado do Ano Selecionado + Tabela Analítica Mês a Mês Editável
  const titleChartMensal = document.getElementById('title-chart-budget-mensal');
  if (titleChartMensal) {
    titleChartMensal.innerText = `Curva Mensal: Realizado vs. Budget Planejado (${selectedAno})`;
  }

  // Atualizar inputs da barra de edição rápida com os valores atuais
  const quickAnualInput = document.getElementById('input-quick-budget-anual');
  if (quickAnualInput && document.activeElement !== quickAnualInput) {
    quickAnualInput.value = Math.round(budgetFat).toLocaleString('pt-BR');
  }
  const quickTicketInput = document.getElementById('input-quick-budget-ticket');
  if (quickTicketInput && document.activeElement !== quickTicketInput) {
    quickTicketInput.value = Math.round(budgetTicket).toLocaleString('pt-BR');
  }

  let mLabels = [];
  let mValores = [];
  let mBudgets = [];
  let tableRowsHtml = '';

  let totalBudFat = 0;
  let totalRealFat = 0;
  let totalBudPecas = 0;
  let totalRealPecas = 0;

  for (let m = 1; m <= 12; m++) {
    const mesStr = String(m);
    const mesPad = String(m).padStart(2, '0');
    const key = `${selectedAno}-${mesPad}`;
    const mShort = `${MESES_MAP[mesStr].substring(0, 3)}/${selectedAno}`;
    mLabels.push(mShort);

    const realMes = empresaData.dados_mensais?.[key]?.faturamento || 0;
    const realPecasMes = empresaData.dados_mensais?.[key]?.quantidade || 0;
    const budRecMes = getFatoBudgetRecord(key, compKey);
    const budMes = budRecMes.budget_faturamento || 0;
    const budPecasMes = budRecMes.budget_volume_pecas || 0;
    const isModifiedRow = Boolean(budRecMes.isCustomFat || budRecMes.isCustomPecas);

    mValores.push(realMes);
    mBudgets.push(budMes);

    totalBudFat += budMes;
    totalRealFat += realMes;
    totalBudPecas += budPecasMes;
    totalRealPecas += realPecasMes;

    const varMes = realMes - budMes;
    const pctMes = budMes > 0 ? (realMes / budMes) * 100 : 0;
    const gapMes = Math.max(0, budMes - realMes);
    const pctPecasMes = budPecasMes > 0 ? (realPecasMes / budPecasMes) * 100 : 0;

    let statusBadge = '';
    if (realMes <= 0) {
      statusBadge = `<span class="tag-rec tag-secondary">A Realizar</span>`;
    } else if (realMes >= budMes) {
      statusBadge = `<span class="tag-rec tag-success">Meta Atingida</span>`;
    } else if (pctMes >= 75) {
      statusBadge = `<span class="tag-rec tag-warning">Em Atenção</span>`;
    } else {
      statusBadge = `<span class="tag-rec tag-danger">Abaixo do Budget</span>`;
    }

    const budFatFormatted = budMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    tableRowsHtml += `
      <tr class="${isModifiedRow ? 'cost-row-modified' : ''}">
        <td style="font-weight: 700; color: var(--text-main);">${MESES_MAP[mesStr]} / ${selectedAno}</td>
        <td>
          <div class="cost-input-wrapper">
            <span class="cost-input-symbol">R$</span>
            <input type="text"
              class="budget-edit-input"
              value="${budFatFormatted}"
              title="Clique para editar o Budget de Receita de ${MESES_MAP[mesStr]}/${selectedAno}"
              onchange="onEditMonthlyBudgetCell('${key}', 'fat', this.value)"
              onkeydown="if(event.key==='Enter'){this.blur();}">
          </div>
        </td>
        <td style="font-weight: 700; color: #38bdf8;">${realMes > 0 ? formatBRL(realMes) : '—'}</td>
        <td style="font-weight: 600; color: ${realMes <= 0 ? 'var(--text-dim)' : (varMes >= 0 ? '#34d399' : '#fb7185')};">
          ${realMes > 0 ? `${varMes >= 0 ? '+' : ''}${formatBRL(varMes)}` : '—'}
        </td>
        <td>
          <span class="kpi-budget-pill ${realMes <= 0 ? 'warn' : (pctMes >= 100 ? 'ok' : (pctMes >= 75 ? 'warn' : 'danger'))}">
            ${realMes > 0 ? `${pctMes.toFixed(1)}%` : '0.0%'}
          </span>
        </td>
        <td style="color: ${gapMes > 0 ? '#fbbf24' : '#34d399'}; font-weight: 600;">
          ${gapMes > 0 ? formatBRL(gapMes) : 'R$ 0,00'}
        </td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }

  const tbodyBudget = document.getElementById('tbody-fato-budget');
  if (tbodyBudget) {
    tbodyBudget.innerHTML = tableRowsHtml;
  }

  const tfootBudget = document.getElementById('tfoot-fato-budget');
  if (tfootBudget) {
    const totalVarFat = totalRealFat - totalBudFat;
    const totalPctFat = totalBudFat > 0 ? (totalRealFat / totalBudFat) * 100 : 0;
    const totalGapFat = Math.max(0, totalBudFat - totalRealFat);
    const totalStatusBadge = totalRealFat >= totalBudFat && totalBudFat > 0
      ? `<span class="tag-rec tag-success">Meta Anual Batida</span>`
      : `<span class="tag-rec tag-warning">Acumulado YTD (${totalPctFat.toFixed(1)}%)</span>`;

    tfootBudget.innerHTML = `
      <tr class="budget-tfoot-row">
        <td style="color: var(--text-main);">TOTAL EXERCÍCIO ${selectedAno}</td>
        <td style="color: #38bdf8;">${formatBRL(totalBudFat)}</td>
        <td style="color: #38bdf8;">${formatBRL(totalRealFat)}</td>
        <td style="color: ${totalVarFat >= 0 ? '#34d399' : '#fb7185'};">
          ${totalVarFat >= 0 ? '+' : ''}${formatBRL(totalVarFat)}
        </td>
        <td>
          <span class="kpi-budget-pill ${totalPctFat >= 100 ? 'ok' : (totalPctFat >= 65 ? 'warn' : 'danger')}">
            ${totalPctFat.toFixed(1)}%
          </span>
        </td>
        <td style="color: ${totalGapFat > 0 ? '#fbbf24' : '#34d399'};">
          ${totalGapFat > 0 ? formatBRL(totalGapFat) : 'R$ 0,00'}
        </td>
        <td>${totalStatusBadge}</td>
      </tr>
    `;
  }

  const mBarColors = mValores.map((val, idx) => {
    const bud = mBudgets[idx] || 0;
    if (val <= 0) return 'rgba(148, 163, 184, 0.18)';
    if (bud > 0 && val >= bud) return 'rgba(16, 185, 129, 0.82)';
    const pct = bud > 0 ? (val / bud) : 1;
    return pct >= 0.75 ? 'rgba(245, 158, 11, 0.80)' : 'rgba(244, 63, 94, 0.78)';
  });

  const mBorderColors = mValores.map((val, idx) => {
    const bud = mBudgets[idx] || 0;
    if (val <= 0) return 'rgba(148, 163, 184, 0.3)';
    if (bud > 0 && val >= bud) return '#10b981';
    const pct = bud > 0 ? (val / bud) : 1;
    return pct >= 0.75 ? '#f59e0b' : '#f43f5e';
  });

  const maxMensalB = Math.max(...mValores, ...mBudgets, 0);

  getOrCreateChart('chart-budget-mensal', {
    type: 'bar',
    data: {
      labels: mLabels,
      datasets: [
        {
          type: 'bar',
          label: 'Realizado Mensal (R$)',
          data: mValores,
          backgroundColor: mBarColors,
          borderColor: mBorderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          order: 2
        },
        {
          type: 'line',
          label: 'Budget Sazonal (R$)',
          data: mBudgets,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          borderWidth: 2.5,
          borderDash: [6, 4],
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: '#0f172a',
          pointBorderWidth: 1.5,
          tension: 0.3,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatBRL(ctx.raw)}`,
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return [];
              const real = mValores[idx] || 0;
              const bud = mBudgets[idx] || 0;
              if (bud <= 0) return [];
              const variancia = real - bud;
              const pct = ((real / bud) * 100).toFixed(1);
              const sinal = variancia >= 0 ? '+' : '';
              return [
                `────────────────────────`,
                `Variância (R$): ${sinal}${formatBRL(variancia)}`,
                `% Atingido: ${pct}% (${variancia >= 0 ? 'Meta Superada' : 'Abaixo da Meta'})`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => maxMensalB >= 1000000 ? 'R$ ' + (v / 1000000).toFixed(1) + 'M' : 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 45 }
        }
      }
    }
  });
}
window.renderBudgetModule = renderBudgetModule;

/**
 * Edita diretamente uma célula mensal de Budget (Receita em R$ ou Volume de Peças) na tabela.
 */
function onEditMonthlyBudgetCell(periodoYM, field, rawVal) {
  const num = parseBrNumberInput(rawVal);
  if (isNaN(num) || num < 0) {
    renderBudgetModule();
    return;
  }

  const compKey = state.currentCompany || 'consolidado';
  const store = getCustomBudgetStore();
  if (!store[compKey]) store[compKey] = {};
  if (!store[compKey][periodoYM]) store[compKey][periodoYM] = {};

  const baseRec = getBaseFatoBudgetRecord(periodoYM, compKey);

  if (field === 'fat') {
    store[compKey][periodoYM].fat = Math.round(num * 100) / 100;
    // Se o usuário ainda não editou manualmente as peças deste mês, ajusta proporcionalmente
    if (store[compKey][periodoYM].pecas === undefined) {
      const ratio = baseRec.budget_faturamento > 0
        ? (baseRec.budget_volume_pecas / baseRec.budget_faturamento)
        : (1 / 5.4054);
      store[compKey][periodoYM].pecas = Math.round(num * ratio);
    }
  } else if (field === 'pecas') {
    store[compKey][periodoYM].pecas = Math.round(num);
  }

  saveCustomBudgetStore(store);
  renderBudgetModule();
  if (typeof renderGastosModule === 'function') renderGastosModule();
}
window.onEditMonthlyBudgetCell = onEditMonthlyBudgetCell;

/**
 * Distribui uma Meta Anual Total nos 12 meses do exercício selecionado ('sazonal' ou 'uniforme').
 */
function onQuickDistributeAnnualBudget(modo = 'sazonal') {
  const inputEl = document.getElementById('input-quick-budget-anual');
  if (!inputEl) return;
  const totalAnual = parseBrNumberInput(inputEl.value);
  if (isNaN(totalAnual) || totalAnual <= 0) return;

  const anoSelect = document.getElementById('budget-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2026';
  const compKey = state.currentCompany || 'consolidado';

  const store = getCustomBudgetStore();
  if (!store[compKey]) store[compKey] = {};

  const baseAnualRec = getBaseFatoBudgetRecord(selectedAno, compKey);
  const pecasPorReal = baseAnualRec.budget_faturamento > 0
    ? (baseAnualRec.budget_volume_pecas / baseAnualRec.budget_faturamento)
    : (1 / 5.4054);

  for (let m = 1; m <= 12; m++) {
    const ym = `${selectedAno}-${String(m).padStart(2, '0')}`;
    const peso = modo === 'uniforme' ? (1 / 12) : (PESOS_SAZONAIS_MES[m] || (1 / 12));
    const fatMes = Math.round(totalAnual * peso * 100) / 100;
    const pecasMes = Math.round(fatMes * pecasPorReal);
    store[compKey][ym] = { fat: fatMes, pecas: pecasMes };
  }

  saveCustomBudgetStore(store);
  renderBudgetModule();
  if (typeof renderGastosModule === 'function') renderGastosModule();
}
window.onQuickDistributeAnnualBudget = onQuickDistributeAnnualBudget;

/**
 * Aplica um mesmo valor fixo de Meta Mensal para todos os 12 meses do exercício selecionado.
 */
function onQuickApplyUniformMonthlyBudget() {
  const inputEl = document.getElementById('input-quick-budget-mensal-fixo');
  if (!inputEl) return;
  const valorMensal = parseBrNumberInput(inputEl.value);
  if (isNaN(valorMensal) || valorMensal < 0) return;

  const anoSelect = document.getElementById('budget-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2026';
  const compKey = state.currentCompany || 'consolidado';

  const store = getCustomBudgetStore();
  if (!store[compKey]) store[compKey] = {};

  const baseAnualRec = getBaseFatoBudgetRecord(selectedAno, compKey);
  const pecasPorReal = baseAnualRec.budget_faturamento > 0
    ? (baseAnualRec.budget_volume_pecas / baseAnualRec.budget_faturamento)
    : (1 / 5.4054);

  for (let m = 1; m <= 12; m++) {
    const ym = `${selectedAno}-${String(m).padStart(2, '0')}`;
    store[compKey][ym] = {
      fat: Math.round(valorMensal * 100) / 100,
      pecas: Math.round(valorMensal * pecasPorReal)
    };
  }

  saveCustomBudgetStore(store);
  renderBudgetModule();
  if (typeof renderGastosModule === 'function') renderGastosModule();
}
window.onQuickApplyUniformMonthlyBudget = onQuickApplyUniformMonthlyBudget;

/**
 * Edita a Meta de Ticket Médio ou Folha Mensal para o exercício selecionado.
 */
function onEditBudgetTicketOrFolha(field, rawVal) {
  const num = parseBrNumberInput(rawVal);
  if (isNaN(num) || num <= 0) {
    renderBudgetModule();
    return;
  }

  const anoSelect = document.getElementById('budget-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2026';
  const compKey = state.currentCompany || 'consolidado';

  const store = getCustomBudgetStore();
  if (!store[compKey]) store[compKey] = {};
  const metaKey = `${selectedAno}_meta`;
  if (!store[compKey][metaKey]) store[compKey][metaKey] = {};

  if (field === 'ticket') {
    store[compKey][metaKey].ticket = Math.round(num * 100) / 100;
  } else if (field === 'folhaMes') {
    store[compKey][metaKey].folhaMes = Math.round(num * 100) / 100;
  }

  saveCustomBudgetStore(store);
  renderBudgetModule();
}
window.onEditBudgetTicketOrFolha = onEditBudgetTicketOrFolha;

/**
 * Restaura os valores originais do `fato_budget` para o exercício e empresa selecionados.
 */
function onResetCustomBudgetYear() {
  const anoSelect = document.getElementById('budget-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2026';
  const compKey = state.currentCompany || 'consolidado';

  const store = getCustomBudgetStore();
  if (store[compKey]) {
    for (let m = 1; m <= 12; m++) {
      const ym = `${selectedAno}-${String(m).padStart(2, '0')}`;
      delete store[compKey][ym];
    }
    delete store[compKey][`${selectedAno}_meta`];
    saveCustomBudgetStore(store);
  }

  const inputFixo = document.getElementById('input-quick-budget-mensal-fixo');
  if (inputFixo) inputFixo.value = '';

  renderBudgetModule();
  if (typeof renderGastosModule === 'function') renderGastosModule();
}
window.onResetCustomBudgetYear = onResetCustomBudgetYear;

// =========================================================================
// MÓDULO EXCLUSIVO: PLANO DE GASTOS E INVESTIMENTOS (SIMPLES E DIRETO)
// =========================================================================
const GASTOS_STORAGE_KEY = 'mb_plano_gastos_simples_v1';

function getInitialGastosTemplate() {
  return [
    { id: 'g1', nome: 'Compra de Máquinas e Equipamentos', mes: '1', anual: 0 },
    { id: 'g2', nome: 'Novos Moldes e Ferramentaria', mes: '2', anual: 0 },
    { id: 'g3', nome: 'Reforma / Melhorias na Fábrica', mes: '3', anual: 0 },
    { id: 'g4', nome: 'Matéria-Prima e Insumos', mes: 'anual', anual: 0 },
    { id: 'g5', nome: 'Folha de Pagamento e Equipe', mes: 'anual', anual: 0 },
    { id: 'g6', nome: 'Energia, Água e Manutenção', mes: 'anual', anual: 0 }
  ];
}

function getGastosStore() {
  try {
    const raw = localStorage.getItem(GASTOS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveGastosStore(store) {
  try {
    localStorage.setItem(GASTOS_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {}
}

function getGastosListForContext(ano, compKey) {
  const store = getGastosStore();
  const key = `${compKey}_${ano}`;
  if (Array.isArray(store[key])) {
    return store[key];
  }
  const initial = getInitialGastosTemplate();
  store[key] = initial;
  saveGastosStore(store);
  return initial;
}

function saveGastosListForContext(ano, compKey, list) {
  const store = getGastosStore();
  store[`${compKey}_${ano}`] = list;
  saveGastosStore(store);
}

function renderGastosModule() {
  const compKey = state.currentCompany || 'consolidado';
  const anoSelect = document.getElementById('gastos-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2027';
  const mesFilterEl = document.getElementById('gastos-mes-filter');
  const selectedMesFilter = mesFilterEl ? mesFilterEl.value : 'todos';

  const gastosList = getGastosListForContext(selectedAno, compKey);

  // Filtrar itens se um mês específico estiver selecionado no filtro superior
  const filteredEntries = gastosList
    .map((item, originalIndex) => ({ item, originalIndex }))
    .filter(({ item }) => {
      if (selectedMesFilter === 'todos') return true;
      return String(item.mes || '1') === String(selectedMesFilter);
    });

  let totalPlanejado = 0;
  let totalFeito = 0;
  let totalNaoFeito = 0;

  filteredEntries.forEach(({ item }) => {
    const val = Number(item.anual) || 0;
    totalPlanejado += val;
    if (item.feito) {
      totalFeito += val;
    } else {
      totalNaoFeito += val;
    }
  });

  const mesNomeFiltro = MESES_MAP[selectedMesFilter] || 'Todos os Meses';
  const periodoRef = selectedMesFilter === 'todos' ? selectedAno : `${mesNomeFiltro}/${selectedAno}`;

  // 1. Renderizar 3 Cards Limpos no Topo: Total Planejado, Feito e Não Feito
  const kpiGrid = document.getElementById('gastos-kpi-grid');
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card cyan">
        <div class="kpi-header">
          <span class="kpi-title">Total Planejado (${periodoRef})</span>
        </div>
        <div class="kpi-value">${formatBRL(totalPlanejado)}</div>
      </div>

      <div class="kpi-card emerald">
        <div class="kpi-header">
          <span class="kpi-title">Já Feito / Validado (${periodoRef})</span>
        </div>
        <div class="kpi-value" style="color: #10b981;">${formatBRL(totalFeito)}</div>
      </div>

      <div class="kpi-card amber">
        <div class="kpi-header">
          <span class="kpi-title">Não Feito / Pendente (${periodoRef})</span>
        </div>
        <div class="kpi-value" style="color: #f59e0b;">${formatBRL(totalNaoFeito)}</div>
      </div>
    `;
  }

  const titleChartMensal = document.getElementById('title-chart-gastos-mensal');
  if (titleChartMensal) {
    titleChartMensal.innerText = `Evolução Mês a Mês: Feito vs. Não Feito (${selectedAno})`;
  }

  const titleTable = document.getElementById('title-table-gastos');
  if (titleTable) {
    titleTable.innerText = selectedMesFilter === 'todos'
      ? `Lista do que pretende gastar ou investir em ${selectedAno}`
      : `Lista do que pretende gastar ou investir em ${mesNomeFiltro} / ${selectedAno}`;
  }

  // 2. Calcular dados mês a mês (Janeiro a Dezembro) para o Gráfico de Barras
  const mesesLabels = [];
  const feitoPorMes = new Array(12).fill(0);
  const naoFeitoPorMes = new Array(12).fill(0);

  for (let m = 1; m <= 12; m++) {
    mesesLabels.push(`${MESES_MAP[String(m)].substring(0, 3)}/${selectedAno}`);
  }

  gastosList.forEach(item => {
    const val = Number(item.anual) || 0;
    if (val <= 0) return;
    const mesStr = String(item.mes || '1');
    if (mesStr === 'anual') {
      const parcela = val / 12;
      for (let i = 0; i < 12; i++) {
        if (item.feito) feitoPorMes[i] += parcela;
        else naoFeitoPorMes[i] += parcela;
      }
    } else {
      const mIdx = parseInt(mesStr, 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        if (item.feito) feitoPorMes[mIdx] += val;
        else naoFeitoPorMes[mIdx] += val;
      }
    }
  });

  const maxMesVal = Math.max(...mesesLabels.map((_, i) => feitoPorMes[i] + naoFeitoPorMes[i]), 0);

  getOrCreateChart('chart-gastos-mensal', {
    type: 'bar',
    data: {
      labels: mesesLabels,
      datasets: [
        {
          label: 'Feito (R$)',
          data: feitoPorMes,
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 5
        },
        {
          label: 'Não Feito (R$)',
          data: naoFeitoPorMes,
          backgroundColor: 'rgba(245, 158, 11, 0.80)',
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { boxWidth: 12, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatBRL(ctx.raw)}`,
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return [];
              const totMes = (feitoPorMes[idx] || 0) + (naoFeitoPorMes[idx] || 0);
              return [`Total do Mês: ${formatBRL(totMes)}`];
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => maxMesVal >= 1000000 ? 'R$ ' + (v / 1000000).toFixed(1) + 'M' : 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        }
      }
    }
  });

  // 3. Renderizar Lista Simples de 5 Colunas (Descrição, Mês Previsto, Valor Previsto, Feito/Não Feito, Remover)
  let rowsHtml = '';
  if (filteredEntries.length === 0) {
    rowsHtml = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">
          Nenhum item encontrado. Digite acima com o que pretende gastar, escolha o mês e clique em <strong>+ Adicionar</strong>.
        </td>
      </tr>
    `;
  } else {
    filteredEntries.forEach(({ item, originalIndex }) => {
      const valAnual = Number(item.anual) || 0;
      const anualStr = valAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const safeNome = String(item.nome || '').replace(/"/g, '&quot;');
      const curMes = String(item.mes || '1');
      const isFeito = Boolean(item.feito);

      let mesOptionsHtml = '';
      for (let m = 1; m <= 12; m++) {
        const mKey = String(m);
        mesOptionsHtml += `<option value="${mKey}" ${curMes === mKey ? 'selected' : ''}>${MESES_MAP[mKey]} / ${selectedAno}</option>`;
      }
      mesOptionsHtml += `<option value="anual" ${curMes === 'anual' ? 'selected' : ''}>Ano Todo (${selectedAno})</option>`;

      const statusBtnHtml = isFeito
        ? `<button type="button" class="btn-budget-mini" style="background: rgba(16, 185, 129, 0.18); border-color: #10b981; color: #10b981; min-width: 112px;" onclick="onToggleGastoFeito(${originalIndex})" title="Clique para marcar como Não Feito">✓ Feito</button>`
        : `<button type="button" class="btn-budget-mini" style="background: rgba(245, 158, 11, 0.14); border-color: rgba(245, 158, 11, 0.45); color: #f59e0b; min-width: 112px;" onclick="onToggleGastoFeito(${originalIndex})" title="Clique para validar como Feito">○ Não Feito</button>`;

      rowsHtml += `
        <tr class="${valAnual > 0 ? 'cost-row-modified' : ''}">
          <td>
            <input type="text"
              class="budget-edit-input"
              style="width: 100%; text-align: left; font-weight: 600; ${isFeito ? 'color: #10b981;' : ''}"
              value="${safeNome}"
              placeholder="Com o que pretende gastar..."
              onchange="onEditGastoItem(${originalIndex}, 'nome', this.value)"
              onkeydown="if(event.key==='Enter'){this.blur();}">
          </td>
          <td>
            <select class="filter-select"
              style="width: 100%; padding: 5px 10px; font-size: 0.82rem; font-weight: 600;"
              onchange="onEditGastoItem(${originalIndex}, 'mes', this.value)">
              ${mesOptionsHtml}
            </select>
          </td>
          <td>
            <div class="cost-input-wrapper">
              <span class="cost-input-symbol">R$</span>
              <input type="text"
                class="budget-edit-input"
                style="width: 150px;"
                value="${anualStr}"
                onchange="onEditGastoItem(${originalIndex}, 'anual', this.value)"
                onkeydown="if(event.key==='Enter'){this.blur();}">
            </div>
          </td>
          <td style="text-align: center;">
            ${statusBtnHtml}
          </td>
          <td style="text-align: center;">
            <button type="button"
              class="btn-budget-mini secondary"
              style="padding: 4px 10px; font-size: 0.75rem;"
              title="Remover item"
              onclick="onDeleteGastoItem(${originalIndex})">✕</button>
          </td>
        </tr>
      `;
    });
  }

  const tbodyGastos = document.getElementById('tbody-plano-gastos');
  if (tbodyGastos) {
    tbodyGastos.innerHTML = rowsHtml;
  }

  const tfootGastos = document.getElementById('tfoot-plano-gastos');
  if (tfootGastos) {
    tfootGastos.innerHTML = `
      <tr class="budget-tfoot-row">
        <td colspan="2" style="color: var(--text-main);">
          ${selectedMesFilter === 'todos' ? `TOTAL PLANEJADO (${selectedAno})` : `TOTAL PLANEJADO EM ${mesNomeFiltro.toUpperCase()} (${selectedAno})`}
        </td>
        <td style="color: #38bdf8; font-size: 1rem;">${formatBRL(totalPlanejado)}</td>
        <td style="text-align: center; font-size: 0.78rem; color: #10b981;">
          Feito: ${formatBRL(totalFeito)}
        </td>
        <td></td>
      </tr>
    `;
  }
}
window.renderGastosModule = renderGastosModule;

function onToggleGastoFeito(index) {
  const anoSelect = document.getElementById('gastos-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2027';
  const compKey = state.currentCompany || 'consolidado';

  const list = getGastosListForContext(selectedAno, compKey);
  if (list[index]) {
    list[index].feito = !list[index].feito;
    saveGastosListForContext(selectedAno, compKey, list);
    renderGastosModule();
  }
}
window.onToggleGastoFeito = onToggleGastoFeito;

function onAddGastoItem() {
  const nomeEl = document.getElementById('input-new-gasto-nome');
  const mesEl = document.getElementById('select-new-gasto-mes');
  const anualEl = document.getElementById('input-new-gasto-anual');

  const nome = (nomeEl?.value || '').trim();
  if (!nome) {
    nomeEl?.focus();
    return;
  }

  const mes = mesEl ? mesEl.value : '1';
  let valAnual = parseBrNumberInput(anualEl?.value);
  if (isNaN(valAnual) || valAnual < 0) valAnual = 0;

  const anoSelect = document.getElementById('gastos-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2027';
  const compKey = state.currentCompany || 'consolidado';

  const list = getGastosListForContext(selectedAno, compKey);
  list.unshift({
    id: 'g_' + Date.now(),
    nome,
    mes,
    anual: Math.round(valAnual * 100) / 100,
    feito: false
  });

  saveGastosListForContext(selectedAno, compKey, list);

  if (nomeEl) nomeEl.value = '';
  if (anualEl) anualEl.value = '';
  nomeEl?.focus();

  renderGastosModule();
}
window.onAddGastoItem = onAddGastoItem;

function onEditGastoItem(index, field, rawValue) {
  const anoSelect = document.getElementById('gastos-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2027';
  const compKey = state.currentCompany || 'consolidado';

  const list = getGastosListForContext(selectedAno, compKey);
  const item = list[index];
  if (!item) return;

  if (field === 'nome') {
    item.nome = String(rawValue || '').trim() || 'Item sem descrição';
  } else if (field === 'mes') {
    item.mes = String(rawValue || '1');
  } else if (field === 'anual') {
    const num = parseBrNumberInput(rawValue);
    if (!isNaN(num) && num >= 0) {
      item.anual = Math.round(num * 100) / 100;
    }
  }

  saveGastosListForContext(selectedAno, compKey, list);
  renderGastosModule();
}
window.onEditGastoItem = onEditGastoItem;

function onDeleteGastoItem(index) {
  const anoSelect = document.getElementById('gastos-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2027';
  const compKey = state.currentCompany || 'consolidado';

  const list = getGastosListForContext(selectedAno, compKey);
  if (index >= 0 && index < list.length) {
    list.splice(index, 1);
    saveGastosListForContext(selectedAno, compKey, list);
    renderGastosModule();
  }
}
window.onDeleteGastoItem = onDeleteGastoItem;

function onClearAllGastosYear() {
  const anoSelect = document.getElementById('gastos-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2027';
  const compKey = state.currentCompany || 'consolidado';

  saveGastosListForContext(selectedAno, compKey, []);
  renderGastosModule();
}
window.onClearAllGastosYear = onClearAllGastosYear;

// Renderizar Curva ABC e Top Produtos Dinâmicos
function renderCurvaABC(empresaData, periodData) {
  const masterMap = {};
  (empresaData.produtos_estrategia || []).forEach(p => { masterMap[p.nome] = p; });

  const rawProds = (periodData && periodData.produtos && periodData.produtos.length > 0)
    ? periodData.produtos.map(p => {
        const m = masterMap[p.nome];
        return {
          ...p,
          icone: m?.icone || '🔧',
          recomendacao: m?.recomendacao || 'MANTER / MONITORAR',
          lote: m?.lote || 'Lote Padrão',
          qtd_2024: m?.qtd_2024 || 0,
          qtd_2025: m?.qtd_2025 || 0,
          qtd_2026: m?.qtd_2026 || 0
        };
      })
    : (empresaData.produtos_estrategia || []);

  const abc = computeCurvaABCFromProducts(rawProds);

  if (document.getElementById('stat-abc-a')) {
    document.getElementById('stat-abc-a').innerText = `${abc.A.itens} itens`;
  }
  if (document.getElementById('stat-abc-c')) {
    document.getElementById('stat-abc-c').innerText = `${abc.C.itens} itens`;
  }

  // Gráfico da Curva ABC Dinâmico
  const maxAbc = Math.max(abc.A.faturamento, abc.B.faturamento, abc.C.faturamento, 0);
  getOrCreateChart('chart-curva-abc', {
    type: 'bar',
    data: {
      labels: ['Classe A (80% Receita)', 'Classe B (15% Receita)', 'Classe C (5% Receita)'],
      datasets: [
        {
          label: 'Faturamento (R$)',
          data: [abc.A.faturamento, abc.B.faturamento, abc.C.faturamento],
          backgroundColor: ['#10b981', '#06b6d4', '#f43f5e'],
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatBRL(ctx.raw)
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => maxAbc >= 1000000 ? 'R$ ' + (v / 1000000).toFixed(1) + 'M' : 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });

  // Top 10 Produtos do Período
  const top10 = rawProds.slice(0, 10);
  const top10Labels = top10.map(p => p.nome.length > 25 ? p.nome.substring(0, 25) + '...' : p.nome);
  const top10Valores = top10.map(p => p.faturamento);

  getOrCreateChart('chart-top-produtos', {
    type: 'bar',
    data: {
      labels: top10Labels,
      datasets: [{
        label: 'Faturamento (R$)',
        data: top10Valores,
        backgroundColor: '#0284c7',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatBRL(ctx.raw)
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#1e293b', font: { size: 11, weight: '600' } }
        }
      }
    }
  });
}

// Renderizar Tabela de Produtos com Busca, Filtros e Paginação
function renderProdutosTable(empresaData, periodData) {
  const data = window.DASHBOARD_DATA;
  if (!data) return;

  const currentEmp = empresaData || data.empresas[state.currentCompany];
  const masterMap = {};
  (currentEmp.produtos_estrategia || []).forEach(p => { masterMap[p.nome] = p; });

  let produtos = (periodData && periodData.produtos && periodData.produtos.length > 0)
    ? periodData.produtos.map(p => {
        const m = masterMap[p.nome];
        return {
          ...p,
          icone: m?.icone || '🔧',
          curva_abc: p.curva_abc || m?.curva_abc || 'B',
          recomendacao: m?.recomendacao || 'MANTER / MONITORAR',
          lote: m?.lote || 'Lote Padrão',
          qtd_2024: m?.qtd_2024 || 0,
          qtd_2025: m?.qtd_2025 || 0,
          qtd_2026: m?.qtd_2026 || 0
        };
      })
    : (currentEmp.produtos_estrategia || []);

  const search = (document.getElementById('search-produto')?.value || '').toLowerCase().trim();
  const filterRec = document.getElementById('filter-rec-status')?.value || 'todos';
  const filterAbc = document.getElementById('filter-curva-abc')?.value || 'todas';
  const filterCat = state.filters.categoria;

  // Filtragem
  if (search) {
    produtos = produtos.filter(p => p.nome.toLowerCase().includes(search));
  }
  if (filterRec !== 'todos') {
    produtos = produtos.filter(p => p.recomendacao && p.recomendacao.includes(filterRec));
  }
  if (filterAbc !== 'todas') {
    produtos = produtos.filter(p => p.curva_abc === filterAbc);
  }
  if (filterCat !== 'todas') {
    produtos = produtos.filter(p => p.categoria === filterCat);
  }

  // Paginação
  const total = produtos.length;
  const totalPages = Math.ceil(total / state.productsPerPage) || 1;
  if (state.productsPage > totalPages) state.productsPage = totalPages;
  if (state.productsPage < 1) state.productsPage = 1;

  const start = (state.productsPage - 1) * state.productsPerPage;
  const pageItems = produtos.slice(start, start + state.productsPerPage);

  const tbody = document.getElementById('tbody-produtos');
  if (!tbody) return;

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 24px; color: var(--text-dim);">Nenhuma peça encontrada com os filtros selecionados.</td></tr>`;
    document.getElementById('page-info-produtos').innerText = '0 peças encontradas';
    return;
  }

  tbody.innerHTML = pageItems.map(p => {
    const abcClass = p.curva_abc === 'A' ? 'badge-a' : (p.curva_abc === 'B' ? 'badge-b' : 'badge-c');
    let recClass = 'tag-secondary';
    if (p.recomendacao && p.recomendacao.includes('PRODUZIR MAIS')) recClass = 'tag-success';
    else if (p.recomendacao && p.recomendacao.includes('EXPANDIR')) recClass = 'tag-info';
    else if (p.recomendacao && p.recomendacao.includes('MANTER')) recClass = 'tag-warning';
    else if (p.recomendacao && p.recomendacao.includes('SOB ENCOMENDA')) recClass = 'tag-danger';

    return `
      <tr>
        <td style="font-weight: 600; color: var(--text-main);" title="${p.nome}">
          ${p.icone || ''} ${p.nome}
        </td>
        <td><span style="font-size: 0.78rem; color: var(--text-muted);">${p.categoria}</span></td>
        <td><span class="badge-abc ${abcClass}">${p.curva_abc}</span></td>
        <td style="font-weight: 700; color: #67e8f9;">${formatBRL(p.faturamento)}</td>
        <td>${formatNumber(p.quantidade)}</td>
        <td>${formatBRL(p.preco_medio)}</td>
        <td>${formatNumber(p.qtd_2024)}</td>
        <td>${formatNumber(p.qtd_2025)}</td>
        <td><strong style="color: #38bdf8;">${formatNumber(p.qtd_2026)}</strong></td>
        <td><span class="tag-rec ${recClass}">${p.recomendacao || 'MANTER'}</span></td>
        <td><span style="font-size: 0.76rem; color: var(--text-dim);">${p.lote || 'Lote Padrão'}</span></td>
      </tr>
    `;
  }).join('');

  document.getElementById('page-info-produtos').innerText = `Mostrando ${start + 1} a ${Math.min(start + state.productsPerPage, total)} de ${formatNumber(total)} peças`;
  document.getElementById('btn-prev-page').disabled = state.productsPage <= 1;
  document.getElementById('btn-next-page').disabled = state.productsPage >= totalPages;
}

function changeProductPage(delta) {
  state.productsPage += delta;
  const currentEmpresaData = window.DASHBOARD_DATA?.empresas[state.currentCompany];
  const { periodData } = getPeriodData(currentEmpresaData);
  renderProdutosTable(currentEmpresaData, periodData);
}

// Renderizar Análise Geográfica (Estados e Cidades) Dinâmica
function renderGeografia(empresaData, periodData, periodLabel) {
  const ufs = (periodData && periodData.vendas_por_uf && periodData.vendas_por_uf.length > 0)
    ? [...periodData.vendas_por_uf].sort((a, b) => b.faturamento - a.faturamento)
    : (empresaData.vendas_por_uf || []);
  let cidades = (periodData && periodData.top_cidades && periodData.top_cidades.length > 0)
    ? [...periodData.top_cidades]
    : (empresaData?.top_cidades ? [...empresaData.top_cidades] : []);

  // Consolidar cidades dos dados anuais se não estiver populado no período
  if (cidades.length === 0 && empresaData && empresaData.dados_anuais) {
    const cidMap = {};
    Object.values(empresaData.dados_anuais).forEach(anoObj => {
      if (anoObj.top_cidades) {
        anoObj.top_cidades.forEach(c => {
          const key = `${c.cidade}|${c.uf}`;
          if (!cidMap[key]) {
            cidMap[key] = { cidade: c.cidade, uf: c.uf, faturamento: 0, quantidade: 0, clientes: 0 };
          }
          cidMap[key].faturamento += c.faturamento || 0;
          cidMap[key].quantidade += c.quantidade || 0;
          cidMap[key].clientes = Math.max(cidMap[key].clientes, c.clientes || 0);
        });
      }
    });
    cidades = Object.values(cidMap).sort((a, b) => b.faturamento - a.faturamento);
  }

  // Filtrar pelo Estado selecionado (se houver filtro de UF ativo)
  if (state.filters.uf && state.filters.uf !== 'todos') {
    cidades = cidades.filter(c => c.uf === state.filters.uf);
  }

  // Calcular Regiões Dinamicamente a partir dos Estados
  const regMap = {};
  ufs.forEach(u => {
    const reg = UF_TO_REGIAO[u.uf] || 'Outro';
    if (!regMap[reg]) regMap[reg] = { regiao: reg, faturamento: 0, quantidade: 0, pedidos: 0, clientes: 0 };
    regMap[reg].faturamento += u.faturamento;
    regMap[reg].quantidade += u.quantidade;
    regMap[reg].pedidos += u.pedidos;
    regMap[reg].clientes += u.clientes;
  });
  const totalFatGeo = Object.values(regMap).reduce((acc, r) => acc + r.faturamento, 0) || 1;
  const regioes = Object.values(regMap)
    .sort((a, b) => b.faturamento - a.faturamento)
    .map(r => ({
      ...r,
      pct: +( (r.faturamento / totalFatGeo) * 100 ).toFixed(1)
    }));

  // Atualizar Banner Geográfico Dinâmico
  const descBanner = document.getElementById('geo-banner-desc');
  if (descBanner) {
    const r1 = regioes[0] || { regiao: 'Sudeste', pct: 60.1, faturamento: 0 };
    const u1 = ufs[0] || { uf: 'SP', faturamento: 0, pct: 0 };
    const u2 = ufs[1] || { uf: 'PR', faturamento: 0 };
    const u3 = ufs[2] || { uf: 'MG', faturamento: 0 };
    descBanner.innerHTML = `No período selecionado (<strong>${periodLabel}</strong>), a região <strong>${r1.regiao}</strong> lidera com <strong>${r1.pct}%</strong> do faturamento (${formatBRL(r1.faturamento)}). O Estado de <strong>${u1.uf}</strong> é o principal mercado com <strong>${formatBRL(u1.faturamento)}</strong> (${u1.pct}% do total)${u2.faturamento > 0 ? `, seguido por <strong>${u2.uf}</strong> (${formatBRL(u2.faturamento)})` : ''}${u3.faturamento > 0 ? ` e <strong>${u3.uf}</strong> (${formatBRL(u3.faturamento)})` : ''}.`;
  }
  if (document.getElementById('geo-stat-regiao1-val') && regioes[0]) {
    document.getElementById('geo-stat-regiao1-val').innerText = `${regioes[0].pct}%`;
    document.getElementById('geo-stat-regiao1-lbl').innerText = `Região ${regioes[0].regiao}`;
  }
  if (document.getElementById('geo-stat-regiao2-val') && regioes[1]) {
    document.getElementById('geo-stat-regiao2-val').innerText = `${regioes[1].pct}%`;
    document.getElementById('geo-stat-regiao2-lbl').innerText = `Região ${regioes[1].regiao}`;
  }

  // Top 12 UFs para o Gráfico
  const topUFs = ufs.slice(0, 12);
  const maxVal = Math.max(...topUFs.map(u => u.faturamento), 0);
  getOrCreateChart('chart-estados', {
    type: 'bar',
    data: {
      labels: topUFs.map(u => u.uf),
      datasets: [{
        label: 'Faturamento (R$)',
        data: topUFs.map(u => u.faturamento),
        backgroundColor: topUFs.map(u => state.filters.uf === u.uf ? '#38bdf8' : '#3b82f6'),
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatBRL(ctx.raw)
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => maxVal >= 1000000 ? 'R$ ' + (v / 1000000).toFixed(1) + 'M' : 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });

  // Gráfico de Macro-regiões Dinâmico
  getOrCreateChart('chart-regioes', {
    type: 'doughnut',
    data: {
      labels: regioes.map(r => r.regiao),
      datasets: [{
        data: regioes.map(r => r.faturamento),
        backgroundColor: ['#0284c7', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'],
        borderWidth: 2,
        borderColor: '#162032'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#e5e7eb', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatBRL(ctx.raw)} (${regioes[ctx.dataIndex]?.pct || 0}%)`
          }
        }
      }
    }
  });

  // Heat Grid dos Estados Dinâmico
  const heatGrid = document.getElementById('uf-heat-grid');
  if (heatGrid) {
    heatGrid.innerHTML = ufs.map(u => {
      const isHigh = u.pct >= 8;
      const isMed = u.pct >= 2 && u.pct < 8;
      const tileClass = isHigh ? 'high' : (isMed ? 'medium' : '');
      const isSelected = state.filters.uf === u.uf ? 'style="border-color: #38bdf8; box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);"' : '';

      return `
        <div class="uf-tile ${tileClass}" ${isSelected} onclick="selectUF('${u.uf}')" title="Filtrar Estado ${u.uf}">
          <div class="uf-code">${u.uf}</div>
          <div class="uf-val">${formatBRL(u.faturamento)}</div>
          <div class="uf-pct">${u.pct}% das vendas</div>
        </div>
      `;
    }).join('');
  }

  // Tabela de Estados Dinâmica
  const tbodyUf = document.getElementById('tbody-estados');
  if (tbodyUf) {
    tbodyUf.innerHTML = ufs.map(u => `
      <tr style="${state.filters.uf === u.uf ? 'background: rgba(56, 189, 248, 0.1);' : ''}">
        <td><strong style="color: #67e8f9; cursor: pointer;" onclick="selectUF('${u.uf}')">${u.uf}</strong></td>
        <td><strong>${formatBRL(u.faturamento)}</strong></td>
        <td>${formatNumber(u.quantidade)}</td>
        <td>${formatNumber(u.pedidos)}</td>
        <td>${formatNumber(u.clientes)}</td>
        <td>${formatBRL(u.ticket_medio)}</td>
        <td><span style="color: #34d399; font-weight: 600;">${u.pct}%</span></td>
      </tr>
    `).join('');
  }

  // Tabela de Cidades Top Dinâmica
  const tbodyCid = document.getElementById('tbody-cidades');
  if (tbodyCid) {
    if (cidades.length === 0) {
      tbodyCid.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-dim);">Nenhuma cidade encontrada para os filtros selecionados.</td></tr>`;
    } else {
      tbodyCid.innerHTML = cidades.slice(0, 20).map(c => `
        <tr>
          <td style="font-weight: 600; color: var(--text-main);">${c.cidade}</td>
          <td><span class="badge-abc badge-b" style="cursor: pointer;" onclick="selectUF('${c.uf}')">${c.uf}</span></td>
          <td style="color: #67e8f9; font-weight: 700;">${formatBRL(c.faturamento)}</td>
          <td>${formatNumber(c.quantidade)}</td>
          <td>${formatNumber(c.clientes)}</td>
        </tr>
      `).join('');
    }
  }
}

function selectUF(uf) {
  const sel = document.getElementById('filter-uf');
  if (sel) {
    sel.value = uf;
    applyGlobalFilters();
  }
}

// Renderizar Equilíbrio Fiscal e Split MB vs Moderna
function renderSplitAnalysis() {
  const data = window.DASHBOARD_DATA;
  if (!data || !data.split_fiscal) return;

  const ano = document.getElementById('split-ano-select')?.value || '2026';
  const splitAno = data.split_fiscal[ano] || data.split_fiscal['2026'];

  const mbFat = splitAno.mb_faturamento;
  const modFat = splitAno.moderna_faturamento;
  const total = splitAno.total;
  const mbPct = splitAno.mb_pct;
  const modPct = splitAno.moderna_pct;

  // Ajustar barra de progresso
  const barMb = document.getElementById('bar-split-mb');
  const barMod = document.getElementById('bar-split-mod');
  if (barMb && barMod) {
    barMb.style.width = `${mbPct}%`;
    barMb.innerText = `Empresa 1: ${mbPct}%`;
    barMod.style.width = `${modPct}%`;
    barMod.innerText = `Empresa 2: ${modPct}%`;
  }

  document.getElementById('label-split-mb').innerText = `⚙️ Empresa 1: ${formatBRL(mbFat)} (${mbPct}%)`;
  document.getElementById('label-split-mod').innerText = `💎 Empresa 2: ${formatBRL(modFat)} (${modPct}%)`;

  // Cards de Alerta de Simples Nacional + Budget Fiscal Dinâmico (Sublimite ICMS R$ 3,6M)
  const cardsContainer = document.getElementById('tax-indicator-cards');
  if (cardsContainer) {
    const isMbTeto = splitAno.mb_risco_teto;
    const isMbSub = splitAno.mb_risco_sublimite;
    const isModTeto = splitAno.moderna_risco_teto;

    const mbBudRec = getFatoBudgetRecord(ano, 'mb');
    const modBudRec = getFatoBudgetRecord(ano, 'moderna');
    const mbBudget = mbBudRec.budget_faturamento || 4800000;
    const modBudget = modBudRec.budget_faturamento || 3200000;
    const SUBLIMITE_ICMS = 3600000;
    const mbBudExcedeSub = mbBudget > SUBLIMITE_ICMS;
    const modBudExcedeSub = modBudget > SUBLIMITE_ICMS;
    const mbGapSublimite = Math.max(0, SUBLIMITE_ICMS - mbFat);

    cardsContainer.innerHTML = `
      <div class="tax-box ${isMbTeto ? 'danger' : (isMbSub || mbBudExcedeSub ? 'warning' : 'success')}">
        <div class="tax-box-title">Empresa 1 (Sublimite R$ 3,6M | Teto R$ 4,8M)</div>
        <div class="tax-box-val">${formatBRL(mbFat)}</div>
        <div class="tax-box-status" style="color: ${isMbTeto ? '#fb7185' : (isMbSub ? '#fbbf24' : '#34d399')};">
          ${isMbTeto ? '🚨 ESTOUROU TETO DO SIMPLES (Risco de Exclusão)' : (isMbSub ? '⚠️ ULTRAPASSOU SUBLIMITE DE ICMS (R$ 3,6M)' : `✓ Realizado Seguro (Restam ${formatBRL(mbGapSublimite)} p/ R$ 3,6M)`)}
        </div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.74rem; color: ${mbBudExcedeSub ? '#fbbf24' : 'var(--text-muted)'};">
          Budget Planejado (${ano}): <strong>${formatBRL(mbBudget)}</strong>
          ${mbBudExcedeSub ? `<br>⚠️ Alerta Budget Fiscal: Orçamento excede o sublimite estadual de R$ 3,6M em <strong>${formatBRL(mbBudget - SUBLIMITE_ICMS)}</strong>!` : ' (Dentro do sublimite R$ 3,6M)'}
        </div>
      </div>

      <div class="tax-box ${isModTeto ? 'danger' : (modBudExcedeSub ? 'warning' : 'success')}">
        <div class="tax-box-title">Empresa 2 (Sublimite R$ 3,6M | Teto R$ 4,8M)</div>
        <div class="tax-box-val">${formatBRL(modFat)}</div>
        <div class="tax-box-status" style="color: ${isModTeto ? '#fb7185' : '#34d399'};">
          ${isModTeto ? '🚨 ESTOUROU TETO' : `✓ Margem livre p/ Sublimite ICMS: ${formatBRL(Math.max(0, SUBLIMITE_ICMS - modFat))}`}
        </div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.74rem; color: ${modBudExcedeSub ? '#fbbf24' : 'var(--text-muted)'};">
          Budget Planejado (${ano}): <strong>${formatBRL(modBudget)}</strong>
          ${modBudExcedeSub ? `<br>⚠️ Alerta: Budget ultrapassa sublimite de R$ 3,6M!` : `<br>✓ Folga no Budget p/ absorver da Empresa 1: <strong>${formatBRL(Math.max(0, SUBLIMITE_ICMS - modBudget))}</strong>`}
        </div>
      </div>

      <div class="tax-box ${splitAno.nivel_risco === 'critico' ? 'danger' : (splitAno.nivel_risco === 'otimo' ? 'success' : 'warning')}">
        <div class="tax-box-title">Diagnóstico de Equilíbrio & Budget Fiscal</div>
        <div class="tax-box-val" style="font-size: 1.05rem;">${splitAno.mb_pct}% Emp. 1 / ${splitAno.moderna_pct}% Emp. 2</div>
        <div class="tax-box-status">${splitAno.diagnostico}</div>
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 0.73rem; color: var(--text-muted);">
          Recomendação Controladoria: Manter faturamento anual de cada CNPJ abaixo de <strong>R$ 3.600.000,00</strong> para evitar recolhimento de ICMS fora do DAS.
        </div>
      </div>
    `;
  }

  // Gráfico Histórico de Comparação
  const anosSplit = Object.keys(data.split_fiscal);
  const mbVals = anosSplit.map(a => data.split_fiscal[a].mb_faturamento);
  const modVals = anosSplit.map(a => data.split_fiscal[a].moderna_faturamento);

  getOrCreateChart('chart-split-historico', {
    type: 'bar',
    data: {
      labels: anosSplit,
      datasets: [
        {
          label: 'Empresa 1',
          data: mbVals,
          backgroundColor: '#0284c7',
          borderRadius: 4
        },
        {
          label: 'Empresa 2',
          data: modVals,
          backgroundColor: '#a855f7',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        },
        y: {
          stacked: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => 'R$ ' + (v / 1000000).toFixed(1) + 'M'
          }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#ffffff' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatBRL(ctx.raw)}`
          }
        }
      }
    }
  });

  runSplitSimulation();
}

// Simulador de Split Fiscal
function runSplitSimulation() {
  const total = parseFloat(document.getElementById('sim-fat-total')?.value) || 7500000;
  const pctMb = parseInt(document.getElementById('sim-slider-split')?.value) || 50;
  const pctMod = 100 - pctMb;

  const lbl = document.getElementById('sim-slider-label');
  if (lbl) {
    lbl.innerText = `${pctMb}% Empresa 1 / ${pctMod}% Empresa 2 ${pctMb === 50 ? '(Equilíbrio Perfeito)' : ''}`;
  }

  const valorMb = (total * pctMb) / 100;
  const valorMod = (total * pctMod) / 100;

  const resContainer = document.getElementById('sim-split-results');
  if (!resContainer) return;

  const isMbOk = valorMb <= 4800000;
  const isModOk = valorMod <= 4800000;
  const bothOk = isMbOk && isModOk;

  resContainer.innerHTML = `
    <div style="background: rgba(2, 132, 199, 0.15); border: 1px solid rgba(2, 132, 199, 0.4); padding: 14px; border-radius: 8px;">
      <div style="font-size: 0.76rem; color: #93c5fd; text-transform: uppercase;">Projeção Empresa 1</div>
      <div style="font-size: 1.3rem; font-weight: 700; color: var(--text-main);">${formatBRL(valorMb)}</div>
      <div style="font-size: 0.8rem; margin-top: 4px; color: ${isMbOk ? '#34d399' : '#fb7185'}; font-weight: 600;">
        ${isMbOk ? '✓ Dentro do Teto do Simples (R$ 4,8M)' : '🚨 ESTOURA O TETO DO SIMPLES!'}
      </div>
    </div>

    <div style="background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.4); padding: 14px; border-radius: 8px;">
      <div style="font-size: 0.76rem; color: #c084fc; text-transform: uppercase;">Projeção Empresa 2</div>
      <div style="font-size: 1.3rem; font-weight: 700; color: var(--text-main);">${formatBRL(valorMod)}</div>
      <div style="font-size: 0.8rem; margin-top: 4px; color: ${isModOk ? '#34d399' : '#fb7185'}; font-weight: 600;">
        ${isModOk ? '✓ Dentro do Teto do Simples (R$ 4,8M)' : '🚨 ESTOURA O TETO DO SIMPLES!'}
      </div>
    </div>

    <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); padding: 14px; border-radius: 8px;">
      <div style="font-size: 0.76rem; color: #6ee7b7; text-transform: uppercase;">Resultado da Estratégia</div>
      <div style="font-size: 1.15rem; font-weight: 700; color: ${bothOk ? '#34d399' : '#fb7185'};">
        ${bothOk ? '🎯 Ambas no Simples Nacional' : '⚠️ Ajuste os percentuais!'}
      </div>
      <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 4px;">
        ${bothOk ? 'Economia tributária máxima atingida mantendo os dois CNPJs na alíquota unificada.' : 'Uma das empresas ultrapassará o limite anual de R$ 4,8 Milhões.'}
      </div>
    </div>
  `;
}

// Renderizar Módulo de Colaboradores, Produtividade e Raio-X de Holerites
function toggleRubricaCategoryFilter(categoria) {
  const selGrupo = document.getElementById('rh-filter-rubrica-grupo');
  if (!selGrupo) return;
  if (selGrupo.value === categoria) {
    selGrupo.value = 'oculto';
  } else {
    selGrupo.value = categoria;
  }
  onRhHoleriteFilterChange('rubrica');
}
window.toggleRubricaCategoryFilter = toggleRubricaCategoryFilter;

function onRhHoleriteFilterChange(source) {
  const selectTop = document.getElementById('rh-holerite-mes-select');
  const selectColab = document.getElementById('colab-mes-select');
  const selectRanking = document.getElementById('ranking-mes-select');

  let chosenVal = state.rhSelectedPeriodo || 'acumulado';
  if (source === 'colab' && selectColab) {
    chosenVal = selectColab.value;
  } else if (source === 'ranking' && selectRanking) {
    chosenVal = selectRanking.value;
  } else if (source === 'top' && selectTop) {
    chosenVal = selectTop.value;
  } else if (source === 'rubrica') {
    chosenVal = state.rhSelectedPeriodo || selectTop?.value || selectColab?.value || 'acumulado';
  } else if (typeof source === 'string' && source.length > 0 && !['top', 'colab', 'ranking', 'rubrica'].includes(source)) {
    chosenVal = source;
  } else {
    chosenVal = selectColab?.value || selectRanking?.value || selectTop?.value || 'acumulado';
  }

  state.rhSelectedPeriodo = chosenVal;
  if (selectTop) selectTop.value = chosenVal;
  if (selectColab) selectColab.value = chosenVal;
  if (selectRanking) selectRanking.value = chosenVal;

  const currentEmp = window.DASHBOARD_DATA?.empresas?.[state.currentCompany];
  const rhData = currentEmp?.produtividade_rh || window.DASHBOARD_DATA?.produtividade_rh;
  if (rhData) renderColaboradores(rhData);
}
window.onRhHoleriteFilterChange = onRhHoleriteFilterChange;

function renderColaboradores(rhData) {
  if (!rhData) return;

  document.getElementById('stat-colab-headcount').innerText = `${rhData.total_colaboradores} colaboradores`;
  document.getElementById('stat-colab-roi').innerText = `${rhData.roi_mao_de_obra}x faturamento`;

  document.getElementById('kpi-fat-per-capita').innerText = formatBRL(rhData.fat_per_capita_mensal);
  document.getElementById('kpi-pecas-per-capita').innerText = `${formatNumber(rhData.pecas_per_capita_mensal)} un`;
  document.getElementById('kpi-custo-colab').innerText = formatBRL(rhData.total_colaboradores > 0 ? rhData.custo_folha_mensal / rhData.total_colaboradores : 0);
  document.getElementById('kpi-margem-colab').innerText = formatBRL(rhData.lucro_bruto_per_capita_mensal);
  document.getElementById('kpi-indice-folha').innerText = `${rhData.indice_folha_faturamento}%`;

  const srcLabel = document.getElementById('colab-file-source');
  const evolucao = rhData.evolucao_mensal_folha || window.DASHBOARD_DATA?.evolucao_mensal_folha || [];

  // Popular opções dos 3 filtros de período do Holerite (topo, rankings e quadro de colaboradores)
  const selectMesRh = document.getElementById('rh-holerite-mes-select');
  const selectColabMes = document.getElementById('colab-mes-select');
  const selectRankingMes = document.getElementById('ranking-mes-select');
  const targetVal = state.rhSelectedPeriodo || selectColabMes?.value || selectRankingMes?.value || selectMesRh?.value || 'acumulado';

  if (evolucao.length > 0) {
    const numMeses = evolucao.length;
    const firstLbl = evolucao[0]?.label || 'Nov/2025';
    const lastLbl = evolucao[evolucao.length - 1]?.label || 'Out/2026';
    let optsHtml = `
      <option value="acumulado">📊 Total Acumulado (${numMeses} Meses: ${firstLbl} a ${lastLbl})</option>
      <option value="media">📅 Média Mensal por Colaborador</option>
    `;
    evolucao.slice().reverse().forEach(m => {
      optsHtml += `<option value="${m.ano_mes}">🗓️ Mês: ${m.label} (${m.headcount} colaboradores)</option>`;
    });

    [selectMesRh, selectColabMes, selectRankingMes].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = optsHtml;
      if ([...sel.options].some(o => o.value === targetVal)) {
        sel.value = targetVal;
      } else {
        sel.value = 'acumulado';
      }
    });
  }

  const modoPeriodo = selectColabMes?.value || selectRankingMes?.value || selectMesRh?.value || 'acumulado';
  state.rhSelectedPeriodo = modoPeriodo;
  const resumoHol = rhData.resumo_holerites || null;

  // Renderizar os 6 Cards e a Tabela de Rubricas do Holerite
  if (resumoHol && evolucao.length > 0) {
    const numMeses = resumoHol.num_meses || evolucao.length || 1;
    let dadosRef = resumoHol.acumulado || {};
    let rubricasMapMes = null;
    let divisorMedia = numMeses;

    if (modoPeriodo === 'media') {
      dadosRef = resumoHol.media_mensal || {};
    } else if (modoPeriodo !== 'acumulado') {
      const mesObj = evolucao.find(e => e.ano_mes === modoPeriodo);
      if (mesObj) {
        dadosRef = mesObj;
        rubricasMapMes = mesObj.rubricas || {};
        divisorMedia = 1;
      }
    }

    const salBase = dadosRef.salario_base_efetivo || 0;
    const heTotal = dadosRef.hora_extra_total || 0;
    const he110 = dadosRef.hora_extra_110 || 0;
    const he70 = dadosRef.hora_extra_70 || 0;
    const horasQtd = dadosRef.horas_extras_qtd || 0;
    const dsrVar = dadosRef.dsr_variaveis || 0;
    const valeAlim = dadosRef.vale_alimentacao || 0;
    const ajudaReemb = dadosRef.ajuda_reembolso || 0;
    const comissoes = dadosRef.comissoes || 0;
    const gratificacoes = dadosRef.gratificacoes || 0;
    const bonus = dadosRef.bonus || 0;
    const adicTotal = dadosRef.adicionais_total || (comissoes + gratificacoes + bonus + ajudaReemb);
    const adiantamento = dadosRef.vale_adiantamento || 0;
    const vtDesc = dadosRef.vale_transporte || 0;
    const brutoRef = dadosRef.total_bruto || 1;

    const elSalBase = document.getElementById('rh-card-sal-base');
    const elSalBaseSub = document.getElementById('rh-card-sal-base-sub');
    if (elSalBase) elSalBase.innerText = formatBRL(salBase);
    if (elSalBaseSub) {
      elSalBaseSub.innerText = modoPeriodo === 'acumulado'
        ? `Média: ${formatBRL(salBase / numMeses)}/mês • ${((salBase / brutoRef) * 100).toFixed(1)}% do bruto`
        : `${((salBase / brutoRef) * 100).toFixed(1)}% da folha bruta no período`;
    }

    const elHeTotal = document.getElementById('rh-card-he-total');
    const elHeSub = document.getElementById('rh-card-he-sub');
    if (elHeTotal) elHeTotal.innerText = formatBRL(heTotal + dsrVar);
    if (elHeSub) {
      elHeSub.innerText = `HE: ${formatBRL(heTotal)} (${formatNumber(Math.round(horasQtd))}h) + DSR: ${formatBRL(dsrVar)}`;
    }

    const elValeAlim = document.getElementById('rh-card-vale-alim');
    const elValeAlimSub = document.getElementById('rh-card-vale-alim-sub');
    if (elValeAlim) elValeAlim.innerText = formatBRL(valeAlim + ajudaReemb);
    if (elValeAlimSub) {
      elValeAlimSub.innerText = `VA (105): ${formatBRL(valeAlim)} • Ajuda/Reemb.: ${formatBRL(ajudaReemb)} • VT Desc.: ${formatBRL(vtDesc)}`;
    }

    const elAdic = document.getElementById('rh-card-adicionais');
    const elAdicSub = document.getElementById('rh-card-adicionais-sub');
    if (elAdic) elAdic.innerText = formatBRL(comissoes + gratificacoes + bonus);
    if (elAdicSub) {
      elAdicSub.innerText = `Comissões: ${formatBRL(comissoes)} • Grat.: ${formatBRL(gratificacoes)} • Bônus: ${formatBRL(bonus)}`;
    }

    const elAdiant = document.getElementById('rh-card-adiantamento');
    const elAdiantSub = document.getElementById('rh-card-adiantamento-sub');
    if (elAdiant) elAdiant.innerText = formatBRL(adiantamento);
    if (elAdiantSub) {
      elAdiantSub.innerText = modoPeriodo === 'acumulado'
        ? `Média de Vales/Quinzena: ${formatBRL(adiantamento / numMeses)}/mês`
        : `Vales quinzenais e adiantamentos pagos no período`;
    }

    // Tabela Analítica de todas as rubricas do holerite (controlada pelo filtro #rh-filter-rubrica-grupo)
    const tbodyRub = document.getElementById('tbody-holerite-rubricas');
    const wrapRub = document.getElementById('rh-rubricas-table-wrap');
    const selGrupoRub = document.getElementById('rh-filter-rubrica-grupo');
    const filtroGrupoRub = selGrupoRub ? selGrupoRub.value : 'oculto';

    if (wrapRub) {
      wrapRub.style.display = (filtroGrupoRub === 'oculto') ? 'none' : 'block';
    }

    if (tbodyRub && filtroGrupoRub !== 'oculto' && Array.isArray(resumoHol.rubricas_detalhadas)) {
      const listaRub = resumoHol.rubricas_detalhadas.filter(r => {
        const hasVal = rubricasMapMes ? ((rubricasMapMes[r.codigo]?.val || 0) > 0) : (r.valor_total > 0);
        if (!hasVal) return false;
        if (filtroGrupoRub === 'todas') return true;
        if (filtroGrupoRub === 'Impostos & Encargos') {
          return r.categoria.includes('Impostos') || r.categoria.includes('Descontos') || r.categoria.includes('Faltas');
        }
        return r.categoria === filtroGrupoRub;
      });

      const rowsRubHtml = listaRub.map(r => {
        let valExibido = r.valor_total;
        let refExibida = r.referencia_total;
        if (modoPeriodo === 'media') {
          valExibido = r.media_mensal;
          refExibida = r.referencia_total / numMeses;
        } else if (rubricasMapMes) {
          valExibido = rubricasMapMes[r.codigo]?.val || 0;
          refExibida = rubricasMapMes[r.codigo]?.ref || 0;
        }

        const pctBruto = brutoRef > 0 ? (valExibido / brutoRef) * 100 : 0;
        let badgeTipo = '<span class="tag-rec tag-success">PROVENTO / CUSTO</span>';
        let valColor = '#34d399';
        if (r.tipo === 'adiantamento') {
          badgeTipo = '<span class="tag-rec tag-warning">VALE / ADIANTAMENTO</span>';
          valColor = '#fbbf24';
        } else if (r.tipo === 'desconto') {
          badgeTipo = '<span class="tag-rec tag-info">DESCONTO / RETENÇÃO</span>';
          valColor = '#38bdf8';
        }

        const isHeCode = ['030', '031', '032'].includes(r.codigo);
        const refLabel = refExibida > 0
          ? `${refExibida.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${isHeCode ? ' h' : ''}`
          : '—';

        return `
          <tr>
            <td><span class="badge-abc badge-b">${r.codigo}</span></td>
            <td style="font-weight: 700; color: var(--text-main);">${r.descricao}</td>
            <td style="color: var(--text-muted); font-size: 0.8rem;">${r.categoria}</td>
            <td>${badgeTipo}</td>
            <td style="text-align: right; color: var(--text-muted); font-weight: 600;">${refLabel}</td>
            <td style="text-align: right; font-weight: 700; color: ${valColor};">${formatBRL(valExibido)}</td>
            <td style="text-align: right; color: var(--text-muted);">${formatBRL(r.media_mensal)}/mês</td>
            <td style="text-align: right; font-weight: 600;">${pctBruto.toFixed(1)}%</td>
          </tr>
        `;
      }).join('');

      const fgtsPeriodo = dadosRef.total_fgts || 0;
      const fgtsMedia = (resumoHol.media_mensal?.total_fgts) || (fgtsPeriodo / divisorMedia);
      const showFgtsRow = (filtroGrupoRub === 'todas' || filtroGrupoRub === 'Impostos & Encargos');

      const fgtsRowHtml = showFgtsRow ? `
        <tr style="background: rgba(56, 189, 248, 0.08); font-weight: 700;">
          <td><span class="badge-abc badge-a">FGTS</span></td>
          <td style="font-weight: 700; color: #fbbf24;">FGTS Patronal Mensal (8% s/ Remuneração)</td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">Encargos Patronais CLT</td>
          <td><span class="tag-rec tag-warning">ENCARGO EMPRESA</span></td>
          <td style="text-align: right; color: var(--text-muted);">8,0%</td>
          <td style="text-align: right; font-weight: 700; color: #fbbf24;">${formatBRL(fgtsPeriodo)}</td>
          <td style="text-align: right; color: var(--text-muted);">${formatBRL(fgtsMedia)}/mês</td>
          <td style="text-align: right; font-weight: 600;">${brutoRef > 0 ? ((fgtsPeriodo / brutoRef) * 100).toFixed(1) : '8.0'}%</td>
        </tr>
      ` : '';

      tbodyRub.innerHTML = rowsRubHtml + fgtsRowHtml;
    }
  }

  // 1. Renderizar Gráfico e Tabela de Evolução da Folha (11 meses)
  if (evolucao && evolucao.length > 0) {
    const badgePer = document.getElementById('badge-folha-periodo');
    if (badgePer) badgePer.innerText = `Período: ${evolucao.length} Meses (${evolucao[0].label} a ${evolucao[evolucao.length - 1].label})`;

    const labels = evolucao.map(e => e.label || e.ano_mes);
    const salBases = evolucao.map(e => e.salario_base_efetivo || 0);
    const horasExtras = evolucao.map(e => (e.hora_extra_total || 0) + (e.dsr_variaveis || 0));
    const valesBenef = evolucao.map(e => (e.vale_alimentacao || 0) + (e.adicionais_total || 0));
    const headcounts = evolucao.map(e => e.headcount);

    const datasets = [
      {
        type: 'bar',
        label: 'Salário Base & Pró-Labore (R$)',
        data: salBases,
        backgroundColor: '#0284c7',
        borderRadius: 3,
        stack: 'folha',
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'Horas Extras (70%/110%) + DSR (R$)',
        data: horasExtras,
        backgroundColor: '#f59e0b',
        borderRadius: 3,
        stack: 'folha',
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'Vale Alimentação + Comissões & Adicionais (R$)',
        data: valesBenef,
        backgroundColor: '#a855f7',
        borderRadius: 3,
        stack: 'folha',
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: 'Equipe Ativa (Colaboradores)',
        data: headcounts,
        borderColor: '#10b981',
        backgroundColor: '#10b981',
        pointRadius: 5,
        pointHoverRadius: 7,
        borderWidth: 3,
        tension: 0.2,
        yAxisID: 'y1'
      }
    ];

    getOrCreateChart('chart-folha-evolucao', {
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: '#9ca3af' }
          },
          y: {
            stacked: true,
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#9ca3af',
              callback: v => 'R$ ' + (v / 1000).toFixed(0) + 'k'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { display: false },
            ticks: {
              color: '#10b981',
              stepSize: 2,
              callback: v => v + ' colabs'
            }
          }
        },
        plugins: {
          legend: { labels: { color: '#ffffff' } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.yAxisID === 'y1') {
                  return ` ${ctx.dataset.label}: ${ctx.raw} colaboradores`;
                }
                return ` ${ctx.dataset.label}: ${formatBRL(ctx.raw)}`;
              }
            }
          }
        }
      }
    });

    const tbodyFolha = document.getElementById('tbody-folha-mensal');
    if (tbodyFolha) {
      tbodyFolha.innerHTML = evolucao.map(e => {
        const heComDsrMes = (e.hora_extra_total || 0) + (e.dsr_variaveis || 0);
        const qtdH = e.horas_extras_qtd || 0;
        const isSelectedMonth = modoPeriodo === e.ano_mes;
        const rowStyle = isSelectedMonth
          ? 'cursor: pointer; background: rgba(56, 189, 248, 0.14); outline: 1px solid rgba(56, 189, 248, 0.45);'
          : 'cursor: pointer;';
        return `
          <tr onclick="onRhHoleriteFilterChange('${e.ano_mes}')" style="${rowStyle}" title="Clique para filtrar os colaboradores por ${e.label}">
            <td style="font-weight: 700; color: #67e8f9;">📅 ${e.label}</td>
            <td style="font-weight: 600; color: #34d399;"><span class="badge-abc badge-b">${e.headcount} colabs</span></td>
            <td>${formatBRL(e.salario_base_efetivo || 0)}</td>
            <td style="color: #fbbf24; font-weight: 700;">${formatBRL(heComDsrMes)} <small style="color: var(--text-muted); font-weight: 400;">(${Math.round(qtdH)}h)</small></td>
            <td style="color: #34d399;">${formatBRL(e.vale_alimentacao || 0)}</td>
            <td style="color: #38bdf8;">${formatBRL(e.adicionais_total || 0)}</td>
            <td>${formatBRL(e.ferias_total || 0)}</td>
            <td style="color: #fb7185;">${formatBRL(e.vale_adiantamento || 0)}</td>
            <td style="color: #fbbf24;">${formatBRL(e.total_fgts || 0)}</td>
            <td style="font-weight: 800; color: #34d399; text-align: right;">${formatBRL(e.total_custo)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  // 2. Renderizar Tabela de Colaboradores (respeitando o filtro de mês/período selecionado)
  const tbody = document.getElementById('tbody-colaboradores');
  if (tbody && rhData.colaboradores_lista) {
    const isSpecificMonth = modoPeriodo !== 'acumulado' && modoPeriodo !== 'media';
    const mesObjSel = isSpecificMonth ? evolucao.find(e => e.ano_mes === modoPeriodo) : null;
    const mesLabelSel = mesObjSel ? mesObjSel.label : modoPeriodo;

    // Filtrar colaboradores que possuem holerite no período selecionado
    const listaColabs = rhData.colaboradores_lista.filter(c => {
      if (isSpecificMonth) {
        return Boolean(c.historico_mensal && c.historico_mensal[modoPeriodo]);
      }
      if (modoPeriodo === 'media') {
        return c.ativo_atual !== false;
      }
      return true;
    });

    if (srcLabel) {
      if (isSpecificMonth) {
        srcLabel.innerHTML = `Exibindo Holerites de: <strong style="color:#38bdf8;">${mesLabelSel}</strong> • <strong>${listaColabs.length} colaboradores</strong> na folha do mês`;
      } else if (modoPeriodo === 'media') {
        srcLabel.innerHTML = `Exibindo: <strong style="color:#38bdf8;">Média Mensal por Colaborador Ativo</strong> • <strong>${listaColabs.length} colaboradores</strong>`;
      } else {
        const fLbl = evolucao[0]?.label || 'Nov/2025';
        const lLbl = evolucao[evolucao.length - 1]?.label || 'Out/2026';
        srcLabel.innerHTML = `Exibindo: <strong style="color:#38bdf8;">Total Acumulado (${evolucao.length || 12} Meses: ${fLbl} a ${lLbl})</strong> • <strong>${listaColabs.length} colaboradores</strong>`;
      }
    }

    let totSalBase = 0;
    let totHeDsr = 0;
    let totHeHoras = 0;
    let totVa = 0;
    let totAdic = 0;
    let totValeAdiant = 0;
    let totFgts = 0;
    let totCustoFolha = 0;
    const colabMetricsForRank = [];

    const rowsColabHtml = listaColabs.map(c => {
      let salBase = c.salario_base_efetivo_media || c.salario_base || 0;
      let salContratualRank = c.salario_contratual || c.salario_base || salBase;
      let heVal = c.hora_extra_total_media || 0;
      let heHoras = c.horas_extras_qtd_media || 0;
      let dsrVal = c.dsr_variaveis_media || 0;
      let vaVal = c.vale_alimentacao_media || 0;
      let adicVal = c.adicionais_total_media || 0;
      let comisOnlyVal = c.comissoes_media || 0;
      let valeAdiant = c.vale_adiantamento_media || 0;
      let fgtsVal = c.fgts || 0;
      let custoTot = c.custo_mensal || 0;
      let subInfoLabel = `${c.empresa || ''} • ${c.meses_na_base || 11} folhas`;

      if (modoPeriodo === 'acumulado') {
        salBase = c.salario_base_efetivo_acum || (salBase * (c.meses_na_base || 1));
        salContratualRank = c.salario_contratual || c.salario_base || (salBase / (c.meses_na_base || 1));
        heVal = c.hora_extra_total_acum || 0;
        heHoras = c.horas_extras_qtd_acum || 0;
        dsrVal = c.dsr_variaveis_acum || 0;
        vaVal = c.vale_alimentacao_acum || 0;
        adicVal = c.adicionais_total_acum || 0;
        comisOnlyVal = c.comissoes_acum || 0;
        valeAdiant = c.vale_adiantamento_acum || 0;
        fgtsVal = c.fgts_acumulado_periodo || (fgtsVal * (c.meses_na_base || 1));
        custoTot = c.custo_acumulado_periodo || (custoTot * (c.meses_na_base || 1));
      } else if (isSpecificMonth) {
        const mHist = c.historico_mensal ? c.historico_mensal[modoPeriodo] : null;
        if (mHist) {
          salBase = mHist.salario_base || 0;
          salContratualRank = mHist.salario_contratual || mHist.salario_base || c.salario_contratual || 0;
          heVal = mHist.hora_extra_total || 0;
          heHoras = mHist.horas_extras_qtd || 0;
          dsrVal = mHist.dsr_variaveis || 0;
          vaVal = mHist.vale_alimentacao || 0;
          adicVal = mHist.adicionais_total || 0;
          comisOnlyVal = mHist.comissoes || 0;
          valeAdiant = mHist.vale_adiantamento || 0;
          fgtsVal = mHist.fgts || 0;
          custoTot = mHist.custo_mensal || 0;
          subInfoLabel = `${c.empresa || ''} • Folha ${mesLabelSel}`;
        }
      } else {
        subInfoLabel = `${c.empresa || ''} • Média (${c.meses_na_base || 11}m)`;
      }

      const heComDsrColab = heVal + dsrVal;

      totSalBase += salBase;
      totHeDsr += heComDsrColab;
      totHeHoras += heHoras;
      totVa += vaVal;
      totAdic += adicVal;
      totValeAdiant += valeAdiant;
      totFgts += fgtsVal;
      totCustoFolha += custoTot;

      const partesNome = (c.nome || '').trim().split(/\s+/);
      const nomeCurto = partesNome.length > 2
        ? `${partesNome[0]} ${partesNome[partesNome.length - 1]}`
        : (c.nome || '');

      colabMetricsForRank.push({
        nome: c.nome,
        nomeCurto,
        cargo: c.cargo,
        setor: c.setor || '',
        empresa: c.empresa,
        salBase,
        salContratualRank,
        heVal,
        dsrVal,
        heComDsr: heComDsrColab,
        heHoras,
        adicVal,
        comisOnlyVal,
        custoTot
      });

      return `
        <tr>
          <td style="font-weight: 700; color: var(--text-main);">
            ${c.nome}
            <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 400;">${subInfoLabel}</div>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.76rem;">${c.cargo}</div>
            <span class="badge-abc badge-b" style="font-size: 0.65rem;">${c.setor}</span>
          </td>
          <td>${formatBRL(salBase)}</td>
          <td style="color: ${heComDsrColab > 0 ? '#fbbf24' : 'var(--text-muted)'}; font-weight: ${heComDsrColab > 0 ? '700' : '400'};">
            ${formatBRL(heComDsrColab)}
            ${heHoras > 0 ? `<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 400;">${heHoras.toFixed(1)}h extras</div>` : ''}
          </td>
          <td style="color: #34d399; font-weight: 600;">${formatBRL(vaVal)}</td>
          <td style="color: ${adicVal > 0 ? '#38bdf8' : 'var(--text-muted)'}; font-weight: ${adicVal > 0 ? '600' : '400'};">${formatBRL(adicVal)}</td>
          <td style="color: ${valeAdiant > 0 ? '#fb7185' : 'var(--text-muted)'};">${formatBRL(valeAdiant)}</td>
          <td style="color: #fbbf24;">${formatBRL(fgtsVal)}</td>
          <td style="color: #34d399; font-weight: 800; text-align: right;">${formatBRL(custoTot)}</td>
        </tr>
      `;
    }).join('');

    const labelTotalFooter = isSpecificMonth
      ? `TOTAL DA FOLHA (${mesLabelSel.toUpperCase()})`
      : (modoPeriodo === 'media' ? 'SOMA DAS MÉDIAS MENSAIS' : `TOTAL ACUMULADO (${evolucao.length || 12} MESES)`);

    const footerRowHtml = `
      <tr style="background: rgba(16, 185, 129, 0.1); border-top: 2px solid rgba(16, 185, 129, 0.4); font-weight: 800;">
        <td colspan="2" style="font-weight: 800; color: var(--text-main);">${labelTotalFooter} (${listaColabs.length} colabs)</td>
        <td style="font-weight: 800;">${formatBRL(totSalBase)}</td>
        <td style="color: #fbbf24; font-weight: 800;">
          ${formatBRL(totHeDsr)}
          ${totHeHoras > 0 ? `<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">${Math.round(totHeHoras)}h extras</div>` : ''}
        </td>
        <td style="color: #34d399; font-weight: 800;">${formatBRL(totVa)}</td>
        <td style="color: #38bdf8; font-weight: 800;">${formatBRL(totAdic)}</td>
        <td style="color: #fb7185; font-weight: 800;">${formatBRL(totValeAdiant)}</td>
        <td style="color: #fbbf24; font-weight: 800;">${formatBRL(totFgts)}</td>
        <td style="color: #34d399; font-weight: 900; text-align: right;">${formatBRL(totCustoFolha)}</td>
      </tr>
    `;

    tbody.innerHTML = rowsColabHtml + footerRowHtml;

    // 2.5 Renderizar Organograma Corporativo & Industrial sincronizado com o filtro
    const orgPeriodLabel = isSpecificMonth
      ? `Folha ${mesLabelSel}`
      : (modoPeriodo === 'media' ? 'Média Mensal por Colaborador' : `Total Acumulado (${evolucao.length || 12} Meses)`);
    renderOrganogramaRH(colabMetricsForRank, orgPeriodLabel);

    // 3. Renderizar os 3 Gráficos de Barras de Ranking Individual (Horas Extras, Maiores Salários Base, Maiores Comissões)
    const rankSubEl = document.getElementById('rh-ranking-subtitle');
    if (rankSubEl) {
      if (isSpecificMonth) {
        rankSubEl.innerHTML = `Exibindo Rankings Individuais de: <strong style="color:#fbbf24;">${mesLabelSel}</strong>`;
      } else if (modoPeriodo === 'media') {
        rankSubEl.innerHTML = `Exibindo Rankings Individuais por: <strong style="color:#fbbf24;">Média Mensal por Colaborador</strong>`;
      } else {
        const fLbl = evolucao[0]?.label || 'Nov/2025';
        const lLbl = evolucao[evolucao.length - 1]?.label || 'Out/2026';
        rankSubEl.innerHTML = `Exibindo Rankings Individuais por: <strong style="color:#fbbf24;">Total Acumulado (${evolucao.length || 12} Meses: ${fLbl} a ${lLbl})</strong>`;
      }
    }

    // 3.1 Ranking de Horas Extras + DSR (Top 10)
    const topHeList = colabMetricsForRank
      .filter(x => x.heComDsr > 0 || x.heHoras > 0)
      .sort((a, b) => b.heComDsr - a.heComDsr)
      .slice(0, 10);

    getOrCreateChart('chart-rh-rank-he', {
      type: 'bar',
      data: {
        labels: topHeList.map(x => `${x.nomeCurto} (${Math.round(x.heHoras)}h)`),
        datasets: [{
          label: 'Horas Extras + DSR (R$)',
          data: topHeList.map(x => Number(x.heComDsr.toFixed(2))),
          backgroundColor: 'rgba(245, 158, 11, 0.85)',
          borderColor: '#f59e0b',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                const item = topHeList[idx];
                return item ? `${item.nome} (${item.cargo})` : '';
              },
              label: (ctx) => {
                const item = topHeList[ctx.dataIndex];
                if (!item) return formatBRL(ctx.raw);
                return ` Total HE + DSR: ${formatBRL(item.heComDsr)} (${item.heHoras.toFixed(1)}h extras)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#9ca3af',
              font: { size: 10 },
              callback: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#f3f4f6', font: { size: 11, weight: '600' } }
          }
        }
      }
    });

    // 3.2 Ranking de Maiores Salários Base (Top 10)
    const topSalList = colabMetricsForRank
      .map(x => ({
        ...x,
        salDisplay: modoPeriodo === 'acumulado' ? x.salBase : (x.salContratualRank || x.salBase)
      }))
      .filter(x => x.salDisplay > 0)
      .sort((a, b) => b.salDisplay - a.salDisplay)
      .slice(0, 10);

    getOrCreateChart('chart-rh-rank-salario', {
      type: 'bar',
      data: {
        labels: topSalList.map(x => x.nomeCurto),
        datasets: [{
          label: 'Salário Base (R$)',
          data: topSalList.map(x => Number(x.salDisplay.toFixed(2))),
          backgroundColor: 'rgba(56, 189, 248, 0.85)',
          borderColor: '#0284c7',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                const item = topSalList[idx];
                return item ? `${item.nome} (${item.cargo})` : '';
              },
              label: (ctx) => ` Salário Base: ${formatBRL(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#9ca3af',
              font: { size: 10 },
              callback: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#f3f4f6', font: { size: 11, weight: '600' } }
          }
        }
      }
    });

    // 3.3 Ranking de Maiores Comissões (Rubrica 023 - Comissões de Vendas / E-commerce)
    const topComisList = colabMetricsForRank
      .filter(x => x.comisOnlyVal > 0)
      .sort((a, b) => b.comisOnlyVal - a.comisOnlyVal)
      .slice(0, 10);

    getOrCreateChart('chart-rh-rank-comissoes', {
      type: 'bar',
      data: {
        labels: topComisList.length > 0 ? topComisList.map(x => x.nomeCurto) : ['Sem comissões no mês'],
        datasets: [{
          label: 'Comissões Pagas - Cód. 023 (R$)',
          data: topComisList.length > 0 ? topComisList.map(x => Number(x.comisOnlyVal.toFixed(2))) : [0],
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 5
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                const item = topComisList[idx];
                return item ? `${item.nome} (${item.cargo})` : '';
              },
              label: (ctx) => ` Comissões (Cód. 023): ${formatBRL(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#9ca3af',
              font: { size: 10 },
              callback: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#f3f4f6', font: { size: 11, weight: '600' } }
          }
        }
      }
    });
  }

  const simCountInput = document.getElementById('sim-colab-count');
  const simCostInput = document.getElementById('sim-colab-cost');
  if (simCountInput && simCostInput) {
    simCountInput.value = rhData.total_colaboradores;
    simCostInput.value = Math.round(rhData.custo_medio_colaborador || (rhData.total_colaboradores > 0 ? rhData.custo_folha_mensal / rhData.total_colaboradores : 3900));
  }

  runColabSimulation();
}

// =========================================================================
// ORGANOGRAMA CORPORATIVO & INDUSTRIAL (METALÚRGICA BRILHO & MODERNA)
// =========================================================================
let stateShowOrgValues = true;
let lastOrgColabList = [];
let lastOrgPeriodLabel = '';

function openOrganogramaSection() {
  switchTab('tab-colaboradores');
  setTimeout(() => {
    const el = document.getElementById('rh-organograma-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 120);
}

function toggleOrgChartValues() {
  stateShowOrgValues = !stateShowOrgValues;
  const btn = document.getElementById('btn-toggle-org-valores');
  if (btn) {
    btn.innerHTML = stateShowOrgValues
      ? '👁️ Ocultar Valores no Organograma'
      : '🔒 Exibir Valores no Organograma';
  }
  renderOrganogramaRH(lastOrgColabList, lastOrgPeriodLabel);
}

window.openOrganogramaSection = openOrganogramaSection;
window.toggleOrgChartValues = toggleOrgChartValues;

function renderOrganogramaRH(colabList, periodoLbl) {
  lastOrgColabList = colabList || [];
  lastOrgPeriodLabel = periodoLbl || '';

  const treeContainer = document.getElementById('org-tree-container');
  const summaryStrip = document.getElementById('org-summary-strip');
  const subtitleEl = document.getElementById('org-subtitle-info');
  if (!treeContainer) return;

  const list = [...(colabList || [])];
  const totalCustoGeral = list.reduce((acc, c) => acc + (Number(c.custoTot) || 0), 0) || 1;

  if (subtitleEl) {
    subtitleEl.innerHTML = `Estrutura Hierárquica Ativa • Base: <strong style="color:#0284c7;">${periodoLbl}</strong> • <strong>${list.length} colaboradores</strong>`;
  }

  // Classificação hierárquica por cargo e setor
  const isDiretoria = c => (c.setor || '').includes('Diretoria') || (c.cargo || '').includes('Diretor');
  const isAdminFin = c => (c.setor || '').includes('Administra') || (c.setor || '').includes('Finan') || (c.cargo || '').includes('Financeiro') || (c.cargo || '').includes('Escritório');
  const isComercial = c => (c.setor || '').includes('Comercial') || (c.setor || '').includes('Vendas') || (c.setor || '').includes('Marketing') || (c.setor || '').includes('E-commerce');
  const isEngSuporte = c => (c.setor || '').includes('Engenharia') || (c.setor || '').includes('Qualidade') || (c.setor || '').includes('Manuten') || (c.setor || '').includes('Estoque');

  const diretoriaList = list.filter(isDiretoria);
  const adminList = list.filter(c => !isDiretoria(c) && isAdminFin(c));
  const comercialList = list.filter(c => !isDiretoria(c) && !isAdminFin(c) && isComercial(c));
  const suporteList = list.filter(c => !isDiretoria(c) && !isAdminFin(c) && !isComercial(c) && isEngSuporte(c));
  const producaoList = list.filter(c => !isDiretoria(c) && !isAdminFin(c) && !isComercial(c) && !isEngSuporte(c));

  const sumCusto = arr => arr.reduce((s, x) => s + (Number(x.custoTot) || 0), 0);

  // Renderizar faixa de resumo por área
  if (summaryStrip) {
    const areasResumo = [
      { titulo: '🏛️ Diretoria & Adm./Finanças', qtd: diretoriaList.length + adminList.length, custo: sumCusto(diretoriaList) + sumCusto(adminList), cor: '#0284c7', bg: 'rgba(2, 132, 199, 0.08)', border: 'rgba(2, 132, 199, 0.3)' },
      { titulo: '📈 Comercial, Vendas & Mkt', qtd: comercialList.length, custo: sumCusto(comercialList), cor: '#059669', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)' },
      { titulo: '🔧 Eng., Qualidade, Manut. & Est.', qtd: suporteList.length, custo: sumCusto(suporteList), cor: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)', border: 'rgba(124, 58, 237, 0.3)' },
      { titulo: '🏭 Produção & Galvanoplastia', qtd: producaoList.length, custo: sumCusto(producaoList), cor: '#d97706', bg: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.3)' }
    ];

    summaryStrip.innerHTML = areasResumo.map(a => {
      const pct = ((a.custo / totalCustoGeral) * 100).toFixed(1);
      return `
        <div style="background: ${a.bg}; border: 1px solid ${a.border}; border-left: 4px solid ${a.cor}; border-radius: 10px; padding: 12px 14px;">
          <div style="font-size: 0.76rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">${a.titulo}</div>
          <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 6px;">
            <strong style="font-size: 1.25rem; color: var(--text-main); font-weight: 800;">${a.qtd} <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted);">colabs</span></strong>
            ${stateShowOrgValues ? `<span style="font-size: 0.84rem; font-weight: 700; color: ${a.cor};">${formatBRL(a.custo)} <small style="color: var(--text-muted);">(${pct}%)</small></span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Helper para renderizar card individual de colaborador no Organograma
  const renderPersonCard = (c, isLeader = false, accentColor = '#0284c7') => {
    const isMod = (c.empresa || '').toLowerCase().includes('moderna') || (c.empresa || '').toLowerCase().includes('empresa 2');
    const empBadgeBg = isMod ? 'rgba(16, 185, 129, 0.14)' : 'rgba(2, 132, 199, 0.14)';
    const empBadgeColor = isMod ? '#059669' : '#0284c7';
    const empShort = isMod ? 'Empresa 2' : 'Empresa 1';
    const parts = (c.nome || '').trim().split(/\s+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (c.nome || 'C').substring(0, 2).toUpperCase();

    return `
      <div style="background: var(--bg-card); border: ${isLeader ? `2px solid ${accentColor}` : '1px solid var(--border-color)'}; border-left: 4px solid ${accentColor}; border-radius: 8px; padding: 9px 11px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: transform 0.15s;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: ${accentColor}; color: #ffffff; font-size: 0.72rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${initials}
            </div>
            <div style="min-width: 0;">
              <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c.nome}">
                ${isLeader ? '⭐ ' : ''}${c.nome}
              </div>
              <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted);">
                ${c.cargo}
              </div>
            </div>
          </div>
          <span style="background: ${empBadgeBg}; color: ${empBadgeColor}; border: 1px solid ${empBadgeColor}40; font-size: 0.65rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">
            ${empShort}
          </span>
        </div>
        ${stateShowOrgValues ? `
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; margin-top: 7px; padding-top: 6px; border-top: 1px dashed var(--border-color); font-size: 0.71rem;">
            <span style="color: var(--text-muted);">Base: <strong style="color: var(--text-main);">${formatBRL(c.salBase)}</strong></span>
            ${c.heComDsr > 0 ? `<span style="color: #d97706; font-weight: 700;">⏱️ HE: ${formatBRL(c.heComDsr)}</span>` : ''}
            ${c.comisOnlyVal > 0 ? `<span style="color: #0284c7; font-weight: 700;">🏆 Comis: ${formatBRL(c.comisOnlyVal)}</span>` : ''}
            <span style="color: #059669; font-weight: 800; margin-left: auto;">Custo: ${formatBRL(c.custoTot)}</span>
          </div>
        ` : ''}
      </div>
    `;
  };

  // Separar líderes e equipes dentro de cada pilar
  const adminLeaders = adminList.filter(c => (c.cargo || '').toLowerCase().includes('gerente'));
  const adminTeam = adminList.filter(c => !(c.cargo || '').toLowerCase().includes('gerente')).sort((a, b) => a.nome.localeCompare(b.nome));

  const comLeaders = comercialList.filter(c => (c.cargo || '').toLowerCase().includes('gerente') || (c.cargo || '').toLowerCase().includes('gestor'));
  const comTeam = comercialList.filter(c => !((c.cargo || '').toLowerCase().includes('gerente') || (c.cargo || '').toLowerCase().includes('gestor'))).sort((a, b) => a.nome.localeCompare(b.nome));

  const prodLeaders = producaoList.filter(c => (c.cargo || '').toLowerCase().includes('líder') || (c.cargo || '').toLowerCase().includes('lider'));
  const prodGalvanica = producaoList.filter(c => !prodLeaders.includes(c) && ((c.setor || '').toLowerCase().includes('galv') || (c.cargo || '').toLowerCase().includes('galv'))).sort((a, b) => a.nome.localeCompare(b.nome));
  const prodFabrilMB = producaoList.filter(c => !prodLeaders.includes(c) && !prodGalvanica.includes(c) && !((c.empresa || '').toLowerCase().includes('moderna') || (c.empresa || '').toLowerCase().includes('empresa 2'))).sort((a, b) => a.nome.localeCompare(b.nome));
  const prodFabrilMod = producaoList.filter(c => !prodLeaders.includes(c) && !prodGalvanica.includes(c) && ((c.empresa || '').toLowerCase().includes('moderna') || (c.empresa || '').toLowerCase().includes('empresa 2'))).sort((a, b) => a.nome.localeCompare(b.nome));

  const dirObj = diretoriaList[0] || {
    nome: 'Marcelo Marques de Oliveira',
    cargo: 'Diretor Geral',
    empresa: 'Empresa 1 & Empresa 2',
    salBase: 2500,
    custoTot: 2500,
    heComDsr: 0,
    comisOnlyVal: 0
  };

  treeContainer.innerHTML = `
    <!-- NÍVEL 1: DIRETORIA EXECUTIVA (TOPO CENTRAL) -->
    <div style="display: flex; flex-direction: column; align-items: center;">
      <div style="width: 100%; max-width: 390px; background: linear-gradient(135deg, rgba(2, 132, 199, 0.12), rgba(16, 185, 129, 0.12)); border: 2px solid #0284c7; border-radius: 12px; padding: 14px 18px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.12); text-align: center;">
        <div style="font-size: 0.7rem; font-weight: 800; color: #0284c7; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px;">
          👑 CONSELHO &amp; DIRETORIA EXECUTIVA
        </div>
        <div style="font-size: 1.02rem; font-weight: 800; color: var(--text-main);">
          ${dirObj.nome}
        </div>
        <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-top: 2px;">
          ${dirObj.cargo} • Grupo Empresa 1 &amp; Empresa 2
        </div>
        ${stateShowOrgValues && diretoriaList.length > 0 ? `
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(2, 132, 199, 0.35); font-size: 0.75rem; display: flex; justify-content: center; gap: 14px;">
            <span style="color: var(--text-muted);">Pró-Labore: <strong style="color: var(--text-main);">${formatBRL(dirObj.salBase)}</strong></span>
            <span style="color: #059669; font-weight: 800;">Custo Folha: ${formatBRL(dirObj.custoTot)}</span>
          </div>
        ` : ''}
      </div>

      <!-- Haste Vertical de Conexão -->
      <div style="width: 3px; height: 22px; background: #0284c7;"></div>
      <!-- Barra Horizontal de Distribuição -->
      <div style="width: 86%; height: 3px; background: linear-gradient(90deg, #0284c7, #059669, #7c3aed, #d97706); border-radius: 3px;"></div>
    </div>

    <!-- NÍVEL 2 E 3: OS 4 PILARES DEPARTAMENTAIS -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(275px, 1fr)); gap: 16px; margin-top: 12px; align-items: start;">

      <!-- PILAR 1: ADMINISTRAÇÃO & FINANÇAS -->
      <div style="background: var(--bg-card-alt); border: 1px solid var(--border-color); border-top: 4px solid #0284c7; border-radius: 10px; padding: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
          <div>
            <div style="font-size: 0.84rem; font-weight: 800; color: #0284c7;">🏛️ ADM., FINANÇAS &amp; ESCRITÓRIO</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">Controladoria, Faturamento &amp; Apoio</div>
          </div>
          <span style="background: rgba(2, 132, 199, 0.14); color: #0284c7; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 999px;">
            ${adminList.length}
          </span>
        </div>

        ${adminLeaders.length > 0 ? `
          <div style="font-size: 0.68rem; font-weight: 800; color: #0284c7; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.04em;">
            ▾ Gerência Financeira
          </div>
          ${adminLeaders.map(c => renderPersonCard(c, true, '#0284c7')).join('')}
        ` : ''}

        <div style="font-size: 0.68rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin: 10px 0 6px; letter-spacing: 0.04em;">
          ▾ Equipe Administrativa (${adminTeam.length})
        </div>
        ${adminTeam.length > 0 ? adminTeam.map(c => renderPersonCard(c, false, '#0284c7')).join('') : '<div style="font-size:0.75rem; color:var(--text-muted); padding:8px;">Nenhum colaborador no filtro atual.</div>'}
      </div>

      <!-- PILAR 2: COMERCIAL, VENDAS, E-COMMERCE & MARKETING -->
      <div style="background: var(--bg-card-alt); border: 1px solid var(--border-color); border-top: 4px solid #059669; border-radius: 10px; padding: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
          <div>
            <div style="font-size: 0.84rem; font-weight: 800; color: #059669;">📈 COMERCIAL, E-COMMERCE &amp; MKT</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">Vendas B2B, Canais Digitais &amp; Mídias</div>
          </div>
          <span style="background: rgba(16, 185, 129, 0.14); color: #059669; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 999px;">
            ${comercialList.length}
          </span>
        </div>

        ${comLeaders.length > 0 ? `
          <div style="font-size: 0.68rem; font-weight: 800; color: #059669; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.04em;">
            ▾ Liderança Comercial
          </div>
          ${comLeaders.map(c => renderPersonCard(c, true, '#059669')).join('')}
        ` : ''}

        <div style="font-size: 0.68rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin: 10px 0 6px; letter-spacing: 0.04em;">
          ▾ E-commerce, Vendas &amp; Mídias (${comTeam.length})
        </div>
        ${comTeam.length > 0 ? comTeam.map(c => renderPersonCard(c, false, '#059669')).join('') : '<div style="font-size:0.75rem; color:var(--text-muted); padding:8px;">Nenhum colaborador no filtro atual.</div>'}
      </div>

      <!-- PILAR 3: ENGENHARIA, QUALIDADE, MANUTENÇÃO & LOGÍSTICA -->
      <div style="background: var(--bg-card-alt); border: 1px solid var(--border-color); border-top: 4px solid #7c3aed; border-radius: 10px; padding: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
          <div>
            <div style="font-size: 0.84rem; font-weight: 800; color: #7c3aed;">🔧 ENGENHARIA, QUALIDADE &amp; SUPORTE</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">Automação, Inspeção, Manut. &amp; Estoque</div>
          </div>
          <span style="background: rgba(124, 58, 237, 0.14); color: #7c3aed; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 999px;">
            ${suporteList.length}
          </span>
        </div>

        <div style="font-size: 0.68rem; font-weight: 800; color: #7c3aed; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.04em;">
          ▾ Especialistas Técnicos &amp; Logística
        </div>
        ${suporteList.length > 0 ? suporteList.map(c => renderPersonCard(c, false, '#7c3aed')).join('') : '<div style="font-size:0.75rem; color:var(--text-muted); padding:8px;">Nenhum colaborador no filtro atual.</div>'}
      </div>

      <!-- PILAR 4: OPERAÇÕES INDUSTRIAIS, PRODUÇÃO & GALVANOPLASTIA -->
      <div style="background: var(--bg-card-alt); border: 1px solid var(--border-color); border-top: 4px solid #d97706; border-radius: 10px; padding: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color);">
          <div>
            <div style="font-size: 0.84rem; font-weight: 800; color: #d97706;">🏭 PRODUÇÃO &amp; GALVANOPLASTIA</div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">Manufatura de Pontas, Lixas &amp; Abrasivos</div>
          </div>
          <span style="background: rgba(217, 119, 6, 0.14); color: #d97706; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 999px;">
            ${producaoList.length}
          </span>
        </div>

        ${prodLeaders.length > 0 ? `
          <div style="font-size: 0.68rem; font-weight: 800; color: #d97706; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.04em;">
            ▾ Liderança de Produção Fabril
          </div>
          ${prodLeaders.map(c => renderPersonCard(c, true, '#d97706')).join('')}
        ` : ''}

        ${prodGalvanica.length > 0 ? `
          <div style="font-size: 0.68rem; font-weight: 800; color: #0284c7; text-transform: uppercase; margin: 10px 0 6px; letter-spacing: 0.04em;">
            ▾ Diamantação &amp; Galvanoplastia (${prodGalvanica.length})
          </div>
          ${prodGalvanica.map(c => renderPersonCard(c, false, '#0284c7')).join('')}
        ` : ''}

        ${prodFabrilMB.length > 0 ? `
          <div style="font-size: 0.68rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin: 10px 0 6px; letter-spacing: 0.04em;">
            ▾ Produção Empresa 1 (${prodFabrilMB.length})
          </div>
          ${prodFabrilMB.map(c => renderPersonCard(c, false, '#d97706')).join('')}
        ` : ''}

        ${prodFabrilMod.length > 0 ? `
          <div style="font-size: 0.68rem; font-weight: 800; color: #059669; text-transform: uppercase; margin: 10px 0 6px; letter-spacing: 0.04em;">
            ▾ Produção Empresa 2 (${prodFabrilMod.length})
          </div>
          ${prodFabrilMod.map(c => renderPersonCard(c, false, '#059669')).join('')}
        ` : ''}
      </div>

    </div>
  `;
}

// Simulador de Capacidade de Mão de Obra
function runColabSimulation() {
  const currentEmp = window.DASHBOARD_DATA?.empresas[state.currentCompany];
  const rhData = currentEmp?.produtividade_rh || window.DASHBOARD_DATA?.produtividade_rh;
  
  const headCount = parseInt(document.getElementById('sim-colab-count')?.value) || (rhData?.total_colaboradores || 28);
  const costPerHead = parseFloat(document.getElementById('sim-colab-cost')?.value) || (rhData?.custo_medio_colaborador || 3911);

  const lbl = document.getElementById('sim-colab-count-label');
  if (lbl) lbl.innerText = `${headCount} Colaboradores`;

  const totalFolhaMes = headCount * costPerHead;
  // Receita média mensal da empresa ativa
  const fatTotalAnual = currentEmp?.resumo_executivo?.total_faturamento || 36304321;
  const anosQtd = currentEmp?.resumo_executivo?.anos?.length || 7;
  const fatMedioMes = (fatTotalAnual / anosQtd) / 12;

  const fatPerCapita = headCount > 0 ? fatMedioMes / headCount : 0;
  const margemPerCapita = fatPerCapita - costPerHead;
  const roi = (totalFolhaMes > 0 ? fatMedioMes / totalFolhaMes : 0).toFixed(2);
  const indFolha = (fatMedioMes > 0 ? ((totalFolhaMes * 13.33) / (fatMedioMes * 12) * 100) : 0).toFixed(1);

  const resContainer = document.getElementById('sim-colab-results');
  if (!resContainer) return;

  resContainer.innerHTML = `
    <div>
      <div style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase;">Custo Total da Folha / Mês</div>
      <div style="font-size: 1.25rem; font-weight: 700; color: #fbbf24;">${formatBRL(totalFolhaMes)}</div>
      <div style="font-size: 0.78rem; color: var(--text-muted);">Índice s/ Receita: ${indFolha}%</div>
    </div>

    <div>
      <div style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase;">Faturamento per Capita</div>
      <div style="font-size: 1.25rem; font-weight: 700; color: #67e8f9;">${formatBRL(fatPerCapita)}</div>
      <div style="font-size: 0.78rem; color: var(--text-muted);">Por colaborador/mês</div>
    </div>

    <div>
      <div style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase;">Margem Líquida per Capita</div>
      <div style="font-size: 1.25rem; font-weight: 700; color: #34d399;">+${formatBRL(margemPerCapita)}</div>
      <div style="font-size: 0.78rem; color: var(--text-muted);">Lucro livre gerado por operador</div>
    </div>

    <div>
      <div style="font-size: 0.76rem; color: var(--text-dim); text-transform: uppercase;">Retorno Múltiplo (ROI)</div>
      <div style="font-size: 1.25rem; font-weight: 700; color: #a855f7;">${roi}x</div>
      <div style="font-size: 0.78rem; color: var(--text-muted);">R$ gerados p/ cada R$ 1 em folha</div>
    </div>
  `;
}

// Renderizar Backlog Fabril e Pedidos Pendentes
function renderBacklog(backlogData) {
  if (!backlogData) return;

  document.getElementById('stat-backlog-valor').innerText = formatBRL(backlogData.total_valor_pendente);
  document.getElementById('stat-backlog-qtd').innerText = `${backlogData.quantidade_pedidos_pendentes} ordens`;

  const tbody = document.getElementById('tbody-backlog');
  if (tbody && backlogData.lista_pendencias) {
    tbody.innerHTML = backlogData.lista_pendencias.map(p => `
      <tr>
        <td>${p.data || 'N/A'}</td>
        <td style="color: #fbbf24; font-weight: 600;">${p.data_limite || 'A Definir'}</td>
        <td style="font-weight: 600; color: var(--text-main);">${p.cliente}</td>
        <td style="color: #67e8f9; font-weight: 700;">${formatBRL(p.valor)}</td>
        <td><span class="tag-rec tag-warning">⏳ ${p.status}</span></td>
      </tr>
    `).join('');
  }
}

// Renderizar Top Clientes
function renderTopClientes(empresaData, periodData) {
  const tbody = document.getElementById('tbody-top-clientes');
  if (!tbody) return;

  const clientesList = (periodData && periodData.top_clientes && periodData.top_clientes.length > 0)
    ? periodData.top_clientes
    : (empresaData.top_clientes || []);

  if (clientesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-dim);">Nenhum cliente registrado para os filtros selecionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = clientesList.slice(0, 15).map(c => `
    <tr>
      <td style="font-weight: 600; color: var(--text-main);">${c.cliente}</td>
      <td><span class="badge-abc badge-b">${c.cidade || ''} - ${c.uf || ''}</span></td>
      <td style="color: #67e8f9; font-weight: 700;">${formatBRL(c.faturamento)}</td>
      <td>${formatNumber(c.quantidade)}</td>
      <td>${formatNumber(c.pedidos)}</td>
      <td>${formatBRL(c.ticket_medio)}</td>
      <td><span style="color: #34d399; font-weight: 600;">${c.pct}%</span></td>
      <td style="font-size: 0.78rem; color: var(--text-dim);">${c.ultima_compra || '-'}</td>
    </tr>
  `).join('');
}

// Renderizar Lista de Arquivos Processados
function renderGuiaFiles(data) {
  const container = document.getElementById('lista-arquivos-processados');
  if (!container || !data.arquivos_processados) return;

  container.innerHTML = data.arquivos_processados.map(f => `
    <div style="background: var(--bg-card-alt); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 14px; font-size: 0.82rem; display: flex; align-items: center; gap: 8px;">
      <span>📄</span>
      <span style="color: var(--text-main); font-weight: 500;">${f}</span>
    </div>
  `).join('');
}

// Exportar Resumo para CSV
function exportDataCSV() {
  const data = window.DASHBOARD_DATA;
  if (!data) return;

  const prods = data.empresas[state.currentCompany].produtos_estrategia;
  let csv = 'Nome;Categoria;Curva_ABC;Faturamento;Quantidade;Preco_Medio;Recomendacao_Fabril;Lote_Sugerido\n';

  prods.forEach(p => {
    csv += `"${p.nome.replace(/"/g, '""')}";"${p.categoria}";"${p.curva_abc}";${p.faturamento};${p.quantidade};${p.preco_medio};"${p.recomendacao}";"${p.lote}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `Empresa_1_2_${state.currentCompany}_Analise_Industrial.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================================================================
// MÓDULO DE CHURN E CLIENTES INATIVOS (COM ANÁLISE MANUAL / RETIRADA)
// =========================================================================
const CHURN_EXCLUDED_STORAGE_KEY = 'mb_churn_excluidos_manual_v1';

function getExcludedChurnSet() {
  try {
    const raw = localStorage.getItem(CHURN_EXCLUDED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch (e) {
    return new Set();
  }
}

function saveExcludedChurnSet(excludedSet) {
  try {
    localStorage.setItem(CHURN_EXCLUDED_STORAGE_KEY, JSON.stringify(Array.from(excludedSet)));
  } catch (e) {
    console.warn('Não foi possível salvar exclusões manuais no localStorage:', e);
  }
}

function removeChurnClient(encodedName) {
  const clientName = decodeURIComponent(encodedName);
  const excluded = getExcludedChurnSet();
  excluded.add(clientName);
  saveExcludedChurnSet(excluded);
  const data = window.DASHBOARD_DATA;
  if (data && data.empresas[state.currentCompany]) {
    renderChurnAnalysis(data.empresas[state.currentCompany]);
  }
}

function restoreChurnClient(encodedName) {
  const clientName = decodeURIComponent(encodedName);
  const excluded = getExcludedChurnSet();
  excluded.delete(clientName);
  saveExcludedChurnSet(excluded);
  const data = window.DASHBOARD_DATA;
  if (data && data.empresas[state.currentCompany]) {
    renderChurnAnalysis(data.empresas[state.currentCompany]);
  }
}

function restoreAllChurnClients() {
  saveExcludedChurnSet(new Set());
  const drawer = document.getElementById('churn-excluded-drawer');
  if (drawer) drawer.style.display = 'none';
  const data = window.DASHBOARD_DATA;
  if (data && data.empresas[state.currentCompany]) {
    renderChurnAnalysis(data.empresas[state.currentCompany]);
  }
}

function toggleExcludedChurnDrawer() {
  const drawer = document.getElementById('churn-excluded-drawer');
  if (!drawer) return;
  drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
}

window.removeChurnClient = removeChurnClient;
window.restoreChurnClient = restoreChurnClient;
window.restoreAllChurnClients = restoreAllChurnClients;
window.toggleExcludedChurnDrawer = toggleExcludedChurnDrawer;

function updateExcludedChurnUI(allInativos) {
  const excluded = getExcludedChurnSet();
  const bar = document.getElementById('churn-manual-exclusion-bar');
  const drawer = document.getElementById('churn-excluded-drawer');
  const summaryEl = document.getElementById('churn-excluded-summary');
  const listEl = document.getElementById('churn-excluded-list');
  if (!bar) return;

  const removedItems = (allInativos || []).filter(c => excluded.has(c.cliente));
  if (removedItems.length === 0) {
    bar.style.display = 'none';
    if (drawer) drawer.style.display = 'none';
    return;
  }

  const totalFatRemovido = removedItems.reduce((acc, c) => acc + (Number(c.faturamento) || 0), 0);
  bar.style.display = 'flex';
  if (summaryEl) {
    summaryEl.innerHTML = `<strong>${removedItems.length} ${removedItems.length === 1 ? 'cliente retirado' : 'clientes retirados'}</strong> manualmente da análise (<strong style="color: #f43f5e;">${formatBRL(totalFatRemovido)}</strong> desconsiderados)`;
  }

  if (listEl) {
    listEl.innerHTML = removedItems.map(c => {
      const enc = encodeURIComponent(c.cliente);
      return `
        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 5px 10px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border-color); font-size: 0.78rem;">
          <span style="font-weight: 600; color: var(--text-main);">${c.cliente}</span>
          <span style="color: #f43f5e; font-weight: 700;">${formatBRL(c.faturamento)}</span>
          <button type="button" onclick="restoreChurnClient('${enc}')" title="Devolver este cliente para a análise" style="background: rgba(16, 185, 129, 0.14); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 4px; padding: 2px 7px; font-size: 0.74rem; font-weight: 700; cursor: pointer;">
            ↺ Restaurar
          </button>
        </div>
      `;
    }).join('');
  }
}

function renderChurnAnalysis(empresaData) {
  const ch = empresaData.analise_churn;
  if (!ch) return;

  const excluded = getExcludedChurnSet();
  const rawList = ch.lista_inativos || [];
  updateExcludedChurnUI(rawList);

  const activeList = rawList.filter(c => !excluded.has(c.cliente));

  const inativosCount = activeList.length;
  const fatInativo = activeList.reduce((acc, c) => acc + (Number(c.faturamento) || 0), 0);
  const vipCount = activeList.filter(c => (Number(c.faturamento) || 0) >= 50000 || c.prioridade === 'URGENTE').length;
  const potenciaRecup = fatInativo * 0.25;

  const ate270 = activeList.filter(c => c.dias_sem_comprar <= 270).length;
  const de271a540 = activeList.filter(c => c.dias_sem_comprar > 270 && c.dias_sem_comprar <= 540).length;
  const mais540 = activeList.filter(c => c.dias_sem_comprar > 540).length;

  if (document.getElementById('kpi-churn-inativos')) document.getElementById('kpi-churn-inativos').innerText = formatNumber(inativosCount);
  if (document.getElementById('badge-churn-count')) document.getElementById('badge-churn-count').innerText = formatNumber(inativosCount);
  if (document.getElementById('kpi-churn-faturamento')) document.getElementById('kpi-churn-faturamento').innerText = formatBRL(fatInativo);
  if (document.getElementById('kpi-churn-vip')) document.getElementById('kpi-churn-vip').innerText = `${vipCount} clientes`;
  if (document.getElementById('kpi-churn-recentes')) document.getElementById('kpi-churn-recentes').innerText = `${ate270} clientes`;
  if (document.getElementById('kpi-churn-recuperavel')) document.getElementById('kpi-churn-recuperavel').innerText = formatBRL(potenciaRecup);
  if (document.getElementById('stat-churn-vip-count')) document.getElementById('stat-churn-vip-count').innerText = `${vipCount}`;
  if (document.getElementById('stat-churn-potencial')) document.getElementById('stat-churn-potencial').innerText = formatBRL(potenciaRecup);

  // Gráfico 1: Churn por Tempo Sem Comprar
  getOrCreateChart('chart-churn-tempo', {
    type: 'doughnut',
    data: {
      labels: ['4 a 9 meses (Recentes)', '9 a 18 meses (Médio Prazo)', 'Mais de 18 meses (Longo Prazo)'],
      datasets: [{
        data: [ate270, de271a540, mais540],
        backgroundColor: ['#f59e0b', '#f43f5e', '#64748b'],
        borderWidth: 2,
        borderColor: '#162032'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#e5e7eb', font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatNumber(ctx.raw)} clientes`
          }
        }
      }
    }
  });

  // Gráfico 2: Top 10 Clientes Perdidos de Maior Faturamento (já sem os retirados manualmente)
  const top10Inativos = activeList.slice(0, 10);
  getOrCreateChart('chart-top-churn', {
    type: 'bar',
    data: {
      labels: top10Inativos.map(c => c.cliente.length > 22 ? c.cliente.substring(0, 22) + '...' : c.cliente),
      datasets: [{
        label: 'Faturamento Histórico (R$)',
        data: top10Inativos.map(c => c.faturamento),
        backgroundColor: '#f43f5e',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Faturamento Histórico: ${formatBRL(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#9ca3af',
            callback: (v) => 'R$ ' + (v / 1000).toFixed(0) + 'k'
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#1e293b', font: { size: 11, weight: '600' } }
        }
      }
    }
  });

  renderChurnTable();
}

function renderChurnTable() {
  const data = window.DASHBOARD_DATA;
  if (!data) return;

  const excluded = getExcludedChurnSet();
  const currentEmpresaData = data.empresas[state.currentCompany];
  const allInativos = currentEmpresaData?.analise_churn?.lista_inativos || [];
  updateExcludedChurnUI(allInativos);

  let inativos = allInativos.filter(c => !excluded.has(c.cliente));

  const search = (document.getElementById('search-churn')?.value || '').toLowerCase().trim();
  const filterPrio = document.getElementById('filter-churn-prioridade')?.value || 'todos';
  const filterTempo = document.getElementById('filter-churn-tempo')?.value || 'todos';

  if (search) {
    inativos = inativos.filter(c => c.cliente.toLowerCase().includes(search) || c.cidade.toLowerCase().includes(search));
  }
  if (filterPrio !== 'todos') {
    inativos = inativos.filter(c => c.prioridade === filterPrio);
  }
  if (filterTempo === 'recente') {
    inativos = inativos.filter(c => c.dias_sem_comprar <= 270);
  } else if (filterTempo === 'medio') {
    inativos = inativos.filter(c => c.dias_sem_comprar > 270 && c.dias_sem_comprar <= 540);
  } else if (filterTempo === 'longo') {
    inativos = inativos.filter(c => c.dias_sem_comprar > 540);
  }
  if (state.filters.uf && state.filters.uf !== 'todos') {
    inativos = inativos.filter(c => c.uf === state.filters.uf);
  }

  const total = inativos.length;
  const totalPages = Math.ceil(total / state.churnPerPage) || 1;
  if (state.churnPage > totalPages) state.churnPage = totalPages;
  if (state.churnPage < 1) state.churnPage = 1;

  const start = (state.churnPage - 1) * state.churnPerPage;
  const pageItems = inativos.slice(start, start + state.churnPerPage);

  const tbody = document.getElementById('tbody-churn');
  if (!tbody) return;

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-dim);">Nenhum cliente inativo encontrado com os filtros selecionados.</td></tr>`;
    document.getElementById('page-info-churn').innerText = '0 clientes encontrados';
    return;
  }

  tbody.innerHTML = pageItems.map(c => {
    let prioClass = 'badge-baixa';
    if (c.prioridade === 'URGENTE') prioClass = 'badge-urgente';
    else if (c.prioridade === 'ALTA') prioClass = 'badge-alta';
    else if (c.prioridade === 'MÉDIA') prioClass = 'badge-media';

    const encodedCli = encodeURIComponent(c.cliente);

    return `
      <tr>
        <td style="font-weight: 600; color: var(--text-main);" title="${c.acao_sugerida || c.cliente}">
          <div>${c.cliente}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">${c.acao_sugerida || ''}</div>
        </td>
        <td><span style="font-size: 0.8rem; color: var(--text-muted);">${c.cidade} - ${c.uf}</span></td>
        <td style="font-weight: 700; color: #f43f5e; white-space: nowrap;">${formatBRL(c.faturamento)}</td>
        <td>${formatNumber(c.pedidos)}</td>
        <td>${formatNumber(c.quantidade)}</td>
        <td style="white-space: nowrap;">${formatBRL(c.ticket_medio)}</td>
        <td><span style="color: var(--text-dim); font-size: 0.8rem;">${c.ultima_compra}</span></td>
        <td style="white-space: nowrap;"><span style="color: #d97706; font-weight: 700;">${formatNumber(c.dias_sem_comprar)} dias</span></td>
        <td style="white-space: nowrap;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span class="${prioClass}">${c.prioridade}</span>
            <button type="button" onclick="removeChurnClient('${encodedCli}')" title="Excluir este cliente da análise de inativos" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 6px; padding: 5px 10px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
              🗑️ Excluir
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('page-info-churn').innerText = `Mostrando ${start + 1} a ${Math.min(start + state.churnPerPage, total)} de ${formatNumber(total)} clientes inativos`;
  document.getElementById('btn-prev-churn').disabled = state.churnPage <= 1;
  document.getElementById('btn-next-churn').disabled = state.churnPage >= totalPages;
}

function changeChurnPage(delta) {
  state.churnPage += delta;
  renderChurnTable();
}

function exportChurnCSV() {
  const data = window.DASHBOARD_DATA;
  if (!data) return;

  const excluded = getExcludedChurnSet();
  const inativos = (data.empresas[state.currentCompany]?.analise_churn?.lista_inativos || []).filter(c => !excluded.has(c.cliente));
  let csv = 'Cliente;Cidade;UF;Faturamento_Historico;Pedidos;Pecas;Ticket_Medio;Ultima_Compra;Dias_Sem_Comprar;Prioridade;Acao_Sugerida\n';

  inativos.forEach(c => {
    csv += `"${c.cliente.replace(/"/g, '""')}";"${c.cidade}";"${c.uf}";${c.faturamento};${c.pedidos};${c.quantidade};${c.ticket_medio};"${c.ultima_compra}";${c.dias_sem_comprar};"${c.prioridade}";"${c.acao_sugerida}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `Clientes_Inativos_Resgate_Churn_${state.currentCompany}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setupEventListeners() {
  // Ajustes de redimensionamento
  window.addEventListener('resize', () => {
    Object.values(state.charts).forEach(c => c && c.resize && c.resize());
  });
}

// =========================================================================
// MÓDULO DE RELATÓRIO EXECUTIVO OFICIAL (IMPRESSÃO & PDF)
// =========================================================================

function openAndPrintReport() {
  switchTab('tab-relatorio');
  renderExecutiveReport();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderExecutiveReport() {
  const data = window.DASHBOARD_DATA;
  if (!data) return;

  const currentEmpresaData = data.empresas[state.currentCompany];
  if (!currentEmpresaData) return;

  syncReportFiltersUI();

  const { periodData, rawPeriodData, periodLabel } = getPeriodData(currentEmpresaData);

  // 1. Metadados do Relatório
  const companyNames = {
    'consolidado': 'Grupo Consolidado (Empresa 1 & Empresa 2)',
    'mb': 'Empresa 1',
    'moderna': 'Empresa 2'
  };
  const compName = companyNames[state.currentCompany] || 'Grupo Consolidado';
  
  const elEmpresa = document.getElementById('rep-meta-empresa');
  if (elEmpresa) elEmpresa.innerText = compName;

  const elPeriodo = document.getElementById('rep-meta-periodo');
  let periodLabelTxt = 'Histórico Geral Consolidado (2020 a 2026)';
  if (state.filters.ano === 'todos' && state.filters.mes === 'todos') {
    periodLabelTxt = 'Histórico Geral Consolidado (2020 a 2026)';
  } else if (state.filters.mes === 'todos') {
    periodLabelTxt = `Ano Calendário: ${state.filters.ano} (Jan a Dez)`;
  } else if (state.filters.ano === 'todos') {
    periodLabelTxt = `Mês: ${MESES_MAP[state.filters.mes] || state.filters.mes} (Consolidado Todos os Anos)`;
  } else {
    periodLabelTxt = `${MESES_MAP[state.filters.mes] || state.filters.mes} de ${state.filters.ano}`;
  }
  if (elPeriodo) elPeriodo.innerText = periodLabelTxt;

  const repStatusBadge = document.getElementById('rep-period-status-text');
  if (repStatusBadge) {
    repStatusBadge.innerText = `Período Ativo no Relatório: ${periodLabelTxt} • ${compName}`;
  }

  const elFiltros = document.getElementById('rep-meta-filtros');
  if (elFiltros) {
    const catTxt = state.filters.categoria !== 'todas' ? state.filters.categoria : 'Todas as Famílias';
    const ufTxt = state.filters.uf !== 'todos' ? `Estado: ${state.filters.uf}` : 'Todos os Estados';
    elFiltros.innerText = `${catTxt} • ${ufTxt}`;
  }

  const elData = document.getElementById('rep-meta-data');
  if (elData) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    elData.innerText = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  const elStamp = document.getElementById('rep-stamp-id');
  if (elStamp) {
    elStamp.innerText = `${state.currentCompany.toUpperCase()}-${state.filters.ano}-${Date.now().toString().slice(-6)}`;
  }

  // 2. KPIs
  const fat = periodData.faturamento || 0;
  const qtd = periodData.quantidade || 0;
  const ped = periodData.pedidos || 0;
  const cli = periodData.clientes || 0;
  const tkt = periodData.ticket_medio || 0;
  const pmed = periodData.preco_medio || 0;

  if (document.getElementById('rep-kpi-faturamento')) document.getElementById('rep-kpi-faturamento').innerText = formatBRL(fat);
  if (document.getElementById('rep-kpi-quantidade')) document.getElementById('rep-kpi-quantidade').innerText = `${formatNumber(qtd)} un`;
  if (document.getElementById('rep-kpi-pedidos')) document.getElementById('rep-kpi-pedidos').innerText = `${formatNumber(ped)} ordens`;
  if (document.getElementById('rep-kpi-ticket')) document.getElementById('rep-kpi-ticket').innerText = formatBRL(tkt);
  if (document.getElementById('rep-kpi-preco-medio')) document.getElementById('rep-kpi-preco-medio').innerText = formatBRL(pmed);
  if (document.getElementById('rep-kpi-clientes')) document.getElementById('rep-kpi-clientes').innerText = `${formatNumber(cli)} ativos`;

  // 3. Split Fiscal (Simples Nacional)
  const isMonthSelected = state.filters.mes !== 'todos';
  const isYearSelected = state.filters.ano !== 'todos';
  const anoRef = isYearSelected ? state.filters.ano : '2026';
  const annualSplit = (data.split_fiscal && data.split_fiscal[anoRef]) ? data.split_fiscal[anoRef] : (data.split_fiscal ? data.split_fiscal['2026'] : null);

  let splitMbFat = 0;
  let splitModFat = 0;
  let splitTotFat = 0;
  let splitMbPct = 0;
  let splitModPct = 0;
  let splitThText = 'Faturamento Recente';
  let splitDiagTexto = '';

  if (isYearSelected && isMonthSelected) {
    const monthKey = `${state.filters.ano}-${String(state.filters.mes).padStart(2, '0')}`;
    const monthData = data.split_fiscal?.meses?.[monthKey];
    splitThText = `Faturamento (${MESES_MAP[state.filters.mes] || state.filters.mes}/${state.filters.ano})`;
    if (monthData) {
      splitMbFat = monthData.mb_faturamento;
      splitModFat = monthData.moderna_faturamento;
      splitTotFat = monthData.total;
      splitMbPct = monthData.mb_pct;
      splitModPct = monthData.moderna_pct;
    } else {
      splitMbFat = (periodData.faturamento || 0) * 0.68;
      splitModFat = (periodData.faturamento || 0) * 0.32;
      splitTotFat = periodData.faturamento || 0;
      splitMbPct = 68.0;
      splitModPct = 32.0;
    }
    splitDiagTexto = `Divisão contábil apurada em ${MESES_MAP[state.filters.mes] || state.filters.mes}/${state.filters.ano}: ${splitMbPct}% Empresa 1 e ${splitModPct}% Empresa 2. No ano de ${anoRef}, faturamento acumulado do grupo totaliza ${formatBRL(annualSplit?.total || 0)}.`;
  } else if (!isYearSelected && isMonthSelected) {
    const mesKey = String(parseInt(state.filters.mes, 10));
    const mesGeral = data.split_fiscal?.meses_geral?.[mesKey];
    splitThText = `Faturamento (${MESES_MAP[state.filters.mes] || state.filters.mes} Consolidado)`;
    if (mesGeral) {
      splitMbFat = mesGeral.mb_faturamento;
      splitModFat = mesGeral.moderna_faturamento;
      splitTotFat = mesGeral.total;
      splitMbPct = mesGeral.mb_pct;
      splitModPct = mesGeral.moderna_pct;
    } else {
      splitMbFat = (periodData.faturamento || 0) * 0.70;
      splitModFat = (periodData.faturamento || 0) * 0.30;
      splitTotFat = periodData.faturamento || 0;
      splitMbPct = 70.0;
      splitModPct = 30.0;
    }
    splitDiagTexto = `Mês de ${MESES_MAP[state.filters.mes] || state.filters.mes} em todos os anos consolidados. Faturamento somado: ${formatBRL(splitTotFat)}.`;
  } else if (isYearSelected && !isMonthSelected) {
    splitThText = `Faturamento Anual (${state.filters.ano})`;
    if (annualSplit) {
      splitMbFat = annualSplit.mb_faturamento;
      splitModFat = annualSplit.moderna_faturamento;
      splitTotFat = annualSplit.total;
      splitMbPct = annualSplit.mb_pct;
      splitModPct = annualSplit.moderna_pct;
    }
    splitDiagTexto = annualSplit?.diagnostico || '';
  } else {
    splitThText = 'Faturamento Histórico (2020 a 2026)';
    splitMbFat = 28927247.10;
    splitModFat = 7377074.46;
    splitTotFat = 36304321.56;
    splitMbPct = 79.7;
    splitModPct = 20.3;
    splitDiagTexto = `Histórico acumulado geral (2020 a 2026). Referência anual 2026: Empresa 1 soma ${formatBRL(annualSplit?.mb_faturamento || 0)} (${annualSplit?.mb_pct}%).`;
  }

  const thFatSplit = document.getElementById('rep-th-faturamento-split');
  if (thFatSplit) thFatSplit.innerText = splitThText;

  const repTbodySplit = document.getElementById('rep-tbody-split');
  if (repTbodySplit && annualSplit) {
    const isMbSub = annualSplit.mb_risco_sublimite;
    const isMbTeto = annualSplit.mb_risco_teto;
    const isModTeto = annualSplit.moderna_risco_teto;

    repTbodySplit.innerHTML = `
      <tr>
        <td><strong>⚙️ Empresa 1</strong></td>
        <td><strong>${formatBRL(splitMbFat)}</strong></td>
        <td><span style="font-weight: 700; color: #0284c7;">${splitMbPct}%</span></td>
        <td>${isMbSub ? '<span class="rep-tag tag-warning">⚠️ Ultrapassou R$ 3,6M</span>' : '<span class="rep-tag tag-success">✓ Dentro do Sublimite</span>'}</td>
        <td>${isMbTeto ? '<span class="rep-tag tag-danger">🚨 Estouro de Teto</span>' : '<span class="rep-tag tag-success">✓ Dentro do Teto</span>'}</td>
        <td>${isMbSub ? 'Necessita segregação de ICMS/ISS fora do DAS' : 'Alíquota Simples Integral'}</td>
      </tr>
      <tr>
        <td><strong>💎 Empresa 2</strong></td>
        <td><strong>${formatBRL(splitModFat)}</strong></td>
        <td><span style="font-weight: 700; color: #a855f7;">${splitModPct}%</span></td>
        <td><span class="rep-tag tag-success">✓ Dentro do Sublimite</span></td>
        <td>${isModTeto ? '<span class="rep-tag tag-danger">🚨 Estouro de Teto</span>' : '<span class="rep-tag tag-success">✓ Dentro do Teto</span>'}</td>
        <td>Capacidade livre para absorção de pedidos faturados</td>
      </tr>
      <tr style="background: #f1f5f9; font-weight: 700;">
        <td>Total Grupo Consolidado</td>
        <td>${formatBRL(splitTotFat)}</td>
        <td>100%</td>
        <td colspan="2">Equilíbrio da Carteira: ${splitMbPct}% Empresa 1 / ${splitModPct}% Empresa 2</td>
        <td>${annualSplit.nivel_risco === 'critico' ? 'Ação Imediata de Rebalanceamento' : 'Equilíbrio Tributário Estável'}</td>
      </tr>
    `;

    const repAlertBox = document.getElementById('rep-fiscal-alert-box');
    if (repAlertBox) {
      repAlertBox.innerHTML = `
        <strong>Parecer da Controladoria:</strong> ${splitDiagTexto}
      `;
    }
  }

  // 4. Curva ABC e Produtos Classe A
  const prods = (periodData.produtos && periodData.produtos.length > 0) ? periodData.produtos : (currentEmpresaData.produtos_estrategia || []);
  const abcCalc = computeCurvaABCFromProducts(prods);
  const repAbcGrid = document.getElementById('rep-abc-summary-grid');
  if (repAbcGrid) {
    const totalFatAbc = (abcCalc.A.faturamento + abcCalc.B.faturamento + abcCalc.C.faturamento) || 1;
    const pctA = ((abcCalc.A.faturamento / totalFatAbc) * 100).toFixed(1);
    const pctB = ((abcCalc.B.faturamento / totalFatAbc) * 100).toFixed(1);
    const pctC = ((abcCalc.C.faturamento / totalFatAbc) * 100).toFixed(1);

    repAbcGrid.innerHTML = `
      <div class="rep-abc-card card-a">
        <span class="rep-abc-badge badge-a">CLASSE A (80% DA RECEITA)</span>
        <div class="rep-abc-val">${formatBRL(abcCalc.A.faturamento)} <span style="font-size: 0.8rem; font-weight: normal;">(${pctA}%)</span></div>
        <div class="rep-abc-sub">${abcCalc.A.itens} itens de altíssimo giro &bull; Prioridade absoluta no torno/fresa</div>
      </div>
      <div class="rep-abc-card card-b">
        <span class="rep-abc-badge badge-b">CLASSE B (15% DA RECEITA)</span>
        <div class="rep-abc-val">${formatBRL(abcCalc.B.faturamento)} <span style="font-size: 0.8rem; font-weight: normal;">(${pctB}%)</span></div>
        <div class="rep-abc-sub">${abcCalc.B.itens} itens com demanda intermediária &bull; Lote econômico regular</div>
      </div>
      <div class="rep-abc-card card-c">
        <span class="rep-abc-badge badge-c">CLASSE C (5% DA RECEITA)</span>
        <div class="rep-abc-val">${formatBRL(abcCalc.C.faturamento)} <span style="font-size: 0.8rem; font-weight: normal;">(${pctC}%)</span></div>
        <div class="rep-abc-sub">${abcCalc.C.itens} itens de baixo giro &bull; Fabricar somente sob encomenda (MTO)</div>
      </div>
    `;
  }

  const repTbodyCurvaA = document.getElementById('rep-tbody-curva-a');
  if (repTbodyCurvaA) {
    const top10A = prods.slice(0, 10);
    if (top10A.length === 0) {
      repTbodyCurvaA.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 10px;">Nenhum produto cadastrado para este filtro.</td></tr>';
    } else {
      repTbodyCurvaA.innerHTML = top10A.map(p => `
        <tr>
          <td><strong>${p.nome}</strong></td>
          <td>${p.categoria || 'Geral'}</td>
          <td>${formatNumber(p.quantidade)}</td>
          <td><strong>${formatBRL(p.faturamento)}</strong></td>
          <td>${formatBRL(p.preco_medio)}</td>
          <td><span class="badge-abc badge-${(p.curva_abc || 'A').toLowerCase()}">${p.curva_abc || 'A'}</span></td>
          <td><span class="rep-tag tag-${p.curva_abc === 'A' ? 'success' : 'info'}">${p.recomendacao || 'Produzir Mais / Lote Contínuo'}</span></td>
        </tr>
      `).join('');
    }
  }

  // 5. Recursos Humanos & Produtividade Fabril
  const rhData = currentEmpresaData.produtividade_rh || data.produtividade_rh;
  if (rhData) {
    let hc = rhData.total_colaboradores;
    let custoFolha = rhData.custo_folha_mensal;
    let custoMedio = rhData.custo_medio_colaborador;
    let fatPerCapita = rhData.fat_per_capita_mensal;
    let lucroPerCapita = rhData.lucro_bruto_per_capita_mensal;
    let indiceFolha = rhData.indice_folha_faturamento;
    let roi = rhData.roi_mao_de_obra;

    if (state.filters.ano !== 'todos' && state.filters.mes !== 'todos' && rhData.evolucao_mensal_folha) {
      const monthKey = `${state.filters.ano}-${String(state.filters.mes).padStart(2, '0')}`;
      const mRh = rhData.evolucao_mensal_folha.find(m => m.ano_mes === monthKey);
      if (mRh) {
        if (state.currentCompany === 'mb') {
          hc = mRh.hc_mb || 18;
          custoFolha = mRh.custo_mb || 58769.41;
        } else if (state.currentCompany === 'moderna') {
          hc = mRh.hc_mod || 9;
          custoFolha = mRh.custo_mod || 26595.82;
        } else {
          hc = mRh.headcount || 27;
          custoFolha = mRh.total_custo || 85365.23;
        }
        custoMedio = hc > 0 ? (custoFolha / hc) : 0;
        if (fat > 0 && hc > 0) {
          fatPerCapita = fat / hc;
          lucroPerCapita = (fat * 0.40) / hc;
          indiceFolha = Number(((custoFolha / fat) * 100).toFixed(1));
          roi = Number((fat / (custoFolha || 1)).toFixed(2));
        }
      }
    }

    if (document.getElementById('rep-rh-headcount')) document.getElementById('rep-rh-headcount').innerText = `${hc} colaboradores`;
    if (document.getElementById('rep-rh-custo-folha')) document.getElementById('rep-rh-custo-folha').innerText = formatBRL(custoFolha);
    if (document.getElementById('rep-rh-custo-medio')) document.getElementById('rep-rh-custo-medio').innerText = formatBRL(custoMedio);
    if (document.getElementById('rep-rh-fat-percapita')) document.getElementById('rep-rh-fat-percapita').innerText = formatBRL(fatPerCapita);
    if (document.getElementById('rep-rh-lucro-percapita')) document.getElementById('rep-rh-lucro-percapita').innerText = `+${formatBRL(lucroPerCapita)}`;
    if (document.getElementById('rep-rh-indice')) document.getElementById('rep-rh-indice').innerText = `${indiceFolha}%`;
    if (document.getElementById('rep-rh-roi')) document.getElementById('rep-rh-roi').innerText = `${roi}x`;

    const repTbodyRhRub = document.getElementById('rep-tbody-rh-rubricas');
    if (repTbodyRhRub && rhData.resumo_holerites) {
      const ac = rhData.resumo_holerites.acumulado || {};
      const md = rhData.resumo_holerites.media_mensal || {};
      const brutoTot = ac.total_bruto || 1;
      const pct = v => `${((v / brutoTot) * 100).toFixed(1)}%`;

      const linhasResumoRh = [
        {
          cat: 'Salário Base, Pró-Labore & Estágio',
          det: 'Mensalistas (001), Horistas (002/005), Pró-Labore (013) e Estagiários (043)',
          tot: ac.salario_base_efetivo || 0,
          med: md.salario_base_efetivo || 0
        },
        {
          cat: 'Horas Extras (70% e 110%) + Reflexo DSR',
          det: `Horas Extras (${formatBRL(ac.hora_extra_total || 0)} • ${Math.round(ac.horas_extras_qtd || 0)}h) + DSR s/ Variáveis (${formatBRL(ac.dsr_variaveis || 0)})`,
          tot: (ac.hora_extra_total || 0) + (ac.dsr_variaveis || 0),
          med: (md.hora_extra_total || 0) + (md.dsr_variaveis || 0)
        },
        {
          cat: 'Vale Alimentação & Benefícios',
          det: `Vale Alimentação Cód. 105 (${formatBRL(ac.vale_alimentacao || 0)}) + Ajuda de Custo/Reembolso (${formatBRL(ac.ajuda_reembolso || 0)})`,
          tot: (ac.vale_alimentacao || 0) + (ac.ajuda_reembolso || 0),
          med: (md.vale_alimentacao || 0) + (md.ajuda_reembolso || 0)
        },
        {
          cat: 'Adicionais: Comissões, Gratificações & Bônus',
          det: `Comissões (${formatBRL(ac.comissoes || 0)}) + Gratificações (${formatBRL(ac.gratificacoes || 0)}) + Bônus (${formatBRL(ac.bonus || 0)})`,
          tot: (ac.comissoes || 0) + (ac.gratificacoes || 0) + (ac.bonus || 0),
          med: (md.comissoes || 0) + (md.gratificacoes || 0) + (md.bonus || 0)
        },
        {
          cat: 'Férias Gozadas, 1/3 Constitucional & Abono',
          det: 'Férias Normais (120/121), 1/3 Constitucional (122) e Abono Pecuniário (123/125)',
          tot: ac.ferias_total || 0,
          med: md.ferias_total || 0
        },
        {
          cat: 'Vales & Adiantamentos Salariais (Quinzena)',
          det: 'Adiantamento Salarial Quinzenal (600), Adiantamento Vale (603) e Adiant. Comissão (606)',
          tot: ac.vale_adiantamento || 0,
          med: md.vale_adiantamento || 0
        },
        {
          cat: 'FGTS Patronal (8%)',
          det: 'Encargo Trabalhista FGTS depositado pela empresa',
          tot: ac.total_fgts || 0,
          med: md.total_fgts || 0
        }
      ];

      repTbodyRhRub.innerHTML = linhasResumoRh.map(r => `
        <tr>
          <td><strong>${r.cat}</strong></td>
          <td style="color: #475569;">${r.det}</td>
          <td><strong>${formatBRL(r.tot)}</strong></td>
          <td>${formatBRL(r.med)}/mês</td>
          <td><span class="rep-tag tag-info">${pct(r.tot)}</span></td>
        </tr>
      `).join('');
    }
  }

  // 6. Distribuição Geográfica (Top Estados)
  const ufs = (periodData.vendas_por_uf && periodData.vendas_por_uf.length > 0) ? periodData.vendas_por_uf : (currentEmpresaData.vendas_por_uf || []);
  const repTbodyEstados = document.getElementById('rep-tbody-estados');
  if (repTbodyEstados) {
    const topUfs = ufs.slice(0, 8);
    if (topUfs.length === 0) {
      repTbodyEstados.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 10px;">Nenhum dado geográfico encontrado.</td></tr>';
    } else {
      repTbodyEstados.innerHTML = topUfs.map(u => `
        <tr>
          <td><strong style="color: #0284c7;">${u.uf}</strong></td>
          <td><strong>${formatBRL(u.faturamento)}</strong></td>
          <td><strong style="color: #059669;">${u.pct}%</strong></td>
          <td>${formatNumber(u.quantidade)}</td>
          <td>${formatNumber(u.pedidos)}</td>
          <td>${formatNumber(u.clientes)}</td>
          <td>${formatBRL(u.ticket_medio)}</td>
        </tr>
      `).join('');
    }
  }

  // 7. Churn & Clientes Inativos
  const ch = currentEmpresaData.analise_churn;
  if (ch) {
    const excludedRep = getExcludedChurnSet();
    const activeRepList = (ch.lista_inativos || []).filter(c => !excludedRep.has(c.cliente));
    const fatRepInativo = activeRepList.reduce((acc, c) => acc + (Number(c.faturamento) || 0), 0);
    if (document.getElementById('rep-churn-ativos')) document.getElementById('rep-churn-ativos').innerText = formatNumber(ch.ativos_2026 || 664);
    if (document.getElementById('rep-churn-inativos')) document.getElementById('rep-churn-inativos').innerText = formatNumber(activeRepList.length);
    if (document.getElementById('rep-churn-fat-inativo')) document.getElementById('rep-churn-fat-inativo').innerText = formatBRL(fatRepInativo);
    if (document.getElementById('rep-churn-potencial')) document.getElementById('rep-churn-potencial').innerText = formatBRL(fatRepInativo * 0.25);

    const repTbodyChurn = document.getElementById('rep-tbody-churn');
    if (repTbodyChurn) {
      const topInat = activeRepList.slice(0, 8);
      if (topInat.length === 0) {
        repTbodyChurn.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 10px;">Nenhum cliente inativo registrado.</td></tr>';
      } else {
        repTbodyChurn.innerHTML = topInat.map(c => `
          <tr>
            <td><strong>${c.cliente}</strong></td>
            <td>${c.cidade} - ${c.uf}</td>
            <td style="color: #e11d48; font-weight: 700;">${formatBRL(c.faturamento)}</td>
            <td>${c.ultima_compra}</td>
            <td style="font-weight: 600;">${formatNumber(c.dias_sem_comprar)} dias</td>
            <td><span class="rep-tag tag-danger">${c.prioridade}</span></td>
            <td>${c.acao_sugerida}</td>
          </tr>
        `).join('');
      }
    }
  }

  // 8. Backlog Fabril
  const bg = data.backlog_fabril;
  if (bg) {
    if (document.getElementById('rep-backlog-valor')) document.getElementById('rep-backlog-valor').innerText = formatBRL(bg.total_valor_pendente);
    if (document.getElementById('rep-backlog-qtd')) document.getElementById('rep-backlog-qtd').innerText = `${bg.quantidade_pedidos_pendentes} ordens`;

    const repTbodyBg = document.getElementById('rep-tbody-backlog');
    if (repTbodyBg) {
      const pend = (bg.lista_pendencias || []).slice(0, 6);
      if (pend.length === 0) {
        repTbodyBg.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 10px;">Nenhum pedido pendente registrado no momento.</td></tr>';
      } else {
        repTbodyBg.innerHTML = pend.map(p => `
          <tr>
            <td>${p.data || '-'}</td>
            <td style="font-weight: 600; color: #b45309;">${p.data_limite || 'A Definir'}</td>
            <td><strong>${p.cliente}</strong></td>
            <td><strong>${formatBRL(p.valor)}</strong></td>
            <td><span class="rep-tag tag-warning">⏳ ${p.status}</span></td>
          </tr>
        `).join('');
      }
    }
  }

  // 9. Custos Industriais & Formação de Preço (Seção 8 do Relatório)
  renderReportSection8(data);

  // 10. Budget & Metas Planejadas (Seção 9 do Relatório)
  renderReportBudgetSection(data);

  // 11. Plano de Gastos e Investimentos (Seção 10 do Relatório)
  renderReportGastosSection();

  // Aplicar filtro de seção / módulo selecionado pelo usuário
  applyReportSectionFilter();
}

// =========================================================================
// FUNÇÕES DE CONTROLE DE PERÍODO E SEÇÃO DO RELATÓRIO EXECUTIVO
// =========================================================================

const REPORT_SECTION_LABELS = {
  'todas': 'Todas as Informações (Relatório Completo)',
  'visao-geral': 'Visão Geral',
  'producao': 'Produção (Curva ABC 80/20)',
  'backlog': 'Pendências (Backlog Fabril)',
  'estados': 'Vendas por Estado (UF)',
  'churn': 'Clientes Inativos (Churn)',
  'budget': 'Budget & Metas Planejadas',
  'gastos': 'Plano de Gastos & Investimentos',
  'split': 'Equilíbrio Fiscal (Simples Nacional)',
  'colaboradores': 'Produtividade & RH',
  'custos': 'Custos & Formação de Preço (Pricing)'
};

function applyReportSectionFilter() {
  const selectEl = document.getElementById('rep-filter-secao');
  const selectedSecao = selectEl ? selectEl.value : 'todas';

  const sections = document.querySelectorAll('#report-sheet .rep-section[data-rep-section]');
  let visibleIndex = 1;

  sections.forEach(sec => {
    const secKey = sec.getAttribute('data-rep-section');
    const baseTitle = sec.getAttribute('data-rep-title') || '';
    const isVisible = (selectedSecao === 'todas' || secKey === selectedSecao);

    if (isVisible) {
      sec.classList.remove('rep-section-hidden');
      const titleSpan = sec.querySelector('.rep-section-title span');
      if (titleSpan && baseTitle) {
        titleSpan.innerText = `${visibleIndex}. ${baseTitle}`;
      }
      visibleIndex++;
    } else {
      sec.classList.add('rep-section-hidden');
    }
  });

  // Atualizar metadado de filtros aplicados no cabeçalho do documento impresso
  const elFiltros = document.getElementById('rep-meta-filtros');
  if (elFiltros) {
    const secaoLabel = REPORT_SECTION_LABELS[selectedSecao] || 'Relatório Completo';
    const catTxt = state.filters.categoria !== 'todas' ? state.filters.categoria : 'Todas as Famílias';
    const ufTxt = state.filters.uf !== 'todos' ? `UF: ${state.filters.uf}` : 'Todos os Estados';
    elFiltros.innerText = `Informação: ${secaoLabel} • ${catTxt} • ${ufTxt}`;
  }
}

function onReportSectionFilterChange() {
  applyReportSectionFilter();
}

function onReportPeriodChange() {
  const repAno = document.getElementById('rep-filter-ano')?.value || 'todos';
  const repMes = document.getElementById('rep-filter-mes')?.value || 'todos';

  state.filters.ano = repAno;
  state.filters.mes = repMes;

  // Sincronizar com os filtros do topbar
  const topAno = document.getElementById('filter-ano');
  const topMes = document.getElementById('filter-mes');
  if (topAno) topAno.value = repAno;
  if (topMes) topMes.value = repMes;

  state.productsPage = 1;
  updateAllViews();
}

function onReportCompanyChange() {
  const repComp = document.getElementById('rep-filter-empresa')?.value || 'consolidado';
  setCompany(repComp);
}

function setReportPeriodPreset(ano, mes) {
  state.filters.ano = ano;
  state.filters.mes = mes;

  const topAno = document.getElementById('filter-ano');
  const topMes = document.getElementById('filter-mes');
  if (topAno) topAno.value = ano;
  if (topMes) topMes.value = mes;

  syncReportFiltersUI();
  state.productsPage = 1;
  updateAllViews();
}

function resetReportFilters() {
  state.filters.ano = 'todos';
  state.filters.mes = 'todos';
  state.filters.categoria = 'todas';
  state.filters.uf = 'todos';

  const topAno = document.getElementById('filter-ano');
  const topMes = document.getElementById('filter-mes');
  const topCat = document.getElementById('filter-categoria');
  const topUf = document.getElementById('filter-uf');
  if (topAno) topAno.value = 'todos';
  if (topMes) topMes.value = 'todos';
  if (topCat) topCat.value = 'todas';
  if (topUf) topUf.value = 'todos';

  const repSecao = document.getElementById('rep-filter-secao');
  if (repSecao) repSecao.value = 'todas';

  syncReportFiltersUI();
  state.productsPage = 1;
  updateAllViews();
}

function syncReportFiltersUI() {
  const repAno = document.getElementById('rep-filter-ano');
  const repMes = document.getElementById('rep-filter-mes');
  const repComp = document.getElementById('rep-filter-empresa');
  if (repAno && repAno.value !== state.filters.ano) repAno.value = state.filters.ano;
  if (repMes && repMes.value !== state.filters.mes) repMes.value = state.filters.mes;
  if (repComp && repComp.value !== state.currentCompany) repComp.value = state.currentCompany;
}

window.onReportPeriodChange = onReportPeriodChange;
window.onReportCompanyChange = onReportCompanyChange;
window.onReportSectionFilterChange = onReportSectionFilterChange;
window.setReportPeriodPreset = setReportPeriodPreset;
window.resetReportFilters = resetReportFilters;
window.syncReportFiltersUI = syncReportFiltersUI;

// =========================================================================
// MÓDULO DE CUSTOS INDUSTRIAIS & FORMAÇÃO DE PREÇO (PRICING)
// =========================================================================

let currentSelectedBOMKey = 'PMs';

function parseUserNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = String(val).replace(/\s/g, '').replace('R$', '').replace('%', '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function loadCustomCostProducts(data) {
  try {
    const saved = localStorage.getItem('mb_custos_customizados');
    if (!saved) return;
    const customMap = JSON.parse(saved);
    if (!customMap || typeof customMap !== 'object') return;

    data.custos_industriais.produtos_custo.forEach(p => {
      const k = p.sheet_key || p.chave;
      if (customMap[k]) {
        const c = customMap[k];
        if (typeof c.producao_mensal_ref !== 'undefined') p.producao_mensal_ref = c.producao_mensal_ref;
        if (typeof c.custo_fabricacao !== 'undefined') p.custo_fabricacao = c.custo_fabricacao;
        if (typeof c.custo_adm_mo !== 'undefined') p.custo_adm_mo = c.custo_adm_mo;
        if (typeof c.custo_real_total !== 'undefined') p.custo_real_total = c.custo_real_total;
        if (typeof c.markup_pct !== 'undefined') p.markup_pct = c.markup_pct;
        if (typeof c.markup_valor !== 'undefined') p.markup_valor = c.markup_valor;
        if (typeof c.imposto_valor !== 'undefined') p.imposto_valor = c.imposto_valor;
        if (typeof c.preco_venda_sugerido !== 'undefined') p.preco_venda_sugerido = c.preco_venda_sugerido;
        if (typeof c.margem_contribuicao_rs !== 'undefined') p.margem_contribuicao_rs = c.margem_contribuicao_rs;
        if (typeof c.margem_contribuicao_pct !== 'undefined') p.margem_contribuicao_pct = c.margem_contribuicao_pct;

        p.quantidade_referencia = p.producao_mensal_ref;
        p.custo_fabricacao_unitario = p.custo_fabricacao;
        p.custo_indireto_unitario = p.custo_adm_mo;
        p.custo_real_unitario = p.custo_real_total;
        p.markup_percentual = p.markup_pct;
        p.preco_sugerido = p.preco_venda_sugerido;
        p.margem_contribuicao_valor = p.margem_contribuicao_rs;
      }
    });
  } catch (e) {
    console.warn('Erro ao carregar custos customizados salvos:', e);
  }
}

function saveCustomCostProducts() {
  const data = window.DASHBOARD_DATA;
  if (!data || !data.custos_industriais || !data.custos_industriais.produtos_custo) return;
  try {
    const customMap = {};
    data.custos_industriais.produtos_custo.forEach(p => {
      const k = p.sheet_key || p.chave;
      customMap[k] = {
        producao_mensal_ref: p.producao_mensal_ref,
        custo_fabricacao: p.custo_fabricacao,
        custo_adm_mo: p.custo_adm_mo,
        custo_real_total: p.custo_real_total,
        markup_pct: p.markup_pct,
        markup_valor: p.markup_valor,
        imposto_valor: p.imposto_valor,
        preco_venda_sugerido: p.preco_venda_sugerido,
        margem_contribuicao_rs: p.margem_contribuicao_rs,
        margem_contribuicao_pct: p.margem_contribuicao_pct
      };
    });
    localStorage.setItem('mb_custos_customizados', JSON.stringify(customMap));
  } catch (e) {
    console.warn('Erro ao salvar custos customizados:', e);
  }
}

function switchCostSubView(viewId) {
  document.querySelectorAll('.btn-cost-subnav').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });

  document.querySelectorAll('.cost-subview').forEach(view => {
    view.style.display = view.id === `cost-subview-${viewId}` ? 'block' : 'none';
  });

  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    if (state.charts['chart-bom-composition']) state.charts['chart-bom-composition'].resize();
    if (state.charts['chart-cost-sectors']) state.charts['chart-cost-sectors'].resize();
  }, 60);
}

function renderCustosModule() {
  const data = window.DASHBOARD_DATA;
  if (!data || !data.custos_industriais) return;

  // Salvar backup original se ainda não existir
  if (!data.custos_industriais.produtos_custo_original && data.custos_industriais.produtos_custo) {
    data.custos_industriais.produtos_custo_original = JSON.parse(JSON.stringify(data.custos_industriais.produtos_custo));
  }

  // Carregar customizações salvas pelo usuário
  loadCustomCostProducts(data);

  const custos = data.custos_industriais;
  const produtos = custos.produtos_custo || [];
  const colabs = custos.colaboradores || custos.modelo_colaboradores?.lista_colaboradores || [];
  const setores = custos.setores || custos.modelo_colaboradores?.setores_resumo || {};

  // 1. Popular selects de produtos
  populateCostProductSelects(produtos);

  // 2. Renderizar Tabela Geral de Produtos & Preços
  renderCostProductsTable(produtos);

  // 3. Carregar BOM do primeiro produto ou do produto ativo
  if (produtos.length > 0) {
    const selectedKey = currentSelectedBOMKey || produtos[0].sheet_key || produtos[0].chave;
    loadProductBOM(selectedKey);
  }

  // 4. Renderizar Tabela e Gráfico de Colaboradores / Setores
  if (colabs.length > 0) {
    renderCostColaboradoresTable(colabs);
  }
  if (Object.keys(setores).length > 0) {
    renderCostSectorChart(setores);
  }

  // 5. Executar cálculo inicial do Simulador
  runInteractiveCostSimulation();
}

function populateCostProductSelects(produtos) {
  const selectBOM = document.getElementById('select-bom-product');
  const selectSim = document.getElementById('sim-product-select');

  if (selectBOM && selectBOM.options.length <= 1) {
    const curVal = selectBOM.value;
    selectBOM.innerHTML = produtos.map(p => {
      const key = p.sheet_key || p.chave;
      const nome = p.nome || p.nome_aba;
      return `<option value="${key}">${key} &bull; ${nome}</option>`;
    }).join('');
    if (curVal && produtos.some(p => (p.sheet_key || p.chave) === curVal)) {
      selectBOM.value = curVal;
    }
  }

  if (selectSim && selectSim.options.length <= 1) {
    const curVal = selectSim.value;
    selectSim.innerHTML = produtos.map(p => {
      const key = p.sheet_key || p.chave;
      const nome = p.nome || p.nome_aba;
      const custoReal = p.custo_real_total || p.custo_real_unitario || 0;
      return `<option value="${key}">${key} &bull; ${nome} (Custo: ${formatBRL(custoReal)})</option>`;
    }).join('');
    if (curVal && produtos.some(p => (p.sheet_key || p.chave) === curVal)) {
      selectSim.value = curVal;
    }
  }
}

function renderCostProductsTable(produtos) {
  const tbody = document.getElementById('tbody-cost-products');
  if (!tbody) return;

  if (!produtos || produtos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 18px;">Nenhum produto cadastrado no cálculo de custo.</td></tr>';
    return;
  }

  tbody.innerHTML = produtos.map(p => {
    const sheetKey = p.sheet_key || p.chave || '';
    const nome = p.nome || p.nome_aba || '';
    const qtdRef = p.producao_mensal_ref || p.quantidade_referencia || 1000;
    const custoFab = p.custo_fabricacao || p.custo_fabricacao_unitario || 0;
    const custoInd = (p.custo_adm_mo || 0) + (p.custo_despesas_fixas || 0) || p.custo_indireto_unitario || 0;
    const custoReal = p.custo_real_total || p.custo_real_unitario || 0;
    const markupPct = p.markup_pct || p.markup_percentual || 50;
    const markupVal = p.markup_valor || 0;
    const impostoVal = p.imposto_valor || 0;
    const precoVenda = p.preco_venda_sugerido || p.preco_sugerido || 0;
    const margemRs = p.margem_contribuicao_rs || p.margem_contribuicao_valor || 0;
    const margemPct = p.margem_contribuicao_pct || 0;

    return `
      <tr data-prod-key="${sheetKey}">
        <td>
          <strong style="color: var(--text-main); font-size: 0.95rem;">${sheetKey}</strong>
          <br><small style="color: var(--text-muted);">${nome}</small>
        </td>
        <td style="white-space: nowrap;">
          <div class="cost-input-wrapper">
            <input type="text" class="cost-edit-input" style="width: 68px;" value="${qtdRef}"
              onchange="onCostProductCellEdit('${sheetKey}', 'producao_mensal_ref', this.value)"
              title="Clique para editar a quantidade de referência mensal">
            <span class="cost-input-symbol">un</span>
          </div>
        </td>
        <td>
          <div class="cost-input-wrapper">
            <span class="cost-input-symbol">R$</span>
            <input type="text" class="cost-edit-input" style="width: 65px;" value="${custoFab.toFixed(2).replace('.', ',')}"
              onchange="onCostProductCellEdit('${sheetKey}', 'custo_fabricacao', this.value)"
              title="Clique para editar o Custo Direto de Fabricação">
          </div>
        </td>
        <td>
          <div class="cost-input-wrapper">
            <span class="cost-input-symbol">R$</span>
            <input type="text" class="cost-edit-input" style="width: 65px;" value="${custoInd.toFixed(2).replace('.', ',')}"
              onchange="onCostProductCellEdit('${sheetKey}', 'custo_indireto', this.value)"
              title="Clique para editar Despesas Indiretas e Mão de Obra">
          </div>
        </td>
        <td>
          <strong class="cost-val-real" id="cost-real-${sheetKey}" style="color: var(--text-main); font-size: 0.92rem;">
            ${formatBRL(custoReal)}
          </strong>
        </td>
        <td>
          <div class="cost-input-wrapper">
            <input type="text" class="cost-edit-input" id="input-markup-${sheetKey}" style="width: 48px; color: #0284c7;" value="${markupPct.toFixed(0)}"
              onchange="onCostProductCellEdit('${sheetKey}', 'markup_pct', this.value)"
              title="Clique para editar o Markup percentual">
            <span class="cost-input-symbol">%</span>
          </div>
          <br><small class="cost-val-markup-val" id="cost-markup-val-${sheetKey}" style="color: var(--text-muted);">+${formatBRL(markupVal)}</small>
        </td>
        <td>
          <span class="cost-val-imposto" id="cost-imposto-${sheetKey}" style="color: #ef4444; font-weight: 600;">
            ${formatBRL(impostoVal)}
          </span>
        </td>
        <td>
          <div class="cost-input-wrapper">
            <span class="cost-input-symbol" style="color: #0284c7; font-weight: 700;">R$</span>
            <input type="text" class="cost-edit-input" id="input-preco-${sheetKey}" style="width: 74px; color: #0284c7; font-size: 0.95rem; font-weight: 800;" value="${precoVenda.toFixed(2).replace('.', ',')}"
              onchange="onCostProductCellEdit('${sheetKey}', 'preco_venda_sugerido', this.value)"
              title="Clique para editar o preço sugerido diretamente (recalcula markup)">
          </div>
        </td>
        <td>
          <strong class="cost-val-margem-rs" id="cost-margem-rs-${sheetKey}" style="color: #059669;">
            +${formatBRL(margemRs)}
          </strong>
        </td>
        <td>
          <span class="rep-tag tag-success cost-val-margem-pct" id="cost-margem-pct-${sheetKey}" style="font-weight: 700;">
            ${margemPct.toFixed(1)}%
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 4px; align-items: center;">
            <button class="btn-action-small" onclick="selectAndScrollToBOM('${sheetKey}')" title="Explodir Lista de Materiais e Gráfico">
              🔬 BOM
            </button>
            <button class="btn-action-small" onclick="resetSingleCostProduct('${sheetKey}')" title="Restaurar valores originais deste produto" style="padding: 4px 6px;">
              ↺
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function onCostProductCellEdit(sheetKey, field, rawValue) {
  const data = window.DASHBOARD_DATA;
  if (!data || !data.custos_industriais || !data.custos_industriais.produtos_custo) return;

  const prod = data.custos_industriais.produtos_custo.find(p => (p.sheet_key || p.chave) === sheetKey);
  if (!prod) return;

  const numVal = parseUserNumber(rawValue);

  if (field === 'producao_mensal_ref') {
    prod.producao_mensal_ref = Math.max(1, parseInt(numVal) || 1000);
    prod.quantidade_referencia = prod.producao_mensal_ref;
  } else if (field === 'custo_fabricacao') {
    prod.custo_fabricacao = Math.max(0, numVal);
    prod.custo_fabricacao_unitario = prod.custo_fabricacao;
  } else if (field === 'custo_indireto') {
    prod.custo_adm_mo = Math.max(0, numVal);
    prod.custo_despesas_fixas = 0;
    prod.custo_indireto_unitario = prod.custo_adm_mo;
  }

  // Recalcular Custo Real
  const custoFab = prod.custo_fabricacao || 0;
  const custoInd = (prod.custo_adm_mo || 0) + (prod.custo_despesas_fixas || 0);
  const custoReal = custoFab + custoInd;
  prod.custo_real_total = custoReal;
  prod.custo_real_unitario = custoReal;

  const aliquota = 0.12;

  if (field === 'preco_venda_sugerido') {
    const preco = Math.max(0.01, numVal);
    prod.preco_venda_sugerido = preco;
    prod.preco_sugerido = preco;
    const imposto = preco * aliquota;
    prod.imposto_valor = imposto;
    const markupVal = preco - imposto - custoReal;
    prod.markup_valor = markupVal;
    prod.markup_pct = custoReal > 0 ? (markupVal / custoReal) * 100 : 0;
    prod.markup_percentual = prod.markup_pct;
    prod.margem_contribuicao_rs = markupVal;
    prod.margem_contribuicao_valor = markupVal;
    prod.margem_contribuicao_pct = preco > 0 ? (markupVal / preco) * 100 : 0;
  } else {
    if (field === 'markup_pct') {
      prod.markup_pct = numVal;
      prod.markup_percentual = numVal;
    }
    const markupPct = typeof prod.markup_pct === 'number' ? prod.markup_pct : 50;
    const markupVal = custoReal * (markupPct / 100);
    prod.markup_valor = markupVal;
    const preco = aliquota < 1 ? (custoReal + markupVal) / (1 - aliquota) : (custoReal + markupVal);
    prod.preco_venda_sugerido = preco;
    prod.preco_sugerido = preco;
    const imposto = preco * aliquota;
    prod.imposto_valor = imposto;
    prod.margem_contribuicao_rs = markupVal;
    prod.margem_contribuicao_valor = markupVal;
    prod.margem_contribuicao_pct = preco > 0 ? (markupVal / preco) * 100 : 0;
  }

  // Atualizar elementos da linha no DOM
  const elReal = document.getElementById(`cost-real-${sheetKey}`);
  if (elReal) elReal.innerText = formatBRL(prod.custo_real_total);

  const elMarkupInput = document.getElementById(`input-markup-${sheetKey}`);
  if (elMarkupInput && field !== 'markup_pct') elMarkupInput.value = prod.markup_pct.toFixed(0);

  const elMarkupVal = document.getElementById(`cost-markup-val-${sheetKey}`);
  if (elMarkupVal) elMarkupVal.innerText = '+' + formatBRL(prod.markup_valor);

  const elImposto = document.getElementById(`cost-imposto-${sheetKey}`);
  if (elImposto) elImposto.innerText = formatBRL(prod.imposto_valor);

  const elPrecoInput = document.getElementById(`input-preco-${sheetKey}`);
  if (elPrecoInput && field !== 'preco_venda_sugerido') elPrecoInput.value = prod.preco_venda_sugerido.toFixed(2).replace('.', ',');

  const elMargemRs = document.getElementById(`cost-margem-rs-${sheetKey}`);
  if (elMargemRs) elMargemRs.innerText = '+' + formatBRL(prod.margem_contribuicao_rs);

  const elMargemPct = document.getElementById(`cost-margem-pct-${sheetKey}`);
  if (elMargemPct) elMargemPct.innerText = prod.margem_contribuicao_pct.toFixed(1) + '%';

  // Destacar linha modificada
  const tr = document.querySelector(`tr[data-prod-key="${sheetKey}"]`);
  if (tr) tr.classList.add('cost-row-modified');

  // Salvar no navegador
  saveCustomCostProducts();

  // Atualizar BOM se este for o produto ativo
  if (currentSelectedBOMKey === sheetKey) {
    loadProductBOM(sheetKey);
  }

  // Atualizar Simulador se este for o produto selecionado
  const simSel = document.getElementById('sim-product-select');
  if (simSel && simSel.value === sheetKey) {
    runInteractiveCostSimulation();
  }

  // Atualizar Seção 8 do Relatório Executivo
  renderReportSection8(data);
}

function resetSingleCostProduct(sheetKey) {
  const data = window.DASHBOARD_DATA;
  if (!data || !data.custos_industriais || !data.custos_industriais.produtos_custo_original) return;

  const orig = data.custos_industriais.produtos_custo_original.find(p => (p.sheet_key || p.chave) === sheetKey);
  const target = data.custos_industriais.produtos_custo.find(p => (p.sheet_key || p.chave) === sheetKey);
  if (!orig || !target) return;

  Object.assign(target, JSON.parse(JSON.stringify(orig)));

  saveCustomCostProducts();
  renderCostProductsTable(data.custos_industriais.produtos_custo);

  if (currentSelectedBOMKey === sheetKey) {
    loadProductBOM(sheetKey);
  }
  runInteractiveCostSimulation();
  renderReportSection8(data);
}

function resetAllCostProducts() {
  const data = window.DASHBOARD_DATA;
  if (!data || !data.custos_industriais || !data.custos_industriais.produtos_custo_original) return;

  if (!confirm('Deseja restaurar todos os 12 produtos para os valores originais da planilha de custos?')) {
    return;
  }

  data.custos_industriais.produtos_custo = JSON.parse(JSON.stringify(data.custos_industriais.produtos_custo_original));
  localStorage.removeItem('mb_custos_customizados');

  renderCostProductsTable(data.custos_industriais.produtos_custo);
  populateCostProductSelects(data.custos_industriais.produtos_custo);

  if (data.custos_industriais.produtos_custo.length > 0) {
    loadProductBOM(currentSelectedBOMKey || data.custos_industriais.produtos_custo[0].sheet_key);
  }
  runInteractiveCostSimulation();
  renderReportSection8(data);

  alert('✓ Valores originais de custos, markup e preços restaurados com sucesso!');
}

function exportCostProductsCSV() {
  const data = window.DASHBOARD_DATA;
  if (!data || !data.custos_industriais || !data.custos_industriais.produtos_custo) return;

  const prods = data.custos_industriais.produtos_custo;
  let csv = 'Produto;Nome_Completo;Ref_Mensal_Unidades;Custo_Fabricacao_RS;Despesas_Indiretas_MO_RS;Custo_Real_Total_RS;Markup_Percentual;Markup_Valor_RS;Impostos_12_RS;Preco_Venda_Sugerido_RS;Margem_Contribuicao_RS;Margem_Contribuicao_Percentual\n';

  prods.forEach(p => {
    const sheetKey = p.sheet_key || p.chave || '';
    const nome = (p.nome || p.nome_aba || '').replace(/"/g, '""');
    const qtdRef = p.producao_mensal_ref || p.quantidade_referencia || 1000;
    const custoFab = (p.custo_fabricacao || p.custo_fabricacao_unitario || 0).toFixed(2);
    const custoInd = ((p.custo_adm_mo || 0) + (p.custo_despesas_fixas || 0) || p.custo_indireto_unitario || 0).toFixed(2);
    const custoReal = (p.custo_real_total || p.custo_real_unitario || 0).toFixed(2);
    const markupPct = (p.markup_pct || p.markup_percentual || 50).toFixed(1);
    const markupVal = (p.markup_valor || 0).toFixed(2);
    const impostoVal = (p.imposto_valor || 0).toFixed(2);
    const precoVenda = (p.preco_venda_sugerido || p.preco_sugerido || 0).toFixed(2);
    const margemRs = (p.margem_contribuicao_rs || p.margem_contribuicao_valor || 0).toFixed(2);
    const margemPct = (p.margem_contribuicao_pct || 0).toFixed(1);

    csv += `"${sheetKey}";"${nome}";${qtdRef};${custoFab};${custoInd};${custoReal};${markupPct};${markupVal};${impostoVal};${precoVenda};${margemRs};${margemPct}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', 'Tabela_Custos_e_Precos_Empresa_1.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderReportSection8(data) {
  const prodsCusto = data.custos_industriais ? data.custos_industriais.produtos_custo : null;
  const repTbodyCustos = document.getElementById('rep-tbody-custos');
  if (repTbodyCustos && prodsCusto) {
    if (prodsCusto.length === 0) {
      repTbodyCustos.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 10px;">Nenhum produto cadastrado no módulo de custos.</td></tr>';
    } else {
      repTbodyCustos.innerHTML = prodsCusto.map(p => {
        const sheetKey = p.sheet_key || p.chave || '';
        const nome = p.nome || p.nome_aba || '';
        const qtdRef = p.producao_mensal_ref || p.quantidade_referencia || 1000;
        const custoFab = p.custo_fabricacao || p.custo_fabricacao_unitario || 0;
        const custoInd = (p.custo_adm_mo || 0) + (p.custo_despesas_fixas || 0) || p.custo_indireto_unitario || 0;
        const custoReal = p.custo_real_total || p.custo_real_unitario || 0;
        const markupPct = p.markup_pct || p.markup_percentual || 50;
        const impostoVal = p.imposto_valor || 0;
        const precoVenda = p.preco_venda_sugerido || p.preco_sugerido || 0;
        const margemRs = p.margem_contribuicao_rs || p.margem_contribuicao_valor || 0;
        const margemPct = p.margem_contribuicao_pct || 0;

        return `
          <tr>
            <td><strong>${sheetKey}</strong><br><small style="color: #64748b;">${nome}</small></td>
            <td>${formatNumber(qtdRef)} un</td>
            <td>${formatBRL(custoFab)}</td>
            <td>${formatBRL(custoInd)}</td>
            <td><strong>${formatBRL(custoReal)}</strong></td>
            <td><span class="rep-tag tag-info">${markupPct.toFixed(0)}%</span></td>
            <td>${formatBRL(impostoVal)}</td>
            <td><strong style="color: #0284c7;">${formatBRL(precoVenda)}</strong></td>
            <td><strong style="color: #059669;">+${formatBRL(margemRs)} (${margemPct.toFixed(1)}%)</strong></td>
          </tr>
        `;
      }).join('');
    }
  }
}

function renderReportBudgetSection(data) {
  const compKey = state.currentCompany || 'consolidado';
  const empData = data && data.empresas ? data.empresas[compKey] : null;
  const serieMensal = (empData && empData.serie_mensal) || [];

  const real2026Map = {};
  serieMensal.forEach(s => {
    if (String(s.ano_mes || '').startsWith('2026-')) {
      const m = parseInt(String(s.ano_mes).split('-')[1], 10);
      real2026Map[m] = s.faturamento || 0;
    }
  });

  const mesesLabels = [
    { m: 1, nome: 'Janeiro' }, { m: 2, nome: 'Fevereiro' }, { m: 3, nome: 'Março' },
    { m: 4, nome: 'Abril' }, { m: 5, nome: 'Maio' }, { m: 6, nome: 'Junho' },
    { m: 7, nome: 'Julho' }, { m: 8, nome: 'Agosto' }, { m: 9, nome: 'Setembro' },
    { m: 10, nome: 'Outubro' }, { m: 11, nome: 'Novembro' }, { m: 12, nome: 'Dezembro' }
  ];

  let totalMeta2026 = 0;
  let totalReal2026 = 0;
  let totalMeta2027 = 0;

  const rowsHtml = mesesLabels.map(({ m, nome }) => {
    const rec2026 = getFatoBudgetRecord(2026, m, compKey);
    const rec2027 = getFatoBudgetRecord(2027, m, compKey);
    const meta2026 = rec2026 ? (rec2026.Valor_Budget_Receita || 0) : 0;
    const real2026 = real2026Map[m] || 0;
    const meta2027 = rec2027 ? (rec2027.Valor_Budget_Receita || 0) : 0;

    totalMeta2026 += meta2026;
    totalReal2026 += real2026;
    totalMeta2027 += meta2027;

    const pct2026 = meta2026 > 0 ? (real2026 / meta2026) * 100 : 0;
    const diff2026 = real2026 - meta2026;
    const diffColor = diff2026 >= 0 ? '#059669' : '#e11d48';
    const pctTagClass = pct2026 >= 100 ? 'tag-success' : (pct2026 > 0 ? 'tag-warning' : 'tag-info');

    return `
      <tr>
        <td><strong>${String(m).padStart(2, '0')} - ${nome}</strong></td>
        <td>${formatBRL(meta2026)}</td>
        <td><strong>${real2026 > 0 ? formatBRL(real2026) : '—'}</strong></td>
        <td><span class="rep-tag ${pctTagClass}">${real2026 > 0 && meta2026 > 0 ? pct2026.toFixed(1) + '%' : '—'}</span></td>
        <td style="color: ${real2026 > 0 ? diffColor : '#64748b'}; font-weight: 600;">${real2026 > 0 ? (diff2026 >= 0 ? '+' : '') + formatBRL(diff2026) : '—'}</td>
        <td><strong style="color: #7c3aed;">${formatBRL(meta2027)}</strong></td>
      </tr>
    `;
  }).join('');

  const gap2026 = Math.max(0, totalMeta2026 - totalReal2026);
  const pctTotal2026 = totalMeta2026 > 0 ? (totalReal2026 / totalMeta2026) * 100 : 0;

  const elMeta26 = document.getElementById('rep-budget-meta-2026');
  const elReal26 = document.getElementById('rep-budget-real-2026');
  const elGap26 = document.getElementById('rep-budget-gap-2026');
  const elMeta27 = document.getElementById('rep-budget-meta-2027');

  if (elMeta26) elMeta26.innerText = formatBRL(totalMeta2026);
  if (elReal26) elReal26.innerText = `${formatBRL(totalReal2026)} (${pctTotal2026.toFixed(1)}%)`;
  if (elGap26) elGap26.innerText = formatBRL(gap2026);
  if (elMeta27) elMeta27.innerText = formatBRL(totalMeta2027);

  const tbody = document.getElementById('rep-tbody-budget');
  if (tbody) {
    const diffTotal2026 = totalReal2026 - totalMeta2026;
    tbody.innerHTML = rowsHtml + `
      <tr style="background: #f1f5f9; font-weight: 800;">
        <td><strong>TOTAL ANUAL ACUMULADO</strong></td>
        <td><strong>${formatBRL(totalMeta2026)}</strong></td>
        <td><strong style="color: #059669;">${formatBRL(totalReal2026)}</strong></td>
        <td><strong>${pctTotal2026.toFixed(1)}%</strong></td>
        <td style="color: ${diffTotal2026 >= 0 ? '#059669' : '#e11d48'};"><strong>${(diffTotal2026 >= 0 ? '+' : '') + formatBRL(diffTotal2026)}</strong></td>
        <td><strong style="color: #7c3aed;">${formatBRL(totalMeta2027)}</strong></td>
      </tr>
    `;
  }
}

function renderReportGastosSection() {
  const compKey = state.currentCompany || 'consolidado';
  const anoSelect = document.getElementById('gastos-ano-select');
  const selectedAno = anoSelect ? anoSelect.value : '2027';

  const gastosList = getGastosListForContext(selectedAno, compKey);
  const mesesNomes = {
    '1': '01 - Janeiro', '2': '02 - Fevereiro', '3': '03 - Março', '4': '04 - Abril',
    '5': '05 - Maio', '6': '06 - Junho', '7': '07 - Julho', '8': '08 - Agosto',
    '9': '09 - Setembro', '10': '10 - Outubro', '11': '11 - Novembro', '12': '12 - Dezembro',
    'anual': 'Ano Todo (Recorrente)'
  };

  let totalPlanejado = 0;
  let totalFeito = 0;
  let countFeito = 0;
  let totalPendente = 0;
  let countPendente = 0;

  gastosList.forEach(item => {
    const val = Number(item.anual) || 0;
    totalPlanejado += val;
    if (item.feito) {
      totalFeito += val;
      countFeito++;
    } else {
      totalPendente += val;
      countPendente++;
    }
  });

  const elAnoLbl = document.getElementById('rep-gastos-ano-lbl');
  const elTotal = document.getElementById('rep-gastos-total');
  const elFeito = document.getElementById('rep-gastos-feito');
  const elPendente = document.getElementById('rep-gastos-pendente');

  if (elAnoLbl) elAnoLbl.innerText = selectedAno;
  if (elTotal) elTotal.innerText = formatBRL(totalPlanejado);
  if (elFeito) elFeito.innerText = `${formatBRL(totalFeito)} (${countFeito} ${countFeito === 1 ? 'item' : 'itens'})`;
  if (elPendente) elPendente.innerText = `${formatBRL(totalPendente)} (${countPendente} ${countPendente === 1 ? 'item' : 'itens'})`;

  const tbody = document.getElementById('rep-tbody-gastos');
  if (tbody) {
    if (gastosList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 10px;">Nenhum gasto ou investimento cadastrado para este ano.</td></tr>';
    } else {
      const rows = gastosList.map(item => {
        const mesTxt = mesesNomes[String(item.mes || '1')] || '01 - Janeiro';
        const val = Number(item.anual) || 0;
        const isFeito = Boolean(item.feito);
        const statusBadge = isFeito
          ? '<span class="rep-tag tag-success">✓ FEITO / VALIDADO</span>'
          : '<span class="rep-tag tag-warning">○ NÃO FEITO / PENDENTE</span>';

        return `
          <tr>
            <td><strong>${mesTxt} / ${selectedAno}</strong></td>
            <td><strong>${item.nome || 'Sem descrição'}</strong></td>
            <td><strong style="color: ${isFeito ? '#059669' : '#0284c7'};">${formatBRL(val)}</strong></td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows + `
        <tr style="background: #f1f5f9; font-weight: 800;">
          <td colspan="2"><strong>TOTAL DO PLANO DE GASTOS E INVESTIMENTOS (${selectedAno})</strong></td>
          <td><strong style="color: #0284c7;">${formatBRL(totalPlanejado)}</strong></td>
          <td><strong>Feito: ${formatBRL(totalFeito)} • Pendente: ${formatBRL(totalPendente)}</strong></td>
        </tr>
      `;
    }
  }
}

function filterCostProductsTable() {
  const query = (document.getElementById('search-cost-product')?.value || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#tbody-cost-products tr');

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = (!query || text.includes(query)) ? '' : 'none';
  });
}

function selectAndScrollToBOM(sheetKey) {
  currentSelectedBOMKey = sheetKey;
  switchCostSubView('produtos');

  const select = document.getElementById('select-bom-product');
  if (select) {
    select.value = sheetKey;
  }
  loadProductBOM(sheetKey);

  const panel = document.getElementById('panel-bom-detail');
  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function onSelectBOMProductChange() {
  const select = document.getElementById('select-bom-product');
  if (!select) return;
  currentSelectedBOMKey = select.value;
  loadProductBOM(select.value);
}

function loadProductBOM(sheetKey) {
  const data = window.DASHBOARD_DATA;
  if (!data || !data.custos_industriais || !data.custos_industriais.produtos_custo) return;

  const prod = data.custos_industriais.produtos_custo.find(p => (p.sheet_key || p.chave) === sheetKey);
  if (!prod) return;

  currentSelectedBOMKey = prod.sheet_key || prod.chave;

  const sheetName = prod.sheet_key || prod.chave;
  const prodNome = prod.nome || prod.nome_aba;
  const qtdRef = prod.producao_mensal_ref || prod.quantidade_referencia || 1000;
  const custoFab = prod.custo_fabricacao || prod.custo_fabricacao_unitario || 0;
  const custoInd = (prod.custo_adm_mo || 0) + (prod.custo_despesas_fixas || 0) || prod.custo_indireto_unitario || 0;
  const custoReal = prod.custo_real_total || prod.custo_real_unitario || 0;
  const markupPct = prod.markup_pct || prod.markup_percentual || 50;
  const markupVal = prod.markup_valor || 0;
  const impostoVal = prod.imposto_valor || 0;
  const precoVenda = prod.preco_venda_sugerido || prod.preco_sugerido || 0;

  // Atualizar título
  const subtitle = document.getElementById('bom-product-subtitle');
  if (subtitle) {
    subtitle.innerHTML = `Exibindo composição completa de: <strong>${sheetName} (${prodNome})</strong> &bull; Lote Referência: <strong>${formatNumber(qtdRef)} un</strong>`;
  }

  // Atualizar Chips de KPIs
  const summaryBox = document.getElementById('bom-kpis-summary');
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="bom-kpi-chip">
        <span class="bom-chip-label">Custo Fabril Total:</span>
        <span class="bom-chip-val" style="color: var(--text-main);">${formatBRL(custoReal)}</span>
      </div>
      <div class="bom-kpi-chip">
        <span class="bom-chip-label">Markup Sugerido:</span>
        <span class="bom-chip-val" style="color: #0284c7;">${markupPct.toFixed(0)}% (+${formatBRL(markupVal)})</span>
      </div>
      <div class="bom-kpi-chip">
        <span class="bom-chip-label">Impostos (12% DAS):</span>
        <span class="bom-chip-val" style="color: #ef4444;">${formatBRL(impostoVal)}</span>
      </div>
      <div class="bom-kpi-chip">
        <span class="bom-chip-label">Preço Final Sugerido:</span>
        <span class="bom-chip-val" style="color: #059669; font-size: 1.05rem;">${formatBRL(precoVenda)}</span>
      </div>
    `;
  }

  // Renderizar Gráfico Doughnut
  renderBOMChart(prod);

  // Preencher tabela de itens BOM
  const tbody = document.getElementById('tbody-bom-items');
  if (tbody) {
    const items = prod.itens_composicao || prod.detalhes_bom || [];
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 12px;">Nenhum componente cadastrado nesta ficha.</td></tr>';
    } else {
      tbody.innerHTML = items.map(item => {
        const desc = item.item || item.descricao || 'Item sem descrição';
        const tipo = item.tipo || item.categoria || 'Insumo';
        const unid = item.unidade || '';
        const custoUnit = item.custo_unitario || item.custo_unitario_produto || item.custo_total || 0;
        const pctCusto = custoReal > 0 ? ((custoUnit / custoReal) * 100).toFixed(1) : null;

        return `
          <tr>
            <td>
              <strong>${desc}</strong>
            </td>
            <td>
              <span class="rep-tag tag-info" style="font-size: 0.72rem;">${tipo}</span>
            </td>
            <td>
              ${unid || '-'}
            </td>
            <td>
              <strong>${formatBRL(custoUnit)}</strong>
              ${pctCusto ? `<small style="color: var(--text-muted); margin-left: 4px;">(${pctCusto}%)</small>` : ''}
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

function renderBOMChart(prod) {
  if (!prod) return;

  const custoFab = prod.custo_fabricacao || prod.custo_fabricacao_unitario || 0;
  const custoInd = (prod.custo_adm_mo || 0) + (prod.custo_despesas_fixas || 0) || prod.custo_indireto_unitario || 0;
  const markup = prod.markup_valor || 0;
  const imposto = prod.imposto_valor || 0;

  getOrCreateChart('chart-bom-composition', {
    type: 'doughnut',
    data: {
      labels: ['Custo Fabrico Direto', 'Despesas Indiretas & MO', 'Markup / Margem Bruta', 'Impostos (12% DAS)'],
      datasets: [{
        data: [custoFab, custoInd, markup, imposto],
        backgroundColor: [
          '#0284c7', // Azul Custo Direto
          '#6366f1', // Roxo Desp Indiretas
          '#059669', // Verde Markup Lucro
          '#f59e0b'  // Âmbar Impostos
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const val = ctx.raw || 0;
              const total = (custoFab + custoInd + markup + imposto) || 1;
              const pct = ((val / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${formatBRL(val)} (${pct}%)`;
            }
          }
        }
      },
      cutout: '62%'
    }
  });
}

function renderCostColaboradoresTable(colabs) {
  const tbody = document.getElementById('tbody-cost-colab');
  if (!tbody) return;

  if (!colabs || colabs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 18px;">Nenhum colaborador encontrado no modelo de custo.</td></tr>';
    return;
  }

  tbody.innerHTML = colabs.map(c => {
    const nome = c.nome || '-';
    const cargo = c.cargo || c.funcao || '-';
    const setor = c.setor || '-';
    const salBase = c.salario_base || 0;
    const encargos = c.encargos || c.encargos_beneficios || 0;
    const custoTot = c.custo_total || c.custo_mensal || 0;
    const custoH = c.custo_hora || 0;
    const adm = c.admissao || 'Efetivo';
    const st = c.status || 'Ativo';

    return `
      <tr>
        <td><strong>${nome}</strong></td>
        <td>${cargo}</td>
        <td><span class="rep-tag tag-info">${setor}</span></td>
        <td>${formatBRL(salBase)}</td>
        <td style="color: #d97706;">${formatBRL(encargos)}</td>
        <td><strong style="color: #0284c7;">${formatBRL(custoTot)}</strong></td>
        <td><strong style="color: #059669;">${formatBRL(custoH)}/h</strong></td>
        <td>${adm}</td>
        <td><span class="badge-status active">${st}</span></td>
      </tr>
    `;
  }).join('');
}

function filterCostColabTable() {
  const query = (document.getElementById('search-cost-colab')?.value || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#tbody-cost-colab tr');

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = (!query || text.includes(query)) ? '' : 'none';
  });
}

function renderCostSectorChart(setores) {
  if (!setores || typeof setores !== 'object') return;

  const setoresList = Object.entries(setores)
    .sort((a, b) => (b[1].custo_total || 0) - (a[1].custo_total || 0));

  const labels = setoresList.map(s => s[0]);
  const custos = setoresList.map(s => s[1].custo_total || 0);
  const headcounts = setoresList.map(s => s[1].headcount || s[1].colaboradores || 1);

  getOrCreateChart('chart-cost-sectors', {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Custo Total Mensal (R$)',
        data: custos,
        backgroundColor: 'rgba(2, 132, 199, 0.75)',
        borderColor: '#0284c7',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const idx = ctx.dataIndex;
              const hc = headcounts[idx];
              return ` Custo Total: ${formatBRL(ctx.raw)} (${hc} ${hc === 1 ? 'colaborador' : 'colaboradores'})`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: function(v) { return 'R$ ' + (v / 1000).toFixed(0) + 'k'; }
          }
        }
      }
    }
  });
}

function runInteractiveCostSimulation() {
  const data = window.DASHBOARD_DATA;
  if (!data || !data.custos_industriais || !data.custos_industriais.produtos_custo) return;

  const select = document.getElementById('sim-product-select');
  const sheetKey = select ? select.value : 'PMs';
  const prod = data.custos_industriais.produtos_custo.find(p => (p.sheet_key || p.chave) === sheetKey) || data.custos_industriais.produtos_custo[0];
  if (!prod) return;

  const markupRange = document.getElementById('sim-markup-range');
  const markupPct = markupRange ? parseFloat(markupRange.value) : 50;

  const markupBadge = document.getElementById('sim-markup-badge');
  if (markupBadge) markupBadge.innerText = `${markupPct}%`;

  const aliquotaSelect = document.getElementById('sim-aliquota-imposto');
  const aliquota = aliquotaSelect ? parseFloat(aliquotaSelect.value) : 0.12;

  const custoReal = prod.custo_real_total || prod.custo_real_unitario || 1.0;
  const markupValor = custoReal * (markupPct / 100);
  const precoBase = custoReal + markupValor;
  const precoSugerido = aliquota < 1 ? precoBase / (1 - aliquota) : precoBase;
  const impostoValor = precoSugerido * aliquota;
  const margemContribValor = precoSugerido - custoReal - impostoValor;
  const margemContribPct = precoSugerido > 0 ? (margemContribValor / precoSugerido) * 100 : 0;

  const qtdLote = prod.producao_mensal_ref || prod.quantidade_referencia || 1000;
  const receitaLote = precoSugerido * qtdLote;
  const lucroLote = margemContribValor * qtdLote;

  const kpisContainer = document.getElementById('cost-sim-kpis');
  if (kpisContainer) {
    kpisContainer.innerHTML = `
      <div class="sim-result-card" style="border-top: 3px solid #64748b;">
        <div class="sim-card-title">CUSTO INDUSTRIAL TOTAL</div>
        <div class="sim-card-value">${formatBRL(custoReal)}</div>
        <div class="sim-card-desc">Custo Fabril (MP + Insumos) + Desp. Indiretas e MO</div>
      </div>

      <div class="sim-result-card" style="border-top: 3px solid #d97706;">
        <div class="sim-card-title">MARKUP ADICIONADO (${markupPct}%)</div>
        <div class="sim-card-value" style="color: #d97706;">+${formatBRL(markupValor)}</div>
        <div class="sim-card-desc">Margem bruta sobre o custo fabril unitário</div>
      </div>

      <div class="sim-result-card" style="border-top: 3px solid #ef4444;">
        <div class="sim-card-title">IMPOSTO ESTIMADO (${(aliquota * 100).toFixed(0)}%)</div>
        <div class="sim-card-value" style="color: #ef4444;">${formatBRL(impostoValor)}</div>
        <div class="sim-card-desc">Simples Nacional (DAS) embutido no preço de venda</div>
      </div>

      <div class="sim-result-card highlight">
        <div class="sim-card-title">PREÇO SUGERIDO FINAL</div>
        <div class="sim-card-value">${formatBRL(precoSugerido)}</div>
        <div class="sim-card-desc">Preço ideal ao cliente para garantir a margem líquida</div>
      </div>

      <div class="sim-result-card" style="border-top: 3px solid #059669;">
        <div class="sim-card-title">MARGEM DE CONTRIBUIÇÃO</div>
        <div class="sim-card-value" style="color: #059669;">+${formatBRL(margemContribValor)} <span style="font-size: 0.85rem; font-weight: normal;">(${margemContribPct.toFixed(1)}%)</span></div>
        <div class="sim-card-desc">Ganho líquido por unidade vendida após impostos e custos</div>
      </div>

      <div class="sim-result-card" style="border-top: 3px solid #0284c7;">
        <div class="sim-card-title">LUCRO TOTAL NO LOTE MENSAL</div>
        <div class="sim-card-value" style="color: #0284c7;">${formatBRL(lucroLote)}</div>
        <div class="sim-card-desc">Faturamento de ${formatBRL(receitaLote)} (${formatNumber(qtdLote)} un)</div>
      </div>
    `;
  }
}

window.switchCostSubView = switchCostSubView;
window.renderCustosModule = renderCustosModule;
window.renderCostProductsTable = renderCostProductsTable;
window.filterCostProductsTable = filterCostProductsTable;
window.selectAndScrollToBOM = selectAndScrollToBOM;
window.onSelectBOMProductChange = onSelectBOMProductChange;
window.loadProductBOM = loadProductBOM;
window.filterCostColabTable = filterCostColabTable;
window.runInteractiveCostSimulation = runInteractiveCostSimulation;
window.onCostProductCellEdit = onCostProductCellEdit;
window.resetSingleCostProduct = resetSingleCostProduct;
window.resetAllCostProducts = resetAllCostProducts;
window.exportCostProductsCSV = exportCostProductsCSV;

