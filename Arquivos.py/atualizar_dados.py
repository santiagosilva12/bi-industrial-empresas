import os
import sys
import glob
import json
import re
import unicodedata
import pandas as pd
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

print("=" * 75)
print("  METALÚRGICA BRILHO & MODERNA - MOTOR DE DADOS INDUSTRIAIS BI-EMPRESARIAL")
print("  Atualização e Compilação dos Relatórios Conta Azul (2020 - 2026)")
print("=" * 75)

# Determinar caminhos de diretório de forma robusta
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR) if os.path.basename(BASE_DIR).lower() == 'arquivos.py' else BASE_DIR

print(f"Diretório Raiz do Projeto: {ROOT_DIR}")
print(f"Diretório do Script:      {BASE_DIR}")

# 1. Carregar Lookup do IBGE
lookup_candidates = [
    os.path.join(ROOT_DIR, 'ibge_lookup.json'),
    os.path.join(BASE_DIR, 'ibge_lookup.json')
]
city_lookup = {}
for lp in lookup_candidates:
    if os.path.exists(lp):
        with open(lp, 'r', encoding='utf-8') as f:
            city_lookup = json.load(f)
        print(f"✓ Base de Municípios IBGE: {len(city_lookup)} cidades mapeadas ({os.path.basename(lp)}).")
        break

def norm(s):
    if not isinstance(s, str): return ""
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower().strip()

def get_uf_and_regiao(city):
    if not isinstance(city, str) or not city.strip() or city == '(em branco)':
        return 'N/D', 'Não Identificado'
    cn = norm(city)
    if cn in city_lookup:
        return city_lookup[cn].get('uf', 'OUTRO'), city_lookup[cn].get('regiao', 'Outro')
    if any(ext in cn for ext in ['argentina', 'china', 'estados unidos', 'colombia', 'mexico', 'italia', 'portugal']):
        return 'EX', 'Exterior'
    return 'OUTRO', 'Outro'

def categorize_product(prod_name):
    p = str(prod_name).upper()
    if 'PONTA' in p or 'PM' in p or 'DIAMANTAD' in p:
        if 'FRESA' in p:
            return 'Fresas Diamantadas'
        return 'Pontas Diamantadas'
    elif 'TUNGST' in p:
        return 'Fresas de Tungstênio'
    elif 'FRESA' in p:
        return 'Fresas Especiais'
    elif 'MANDRIL' in p or 'ARRUELA' in p or 'HASTE' in p:
        return 'Mandris & Acessórios'
    elif 'LIXA' in p or 'ABRASIV' in p or 'DISCO' in p:
        return 'Lixas & Abrasivos'
    elif 'FIBRA' in p or 'MEMORIA' in p:
        return 'Fibras Moleculares'
    elif 'BROCA' in p or 'POLIDOR' in p:
        return 'Brocas & Polidores'
    elif 'ENUCLEADORA' in p or 'PINCA' in p or 'ALICATE' in p or 'FORMAS' in p:
        return 'Instrumentais & Podologia'
    elif 'KIT' in p:
        return 'Kits & Conjuntos'
    else:
        return 'Outros Produtos'

# 2. Localizar Arquivos de Vendas nas Pastas Organizadas e na Raiz
sales_dirs = [
    os.path.join(ROOT_DIR, 'Relatório de vendas'),
    ROOT_DIR,
    BASE_DIR
]
found_sales_files = set()
for sdir in sales_dirs:
    if os.path.exists(sdir):
        found_sales_files.update(glob.glob(os.path.join(sdir, '*VENDAS*.xlsx')))
        found_sales_files.update(glob.glob(os.path.join(sdir, '*RELAORIO*.xlsx')))
        found_sales_files.update(glob.glob(os.path.join(sdir, '*RELATORIO*.xlsx')))

sales_files = sorted([
    f for f in found_sales_files
    if not os.path.basename(f).startswith('~$')
    and 'CHURN' not in os.path.basename(f).upper()
    and 'COLABORADORES' not in os.path.basename(f).upper()
    and 'PENDENTES' not in os.path.basename(f).upper()
])

print(f"\nLocalizados {len(sales_files)} arquivos de vendas:")
for f in sales_files:
    fname = os.path.basename(f)
    is_mod = 'MODERNA' in fname.upper() or 'MOD' in fname.upper()
    print(f"  • [{'MODERNA' if is_mod else 'METALÚRGICA BRILHO'}] {fname}")

# Unificar Clientes pelo Nome Comercial (Agrupando múltiplos CNPJs, Filiais e variações de cadastro)
def clean_client_name(n):
    if not isinstance(n, str) or not n.strip():
        return 'SEM IDENTIFICACAO'
    s = n.upper().strip()
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')
    
    # Remover dígitos de CPF / CNPJ do início ou do fim
    s = re.sub(r'^\d{2}[\s\.\-/]*\d{3}[\s\.\-/]*\d{3}[\s\.\-/]*\d{4}[\s\.\-/]*\d{2}\s*', '', s)
    s = re.sub(r'^\d{2}[\s\.]*\d{3}[\s\.]*\d{3}\s*', '', s)
    s = re.sub(r'^\d{8,14}\s*', '', s)
    s = re.sub(r'\s*\b\d{11}\b', '', s)
    s = re.sub(r'\s*\b\d{14}\b', '', s)
    s = re.sub(r'\s*\b\d{8,10}\b', '', s)

    # Remover parênteses
    s = re.sub(r'\([^\)]*\)', ' ', s)
    
    # Remover sufixos societários e palavras genéricas de filial/empresa
    stopwords = r'\b(LTDA|EIRELI|EPP|ME|S/?A|S\.A|SOCIEDADE LIMITADA|MEI|COMERCIO|COMERCIAL|DISTRIBUIDORA|IMPORTADORA|EXPORTADORA|COSMETICOS|PRODUTOS|PERFUMARIA|EXPRESS|MATRIZ|FILIAL|BRASIL|BH|SP|RJ|PR|MG|GO|SC|RS|DF|ES|BA|PE|CE|MT|MS)\b'
    s = re.sub(stopwords, ' ', s)
    
    # Conectivos
    s = re.sub(r'\b(DE|DA|DO|DAS|DOS|E)\b', ' ', s)
    
    # Caracteres alfanuméricos
    s = re.sub(r'[^A-Z0-9]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s if len(s) >= 3 else n.upper().strip()

dfs_item_level = []
dfs_order_summary = []

for file_path in sales_files:
    fname = os.path.basename(file_path).upper()
    empresa = 'Moderna' if ('MODERNA' in fname or 'MOD' in fname) else 'Metalúrgica Brilho'
    try:
        df_temp = pd.read_excel(file_path)
        df_temp['Empresa'] = empresa
        df_temp['Arquivo_Origem'] = os.path.basename(file_path)
        if 'Valor Total' in df_temp.columns:
            dfs_item_level.append(df_temp)
        elif 'Valor líquido' in df_temp.columns:
            dfs_order_summary.append(df_temp)
        else:
            print(f"! Formato não reconhecido em {file_path}: {list(df_temp.columns)}")
    except Exception as e:
        print(f"! Erro ao ler {file_path}: {e}")

if not dfs_item_level and not dfs_order_summary:
    print("! AVISO: Nenhum arquivo de vendas foi carregado com sucesso.")
    sys.exit(1)

df_items = pd.concat(dfs_item_level, ignore_index=True) if dfs_item_level else pd.DataFrame()
if len(df_items) > 0:
    df_items['Data da venda'] = pd.to_datetime(df_items['Data da venda'], errors='coerce')
    df_items = df_items.dropna(subset=['Data da venda']).copy()
    df_items['Valor Total'] = pd.to_numeric(df_items['Valor Total'], errors='coerce').fillna(0)
    df_items['Quantidade de itens'] = pd.to_numeric(df_items['Quantidade de itens'], errors='coerce').fillna(0)
    df_items['Valor unitário'] = pd.to_numeric(df_items['Valor unitário'], errors='coerce').fillna(0)
    df_items['Desconto na venda'] = pd.to_numeric(df_items['Desconto na venda'], errors='coerce').fillna(0)
    df_items['AnoMes'] = df_items['Data da venda'].dt.strftime('%Y-%m')
    df_items['Cliente_Clean'] = df_items['Cliente'].apply(clean_client_name)
    # Excluir faturamentos internos da própria Metalúrgica Brilho e Comercial Moderna (remessas para eventos/feiras/interno)
    mask_self_mb_items = df_items['Cliente_Clean'].str.contains(r'^(?:METALURGICA BRILHO\b|MODERNA$|COMERCIAL MODERNA\b)', regex=True, na=False)
    if mask_self_mb_items.any():
        rem_peds = df_items.loc[mask_self_mb_items, 'Número da venda'].nunique()
        rem_val = df_items.loc[mask_self_mb_items, 'Valor Total'].sum()
        print(f"  ✓ Filtro Eventos/Interno (Histórico Anual): removidos {rem_peds} pedidos internos MB/Moderna (R$ {rem_val:,.2f})")
        df_items = df_items[~mask_self_mb_items].copy()

# Enriquecer e integrar relatórios mensais resumidos por pedido (ex: Outubro 2026 Brilho e Moderna)
if dfs_order_summary:
    valid_cities_df = df_items[df_items['Cidade do cliente'].notnull() & (df_items['Cidade do cliente'] != '(em branco)')]
    city_by_raw = valid_cities_df.groupby('Cliente')['Cidade do cliente'].last().to_dict()
    city_by_clean = valid_cities_df.groupby('Cliente_Clean')['Cidade do cliente'].last().to_dict()

    # Produto principal e preço médio histórico por cliente
    prod_by_clean = {}
    unit_by_clean = {}
    if len(df_items) > 0:
        top_prod_df = df_items.groupby(['Cliente_Clean', 'Nome do produto/serviço']).agg(
            fat=('Valor Total', 'sum'),
            qtd=('Quantidade de itens', 'sum')
        ).reset_index().sort_values('fat', ascending=False)
        for _, r in top_prod_df.iterrows():
            ck = r['Cliente_Clean']
            if ck not in prod_by_clean and pd.notnull(r['Nome do produto/serviço']):
                prod_by_clean[ck] = str(r['Nome do produto/serviço'])
                u_p = float(r['fat'] / r['qtd']) if r['qtd'] > 0 else 5.25
                unit_by_clean[ck] = max(1.50, min(50.0, u_p))

    converted_summary_dfs = []
    covered_emp_anomes = set()

    for df_sum in dfs_order_summary:
        emp = df_sum['Empresa'].iloc[0]
        arq = df_sum['Arquivo_Origem'].iloc[0]
        # Filtrar linha de Total geral
        mask_valid_ord = df_sum['Número da venda'].notnull() & (~df_sum['Número da venda'].astype(str).str.upper().str.contains('TOTAL'))
        df_s = df_sum[mask_valid_ord].copy()
        df_s['Data da venda'] = pd.to_datetime(df_s['Data da venda'], dayfirst=True, errors='coerce')
        df_s['Data da venda'] = df_s['Data da venda'].ffill().bfill()
        df_s = df_s.dropna(subset=['Data da venda']).copy()
        df_s['AnoMes'] = df_s['Data da venda'].dt.strftime('%Y-%m')
        df_s['Cliente_Clean_Tmp'] = df_s['Cliente'].apply(clean_client_name)
        mask_self_mb_sum = df_s['Cliente_Clean_Tmp'].str.contains(r'^(?:METALURGICA BRILHO\b|MODERNA$|COMERCIAL MODERNA\b)', regex=True, na=False)
        if mask_self_mb_sum.any():
            rem_peds_s = df_s.loc[mask_self_mb_sum, 'Número da venda'].nunique()
            rem_val_s = pd.to_numeric(df_s.loc[mask_self_mb_sum, 'Valor líquido'], errors='coerce').sum()
            print(f"  ✓ Filtro Eventos/Interno [{arq}]: removidos {rem_peds_s} pedidos internos MB/Moderna (R$ {rem_val_s:,.2f})")
            df_s = df_s[~mask_self_mb_sum].copy()

        for am in df_s['AnoMes'].unique():
            covered_emp_anomes.add((emp, am))

        # Verificar pedidos que já tinham detalhamento parcial de itens naquele mês
        df_items_emp_oct = df_items[(df_items['Empresa'] == emp) & (df_items['AnoMes'].isin(df_s['AnoMes'].unique()))].copy()
        df_items_emp_oct['ord_str'] = df_items_emp_oct['Número da venda'].astype(str).str.strip()
        existing_orders_map = {}
        for ord_k, grp in df_items_emp_oct.groupby('ord_str'):
            existing_orders_map[ord_k] = grp.copy()

        default_prod = 'PONTA DIAMANTADA CONICA PM 718' if emp == 'Metalúrgica Brilho' else 'PONTA DIAMANTADA PM 720'
        default_unit = 5.25

        rows_expanded = []
        for _, r in df_s.iterrows():
            ord_str = str(r['Número da venda']).strip()
            val_liq = float(pd.to_numeric(r.get('Valor líquido', 0), errors='coerce') or 0.0)
            val_bruto = float(pd.to_numeric(r.get('Valor bruto', val_liq), errors='coerce') or val_liq)
            desc_val = float(pd.to_numeric(r.get('Desconto na venda', 0), errors='coerce') or 0.0)
            cli_name = str(r.get('Cliente', '')).strip()
            ck = clean_client_name(cli_name)

            if ord_str in existing_orders_map:
                grp_items = existing_orders_map[ord_str].copy()
                sum_items = float(grp_items['Valor Total'].sum())
                if sum_items > 0:
                    fator = val_liq / sum_items
                    grp_items['Valor Total'] = grp_items['Valor Total'] * fator
                else:
                    grp_items['Valor Total'] = val_liq / len(grp_items)
                grp_items['Data da venda'] = r['Data da venda']
                grp_items['Arquivo_Origem'] = arq
                rows_expanded.append(grp_items)
            else:
                cid = city_by_raw.get(cli_name) or city_by_clean.get(ck)
                if not cid:
                    cid = 'Foz do Iguaçu' if 'FOZ' in cli_name.upper() else 'São Paulo'
                prod_nome = prod_by_clean.get(ck, default_prod)
                unit_p = unit_by_clean.get(ck, default_unit)
                qtd_est = max(1, int(round(val_liq / unit_p))) if val_liq > 0 else 1

                try:
                    num_venda_val = int(float(ord_str))
                except:
                    num_venda_val = ord_str

                rows_expanded.append(pd.DataFrame([{
                    'Número da venda': num_venda_val,
                    'Nota fiscal/RPS': r.get('Nota fiscal/RPS', ''),
                    'Data da venda': r['Data da venda'],
                    'Cliente': cli_name,
                    'Nome do produto/serviço': prod_nome,
                    'Unidade de medida': 'UN',
                    'Quantidade de itens': qtd_est,
                    'Valor unitário': round(val_liq / qtd_est, 4) if qtd_est > 0 else unit_p,
                    'Valor bruto': val_bruto,
                    'Desconto na venda': desc_val,
                    'Valor líquido no financeiro': val_liq,
                    'Valor Total': val_liq,
                    'Cidade do cliente': cid,
                    'Tipo de item (produto ou serviço)': 'Produto',
                    'Tipo de negociação': 'Venda',
                    'Empresa': emp,
                    'Arquivo_Origem': arq,
                    'AnoMes': r['AnoMes'],
                    'Cliente_Clean': ck
                }]))

        if rows_expanded:
            df_conv = pd.concat(rows_expanded, ignore_index=True)
            converted_summary_dfs.append(df_conv)
            print(f"  ✓ Relatório mensal integrado [{emp}]: {arq} -> {df_s['Número da venda'].nunique()} pedidos | R$ {df_conv['Valor Total'].sum():,.2f}")

    # Remover meses parciais substituídos pelos relatórios mensais fechados (ex: 2026-10 parcial nos arquivos anuais)
    if covered_emp_anomes and len(df_items) > 0:
        covered_keys = {f"{e}|{am}" for e, am in covered_emp_anomes}
        item_keys = df_items['Empresa'].astype(str) + '|' + df_items['AnoMes'].astype(str)
        df_items = df_items[~item_keys.isin(covered_keys)].copy()

    df_all = pd.concat([df_items] + converted_summary_dfs, ignore_index=True)
else:
    df_all = df_items.copy()

# Tratamento Final Unificado
df_all['Data da venda'] = pd.to_datetime(df_all['Data da venda'], errors='coerce')
df_all = df_all.dropna(subset=['Data da venda'])
df_all['Ano'] = df_all['Data da venda'].dt.year
df_all['Mes'] = df_all['Data da venda'].dt.month
df_all['AnoMes'] = df_all['Data da venda'].dt.strftime('%Y-%m')
df_all['Data_Dia'] = df_all['Data da venda'].dt.floor('D')
df_all['Valor Total'] = pd.to_numeric(df_all['Valor Total'], errors='coerce').fillna(0)
df_all['Quantidade de itens'] = pd.to_numeric(df_all['Quantidade de itens'], errors='coerce').fillna(0)
df_all['Valor unitário'] = pd.to_numeric(df_all['Valor unitário'], errors='coerce').fillna(0)
df_all['Desconto na venda'] = pd.to_numeric(df_all['Desconto na venda'], errors='coerce').fillna(0)

# Mapear UF e Região
ufs_regioes = [get_uf_and_regiao(c) for c in df_all['Cidade do cliente']]
df_all['UF'] = [u[0] for u in ufs_regioes]
df_all['Regiao'] = [u[1] for u in ufs_regioes]
df_all['Categoria'] = df_all['Nome do produto/serviço'].apply(categorize_product)

# -------------------------------------------------------------------------------------------------
# CORREÇÃO DE DUPLICIDADE (CONTA AZUL) & MAPEAMENTO COMPLETO DE TERCEIRIZAÇÃO
# 1. Identificar primeiro todos os clientes de Terceirização (incluindo nomes parecidos e variações de CNPJ)
# 2. Preservar 100% do valor real de nota fiscal dos clientes de Terceirização (sem reduzir pelo fator de duplicidade)
# 3. Calibrar o restante das vendas gerais para que o fechamento mensal bata exatamente com a pasta "Faturamento"
# -------------------------------------------------------------------------------------------------
TERCEIRIZACAO_KEYWORDS = [
    ('Nova OGP', ['NOVA OGP', 'OGP INDUSTRIA']),
    ('Volmed', ['VOLMED']),
    ('Callamed / Unimed (Usimed)', ['CALLAMED', 'CALAMED', 'CALLE MED', 'CALLEMED', 'UNIMED', 'USIMED']),
    ('Sancamed', ['SANCAMED', 'SANCA MED']),
    ('Tornado / Tóride', ['TORNADO', 'TORIDE']),
    ('Essence Dental / Pro Essence', ['ESSENCE DENTAL', 'PRO ESSENCE', 'PROESSENCE', 'IPESE']),
    ('Setormed', ['SETORMED', 'SETOR MED']),
    ('Hortron', ['HORTRON']),
    ('Comercial Gallanti', ['GALLANTI', 'GALANTI']),
    ('Nutec / Usinagem', ['NUTEC', 'PROD MOLD', 'TOLEDO & ARAUJO USINAGEM', 'TOLEDO E ARAUJO USINAGEM']),
    ('Outros Terceirizados (Lote/OEM)', ['EXXYS'])
]

def identificar_grupo_terceirizacao(nome_cliente):
    cn = norm(str(nome_cliente)).upper()
    for label, kw_list in TERCEIRIZACAO_KEYWORDS:
        if any(k in cn for k in kw_list):
            return label
    return None

def is_cliente_terceirizacao(nome_cliente):
    return identificar_grupo_terceirizacao(nome_cliente) is not None

df_all['Cliente_Original'] = df_all['Cliente'].fillna('SEM IDENTIFICACAO').astype(str).str.strip()
df_all['Grupo_Terceirizacao'] = df_all['Cliente_Original'].apply(identificar_grupo_terceirizacao)
df_all['Terceirizacao'] = df_all['Grupo_Terceirizacao'].notnull()
df_all['Valor_Bruto_Planilha'] = df_all['Valor Total'].copy()

faturamento_oficial_dir = os.path.join(ROOT_DIR, 'Faturamento')
ajuste_faturamento_oficial = []
if os.path.isdir(faturamento_oficial_dir):
    oficial_map = {}
    for fname in sorted(os.listdir(faturamento_oficial_dir)):
        if not fname.lower().endswith(('.xlsx', '.xls')) or fname.startswith('~$'):
            continue
        try:
            df_of = pd.read_excel(os.path.join(faturamento_oficial_dir, fname))
            df_of = df_of.iloc[:, :2].copy()
            df_of.columns = ['mes', 'fat']
            df_of['mes'] = pd.to_datetime(df_of['mes'], errors='coerce')
            df_of['fat'] = pd.to_numeric(df_of['fat'], errors='coerce')
            df_of = df_of.dropna()
            for _, r in df_of.iterrows():
                oficial_map[r['mes'].strftime('%Y-%m')] = float(r['fat'])
        except Exception as e:
            print(f"! Erro ao ler faturamento oficial {fname}: {e}")

    if oficial_map:
        print(f"\n✓ Faturamento Oficial carregado: {len(oficial_map)} meses ({min(oficial_map)} a {max(oficial_map)})")
        for am, fat_of in sorted(oficial_map.items()):
            mask_mes = df_all['AnoMes'] == am
            fat_atual = float(df_all.loc[mask_mes, 'Valor Total'].sum())
            if fat_atual <= 0:
                continue
            # Preservar valor integral dos clientes de terceirização no mês e ajustar apenas as vendas gerais
            mask_terc_mes = mask_mes & df_all['Terceirizacao']
            mask_geral_mes = mask_mes & (~df_all['Terceirizacao'])
            fat_terc_mes = float(df_all.loc[mask_terc_mes, 'Valor Total'].sum())
            fat_geral_mes = float(df_all.loc[mask_geral_mes, 'Valor Total'].sum())

            if fat_geral_mes > 0 and fat_of > fat_terc_mes:
                fator_geral = (fat_of - fat_terc_mes) / fat_geral_mes
                df_all.loc[mask_geral_mes, 'Valor Total'] = df_all.loc[mask_geral_mes, 'Valor Total'] * fator_geral
                df_all.loc[mask_geral_mes, 'Quantidade de itens'] = df_all.loc[mask_geral_mes, 'Quantidade de itens'] * fator_geral
                fator_efetivo = fat_of / fat_atual
            else:
                fator_efetivo = fat_of / fat_atual
                df_all.loc[mask_mes, 'Valor Total'] = df_all.loc[mask_mes, 'Valor Total'] * fator_efetivo
                df_all.loc[mask_mes, 'Quantidade de itens'] = df_all.loc[mask_mes, 'Quantidade de itens'] * fator_efetivo

            ajuste_faturamento_oficial.append({
                'ano_mes': am,
                'faturamento_anterior': round(fat_atual, 2),
                'faturamento_oficial': round(fat_of, 2),
                'fator': round(fator_efetivo, 4)
            })
        tot_ant = sum(a['faturamento_anterior'] for a in ajuste_faturamento_oficial)
        tot_of = sum(a['faturamento_oficial'] for a in ajuste_faturamento_oficial)
        print(f"  ✓ Ajuste aplicado: R$ {tot_ant:,.2f} (duplicado) -> R$ {tot_of:,.2f} (oficial) | diferença R$ {tot_ant - tot_of:,.2f}")

df_all['Cliente_Clean'] = df_all['Cliente_Original'].apply(clean_client_name)

# Mapear o nome oficial mais representativo (para clientes gerais; para terceirização manter o Cliente_Original para validação transparente!)
cli_canonical_map = {}
grouped_canonical = df_all.groupby(['Cliente_Clean', 'Cliente_Original'])['Valor Total'].sum().reset_index().sort_values('Valor Total', ascending=False)
for _, r in grouped_canonical.iterrows():
    ck = r['Cliente_Clean']
    if ck not in cli_canonical_map:
        cli_canonical_map[ck] = r['Cliente_Original']

df_all['Cliente'] = df_all.apply(
    lambda r: r['Cliente_Original'] if r['Terceirizacao'] else cli_canonical_map.get(r['Cliente_Clean'], r['Cliente_Original']),
    axis=1
)

df_terc_only = df_all[df_all['Terceirizacao']]
df_sem_terc = df_all[~df_all['Terceirizacao']]
print(f"\n✓ Filtro de Terceirização Ampliado ({df_terc_only['Cliente_Original'].nunique()} razões sociais / {len(TERCEIRIZACAO_KEYWORDS)} grupos):")
print(f"  • Faturamento Total Geral:         R$ {df_all['Valor Total'].sum():,.2f}")
print(f"  • Sem Terceirização (Alta Margem): R$ {df_sem_terc['Valor Total'].sum():,.2f} ({df_sem_terc['Valor Total'].sum() / df_all['Valor Total'].sum() * 100:.1f}%)")
print(f"  • Apenas Terceirização (Integral): R$ {df_terc_only['Valor Total'].sum():,.2f} ({df_terc_only['Valor Total'].sum() / df_all['Valor Total'].sum() * 100:.1f}%)")

# Função para computar métricas completas para um subconjunto de dados (Consolidado, MB ou Moderna)
def computar_metricas_empresa(df_sub):
    total_fat = float(df_sub['Valor Total'].sum())
    total_qtd = int(df_sub['Quantidade de itens'].sum())
    total_ped = int(df_sub['Número da venda'].nunique())
    total_cli = int(df_sub['Cliente'].nunique())
    ticket_m = total_fat / total_ped if total_ped > 0 else 0
    preco_m = total_fat / total_qtd if total_qtd > 0 else 0
    anos = sorted([int(a) for a in df_sub['Ano'].unique()])
    
    def calcular_recorrencia_df(df_target, top_n=40):
        if len(df_target) == 0:
            return {
                'total_clientes': 0,
                'clientes_recorrentes': 0,
                'clientes_compra_unica': 0,
                'taxa_recorrencia_pct': 0.0,
                'media_dias_recompra': 0.0,
                'mediana_dias_recompra': 0.0,
                'media_intervalo_eventos_dias': 0.0,
                'media_pedidos_recorrente': 0.0,
                'faturamento_recorrente': 0.0,
                'pct_faturamento_recorrente': 0.0,
                'faixas_ciclo': {
                    'ate_30_dias': 0,
                    'de_31_a_60_dias': 0,
                    'de_61_a_90_dias': 0,
                    'de_91_a_180_dias': 0,
                    'acima_180_dias': 0
                },
                'ranking_recorrentes': []
            }
        tot_fat = float(df_target['Valor Total'].sum())
        max_dt = df_target['Data_Dia'].max()
        c_df = df_target.groupby('Cliente').agg(
            faturamento=('Valor Total', 'sum'),
            quantidade=('Quantidade de itens', 'sum'),
            pedidos=('Número da venda', 'nunique'),
            dias_compra=('Data_Dia', 'nunique'),
            primeira_compra=('Data_Dia', 'min'),
            ultima_compra=('Data_Dia', 'max'),
            cidade=('Cidade do cliente', 'last'),
            uf=('UF', 'last')
        ).reset_index()

        tot_cli = len(c_df)
        rec_df = c_df[c_df['pedidos'] >= 2].copy()
        unicos_cnt = int((c_df['pedidos'] < 2).sum())
        rec_cnt = len(rec_df)
        taxa_rec = round(float(rec_cnt / tot_cli * 100) if tot_cli > 0 else 0.0, 1)

        if rec_cnt == 0:
            return {
                'total_clientes': tot_cli,
                'clientes_recorrentes': 0,
                'clientes_compra_unica': unicos_cnt,
                'taxa_recorrencia_pct': 0.0,
                'media_dias_recompra': 0.0,
                'mediana_dias_recompra': 0.0,
                'media_intervalo_eventos_dias': 0.0,
                'media_pedidos_recorrente': 0.0,
                'faturamento_recorrente': 0.0,
                'pct_faturamento_recorrente': 0.0,
                'faixas_ciclo': {
                    'ate_30_dias': 0,
                    'de_31_a_60_dias': 0,
                    'de_61_a_90_dias': 0,
                    'de_91_a_180_dias': 0,
                    'acima_180_dias': 0
                },
                'ranking_recorrentes': []
            }

        rec_df['span_dias'] = (rec_df['ultima_compra'] - rec_df['primeira_compra']).dt.days
        rec_df['intervalos'] = (rec_df['dias_compra'] - 1).clip(lower=1)
        rec_df['ciclo_dias'] = (rec_df['span_dias'] / rec_df['intervalos']).round(1)
        # Se comprou 2+ pedidos no mesmo dia, considerar ciclo de 1 dia
        rec_df.loc[rec_df['ciclo_dias'] <= 0, 'ciclo_dias'] = 1.0

        valid_span = rec_df[rec_df['span_dias'] > 0]
        if len(valid_span) > 0:
            media_dias = round(float(valid_span['ciclo_dias'].mean()), 1)
            mediana_dias = round(float(valid_span['ciclo_dias'].median()), 1)
            tot_int = float(valid_span['intervalos'].sum())
            media_eventos = round(float(valid_span['span_dias'].sum() / tot_int) if tot_int > 0 else media_dias, 1)
        else:
            media_dias = round(float(rec_df['ciclo_dias'].mean()), 1)
            mediana_dias = round(float(rec_df['ciclo_dias'].median()), 1)
            media_eventos = media_dias

        media_peds = round(float(rec_df['pedidos'].mean()), 1)
        fat_rec = round(float(rec_df['faturamento'].sum()), 2)
        pct_fat_rec = round(float(fat_rec / tot_fat * 100) if tot_fat > 0 else 0.0, 1)

        faixas = {
            'ate_30_dias': int((rec_df['ciclo_dias'] <= 30).sum()),
            'de_31_a_60_dias': int(((rec_df['ciclo_dias'] > 30) & (rec_df['ciclo_dias'] <= 60)).sum()),
            'de_61_a_90_dias': int(((rec_df['ciclo_dias'] > 60) & (rec_df['ciclo_dias'] <= 90)).sum()),
            'de_91_a_180_dias': int(((rec_df['ciclo_dias'] > 90) & (rec_df['ciclo_dias'] <= 180)).sum()),
            'acima_180_dias': int((rec_df['ciclo_dias'] > 180).sum())
        }

        rec_sorted = rec_df.sort_values(['faturamento', 'pedidos'], ascending=[False, False]).head(top_n)
        ranking = []
        for _, r in rec_sorted.iterrows():
            cd = float(r['ciclo_dias'])
            if cd <= 30:
                st_ciclo = 'Mensal (Alta Frequência)'
            elif cd <= 60:
                st_ciclo = 'Bimestral'
            elif cd <= 90:
                st_ciclo = 'Trimestral'
            elif cd <= 180:
                st_ciclo = 'Semestral'
            else:
                st_ciclo = 'Esporádico (>180d)'
            dias_ult = int((max_dt - r['ultima_compra']).days) if pd.notnull(r['ultima_compra']) and pd.notnull(max_dt) else 0
            ranking.append({
                'cliente': str(r['Cliente']),
                'cidade': str(r['cidade']),
                'uf': str(r['uf']),
                'pedidos': int(r['pedidos']),
                'dias_compra': int(r['dias_compra']),
                'faturamento': round(float(r['faturamento']), 2),
                'quantidade': int(r['quantidade']),
                'ticket_medio': round(float(r['faturamento'] / r['pedidos']) if r['pedidos'] > 0 else 0.0, 2),
                'primeira_compra': r['primeira_compra'].strftime('%d/%m/%Y') if pd.notnull(r['primeira_compra']) else '',
                'ultima_compra': r['ultima_compra'].strftime('%d/%m/%Y') if pd.notnull(r['ultima_compra']) else '',
                'ciclo_medio_dias': cd,
                'dias_desde_ultima': dias_ult,
                'status_ciclo': st_ciclo
            })

        return {
            'total_clientes': tot_cli,
            'clientes_recorrentes': rec_cnt,
            'clientes_compra_unica': unicos_cnt,
            'taxa_recorrencia_pct': taxa_rec,
            'media_dias_recompra': media_dias,
            'mediana_dias_recompra': mediana_dias,
            'media_intervalo_eventos_dias': media_eventos,
            'media_pedidos_recorrente': media_peds,
            'faturamento_recorrente': fat_rec,
            'pct_faturamento_recorrente': pct_fat_rec,
            'faixas_ciclo': faixas,
            'ranking_recorrentes': ranking
        }

    def extrair_resumo_df(df_target):
        if len(df_target) == 0:
            return {
                'faturamento': 0.0,
                'quantidade': 0,
                'pedidos': 0,
                'clientes': 0,
                'ticket_medio': 0.0,
                'preco_medio': 0.0,
                'categorias': [],
                'vendas_por_uf': [],
                'top_cidades': [],
                'produtos': [],
                'top_clientes': [],
                'recorrencia_compra': calcular_recorrencia_df(df_target, top_n=30)
            }
        fat = float(df_target['Valor Total'].sum())
        qtd = int(df_target['Quantidade de itens'].sum())
        ped = int(df_target['Número da venda'].nunique())
        cli = int(df_target['Cliente'].nunique())
        ticket = round(fat / ped if ped > 0 else 0, 2)
        preco = round(fat / qtd if qtd > 0 else 0, 2)
        
        # Categorias
        cat_df = df_target.groupby('Categoria').agg(
            faturamento=('Valor Total', 'sum'),
            quantidade=('Quantidade de itens', 'sum')
        ).reset_index().sort_values('faturamento', ascending=False)
        cats = [{
            'categoria': str(r['Categoria']),
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pct': round(float(r['faturamento'] / fat * 100) if fat > 0 else 0, 1)
        } for _, r in cat_df.iterrows()]
        
        # UFs
        uf_df = df_target[df_target['UF'] != 'N/D'].groupby('UF').agg(
            faturamento=('Valor Total', 'sum'),
            quantidade=('Quantidade de itens', 'sum'),
            pedidos=('Número da venda', 'nunique'),
            clientes=('Cliente', 'nunique')
        ).reset_index().sort_values('faturamento', ascending=False)
        ufs = [{
            'uf': str(r['UF']),
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos']),
            'clientes': int(r['clientes']),
            'ticket_medio': round(float(r['faturamento'] / r['pedidos']) if r['pedidos'] > 0 else 0, 2),
            'pct': round(float(r['faturamento'] / fat * 100) if fat > 0 else 0, 1)
        } for _, r in uf_df.iterrows()]
        
        # Top Cidades
        cid_df = df_target[df_target['Cidade do cliente'].notnull()].groupby(['Cidade do cliente', 'UF']).agg(
            faturamento=('Valor Total', 'sum'),
            quantidade=('Quantidade de itens', 'sum'),
            clientes=('Cliente', 'nunique')
        ).reset_index().sort_values('faturamento', ascending=False).head(50)
        cidades = [{
            'cidade': str(r['Cidade do cliente']),
            'uf': str(r['UF']),
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'clientes': int(r['clientes'])
        } for _, r in cid_df.iterrows()]

        # Top Produtos
        prod_df = df_target.groupby('Nome do produto/serviço').agg(
            faturamento=('Valor Total', 'sum'),
            quantidade=('Quantidade de itens', 'sum'),
            pedidos=('Número da venda', 'count'),
            preco_medio=('Valor unitário', 'mean')
        ).reset_index().sort_values('faturamento', ascending=False).head(40)
        prods = [{
            'nome': str(r['Nome do produto/serviço']),
            'categoria': categorize_product(r['Nome do produto/serviço']),
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos']),
            'preco_medio': round(float(r['preco_medio']), 2)
        } for _, r in prod_df.iterrows()]

        # Top Clientes
        top_cli_df = df_target.groupby('Cliente').agg(
            faturamento=('Valor Total', 'sum'),
            quantidade=('Quantidade de itens', 'sum'),
            pedidos=('Número da venda', 'nunique'),
            cidade=('Cidade do cliente', 'first'),
            uf=('UF', 'first')
        ).reset_index().sort_values('faturamento', ascending=False).head(15)
        top_cli = [{
            'cliente': str(r['Cliente']),
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos']),
            'cidade': str(r['cidade']),
            'uf': str(r['uf']),
            'ticket_medio': round(float(r['faturamento'] / r['pedidos']) if r['pedidos'] > 0 else 0, 2),
            'pct': round(float(r['faturamento'] / fat * 100) if fat > 0 else 0, 1)
        } for _, r in top_cli_df.iterrows()]

        return {
            'faturamento': round(fat, 2),
            'quantidade': qtd,
            'pedidos': ped,
            'clientes': cli,
            'ticket_medio': ticket,
            'preco_medio': preco,
            'categorias': cats,
            'vendas_por_uf': ufs,
            'top_cidades': cidades,
            'produtos': prods,
            'top_clientes': top_cli,
            'recorrencia_compra': calcular_recorrencia_df(df_target, top_n=35)
        }
    
    # Anual e sub-meses
    dados_anuais = {}
    for ano in anos:
        df_ano = df_sub[df_sub['Ano'] == ano]
        res_ano = extrair_resumo_df(df_ano)
        res_ano['meses'] = {}
        for m in range(1, 13):
            df_m = df_ano[df_ano['Mes'] == m]
            if len(df_m) > 0:
                res_ano['meses'][str(m)] = extrair_resumo_df(df_m)
        dados_anuais[str(ano)] = res_ano

    # Todos os anos combinados por mês do calendário (1 a 12)
    dados_por_mes_geral = {}
    for m in range(1, 13):
        df_m_all = df_sub[df_sub['Mes'] == m]
        if len(df_m_all) > 0:
            dados_por_mes_geral[str(m)] = extrair_resumo_df(df_m_all)

    # Todos os AnoMes históricos (ex: '2026-09')
    dados_mensais = {}
    for am in df_sub['AnoMes'].unique():
        df_am = df_sub[df_sub['AnoMes'] == am]
        if len(df_am) > 0:
            dados_mensais[str(am)] = extrair_resumo_df(df_am)
    
    # Mensal (Série Temporal Simples)
    mensal = df_sub.groupby('AnoMes').agg(
        faturamento=('Valor Total', 'sum'),
        quantidade=('Quantidade de itens', 'sum'),
        pedidos=('Número da venda', 'nunique')
    ).reset_index().sort_values('AnoMes')
    mensal_list = []
    for idx, r in mensal.iterrows():
        mensal_list.append({
            'ano_mes': r['AnoMes'],
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos'])
        })
    
    # Sazonalidade
    meses_nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    sazon = []
    qtd_anos = len(anos) if len(anos) > 0 else 1
    for m in range(1, 13):
        df_m = df_sub[df_sub['Mes'] == m]
        sazon.append({
            'mes_num': m,
            'mes_nome': meses_nomes[m - 1],
            'faturamento_medio': round(float(df_m['Valor Total'].sum() / qtd_anos), 2),
            'quantidade_media': round(float(df_m['Quantidade de itens'].sum() / qtd_anos), 0)
        })
        
    # Curva ABC & Produtos
    p_agg = df_sub.groupby('Nome do produto/serviço').agg(
        faturamento=('Valor Total', 'sum'),
        quantidade=('Quantidade de itens', 'sum'),
        preco_medio=('Valor unitário', 'mean'),
        pedidos=('Número da venda', 'count')
    ).reset_index().sort_values('faturamento', ascending=False)
    
    p_agg['cum_rev'] = p_agg['faturamento'].cumsum()
    p_agg['cum_pct'] = p_agg['cum_rev'] / total_fat if total_fat > 0 else 0
    p_agg['curva_abc'] = p_agg['cum_pct'].apply(lambda x: 'A' if x <= 0.80 else ('B' if x <= 0.95 else 'C'))
    
    # Vendas recentes
    recent = df_sub[df_sub['Ano'].isin([2024, 2025, 2026])].pivot_table(
        index='Nome do produto/serviço',
        columns='Ano',
        values=['Quantidade de itens'],
        aggfunc='sum',
        fill_value=0
    )
    recent.columns = [f"qtd_{col[1]}" for col in recent.columns]
    p_agg = p_agg.merge(recent, on='Nome do produto/serviço', how='left').fillna(0)
    
    produtos = []
    for idx, r in p_agg.iterrows():
        abc = r['curva_abc']
        q24 = r.get('qtd_2024', 0)
        q25 = r.get('qtd_2025', 0)
        q26 = r.get('qtd_2026', 0)
        
        if abc == 'A':
            if q25 >= q24 * 0.85:
                status = 'PRODUZIR MAIS'
                cor = 'success'
                icone = '🚀'
                lote = 'Lote Contínuo / Prioridade Fabril'
                just = 'Produto Classe A (80% da receita). Alta velocidade de giro e lucro garantido.'
            else:
                status = 'MANTER / MONITORAR'
                cor = 'warning'
                icone = '⚖️'
                lote = 'Lote Padrão Econômico'
                just = 'Produto Classe A com estabilização recente. Manter estoque de segurança regulado.'
        elif abc == 'B':
            if q25 > q24:
                status = 'EXPANDIR PRODUÇÃO'
                cor = 'info'
                icone = '📈'
                lote = 'Lote Médio em Crescimento'
                just = 'Produto Classe B em ascensão de vendas. Potencial para entrar na Curva A.'
            else:
                status = 'MANTER LOTE PADRÃO'
                cor = 'secondary'
                icone = '🔄'
                lote = 'Lote Regular Reposição'
                just = 'Demanda estável e regular. Produzir por ponto de reposição kanban.'
        else: # Classe C
            if r['quantidade'] < 80:
                status = 'SOB ENCOMENDA'
                cor = 'danger'
                icone = '⛔'
                lote = 'Zero Estoque (MTO - Make to Order)'
                just = 'Curva C de baixo giro. Não estocar na fábrica! Produzir somente sob pedido do cliente.'
            else:
                status = 'LOTE MÍNIMO'
                cor = 'warning'
                icone = '📦'
                lote = 'Lote Mínimo Viável'
                just = 'Curva C pontual. Manter lote mínimo para não ocupar tempo de torno e fresa.'
        
        produtos.append({
            'nome': str(r['Nome do produto/serviço']),
            'categoria': categorize_product(r['Nome do produto/serviço']),
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'preco_medio': round(float(r['preco_medio']), 2),
            'pedidos': int(r['pedidos']),
            'curva_abc': abc,
            'qtd_2024': int(q24),
            'qtd_2025': int(q25),
            'qtd_2026': int(q26),
            'recomendacao': status,
            'cor': cor,
            'icone': icone,
            'lote': lote,
            'justificativa': just
        })
        
    resumo_abc = {
        'A': {
            'itens': int((p_agg['curva_abc'] == 'A').sum()),
            'faturamento': round(float(p_agg[p_agg['curva_abc'] == 'A']['faturamento'].sum()), 2),
            'quantidade': int(p_agg[p_agg['curva_abc'] == 'A']['quantidade'].sum()),
            'pct_faturamento': round(float(p_agg[p_agg['curva_abc'] == 'A']['faturamento'].sum() / total_fat * 100) if total_fat > 0 else 0, 1),
            'pct_itens': round(float((p_agg['curva_abc'] == 'A').sum() / len(p_agg) * 100) if len(p_agg) > 0 else 0, 1)
        },
        'B': {
            'itens': int((p_agg['curva_abc'] == 'B').sum()),
            'faturamento': round(float(p_agg[p_agg['curva_abc'] == 'B']['faturamento'].sum()), 2),
            'quantidade': int(p_agg[p_agg['curva_abc'] == 'B']['quantidade'].sum()),
            'pct_faturamento': round(float(p_agg[p_agg['curva_abc'] == 'B']['faturamento'].sum() / total_fat * 100) if total_fat > 0 else 0, 1),
            'pct_itens': round(float((p_agg['curva_abc'] == 'B').sum() / len(p_agg) * 100) if len(p_agg) > 0 else 0, 1)
        },
        'C': {
            'itens': int((p_agg['curva_abc'] == 'C').sum()),
            'faturamento': round(float(p_agg[p_agg['curva_abc'] == 'C']['faturamento'].sum()), 2),
            'quantidade': int(p_agg[p_agg['curva_abc'] == 'C']['quantidade'].sum()),
            'pct_faturamento': round(float(p_agg[p_agg['curva_abc'] == 'C']['faturamento'].sum() / total_fat * 100) if total_fat > 0 else 0, 1),
            'pct_itens': round(float((p_agg['curva_abc'] == 'C').sum() / len(p_agg) * 100) if len(p_agg) > 0 else 0, 1)
        }
    }
    
    # Geografia
    uf_agg = df_sub.groupby('UF').agg(
        faturamento=('Valor Total', 'sum'),
        quantidade=('Quantidade de itens', 'sum'),
        pedidos=('Número da venda', 'nunique'),
        clientes=('Cliente', 'nunique')
    ).reset_index().sort_values('faturamento', ascending=False)
    
    ufs = []
    for idx, r in uf_agg.iterrows():
        if r['UF'] == 'N/D': continue
        ufs.append({
            'uf': r['UF'],
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos']),
            'clientes': int(r['clientes']),
            'ticket_medio': round(float(r['faturamento'] / r['pedidos']) if r['pedidos'] > 0 else 0, 2),
            'pct': round(float(r['faturamento'] / total_fat * 100) if total_fat > 0 else 0, 2)
        })
        
    reg_agg = df_sub.groupby('Regiao').agg(
        faturamento=('Valor Total', 'sum'),
        quantidade=('Quantidade de itens', 'sum'),
        pedidos=('Número da venda', 'nunique'),
        clientes=('Cliente', 'nunique')
    ).reset_index().sort_values('faturamento', ascending=False)
    
    regioes = []
    for idx, r in reg_agg.iterrows():
        regioes.append({
            'regiao': r['Regiao'],
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos']),
            'clientes': int(r['clientes']),
            'pct': round(float(r['faturamento'] / total_fat * 100) if total_fat > 0 else 0, 2)
        })
        
    # Top Cidades Geral
    cid_agg = df_sub[df_sub['Cidade do cliente'].notnull()].groupby(['Cidade do cliente', 'UF']).agg(
        faturamento=('Valor Total', 'sum'),
        quantidade=('Quantidade de itens', 'sum'),
        clientes=('Cliente', 'nunique')
    ).reset_index().sort_values('faturamento', ascending=False).head(50)
    top_cidades = [{
        'cidade': str(r['Cidade do cliente']),
        'uf': str(r['UF']),
        'faturamento': round(float(r['faturamento']), 2),
        'quantidade': int(r['quantidade']),
        'clientes': int(r['clientes'])
    } for _, r in cid_agg.iterrows()]

    # Categorias
    cat_agg = df_sub.groupby('Categoria').agg(
        faturamento=('Valor Total', 'sum'),
        quantidade=('Quantidade de itens', 'sum'),
        pedidos=('Número da venda', 'count')
    ).reset_index().sort_values('faturamento', ascending=False)
    
    categorias = []
    for idx, r in cat_agg.iterrows():
        categorias.append({
            'categoria': r['Categoria'],
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos']),
            'pct': round(float(r['faturamento'] / total_fat * 100) if total_fat > 0 else 0, 2)
        })
        
    # Top Clientes
    cli_agg = df_sub.groupby('Cliente').agg(
        faturamento=('Valor Total', 'sum'),
        quantidade=('Quantidade de itens', 'sum'),
        pedidos=('Número da venda', 'nunique'),
        cidade=('Cidade do cliente', 'last'),
        uf=('UF', 'last'),
        primeira_compra=('Data da venda', 'min'),
        ultima_compra=('Data da venda', 'max')
    ).reset_index().sort_values('faturamento', ascending=False)
    
    top_clientes = []
    for idx, r in cli_agg.head(50).iterrows():
        top_clientes.append({
            'cliente': str(r['Cliente']),
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos']),
            'cidade': str(r['cidade']),
            'uf': str(r['uf']),
            'ticket_medio': round(float(r['faturamento'] / r['pedidos']) if r['pedidos'] > 0 else 0, 2),
            'pct': round(float(r['faturamento'] / total_fat * 100) if total_fat > 0 else 0, 2),
            'primeira_compra': r['primeira_compra'].strftime('%d/%m/%Y') if pd.notnull(r['primeira_compra']) else '',
            'ultima_compra': r['ultima_compra'].strftime('%d/%m/%Y') if pd.notnull(r['ultima_compra']) else ''
        })
        
    # Análise de Churn e Clientes Inativos
    max_data = df_sub['Data da venda'].max()
    cli_agg['dias_sem_comprar'] = (max_data - cli_agg['ultima_compra']).dt.days
    cli_agg['ativo_2026'] = cli_agg['ultima_compra'].dt.year == 2026
    inativos = cli_agg[~cli_agg['ativo_2026']].copy().sort_values('faturamento', ascending=False)
    
    def classificar_churn_cliente(r):
        fat = r['faturamento']
        dias = r['dias_sem_comprar']
        if fat >= 50000:
            return '🚨 CHURN CRÍTICO VIP', 'URGENTE', 'Contato Imediato da Diretoria / Gerente Comercial'
        elif fat >= 15000:
            return '🔴 ALTO VALOR EM RISCO', 'ALTA', 'Visita Técnica / Ligação com Oferta Especial'
        elif dias <= 365:
            return '⚠️ INATIVO RECENTE', 'MÉDIA', 'Campanha de Reativação WhatsApp / Novo Catálogo'
        else:
            return '💤 INATIVO DE LONGO PRAZO', 'BAIXA', 'E-mail Marketing / Proposta de Recompra em Lote'
            
    lista_inativos = []
    for idx, r in inativos.iterrows():
        st, prio, acao = classificar_churn_cliente(r)
        lista_inativos.append({
            'cliente': str(r['Cliente']),
            'cidade': str(r['cidade']),
            'uf': str(r['uf']),
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos']),
            'ticket_medio': round(float(r['faturamento'] / r['pedidos']) if r['pedidos'] > 0 else 0, 2),
            'primeira_compra': r['primeira_compra'].strftime('%d/%m/%Y') if pd.notnull(r['primeira_compra']) else '',
            'ultima_compra': r['ultima_compra'].strftime('%d/%m/%Y') if pd.notnull(r['ultima_compra']) else '',
            'dias_sem_comprar': int(r['dias_sem_comprar']),
            'status': st,
            'prioridade': prio,
            'acao_sugerida': acao
        })
        
    resumo_churn = {
        'total_clientes': len(cli_agg),
        'ativos_2026': int(cli_agg['ativo_2026'].sum()),
        'inativos_2026': len(inativos),
        'taxa_inatividade': round(float(len(inativos) / len(cli_agg) * 100) if len(cli_agg) > 0 else 0, 1),
        'faturamento_inativo_total': round(float(inativos['faturamento'].sum()), 2),
        'churn_vip_count': len([x for x in lista_inativos if x['prioridade'] == 'URGENTE']),
        'faixa_tempo': {
            'ate_270_dias': len([x for x in lista_inativos if x['dias_sem_comprar'] <= 270]),
            '271_a_540_dias': len([x for x in lista_inativos if 270 < x['dias_sem_comprar'] <= 540]),
            'mais_540_dias': len([x for x in lista_inativos if x['dias_sem_comprar'] > 540])
        },
        'lista_inativos': lista_inativos
    }
        
    return {
        'resumo_executivo': {
            'total_faturamento': round(total_fat, 2),
            'total_itens': total_qtd,
            'total_pedidos': total_ped,
            'total_clientes': total_cli,
            'ticket_medio': round(ticket_m, 2),
            'preco_medio_peca': round(preco_m, 2),
            'anos': anos
        },
        'dados_anuais': dados_anuais,
        'dados_por_mes_geral': dados_por_mes_geral,
        'dados_mensais': dados_mensais,
        'evolucao_mensal': mensal_list,
        'sazonalidade': sazon,
        'curva_abc': resumo_abc,
        'produtos_estrategia': produtos,
        'vendas_por_uf': ufs,
        'vendas_por_regiao': regioes,
        'top_cidades': top_cidades,
        'categorias': categorias,
        'top_clientes': top_clientes,
        'recorrencia_compra': calcular_recorrencia_df(df_sub, top_n=60),
        'analise_churn': resumo_churn
    }


print("\nProcessando métricas consolidadas e por empresa (Todos, Sem Terceirização e Apenas Terceirização)...")
metricas_consolidado = computar_metricas_empresa(df_all)
metricas_mb = computar_metricas_empresa(df_all[df_all['Empresa'] == 'Metalúrgica Brilho'])
metricas_moderna = computar_metricas_empresa(df_all[df_all['Empresa'] == 'Moderna'])

df_sem_terc = df_all[~df_all['Terceirizacao']]
metricas_sem_terc_consolidado = computar_metricas_empresa(df_sem_terc)
metricas_sem_terc_mb = computar_metricas_empresa(df_sem_terc[df_sem_terc['Empresa'] == 'Metalúrgica Brilho'])
metricas_sem_terc_moderna = computar_metricas_empresa(df_sem_terc[df_sem_terc['Empresa'] == 'Moderna'])

df_apenas_terc = df_all[df_all['Terceirizacao']]
metricas_apenas_terc_consolidado = computar_metricas_empresa(df_apenas_terc)
metricas_apenas_terc_mb = computar_metricas_empresa(df_apenas_terc[df_apenas_terc['Empresa'] == 'Metalúrgica Brilho'])
metricas_apenas_terc_moderna = computar_metricas_empresa(df_apenas_terc[df_apenas_terc['Empresa'] == 'Moderna'])

# Resumo Analítico Individual por Razão Social Original dos Clientes de Terceirização
terc_cli_agg = df_apenas_terc.groupby(['Cliente_Original', 'Grupo_Terceirizacao']).agg(
    faturamento=('Valor Total', 'sum'),
    quantidade=('Quantidade de itens', 'sum'),
    pedidos=('Número da venda', 'nunique'),
    cidade=('Cidade do cliente', 'last'),
    uf=('UF', 'last'),
    primeira_compra=('Data da venda', 'min'),
    ultima_compra=('Data da venda', 'max')
).reset_index().sort_values('faturamento', ascending=False)

fat_2026_terc_map = df_apenas_terc[df_apenas_terc['Ano'] == 2026].groupby('Cliente_Original')['Valor Total'].sum().to_dict()
fat_2025_terc_map = df_apenas_terc[df_apenas_terc['Ano'] == 2025].groupby('Cliente_Original')['Valor Total'].sum().to_dict()
tot_fat_geral = float(df_all['Valor Total'].sum()) or 1.0
tot_fat_terc = float(df_apenas_terc['Valor Total'].sum()) or 1.0

by_cli_anomes = {}
by_cli_ano = {}
by_cli_mes = {}
for (cli, am), grp in df_apenas_terc.groupby(['Cliente_Original', 'AnoMes']):
    by_cli_anomes.setdefault(str(cli), {})[str(am)] = {
        'fat': round(float(grp['Valor Total'].sum()), 2),
        'qtd': int(grp['Quantidade de itens'].sum()),
        'peds': int(grp['Número da venda'].nunique())
    }
for (cli, ano), grp in df_apenas_terc.groupby(['Cliente_Original', 'Ano']):
    by_cli_ano.setdefault(str(cli), {})[str(ano)] = {
        'fat': round(float(grp['Valor Total'].sum()), 2),
        'qtd': int(grp['Quantidade de itens'].sum()),
        'peds': int(grp['Número da venda'].nunique())
    }
for (cli, mes), grp in df_apenas_terc.groupby(['Cliente_Original', 'Mes']):
    by_cli_mes.setdefault(str(cli), {})[str(mes)] = {
        'fat': round(float(grp['Valor Total'].sum()), 2),
        'qtd': int(grp['Quantidade de itens'].sum()),
        'peds': int(grp['Número da venda'].nunique())
    }

lista_clientes_terceirizacao = []
for _, r in terc_cli_agg.iterrows():
    c_name = str(r['Cliente_Original'])
    f_val = float(r['faturamento'])
    p_cnt = int(r['pedidos'])
    lista_clientes_terceirizacao.append({
        'cliente': c_name,
        'grupo': str(r['Grupo_Terceirizacao']),
        'cidade': str(r['cidade']),
        'uf': str(r['uf']),
        'faturamento_historico': round(f_val, 2),
        'faturamento_2025': round(float(fat_2025_terc_map.get(c_name, 0.0)), 2),
        'faturamento_2026': round(float(fat_2026_terc_map.get(c_name, 0.0)), 2),
        'quantidade': int(r['quantidade']),
        'pedidos': p_cnt,
        'ticket_medio': round(f_val / p_cnt if p_cnt > 0 else 0.0, 2),
        'pct_do_terceirizado': round(f_val / tot_fat_terc * 100, 1),
        'pct_do_total_geral': round(f_val / tot_fat_geral * 100, 2),
        'primeira_compra': r['primeira_compra'].strftime('%d/%m/%Y') if pd.notnull(r['primeira_compra']) else '',
        'ultima_compra': r['ultima_compra'].strftime('%d/%m/%Y') if pd.notnull(r['ultima_compra']) else '',
        'por_anomes': by_cli_anomes.get(c_name, {}),
        'por_ano': by_cli_ano.get(c_name, {}),
        'por_mes': by_cli_mes.get(c_name, {})
    })

resumo_terceirizacao_info = {
    'faturamento_total_geral': round(float(df_all['Valor Total'].sum()), 2),
    'faturamento_sem_terceirizacao': round(float(df_sem_terc['Valor Total'].sum()), 2),
    'faturamento_apenas_terceirizacao': round(float(df_apenas_terc['Valor Total'].sum()), 2),
    'pct_terceirizacao_geral': round(float(df_apenas_terc['Valor Total'].sum()) / tot_fat_geral * 100, 2),
    'faturamento_2026_geral': round(float(df_all[df_all['Ano'] == 2026]['Valor Total'].sum()), 2),
    'faturamento_2026_sem_terceirizacao': round(float(df_sem_terc[df_sem_terc['Ano'] == 2026]['Valor Total'].sum()), 2),
    'faturamento_2026_apenas_terceirizacao': round(float(df_apenas_terc[df_apenas_terc['Ano'] == 2026]['Valor Total'].sum()), 2),
    'total_clientes_terceirizacao': len(lista_clientes_terceirizacao),
    'clientes': lista_clientes_terceirizacao
}

# Análise de Split e Equilíbrio Fiscal
anos_todos = sorted([int(a) for a in df_all['Ano'].unique()])
split_por_ano = {}
for ano in anos_todos:
    mb_rev = float(df_all[(df_all['Ano'] == ano) & (df_all['Empresa'] == 'Metalúrgica Brilho')]['Valor Total'].sum())
    mod_rev = float(df_all[(df_all['Ano'] == ano) & (df_all['Empresa'] == 'Moderna')]['Valor Total'].sum())
    tot = mb_rev + mod_rev
    mb_pct = round((mb_rev / tot * 100) if tot > 0 else 0, 1)
    mod_pct = round((mod_rev / tot * 100) if tot > 0 else 0, 1)
    
    if mod_rev == 0:
        diagnostico = "100% concentrado na Metalúrgica Brilho."
        nivel_risco = "baixo" if mb_rev < 3600000 else "alto"
    elif mb_pct > 75:
        diagnostico = f"Desbalanceado ({mb_pct:.0f}% MB / {mod_pct:.0f}% Moderna). Concentração excessiva na MB eleva alíquota do Simples Nacional."
        nivel_risco = "critico" if mb_rev > 4800000 else "alerta"
    elif mb_pct >= 40 and mb_pct <= 60:
        diagnostico = f"Equilíbrio Ideal ({mb_pct:.0f}% MB / {mod_pct:.0f}% Moderna). Ambas as empresas dividem faturamento de forma otimizada."
        nivel_risco = "otimo"
    else:
        diagnostico = f"Divisão moderada ({mb_pct:.0f}% MB / {mod_pct:.0f}% Moderna)."
        nivel_risco = "moderado"
        
    split_por_ano[str(ano)] = {
        'total': round(tot, 2),
        'mb_faturamento': round(mb_rev, 2),
        'mb_pct': mb_pct,
        'moderna_faturamento': round(mod_rev, 2),
        'moderna_pct': mod_pct,
        'teto_simples': 4800000.00,
        'sublimite_icms': 3600000.00,
        'mb_risco_teto': mb_rev > 4800000.00,
        'mb_risco_sublimite': mb_rev > 3600000.00,
        'moderna_risco_teto': mod_rev > 4800000.00,
        'diagnostico': diagnostico,
        'nivel_risco': nivel_risco
    }

# Split Mensal por AnoMes e por Mês do Calendário
split_por_mes = {}
for am in sorted(df_all['AnoMes'].unique()):
    mb_rev = float(df_all[(df_all['AnoMes'] == am) & (df_all['Empresa'] == 'Metalúrgica Brilho')]['Valor Total'].sum())
    mod_rev = float(df_all[(df_all['AnoMes'] == am) & (df_all['Empresa'] == 'Moderna')]['Valor Total'].sum())
    tot = mb_rev + mod_rev
    split_por_mes[str(am)] = {
        'total': round(tot, 2),
        'mb_faturamento': round(mb_rev, 2),
        'mb_pct': round((mb_rev / tot * 100) if tot > 0 else 0, 1),
        'moderna_faturamento': round(mod_rev, 2),
        'moderna_pct': round((mod_rev / tot * 100) if tot > 0 else 0, 1)
    }

split_por_mes_num = {}
for m in range(1, 13):
    mb_rev = float(df_all[(df_all['Mes'] == m) & (df_all['Empresa'] == 'Metalúrgica Brilho')]['Valor Total'].sum())
    mod_rev = float(df_all[(df_all['Mes'] == m) & (df_all['Empresa'] == 'Moderna')]['Valor Total'].sum())
    tot = mb_rev + mod_rev
    split_por_mes_num[str(m)] = {
        'total': round(tot, 2),
        'mb_faturamento': round(mb_rev, 2),
        'mb_pct': round((mb_rev / tot * 100) if tot > 0 else 0, 1),
        'moderna_faturamento': round(mod_rev, 2),
        'moderna_pct': round((mod_rev / tot * 100) if tot > 0 else 0, 1)
    }

split_fiscal_consolidado = dict(split_por_ano)
split_fiscal_consolidado['anos'] = dict(split_por_ano)
split_fiscal_consolidado['meses'] = split_por_mes
split_fiscal_consolidado['meses_geral'] = split_por_mes_num

# -------------------------------------------------------------------------------------------------
# 5. MÓDULO ANUAL DE FOLHA DE PAGAMENTO, COLABORADORES & PRODUTIVIDADE FABRIL
#    Processamento completo de 10 meses / 1 ano de folhas analíticas e holerites (Dez/2025 a Set/2026)
# -------------------------------------------------------------------------------------------------
import pypdf

# Mapeamento Oficial de Nomes, Cargos e Setores
colab_meta_map = {
    # METALÚRGICA BRILHO
    'MB_000019': ('Sueli Senciani Gomes', 'Líder de Produção (Lixas & Abrasivos)', 'Liderança Fabril'),
    'MB_000021': ('Elaine Maria Santos', 'Gerente Comercial', 'Comercial & Vendas'),
    'MB_000025': ('Cleide Aparecida da Silva', 'Auxiliar de Produção B', 'Produção Fabril'),
    'MB_000030': ('Luciane de Oliveira Sousa', 'Gerente Financeiro', 'Administração & Finanças'),
    'MB_000031': ('Paula Lima Barros', 'Auxiliar Galvânica', 'Diamantação & Galvanoplastia'),
    'MB_000032': ('José Haroldo Ribeiro Costa', 'Auxiliar de Produção', 'Produção Fabril'),
    'MB_000037': ('Flavia Assis dos Santos', 'Analista de E-commerce', 'Comercial & E-commerce'),
    'MB_000050': ('Patricia Basaia', 'Auxiliar de Inspeção de Qualidade', 'Controle de Qualidade'),
    'MB_000064': ('Gilvan Ribeiro de Sousa', 'Auxiliar de Manutenção', 'Manutenção Fabril'),
    'MB_000066': ('Gabriela Evangelista de Souza', 'Auxiliar Galvânica A', 'Diamantação & Galvanoplastia'),
    'MB_000072': ('Veridiana Conceicao de Souza', 'Auxiliar de Produção', 'Produção Fabril'),
    'MB_000073': ('Gilvanete Araujo de Oliveira', 'Auxiliar de Produção', 'Produção Fabril'),
    'MB_000078': ('Veronica Conceicao de Souza', 'Auxiliar de Produção', 'Produção Fabril'),
    'MB_000079': ('Margarete Carvalho Ferreira', 'Auxiliar de Estoque', 'Estoque & Expedição'),
    'MB_000080': ('Kelly Amancio dos Santos', 'Auxiliar de Produção', 'Produção Fabril'),
    'MB_000090': ('Giliani Rodrigues', 'Auxiliar de Produção A', 'Produção Fabril'),
    'MB_000092': ('Graziele Nunes', 'Auxiliar de Produção', 'Produção Fabril'),
    'MB_000093': ('Beatriz Zavattaro Frias', 'Estagiária Apoio Fabril', 'Apoio Fabril & Estágio'),
    'MB_000905': ('Marcelo Marques de Oliveira', 'Diretor Geral', 'Diretoria Executiva'),
    # MODERNA
    'MOD_000004': ('João Francisco do Nascimento Paulino', 'Auxiliar de Escritório', 'Administração & Apoio'),
    'MOD_000007': ('Luciana Queiroz Cardoso', 'Auxiliar de Escritório A', 'Administração & Apoio'),
    'MOD_000008': ('Veronica Ferreira da Silva', 'Assistente de Vendas', 'Comercial & Vendas'),
    'MOD_000009': ('Valeria Maria Melo de Souza', 'Líder de Produção', 'Liderança Fabril'),
    'MOD_000011': ('Luan Batista Brisola de Oliveira', 'Auxiliar de Escritório', 'Administração & Apoio'),
    'MOD_000015': ('Bianca Dias Nascimento', 'Assistente Mídias Sociais', 'Comercial & Marketing'),
    'MOD_000016': ('Lígia Rodrigues de Azevedo', 'Auxiliar de Produção', 'Produção Fabril'),
    'MOD_000017': ('Cigrid Amanda dos Santos', 'Auxiliar de Escritório', 'Administração & Apoio'),
    'MOD_000018': ('Otávio Vargo Pereira', 'Auxiliar de Escritório', 'Administração & Apoio'),
    'MOD_000019': ('Kauan Cassiano Lima e Silva', 'Analista de Automação', 'Engenharia & Automação'),
    'MOD_000020': ('Willian Souza da Silva', 'Gestor Comercial', 'Gestão Comercial'),
    'MOD_000021': ('Valdir Jose Dill', 'Auxiliar de Produção', 'Produção Fabril'),
    'MOD_000022': ('Deise Silva Santos', 'Auxiliar de Produção', 'Produção Fabril'),
    'MOD_000023': ('Nataly Leticia de Medeiros Batista', 'Auxiliar de Produção', 'Produção Fabril'),
    'MOD_000024': ('Ana Paula Pereira Cruz', 'Auxiliar de Produção', 'Produção Fabril')
}

RUBRICAS_CATALOGO = {
    '001': ('Salário Base Mensalistas', 'Salário Base & Pró-Labore', 'provento'),
    '002': ('Salário Base Horistas', 'Salário Base & Pró-Labore', 'provento'),
    '005': ('D.S.R. Horistas', 'Salário Base & Pró-Labore', 'provento'),
    '013': ('Pró-Labore Diretoria', 'Salário Base & Pró-Labore', 'provento'),
    '023': ('Comissões s/ Vendas', 'Adicionais, Comissões & Bônus', 'provento'),
    '030': ('Hora Extra 110%', 'Horas Extras & DSR', 'provento'),
    '031': ('Hora Extra 70%', 'Horas Extras & DSR', 'provento'),
    '032': ('Diferença Hora Extra Mês Ant.', 'Horas Extras & DSR', 'provento'),
    '040': ('Ajuda de Custo', 'Vales & Benefícios', 'provento'),
    '043': ('Bolsa Estagiários', 'Salário Base & Pró-Labore', 'provento'),
    '045': ('Gratificações de Função/Produção', 'Adicionais, Comissões & Bônus', 'provento'),
    '090': ('D.S.R. s/ Variáveis (Reflexo HE/Comissões)', 'Horas Extras & DSR', 'provento'),
    '105': ('Vale Alimentação (Holerite)', 'Vales & Benefícios', 'provento'),
    '120': ('Férias Normais', 'Férias & 1/3 Constitucional', 'provento'),
    '121': ('Férias Normais - s/ Variáveis', 'Férias & 1/3 Constitucional', 'provento'),
    '122': ('Férias Normais - 1/3 Constitucional', 'Férias & 1/3 Constitucional', 'provento'),
    '123': ('Abono Pecuniário de Férias', 'Férias & 1/3 Constitucional', 'provento'),
    '124': ('Abono Pecuniário - s/ Variáveis', 'Férias & 1/3 Constitucional', 'provento'),
    '125': ('Abono Pecuniário - 1/3', 'Férias & 1/3 Constitucional', 'provento'),
    '138': ('Reembolso de Despesas', 'Vales & Benefícios', 'provento'),
    '218': ('Bônus / Premiação', 'Adicionais, Comissões & Bônus', 'provento'),
    '501': ('Faltas (Dias)', 'Faltas & Atrasos', 'desconto'),
    '502': ('Atrasos / Saídas Antecipadas (Horas)', 'Faltas & Atrasos', 'desconto'),
    '503': ('Faltas (Perda de D.S.R.)', 'Faltas & Atrasos', 'desconto'),
    '504': ('Assistência Médica', 'Vales & Benefícios', 'desconto'),
    '510': ('Vale-Transporte (Desconto 6%)', 'Vales & Benefícios', 'desconto'),
    '568': ('Empréstimo Consignado (eConsignado)', 'Descontos & Retenções', 'desconto'),
    '600': ('Adiantamento de Salário (Vale Quinzenal)', 'Vales & Adiantamentos Salariais', 'adiantamento'),
    '602': ('Líquido Pago em Férias', 'Férias & 1/3 Constitucional', 'adiantamento'),
    '603': ('Adiantamento Vale Extra', 'Vales & Adiantamentos Salariais', 'adiantamento'),
    '606': ('Adiantamento de Comissão', 'Vales & Adiantamentos Salariais', 'adiantamento'),
    '770': ('INSS s/ Folha Mensal', 'Impostos Retidos (INSS / IRRF)', 'desconto'),
    '771': ('INSS s/ Férias', 'Impostos Retidos (INSS / IRRF)', 'desconto'),
    '773': ('INSS s/ Pró-Labore', 'Impostos Retidos (INSS / IRRF)', 'desconto'),
    '780': ('IRRF s/ Folha Mensal', 'Impostos Retidos (INSS / IRRF)', 'desconto'),
    '781': ('IRRF s/ Férias', 'Impostos Retidos (INSS / IRRF)', 'desconto')
}

def extract_rubricas_from_text(text, is_recibo):
    ev = {}
    if is_recibo:
        for line in text.split('\n'):
            m = re.match(r'^(\d{3})\s+(.+?)\s+(\d+,\d{4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})$', line.strip())
            if m:
                cod, _, ref_s, val_s = m.groups()
                if int(cod) < 900:
                    r_v = float(ref_s.replace('.', '').replace(',', '.'))
                    v_v = float(val_s.replace('.', '').replace(',', '.'))
                    if cod not in ev:
                        ev[cod] = {'ref': 0.0, 'val': 0.0}
                    ev[cod]['ref'] = round(ev[cod]['ref'] + r_v, 2)
                    ev[cod]['val'] = round(ev[cod]['val'] + v_v, 2)
    else:
        for m in re.finditer(r'(?<!\d)(\d{3})\s+(\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})', text):
            cod, ref_s, val_s = m.groups()
            if int(cod) < 900:
                r_v = float(ref_s.replace('.', '').replace(',', '.'))
                v_v = float(val_s.replace('.', '').replace(',', '.'))
                if cod not in ev:
                    ev[cod] = {'ref': 0.0, 'val': 0.0}
                ev[cod]['ref'] = round(ev[cod]['ref'] + r_v, 2)
                ev[cod]['val'] = round(ev[cod]['val'] + v_v, 2)
    return ev

def summarize_employee_events(ev, salario_base_fallback=0.0):
    def v(c): return ev.get(c, {}).get('val', 0.0)
    def r(c): return ev.get(c, {}).get('ref', 0.0)

    sal_base = round(v('001') + v('002') + v('005') + v('013') + v('043'), 2)
    if sal_base == 0 and salario_base_fallback > 0:
        sal_base = round(salario_base_fallback, 2)

    he_110 = round(v('030'), 2)
    he_70 = round(v('031'), 2)
    he_dif = round(v('032'), 2)
    he_total = round(he_110 + he_70 + he_dif, 2)
    horas_110 = round(r('030'), 2)
    horas_70 = round(r('031'), 2)
    horas_total = round(horas_110 + horas_70 + r('032'), 2)

    dsr_var = round(v('090'), 2)
    vale_alim = round(v('105'), 2)
    ajuda_reemb = round(v('040') + v('138'), 2)
    comissoes = round(v('023'), 2)
    gratificacoes = round(v('045'), 2)
    bonus = round(v('218'), 2)
    adicionais_total = round(comissoes + gratificacoes + bonus, 2)

    ferias_total = round(v('120') + v('121') + v('122') + v('123') + v('124') + v('125'), 2)
    vale_adiantamento = round(v('600') + v('603') + v('606'), 2)
    vale_transporte = round(v('510'), 2)
    assist_medica = round(v('504'), 2)
    faltas_atrasos = round(v('501') + v('502') + v('503'), 2)
    inss_retido = round(v('770') + v('771') + v('773'), 2)
    irrf_retido = round(v('780') + v('781'), 2)

    return {
        'salario_base_efetivo': sal_base,
        'hora_extra_110': he_110,
        'hora_extra_70': he_70,
        'hora_extra_dif': he_dif,
        'hora_extra_total': he_total,
        'horas_extras_110_qtd': horas_110,
        'horas_extras_70_qtd': horas_70,
        'horas_extras_qtd': horas_total,
        'dsr_variaveis': dsr_var,
        'vale_alimentacao': vale_alim,
        'ajuda_reembolso': ajuda_reemb,
        'comissoes': comissoes,
        'gratificacoes': gratificacoes,
        'bonus': bonus,
        'adicionais_total': adicionais_total,
        'ferias_total': ferias_total,
        'vale_adiantamento': vale_adiantamento,
        'vale_transporte': vale_transporte,
        'assistencia_medica': assist_medica,
        'faltas_atrasos': faltas_atrasos,
        'inss_retido': inss_retido,
        'irrf_retido': irrf_retido,
        'rubricas': ev
    }

def parse_receipt_block(block_text, empresa_nome):
    prefix = 'MOD_' if empresa_nome == 'Moderna' else 'MB_'
    m_cod = re.search(r'C[oó]digo\s*\n?\s*(\d{6})', block_text, re.IGNORECASE)
    codigo = m_cod.group(1) if m_cod else ""
    full_cod = f"{prefix}{codigo}" if codigo else ""
    
    # Nome & Admissão
    nome = ""
    admissao = ""
    m_adm = re.search(r'(\d{2}/\d{2}/\d{4})', block_text)
    if m_adm: admissao = m_adm.group(1)
    
    lines = [l.strip() for l in block_text.split('\n') if l.strip()]
    for i, l in enumerate(lines):
        if 'Nome Cargo Admiss' in l:
            if i + 1 < len(lines):
                cand = lines[i + 1]
                if 'de 202' in cand and i + 2 < len(lines):
                    cand = lines[i + 2]
                nome = cand
            break
            
    cargo = "Colaborador Fabril"
    setor = "Produção Fabril"
    if full_cod in colab_meta_map:
        info = colab_meta_map[full_cod]
        nome = info[0]
        cargo = info[1]
        setor = info[2]
    else:
        m_cargo = re.search(r'Recibo de Pagamento\s*\n\s*Mensal\s*\n\s*([^\n\d]+?)(?:\s+\d{6})?\s*\n', block_text, re.IGNORECASE)
        if m_cargo:
            c_raw = m_cargo.group(1).strip()
            if len(c_raw) > 2 and not c_raw.startswith("001") and not c_raw.startswith("013"):
                cargo = c_raw

    # Extrair rubricas primeiro para obter salario_base_efetivo real
    ev = extract_rubricas_from_text(block_text, True)
    det = summarize_employee_events(ev, 0.0)

    # Salário Base Contratual (rodapé do recibo) ou Efetivo do mês
    salario_contratual = 0.0
    m_sb_footer = re.search(
        r'Valor Liquido:.*?(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*\n\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*\n\s*(\d{1,3}(?:\.\d{3})*,\d{2})',
        block_text,
        re.DOTALL
    )
    if m_sb_footer:
        try:
            salario_contratual = float(m_sb_footer.group(4).replace('.', '').replace(',', '.'))
        except:
            pass

    salario_base = det['salario_base_efetivo'] if det['salario_base_efetivo'] > 0 else salario_contratual
    if salario_contratual == 0.0 or salario_contratual < salario_base:
        salario_contratual = salario_base
    if det['salario_base_efetivo'] == 0.0 and salario_base > 0:
        det['salario_base_efetivo'] = salario_base

    # Vencimentos, Descontos, Líquido
    vencimentos = 0.0
    descontos = 0.0
    liquido = 0.0
    fgts = 0.0
    
    m_tot = re.search(r'Valor Liquido:.*?(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*\n\s*(\d{1,3}(?:\.\d{3})*,\d{2})', block_text, re.DOTALL)
    if m_tot:
        try:
            vencimentos = float(m_tot.group(1).replace('.', '').replace(',', '.'))
            descontos = float(m_tot.group(2).replace('.', '').replace(',', '.'))
            liquido = float(m_tot.group(3).replace('.', '').replace(',', '.'))
        except: pass
        
    m_fgts_exp = re.search(r'FGTS do m[eê]s.*?(\d+,\d{2})', block_text, re.IGNORECASE)
    if m_fgts_exp:
        try: fgts = float(m_fgts_exp.group(1).replace('.', '').replace(',', '.'))
        except: pass
    elif vencimentos > 0 and '013' not in block_text and 'PRO-LABORE' not in block_text:
        fgts = round(vencimentos * 0.08, 2)
        
    custo_total = vencimentos + fgts
    res_colab = {
        'codigo': codigo,
        'full_cod': full_cod,
        'nome': ' '.join(nome.split()) if nome else "Colaborador",
        'cargo': cargo,
        'setor': setor,
        'admissao': admissao,
        'salario_base': salario_base,
        'salario_contratual': salario_contratual,
        'vencimentos_bruto': vencimentos,
        'descontos': descontos,
        'salario_liquido': liquido,
        'fgts': fgts,
        'custo_mensal': round(custo_total, 2),
        'custo_anual': round(custo_total * 13.33, 2),
        'empresa': empresa_nome
    }
    res_colab.update(det)
    return res_colab

def parse_monthly_payroll_pdf(pdf_path, empresa_nome):
    prefix = 'MOD_' if empresa_nome == 'Moderna' else 'MB_'
    if not os.path.exists(pdf_path): return None
    r = pypdf.PdfReader(pdf_path)
    text0 = r.pages[0].extract_text()
    is_recibo = 'Recibo de Pagamento' in text0
    
    m = re.search(r'(Janeiro|Fevereiro|Março|Maro|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s*(?:de|/)?\s*(202\d)', text0, re.IGNORECASE)
    mes_nome = m.group(1).capitalize() if m else "N/A"
    ano_val = m.group(2) if m else "2026"
    
    mes_map = {
        'Janeiro': '01', 'Fevereiro': '02', 'Março': '03', 'Maro': '03',
        'Abril': '04', 'Maio': '05', 'Junho': '06', 'Julho': '07',
        'Agosto': '08', 'Setembro': '09', 'Outubro': '10', 'Novembro': '11', 'Dezembro': '12'
    }
    ano_mes = f"{ano_val}-{mes_map.get(mes_nome, '00')}"
    
    colabs = []
    if is_recibo:
        for p in r.pages:
            ptext = p.extract_text()
            split_keyword = "Cod Descri"
            parts = ptext.split(split_keyword)
            for part in parts:
                if not part.strip() or 'Nome Cargo' not in part:
                    continue
                rec = parse_receipt_block(part, empresa_nome)
                if rec['codigo'] or rec['vencimentos_bruto'] > 0:
                    colabs.append(rec)
    else:
        full_emp_text = "\n".join(
            p.extract_text() for p in r.pages
            if "T O  T A  I S    D A    E  M P R E  S  A" not in p.extract_text()
        )
        linhas = full_emp_text.split("\n")
        i = 0
        while i < len(linhas):
            l = linhas[i].strip()
            m_code = re.match(r'^(\d{6})\s+([A-Z\s]{4,})', l)
            if m_code:
                cod = m_code.group(1)
                full_cod = f"{prefix}{cod}"
                bloco = [l]
                j = i + 1
                while j < len(linhas) and not re.match(r'^\d{6}\s+[A-Z\s]{4,}', linhas[j].strip()) and "T O  T A  I S" not in linhas[j]:
                    bloco.append(linhas[j])
                    j += 1
                bloco_text = "\n".join(bloco)
                i = j - 1
                
                raw_nome = m_code.group(2).strip()
                nome = " ".join(raw_nome.split())
                cargo = "Colaborador Fabril"
                setor = "Produção Fabril"
                if full_cod in colab_meta_map:
                    info = colab_meta_map[full_cod]
                    nome = info[0]
                    cargo = info[1]
                    setor = info[2]
                    
                salario_contratual = 0.0
                m_sal999 = re.search(r'999\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*MA\s*IOR\s*REMUNERA', bloco_text)
                if m_sal999:
                    try: salario_contratual = float(m_sal999.group(1).replace('.', '').replace(',', '.'))
                    except: pass

                salario_base = 0.0
                m_sal = re.search(r'(\d{1,3}\.\d{3},\d{2}|\d{3,4},\d{2})\s*\n?\s*001\s+\d+,\d{2}', bloco_text)
                if not m_sal: m_sal = re.search(r'001\s+\d+,\d{2}\s+(\d{1,3}\.\d{3},\d{2}|\d{3,4},\d{2})', bloco_text)
                if not m_sal: m_sal = re.search(r'043\s+\d+,\d{2}\s+(\d{1,3}\.\d{3},\d{2}|\d{3,4},\d{2})', bloco_text)
                if not m_sal: m_sal = re.search(r'013\s+\d+,\d{2}\s+(\d{1,3}\.\d{3},\d{2}|\d{3,4},\d{2})', bloco_text)
                if m_sal:
                    try: salario_base = float(m_sal.group(1).replace('.', '').replace(',', '.'))
                    except: pass

                ev = extract_rubricas_from_text(bloco_text, False)
                det = summarize_employee_events(ev, salario_base)
                if det['salario_base_efetivo'] > 0:
                    salario_base = det['salario_base_efetivo']
                if salario_contratual == 0.0 or salario_contratual < salario_base:
                    salario_contratual = salario_base
                if salario_base == 0.0 and salario_contratual > 0:
                    salario_base = salario_contratual
                    
                vencimentos = descontos = liquido = fgts = 0.0
                m_tot = re.search(r'(\d+\.?\d*,\d{2})\s+L[ÍI]Q\s*U\s*IDO\s*:DE\s*S\s*CO\s*N\s*TO\s*S\s*:V\s*E\s*N\s*CIME\s*N\s*TO\s*S\s*:TO\s*TA\s*IS\s*>>>\s*(\d+\.?\d*,\d{2})\s+(\d+\.?\d*,\d{2})', bloco_text)
                if m_tot:
                    vencimentos = float(m_tot.group(1).replace('.', '').replace(',', '.'))
                    descontos = float(m_tot.group(2).replace('.', '').replace(',', '.'))
                    liquido = float(m_tot.group(3).replace('.', '').replace(',', '.'))
                else:
                    m_venc = re.search(r'901\s+(\d+\.?\d*,\d{2})', bloco_text)
                    if m_venc: vencimentos = float(m_venc.group(1).replace('.', '').replace(',', '.'))
                    m_desc = re.search(r'902\s+(\d+\.?\d*,\d{2})', bloco_text)
                    if m_desc: descontos = float(m_desc.group(1).replace('.', '').replace(',', '.'))
                    m_liq = re.search(r'903\s+(\d+\.?\d*,\d{2})', bloco_text)
                    if m_liq: liquido = float(m_liq.group(1).replace('.', '').replace(',', '.'))
                    
                m_fgts = re.search(r'924\s+(\d+\.?\d*,\d{2})\s*V\s*A\s*LOR\s*FGTS', bloco_text)
                if m_fgts:
                    fgts = float(m_fgts.group(1).replace('.', '').replace(',', '.'))
                elif vencimentos > 0 and '013' not in bloco_text:
                    fgts = round(vencimentos * 0.08, 2)
                    
                custo_mes = vencimentos + fgts
                res_colab = {
                    'codigo': cod,
                    'full_cod': full_cod,
                    'nome': nome,
                    'cargo': cargo,
                    'setor': setor,
                    'admissao': '',
                    'salario_base': salario_base,
                    'salario_contratual': salario_contratual,
                    'vencimentos_bruto': vencimentos,
                    'descontos': descontos,
                    'salario_liquido': liquido,
                    'fgts': fgts,
                    'custo_mensal': round(custo_mes, 2),
                    'custo_anual': round(custo_mes * 13.33, 2),
                    'empresa': empresa_nome
                }
                res_colab.update(det)
                colabs.append(res_colab)
            i += 1
                
    unicos = {}
    for c in colabs:
        if c['codigo']: unicos[c['codigo']] = c
    lista_final = list(unicos.values())
    
    tot_bruto = sum(c['vencimentos_bruto'] for c in lista_final)
    tot_custo = sum(c['custo_mensal'] for c in lista_final)
    tot_liq = sum(c['salario_liquido'] for c in lista_final)
    tot_fgts = sum(c['fgts'] for c in lista_final)

    # Agregar rubricas do mês
    rubricas_mes = {}
    for c in lista_final:
        for cod, rv in c.get('rubricas', {}).items():
            if cod not in rubricas_mes:
                rubricas_mes[cod] = {'ref': 0.0, 'val': 0.0}
            rubricas_mes[cod]['ref'] = round(rubricas_mes[cod]['ref'] + rv['ref'], 2)
            rubricas_mes[cod]['val'] = round(rubricas_mes[cod]['val'] + rv['val'], 2)

    resumo_ev_mes = summarize_employee_events(rubricas_mes)
    
    res_mes = {
        'arquivo': os.path.basename(pdf_path),
        'empresa': empresa_nome,
        'mes_nome': mes_nome,
        'ano_mes': ano_mes,
        'ano': ano_val,
        'mes': mes_map.get(mes_nome, '00'),
        'is_recibo': is_recibo,
        'headcount': len(lista_final),
        'total_bruto': round(tot_bruto, 2),
        'total_liquido': round(tot_liq, 2),
        'total_fgts': round(tot_fgts, 2),
        'total_custo': round(tot_custo, 2),
        'colaboradores': lista_final
    }
    res_mes.update(resumo_ev_mes)
    return res_mes

print("\n--- PROCESSANDO FOLHAS DE PAGAMENTO ANUAIS E HOLERITES ---")
mb_folhas_dir = os.path.join(ROOT_DIR, 'Folha de pagamento anual', 'Folha de pagamento Brilho')
mod_folhas_dir = os.path.join(ROOT_DIR, 'Folha de pagamento anual', 'Folha de pagamento Moderna')

mb_pdf_files = sorted(glob.glob(os.path.join(mb_folhas_dir, '*.pdf')))
mod_pdf_files = sorted(glob.glob(os.path.join(mod_folhas_dir, '*.pdf')))

# Se não achar nas subpastas, procurar na raiz de Folha de pagamento anual
if not mb_pdf_files:
    mb_pdf_files = sorted(glob.glob(os.path.join(ROOT_DIR, 'Folha de pagamento anual', '*METALURGICA*.pdf')))
if not mod_pdf_files:
    mod_pdf_files = sorted(glob.glob(os.path.join(ROOT_DIR, 'Folha de pagamento anual', '*MODERNA*.pdf')))

meses_mb = {}
for f in mb_pdf_files:
    res = parse_monthly_payroll_pdf(f, 'Metalúrgica Brilho')
    if res and res['ano_mes']:
        meses_mb[res['ano_mes']] = res
        print(f"  • MB  [{res['ano_mes']}] {res['mes_nome']:10} -> {res['headcount']:2} colabs | Custo: R$ {res['total_custo']:10,.2f} | HE: R$ {res['hora_extra_total']:8,.2f}")

meses_mod = {}
for f in mod_pdf_files:
    res = parse_monthly_payroll_pdf(f, 'Moderna')
    if res and res['ano_mes']:
        meses_mod[res['ano_mes']] = res
        print(f"  • MOD [{res['ano_mes']}] {res['mes_nome']:10} -> {res['headcount']:2} colabs | Custo: R$ {res['total_custo']:10,.2f} | HE: R$ {res['hora_extra_total']:8,.2f}")

# Construir Série Temporal Mensal Consolidada (Evolução da Folha de Pagamento + Holerites)
todos_ano_meses = sorted(list(set(list(meses_mb.keys()) + list(meses_mod.keys()))))
evolucao_mensal_folha_consolidado = []
evolucao_mensal_folha_mb = []
evolucao_mensal_folha_mod = []

nomes_meses_pt = {
    '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
}

EXTRA_FIELDS = [
    'salario_base_efetivo', 'hora_extra_110', 'hora_extra_70', 'hora_extra_dif',
    'hora_extra_total', 'horas_extras_110_qtd', 'horas_extras_70_qtd', 'horas_extras_qtd',
    'dsr_variaveis', 'vale_alimentacao', 'ajuda_reembolso', 'comissoes',
    'gratificacoes', 'bonus', 'adicionais_total', 'ferias_total',
    'vale_adiantamento', 'vale_transporte', 'assistencia_medica',
    'faltas_atrasos', 'inss_retido', 'irrf_retido'
]

for am in todos_ano_meses:
    m_mb = meses_mb.get(am)
    m_mod = meses_mod.get(am)
    
    hc_mb = m_mb['headcount'] if m_mb else 0
    custo_mb = m_mb['total_custo'] if m_mb else 0.0
    bruto_mb = m_mb['total_bruto'] if m_mb else 0.0
    liq_mb = m_mb['total_liquido'] if m_mb else 0.0
    fgts_mb = m_mb['total_fgts'] if m_mb else 0.0
    
    hc_mod = m_mod['headcount'] if m_mod else 0
    custo_mod = m_mod['total_custo'] if m_mod else 0.0
    bruto_mod = m_mod['total_bruto'] if m_mod else 0.0
    liq_mod = m_mod['total_liquido'] if m_mod else 0.0
    fgts_mod = m_mod['total_fgts'] if m_mod else 0.0
    
    partes = am.split('-')
    label_mes = f"{nomes_meses_pt.get(partes[1], partes[1])}/{partes[0]}"
    
    # Rubricas combinadas no mês
    rub_cons = {}
    for src in (m_mb, m_mod):
        if src and src.get('rubricas'):
            for cod, rv in src['rubricas'].items():
                if cod not in rub_cons:
                    rub_cons[cod] = {'ref': 0.0, 'val': 0.0}
                rub_cons[cod]['ref'] = round(rub_cons[cod]['ref'] + rv['ref'], 2)
                rub_cons[cod]['val'] = round(rub_cons[cod]['val'] + rv['val'], 2)

    item_cons = {
        'ano_mes': am,
        'label': label_mes,
        'headcount': hc_mb + hc_mod,
        'total_bruto': round(bruto_mb + bruto_mod, 2),
        'total_liquido': round(liq_mb + liq_mod, 2),
        'total_fgts': round(fgts_mb + fgts_mod, 2),
        'total_custo': round(custo_mb + custo_mod, 2),
        'custo_mb': round(custo_mb, 2),
        'custo_mod': round(custo_mod, 2),
        'hc_mb': hc_mb,
        'hc_mod': hc_mod,
        'rubricas': rub_cons
    }
    item_mb = {
        'ano_mes': am,
        'label': label_mes,
        'headcount': hc_mb,
        'total_bruto': round(bruto_mb, 2),
        'total_liquido': round(liq_mb, 2),
        'total_fgts': round(fgts_mb, 2),
        'total_custo': round(custo_mb, 2),
        'rubricas': m_mb.get('rubricas', {}) if m_mb else {}
    }
    item_mod = {
        'ano_mes': am,
        'label': label_mes,
        'headcount': hc_mod,
        'total_bruto': round(bruto_mod, 2),
        'total_liquido': round(liq_mod, 2),
        'total_fgts': round(fgts_mod, 2),
        'total_custo': round(custo_mod, 2),
        'rubricas': m_mod.get('rubricas', {}) if m_mod else {}
    }

    for ef in EXTRA_FIELDS:
        v_mb = m_mb.get(ef, 0.0) if m_mb else 0.0
        v_mod = m_mod.get(ef, 0.0) if m_mod else 0.0
        item_cons[ef] = round(v_mb + v_mod, 2)
        item_mb[ef] = round(v_mb, 2)
        item_mod[ef] = round(v_mod, 2)

    evolucao_mensal_folha_consolidado.append(item_cons)
    evolucao_mensal_folha_mb.append(item_mb)
    evolucao_mensal_folha_mod.append(item_mod)

# Calcular custo mensal médio e acumulado por rubrica para cada colaborador
def computar_colaboradores_com_media(meses_dict, empresa_nome):
    if not meses_dict:
        return []
    
    historico = {}
    for am in sorted(meses_dict.keys()):
        m_dados = meses_dict[am]
        for c in m_dados.get('colaboradores', []):
            chave = c.get('full_cod') or c.get('codigo') or c.get('nome')
            if chave not in historico:
                historico[chave] = {
                    'codigo': c.get('codigo', ''),
                    'full_cod': c.get('full_cod', ''),
                    'nome': c.get('nome', ''),
                    'cargo': c.get('cargo', ''),
                    'setor': c.get('setor', ''),
                    'empresa': c.get('empresa', empresa_nome),
                    'meses_presente': [],
                    'salarios_base': [],
                    'vencimentos': [],
                    'descontos': [],
                    'liquidos': [],
                    'fgts': [],
                    'custos': [],
                    'extra_acum': {ef: 0.0 for ef in EXTRA_FIELDS},
                    'historico_mensal': {}
                }
            h = historico[chave]
            if c.get('cargo') and c.get('cargo') != 'Colaborador Fabril':
                h['cargo'] = c['cargo']
            if c.get('setor') and c.get('setor') != 'Produção Fabril':
                h['setor'] = c['setor']
            if c.get('nome'):
                h['nome'] = c['nome']
            
            h['meses_presente'].append(am)
            sal_efet = c.get('salario_base_efetivo', c.get('salario_base', 0.0))
            sal_contr = c.get('salario_contratual', sal_efet)
            if sal_contr < sal_efet:
                sal_contr = sal_efet
            h['salarios_base'].append(sal_contr if sal_contr > 0 else sal_efet)
            h['vencimentos'].append(c.get('vencimentos_bruto', 0.0))
            h['descontos'].append(c.get('descontos', 0.0))
            h['liquidos'].append(c.get('salario_liquido', 0.0))
            h['fgts'].append(c.get('fgts', 0.0))
            h['custos'].append(c.get('custo_mensal', 0.0))
            for ef in EXTRA_FIELDS:
                h['extra_acum'][ef] = round(h['extra_acum'][ef] + c.get(ef, 0.0), 2)
            h['historico_mensal'][am] = {
                'salario_base': sal_efet,
                'salario_contratual': sal_contr,
                'vencimentos_bruto': c.get('vencimentos_bruto', 0.0),
                'salario_liquido': c.get('salario_liquido', 0.0),
                'fgts': c.get('fgts', 0.0),
                'custo_mensal': c.get('custo_mensal', 0.0),
                'hora_extra_total': c.get('hora_extra_total', 0.0),
                'hora_extra_110': c.get('hora_extra_110', 0.0),
                'hora_extra_70': c.get('hora_extra_70', 0.0),
                'horas_extras_qtd': c.get('horas_extras_qtd', 0.0),
                'dsr_variaveis': c.get('dsr_variaveis', 0.0),
                'vale_alimentacao': c.get('vale_alimentacao', 0.0),
                'vale_adiantamento': c.get('vale_adiantamento', 0.0),
                'vale_transporte': c.get('vale_transporte', 0.0),
                'adicionais_total': c.get('adicionais_total', 0.0),
                'comissoes': c.get('comissoes', 0.0),
                'gratificacoes': c.get('gratificacoes', 0.0),
                'bonus': c.get('bonus', 0.0),
                'ajuda_reembolso': c.get('ajuda_reembolso', 0.0),
                'ferias_total': c.get('ferias_total', 0.0),
                'inss_retido': c.get('inss_retido', 0.0),
                'irrf_retido': c.get('irrf_retido', 0.0),
                'faltas_atrasos': c.get('faltas_atrasos', 0.0)
            }
            
    mes_recente = max(meses_dict.keys())
    ativos_recentes = {
        (c.get('full_cod') or c.get('codigo') or c.get('nome'))
        for c in meses_dict[mes_recente].get('colaboradores', [])
    }
    
    colabs_com_media = []
    for chave, h in historico.items():
        is_ativo = (chave in ativos_recentes)
        num_m = len(h['custos'])
        c_medio = round(sum(h['custos']) / num_m, 2) if num_m > 0 else 0.0
        b_medio = round(sum(h['vencimentos']) / num_m, 2) if num_m > 0 else 0.0
        l_medio = round(sum(h['liquidos']) / num_m, 2) if num_m > 0 else 0.0
        sb_medio = round(sum(h['salarios_base']) / num_m, 2) if num_m > 0 else 0.0
        fgts_m = round(sum(h['fgts']) / num_m, 2) if num_m > 0 else 0.0
        ult_custo = h['custos'][-1] if h['custos'] else c_medio
        sal_contratual_atual = max(h['salarios_base'][-2:]) if h['salarios_base'] else sb_medio
        
        colab_item = {
            'codigo': h['codigo'],
            'full_cod': h['full_cod'],
            'nome': h['nome'],
            'cargo': h['cargo'],
            'setor': h['setor'],
            'admissao': '',
            'ativo_atual': is_ativo,
            'salario_base': sb_medio,
            'salario_contratual': round(sal_contratual_atual, 2),
            'vencimentos_bruto': b_medio,
            'descontos': round(sum(h['descontos']) / num_m, 2) if num_m > 0 else 0.0,
            'salario_liquido': l_medio,
            'fgts': fgts_m,
            'custo_mensal': c_medio,
            'custo_anual': round(custo_medio * 13.33, 2) if False else round(c_medio * 13.33, 2),
            'custo_ultimo_mes': round(ult_custo, 2),
            'custo_acumulado_periodo': round(sum(h['custos']), 2),
            'fgts_acumulado_periodo': round(sum(h['fgts']), 2),
            'meses_na_base': num_m,
            'empresa': h['empresa'],
            'historico_mensal': h['historico_mensal']
        }
        for ef in EXTRA_FIELDS:
            colab_item[f"{ef}_acum"] = round(h['extra_acum'][ef], 2)
            colab_item[f"{ef}_media"] = round(h['extra_acum'][ef] / num_m, 2) if num_m > 0 else 0.0
        colabs_com_media.append(colab_item)
            
    colabs_com_media.sort(key=lambda x: x['nome'])
    return colabs_com_media

mes_recente_mb = max(meses_mb.keys()) if meses_mb else None
mes_recente_mod = max(meses_mod.keys()) if meses_mod else None

colabs_ativos_mb = computar_colaboradores_com_media(meses_mb, 'Metalúrgica Brilho')
colabs_ativos_mod = computar_colaboradores_com_media(meses_mod, 'Moderna')
todos_colaboradores = colabs_ativos_mb + colabs_ativos_mod
todos_colaboradores.sort(key=lambda x: x['nome'])

print(f"\n✓ Quadro Atual Ativo com Custo Médio Normalizado ({len(todos_ano_meses)} folhas processadas):")
print(f"  • Metalúrgica Brilho: {len(colabs_ativos_mb)} colaboradores ativos (Custo Médio: R$ {sum(c['custo_mensal'] for c in colabs_ativos_mb):,.2f}/mês)")
print(f"  • Moderna:            {len(colabs_ativos_mod)} colaboradores ativos (Custo Médio: R$ {sum(c['custo_mensal'] for c in colabs_ativos_mod):,.2f}/mês)")
print(f"  • Grupo Consolidado:  {len(todos_colaboradores)} colaboradores ativos (Custo Médio: R$ {sum(c['custo_mensal'] for c in todos_colaboradores):,.2f}/mês)")

# Salvar Planilha Consolidada da Folha
df_export = pd.DataFrame([{k: v for k, v in c.items() if k != 'historico_mensal'} for c in todos_colaboradores])
colab_export_paths = [
    os.path.join(ROOT_DIR, 'Folha de pagamento anual', 'FOLHA_COLABORADORES_CONSOLIDADA.xlsx'),
    os.path.join(ROOT_DIR, 'FOLHA_COLABORADORES_CONSOLIDADA.xlsx'),
    os.path.join(BASE_DIR, 'FOLHA_COLABORADORES_CONSOLIDADA.xlsx')
]
for cep in colab_export_paths:
    try:
        os.makedirs(os.path.dirname(cep), exist_ok=True)
        df_export.to_excel(cep, index=False)
    except Exception as e:
        pass
print("✓ Planilha consolidada salva: FOLHA_COLABORADORES_CONSOLIDADA.xlsx")

def construir_resumo_holerites(evolucao_serie):
    num_meses = len([m for m in evolucao_serie if m.get('total_custo', 0) > 0]) or 1
    totais_cat = {ef: round(sum(m.get(ef, 0.0) for m in evolucao_serie), 2) for ef in EXTRA_FIELDS}
    totais_cat['total_bruto'] = round(sum(m.get('total_bruto', 0.0) for m in evolucao_serie), 2)
    totais_cat['total_liquido'] = round(sum(m.get('total_liquido', 0.0) for m in evolucao_serie), 2)
    totais_cat['total_fgts'] = round(sum(m.get('total_fgts', 0.0) for m in evolucao_serie), 2)
    totais_cat['total_custo'] = round(sum(m.get('total_custo', 0.0) for m in evolucao_serie), 2)
    totais_cat['num_meses'] = num_meses

    medias_cat = {k: round(v / num_meses, 2) for k, v in totais_cat.items() if k != 'num_meses'}

    # Consolidar catálogo de rubricas
    rub_map = {}
    for m in evolucao_serie:
        for cod, rv in m.get('rubricas', {}).items():
            if cod not in rub_map:
                rub_map[cod] = {'ref': 0.0, 'val': 0.0, 'meses_ocorrencia': 0}
            rub_map[cod]['ref'] = round(rub_map[cod]['ref'] + rv.get('ref', 0.0), 2)
            rub_map[cod]['val'] = round(rub_map[cod]['val'] + rv.get('val', 0.0), 2)
            if rv.get('val', 0.0) > 0:
                rub_map[cod]['meses_ocorrencia'] += 1

    lista_rubricas = []
    for cod in sorted(rub_map.keys()):
        info = RUBRICAS_CATALOGO.get(cod, (f'Rubrica {cod}', 'Outras Rubricas', 'provento'))
        val_tot = rub_map[cod]['val']
        lista_rubricas.append({
            'codigo': cod,
            'descricao': info[0],
            'categoria': info[1],
            'tipo': info[2],
            'referencia_total': rub_map[cod]['ref'],
            'valor_total': val_tot,
            'media_mensal': round(val_tot / num_meses, 2),
            'meses_ocorrencia': rub_map[cod]['meses_ocorrencia']
        })

    return {
        'num_meses': num_meses,
        'acumulado': totais_cat,
        'media_mensal': medias_cat,
        'rubricas_detalhadas': lista_rubricas
    }

def calcular_metricas_rh(colab_lista, fat_anual, qtd_anual, evolucao_serie, nome_arquivo):
    ativos_lista = [c for c in colab_lista if c.get('ativo_atual', True)]
    total_c = len(ativos_lista)
    custo_mes = sum(c['custo_mensal'] for c in ativos_lista)
    custo_ano = sum(c['custo_anual'] for c in ativos_lista)
    
    fat_mes = fat_anual / 12 if fat_anual > 0 else 0
    qtd_mes = qtd_anual / 12 if qtd_anual > 0 else 0
    
    if total_c > 0:
        fat_per_capita = fat_mes / total_c
        pecas_per_capita = qtd_mes / total_c
        custo_per_capita = custo_mes / total_c
        margem_per_capita = fat_per_capita - custo_per_capita
        ind_folha = (custo_ano / fat_anual * 100) if fat_anual > 0 else 0
        roi = fat_anual / custo_ano if custo_ano > 0 else 0
    else:
        fat_per_capita = pecas_per_capita = custo_per_capita = margem_per_capita = ind_folha = roi = 0
        
    return {
        'total_colaboradores': total_c,
        'custo_folha_mensal': round(custo_mes, 2),
        'custo_folha_anual': round(custo_ano, 2),
        'fat_per_capita_mensal': round(fat_per_capita, 2),
        'pecas_per_capita_mensal': round(pecas_per_capita, 0),
        'custo_medio_colaborador': round(custo_per_capita, 2),
        'lucro_bruto_per_capita_mensal': round(margem_per_capita, 2),
        'indice_folha_faturamento': round(ind_folha, 1),
        'roi_mao_de_obra': round(roi, 2),
        'origem_arquivo': nome_arquivo,
        'evolucao_mensal_folha': evolucao_serie,
        'colaboradores_lista': colab_lista,
        'resumo_holerites': construir_resumo_holerites(evolucao_serie)
    }

# Médias recentes de faturamento (2024/2025/2026 anualizado)
fat_medio_grupo = (split_por_ano.get('2024', {}).get('total', 0) + split_por_ano.get('2025', {}).get('total', 0)) / 2
fat_medio_mb = (split_por_ano.get('2024', {}).get('mb_faturamento', 0) + split_por_ano.get('2025', {}).get('mb_faturamento', 0)) / 2
fat_medio_mod = (split_por_ano.get('2024', {}).get('moderna_faturamento', 0) + split_por_ano.get('2025', {}).get('moderna_faturamento', 0)) / 2

qtd_medio_grupo = (metricas_consolidado['dados_anuais'].get('2024', {}).get('quantidade', 0) + metricas_consolidado['dados_anuais'].get('2025', {}).get('quantidade', 0)) / 2
qtd_medio_mb = (metricas_mb['dados_anuais'].get('2024', {}).get('quantidade', 0) + metricas_mb['dados_anuais'].get('2025', {}).get('quantidade', 0)) / 2
qtd_medio_mod = (metricas_moderna['dados_anuais'].get('2024', {}).get('quantidade', 0) + metricas_moderna['dados_anuais'].get('2025', {}).get('quantidade', 0)) / 2

metricas_rh_consolidado = calcular_metricas_rh(todos_colaboradores, fat_medio_grupo, qtd_medio_grupo, evolucao_mensal_folha_consolidado, f'Holerites & Folha Analítica ({len(todos_ano_meses)} meses: Nov/25 a Out/26)')
metricas_rh_mb = calcular_metricas_rh(colabs_ativos_mb, fat_medio_mb, qtd_medio_mb, evolucao_mensal_folha_mb, f'Holerites & Folha Analítica Metalúrgica Brilho ({len(meses_mb)} meses)')
metricas_rh_mod = calcular_metricas_rh(colabs_ativos_mod, fat_medio_mod, qtd_medio_mod, evolucao_mensal_folha_mod, f'Holerites & Folha Analítica Moderna ({len(meses_mod)} meses)')

metricas_consolidado['produtividade_rh'] = metricas_rh_consolidado
metricas_mb['produtividade_rh'] = metricas_rh_mb
metricas_moderna['produtividade_rh'] = metricas_rh_mod
metricas_rh = metricas_rh_consolidado

# -------------------------------------------------------------------------------------------------
# 6. GESTÃO DE BACKLOG FABRIL & PEDIDOS PENDENTES
# -------------------------------------------------------------------------------------------------
backlog_candidates = [
    os.path.join(ROOT_DIR, 'Pedidos pendentes', 'PEDIDOS PENDENTES 2026.xlsx'),
    os.path.join(ROOT_DIR, 'PEDIDOS PENDENTES 2026.xlsx'),
    os.path.join(BASE_DIR, 'PEDIDOS PENDENTES 2026.xlsx')
]
pedidos_pendentes_file = None
for bc in backlog_candidates:
    if os.path.exists(bc):
        pedidos_pendentes_file = bc
        break

pendencias_lista = []
total_valor_pendente = 0

if pedidos_pendentes_file and os.path.exists(pedidos_pendentes_file):
    try:
        xl_p = pd.ExcelFile(pedidos_pendentes_file)
        if 'PENDÊNCIAS' in xl_p.sheet_names:
            df_p = xl_p.parse('PENDÊNCIAS')
            start_row = 1
            for r_idx in range(min(5, len(df_p))):
                row_vals = [str(x).upper() for x in df_p.iloc[r_idx].values]
                if any('DATA' in x for x in row_vals) and any('VALOR' in x for x in row_vals):
                    start_row = r_idx
                    break
            
            headers = [str(c).strip() for c in df_p.iloc[start_row].values]
            df_pend_data = df_p.iloc[start_row + 1:].copy()
            df_pend_data.columns = headers
            
            for idx, r in df_pend_data.iterrows():
                val = r.get('Valor', 0)
                try: val = float(val)
                except: val = 0.0
                cli = str(r.get('Cliente', 'Não informado')).strip()
                status = str(r.get('STATUS', r.get('Status', 'Em Produção'))).strip()
                data_ped = str(r.get('DATA', ''))
                data_lim = str(r.get('Data Limite', ''))
                
                if val > 0 or cli not in ['nan', '', 'None']:
                    total_valor_pendente += val
                    pendencias_lista.append({
                        'data': data_ped[:10] if len(data_ped)>=10 else data_ped,
                        'data_limite': data_lim[:10] if len(data_lim)>=10 else data_lim,
                        'cliente': cli,
                        'valor': round(val, 2),
                        'status': status if status not in ['nan', 'None', ''] else 'Aguardando Produção'
                    })
    except Exception as e:
        print(f"! Erro ao ler PEDIDOS PENDENTES: {e}")

backlog_info = {
    'total_valor_pendente': round(total_valor_pendente, 2),
    'quantidade_pedidos_pendentes': len(pendencias_lista),
    'lista_pendencias': pendencias_lista[:50]
}

# -------------------------------------------------------------------------------------------------
# 6.5 CUSTOS INDUSTRIAIS & FORMAÇÃO DE PREÇO (PRICING)
# -------------------------------------------------------------------------------------------------
print("\n" + "=" * 75)
print("  PROCESSANDO MÓDULO DE CUSTOS INDUSTRIAIS & FORMAÇÃO DE PREÇO")
print("=" * 75)

custos_dir = os.path.join(ROOT_DIR, 'Custo')
colaboradores_custo = []
setores_custo = {}
produtos_custo = []

# 1. Carregar MODELO_CUSTO_COLABORADORES.xlsx
colab_file = os.path.join(custos_dir, 'MODELO_CUSTO_COLABORADORES.xlsx')
if os.path.exists(colab_file):
    try:
        import openpyxl
        wb_c = openpyxl.load_workbook(colab_file, data_only=True)
        ws_c = wb_c['Sheet1']
        for r in range(2, ws_c.max_row + 1):
            nome = ws_c.cell(r, 1).value
            cargo = ws_c.cell(r, 2).value
            setor = ws_c.cell(r, 3).value
            salario = float(ws_c.cell(r, 4).value or 0)
            encargos = float(ws_c.cell(r, 5).value or 0)
            custo_tot = float(ws_c.cell(r, 6).value or 0)
            status = ws_c.cell(r, 7).value or 'Ativo'
            admissao = str(ws_c.cell(r, 8).value or '')
            if nome:
                custo_hora = round(custo_tot / 220, 2)
                colaboradores_custo.append({
                    'nome': nome,
                    'cargo': cargo,
                    'setor': setor,
                    'salario_base': salario,
                    'encargos': encargos,
                    'custo_total': custo_tot,
                    'custo_hora': custo_hora,
                    'status': status,
                    'admissao': admissao
                })
                if setor not in setores_custo:
                    setores_custo[setor] = {'headcount': 0, 'custo_total': 0, 'cargos': []}
                setores_custo[setor]['headcount'] += 1
                setores_custo[setor]['custo_total'] += custo_tot
                setores_custo[setor]['cargos'].append(cargo)
        print(f"✓ Modelo de Custo de Colaboradores: {len(colaboradores_custo)} colaboradores (R$ {sum(c['custo_total'] for c in colaboradores_custo):,.2f}/mês)")
    except Exception as e:
        print(f"! Erro ao ler MODELO_CUSTO_COLABORADORES: {e}")

# 2. Carregar calculo de custo 2023 - Produtos fabricados.xlsx
prod_file = os.path.join(custos_dir, 'calculo de custo 2023 - Produtos fabricados.xlsx')
if os.path.exists(prod_file):
    try:
        import openpyxl
        wb_p = openpyxl.load_workbook(prod_file, data_only=True)
        for sname in wb_p.sheetnames:
            ws = wb_p[sname]
            nome_completo = ws.cell(1, 1).value
            itens_composicao = []
            producao_ref = 5000
            for r in range(1, 10):
                c6 = ws.cell(r, 6).value
                if isinstance(c6, (int, float)) and c6 >= 1000:
                    producao_ref = int(c6)
                    break
            
            secao_atual = 'Geral'
            custo_fab = 0
            custo_adm_mo = 0
            custo_despesas_fixas = 0
            custo_real = 0
            markup_valor = 0
            markup_pct = 0
            imposto_valor = 0
            preco_venda_sugerido = 0
            
            for r in range(1, ws.max_row + 1):
                c1 = str(ws.cell(r, 1).value or '').strip()
                c2 = ws.cell(r, 2).value
                c3 = ws.cell(r, 3).value
                c4 = ws.cell(r, 4).value
                c6 = ws.cell(r, 6).value
                
                if any(k in c1.upper() for k in ['MATERIA PRIMA', 'MATÉRIAS PRIMAS', 'MATERIA PRIMAS']):
                    secao_atual = 'Matéria-Prima'
                elif any(k in c1.upper() for k in ['INSUMOS']):
                    secao_atual = 'Insumos'
                elif any(k in c1.upper() for k in ['EMBALAGENS']):
                    secao_atual = 'Embalagens'
                elif any(k in c1.upper() for k in ['EQUIPAMENTOS']):
                    secao_atual = 'Equipamentos & Desgaste'
                elif any(k in c1.upper() for k in ['CUSTO ADMINISTRATIVOS', 'DESPESAS']):
                    secao_atual = 'Administrativo & Despesas'
                    
                if isinstance(c4, (int, float)) and c4 > 0 and c1 and not any(k in c1.upper() for k in ['CUSTO', 'VALOR', 'TOTAL', 'SUBTOTAL', 'IMPOSTO', 'MARKUP', 'REFER']):
                    itens_composicao.append({
                        'item': c1,
                        'tipo': secao_atual,
                        'custo_unitario': round(c4, 5),
                        'unidade': str(c3 or '')
                    })
                    
                if 'unit' in str(c6).lower() and r < 35:
                    v = ws.cell(r+1, 6).value or ws.cell(r+1, 1).value
                    if isinstance(v, (int, float)): custo_fab = round(v, 4)
                if 'unit' in str(c6).lower() and 35 <= r <= 48:
                    v = ws.cell(r+1, 6).value or ws.cell(r+1, 1).value
                    if isinstance(v, (int, float)): custo_adm_mo = round(v, 4)
                if 'unit' in str(c6).lower() and 48 < r <= 60:
                    v = ws.cell(r+1, 6).value or ws.cell(r+1, 1).value
                    if isinstance(v, (int, float)): custo_despesas_fixas = round(v, 4)
                        
                if 'CUSTO REAL' in c1.upper():
                    v = c2 or c6
                    if isinstance(v, (int, float)): custo_real = round(v, 4)
                if 'MARKUP' in c1.upper():
                    v = c2 or c6
                    if isinstance(v, (int, float)): markup_valor = round(v, 4)
                    if isinstance(c3, (int, float)): markup_pct = round(c3 * 100, 1)
                if 'IMPOSTO' in c1.upper():
                    v = c2 or c6
                    if isinstance(v, (int, float)): imposto_valor = round(v, 4)
                if any(k in str(c6).upper() for k in ['VENDA', 'VALOR ']):
                    for nr in range(r, min(r+4, ws.max_row+1)):
                        v = ws.cell(nr, 6).value
                        if isinstance(v, (int, float)) and v > 0:
                            preco_venda_sugerido = round(v, 2)
                            
            if sname == 'PMs':
                custo_fab = 1.7882
                custo_adm_mo = 0.8737
                custo_despesas_fixas = 0.2217
                custo_real = 3.2296
                markup_pct = 50.0
                markup_valor = round(custo_real * 0.50, 2)
                imposto_valor = 0.3460
                preco_venda_sugerido = 5.20
                producao_ref = 25000
                
            if custo_real == 0:
                custo_real = round(custo_fab + custo_adm_mo + custo_despesas_fixas, 4)
                
            margem_rs = round(preco_venda_sugerido - custo_real - imposto_valor, 2)
            margem_pct = round((margem_rs / preco_venda_sugerido * 100), 1) if preco_venda_sugerido > 0 else 0
            
            produtos_custo.append({
                'sheet_key': sname,
                'nome': nome_completo or sname,
                'producao_mensal_ref': producao_ref,
                'custo_fabricacao': custo_fab,
                'custo_adm_mo': custo_adm_mo,
                'custo_despesas_fixas': custo_despesas_fixas,
                'custo_real_total': custo_real,
                'markup_pct': markup_pct,
                'markup_valor': markup_valor,
                'imposto_valor': imposto_valor,
                'preco_venda_sugerido': preco_venda_sugerido,
                'margem_contribuicao_rs': margem_rs,
                'margem_contribuicao_pct': margem_pct,
                'itens_composicao': itens_composicao[:15]
            })
        print(f"✓ Fichas Técnicas de Produtos: {len(produtos_custo)} produtos analisados.")
    except Exception as e:
        print(f"! Erro ao ler calculo de custo 2023: {e}")

dados_custo_consolidado = {
    'total_colaboradores': len(colaboradores_custo),
    'custo_folha_mensal': sum(c['custo_total'] for c in colaboradores_custo),
    'salario_base_total': sum(c['salario_base'] for c in colaboradores_custo),
    'encargos_total': sum(c['encargos'] for c in colaboradores_custo),
    'custo_medio_colaborador': round(sum(c['custo_total'] for c in colaboradores_custo) / len(colaboradores_custo), 2) if colaboradores_custo else 0,
    'setores': setores_custo,
    'colaboradores': colaboradores_custo,
    'total_produtos_analisados': len(produtos_custo),
    'produtos_custo': produtos_custo
}

# -------------------------------------------------------------------------------------------------
# 6.8 CAMADA DE BUDGET & METAS PLANEJADAS (fato_budget)
# -------------------------------------------------------------------------------------------------
print("\n" + "=" * 75)
print("  CONSTRUINDO TABELA FATO_BUDGET (ORÇAMENTO ANUAL E MENSAL DINÂMICO)")
print("=" * 75)

fato_budget = []

# Pesos sazonais mensais do orçamento industrial (soma = 1.00)
PESOS_SAZONAIS_BUDGET = {
    1: 0.072,  # Jan
    2: 0.076,  # Fev
    3: 0.088,  # Mar
    4: 0.084,  # Abr
    5: 0.085,  # Mai
    6: 0.080,  # Jun
    7: 0.084,  # Jul
    8: 0.088,  # Ago
    9: 0.094,  # Set (Pico histórico de primavera)
    10: 0.090, # Out
    11: 0.084, # Nov
    12: 0.075  # Dez (Férias coletivas / recesso)
}

# Metas Anuais Base por Entidade (2020 a 2026)
# Nota Fiscal: Em 2026 o Grupo orça R$ 8.0M, mas o alerta fiscal monitora o sublimite de R$ 3.6M por CNPJ
BUDGET_ANUAL_ENTIDADES = {
    'Consolidado': {
        '2020': {'fat': 1850000.0, 'pecas': 360000,  'folha': 45000.0, 'ticket': 2100.0},
        '2021': {'fat': 3200000.0, 'pecas': 620000,  'folha': 58000.0, 'ticket': 2250.0},
        '2022': {'fat': 4800000.0, 'pecas': 910000,  'folha': 68000.0, 'ticket': 2400.0},
        '2023': {'fat': 5500000.0, 'pecas': 1020000, 'folha': 75000.0, 'ticket': 2500.0},
        '2024': {'fat': 6800000.0, 'pecas': 1250000, 'folha': 82000.0, 'ticket': 2600.0},
        '2025': {'fat': 7400000.0, 'pecas': 1350000, 'folha': 88000.0, 'ticket': 2650.0},
        '2026': {'fat': 8000000.0, 'pecas': 1480000, 'folha': 92000.0, 'ticket': 2700.0},
    },
    'MB': {
        '2020': {'fat': 1850000.0, 'pecas': 360000,  'folha': 45000.0, 'ticket': 2100.0},
        '2021': {'fat': 2800000.0, 'pecas': 540000,  'folha': 48000.0, 'ticket': 2250.0},
        '2022': {'fat': 3500000.0, 'pecas': 665000,  'folha': 52000.0, 'ticket': 2400.0},
        '2023': {'fat': 3600000.0, 'pecas': 670000,  'folha': 55000.0, 'ticket': 2500.0},
        '2024': {'fat': 4500000.0, 'pecas': 830000,  'folha': 60000.0, 'ticket': 2600.0},
        '2025': {'fat': 4800000.0, 'pecas': 880000,  'folha': 64000.0, 'ticket': 2650.0},
        '2026': {'fat': 4800000.0, 'pecas': 890000,  'folha': 66000.0, 'ticket': 2700.0},
    },
    'Moderna': {
        '2020': {'fat': 0.0,       'pecas': 0,       'folha': 0.0,     'ticket': 0.0},
        '2021': {'fat': 400000.0,  'pecas': 80000,   'folha': 10000.0, 'ticket': 2100.0},
        '2022': {'fat': 1300000.0, 'pecas': 245000,  'folha': 16000.0, 'ticket': 2300.0},
        '2023': {'fat': 1900000.0, 'pecas': 350000,  'folha': 20000.0, 'ticket': 2450.0},
        '2024': {'fat': 2300000.0, 'pecas': 420000,  'folha': 22000.0, 'ticket': 2550.0},
        '2025': {'fat': 2600000.0, 'pecas': 470000,  'folha': 24000.0, 'ticket': 2600.0},
        '2026': {'fat': 3200000.0, 'pecas': 590000,  'folha': 26000.0, 'ticket': 2680.0},
    }
}

for entidade, anos_dict in BUDGET_ANUAL_ENTIDADES.items():
    for ano_str, b_vals in anos_dict.items():
        # Registro Anual Consolidado na fato_budget
        fato_budget.append({
            'periodo': ano_str,
            'tipo_periodo': 'ANUAL',
            'entidade': entidade,
            'budget_faturamento': round(b_vals['fat'], 2),
            'budget_volume_pecas': int(b_vals['pecas']),
            'budget_custo_folha': round(b_vals['folha'] * 12, 2),
            'budget_custo_folha_mensal': round(b_vals['folha'], 2),
            'budget_ticket_medio': round(b_vals['ticket'], 2)
        })
        # Registros Mensais Sazonalizados na fato_budget
        for mes_num, peso in PESOS_SAZONAIS_BUDGET.items():
            periodo_ym = f"{ano_str}-{mes_num:02d}"
            fato_budget.append({
                'periodo': periodo_ym,
                'tipo_periodo': 'MENSAL',
                'entidade': entidade,
                'budget_faturamento': round(b_vals['fat'] * peso, 2),
                'budget_volume_pecas': int(round(b_vals['pecas'] * peso)),
                'budget_custo_folha': round(b_vals['folha'], 2),
                'budget_ticket_medio': round(b_vals['ticket'], 2)
            })

print(f"✓ Tabela fato_budget gerada com {len(fato_budget)} registros (Anual + Mensal Sazonalizado para Consolidado, MB e Moderna).")

# -------------------------------------------------------------------------------------------------
# 7. EXPORTAÇÃO FINAL DE DADOS DO DASHBOARD
# -------------------------------------------------------------------------------------------------
dataset_final = {
    'data_atualizacao': pd.Timestamp.now().strftime('%d/%m/%Y %H:%M:%S'),
    'arquivos_processados': [os.path.basename(f) for f in sales_files],
    'fato_budget': fato_budget,
    'ajuste_faturamento_oficial': ajuste_faturamento_oficial,
    'split_fiscal': split_fiscal_consolidado,
    'produtividade_rh': metricas_rh,
    'evolucao_mensal_folha': evolucao_mensal_folha_consolidado,
    'backlog_fabril': backlog_info,
    'custos_industriais': dados_custo_consolidado,
    'resumo_terceirizacao': resumo_terceirizacao_info,
    'empresas': {
        'consolidado': metricas_consolidado,
        'mb': metricas_mb,
        'moderna': metricas_moderna
    },
    'empresas_sem_terceirizacao': {
        'consolidado': metricas_sem_terc_consolidado,
        'mb': metricas_sem_terc_mb,
        'moderna': metricas_sem_terc_moderna
    },
    'empresas_apenas_terceirizacao': {
        'consolidado': metricas_apenas_terc_consolidado,
        'mb': metricas_apenas_terc_mb,
        'moderna': metricas_apenas_terc_moderna
    }
}


def _anonimizar_empresas(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == 'empresa' and isinstance(v, str):
                if v == 'Metalúrgica Brilho':
                    obj[k] = 'Empresa 1'
                elif v == 'Moderna':
                    obj[k] = 'Empresa 2'
            elif k in ('diagnostico', 'fonte', 'fonte_arquivo') and isinstance(v, str):
                v = v.replace('Metalúrgica Brilho (MB)', 'Empresa 1')
                v = v.replace('Metalúrgica Brilho', 'Empresa 1')
                v = v.replace('Moderna', 'Empresa 2')
                v = re.sub(r'\bMB\b', 'Empresa 1', v)
                obj[k] = v
            else:
                _anonimizar_empresas(v)
    elif isinstance(obj, list):
        for item in obj:
            _anonimizar_empresas(item)

_anonimizar_empresas(dataset_final)

# Salvar Planilha de Clientes Inativos / Churn
df_churn_export = pd.DataFrame(metricas_consolidado['analise_churn']['lista_inativos'])
churn_excel_paths = [
    os.path.join(ROOT_DIR, 'Relatório de carteira de pedidos', 'RELATORIO_CLIENTES_INATIVOS_CHURN.xlsx'),
    os.path.join(ROOT_DIR, 'RELATORIO_CLIENTES_INATIVOS_CHURN.xlsx'),
    os.path.join(BASE_DIR, 'RELATORIO_CLIENTES_INATIVOS_CHURN.xlsx')
]
for cp in churn_excel_paths:
    try:
        os.makedirs(os.path.dirname(cp), exist_ok=True)
        df_churn_export.to_excel(cp, index=False)
    except Exception as e:
        pass
print(f"✓ Planilha de Resgate Salva: RELATORIO_CLIENTES_INATIVOS_CHURN.xlsx ({len(df_churn_export)} clientes inativos)")

# Salvar data_dashboard.json (na Raiz, em Arquivos.js e no script dir)
json_str = json.dumps(dataset_final, ensure_ascii=False, indent=2)
json_targets = [
    os.path.join(ROOT_DIR, 'data_dashboard.json'),
    os.path.join(ROOT_DIR, 'Arquivos.js', 'data_dashboard.json'),
    os.path.join(BASE_DIR, 'data_dashboard.json')
]
for jt in json_targets:
    try:
        os.makedirs(os.path.dirname(jt), exist_ok=True)
        with open(jt, 'w', encoding='utf-8') as f:
            f.write(json_str)
    except Exception as e:
        print(f"! Erro ao gravar {jt}: {e}")

# Salvar data.js (na Raiz e em Arquivos.js)
js_str = 'window.DASHBOARD_DATA = ' + json.dumps(dataset_final, ensure_ascii=False) + ';'
js_targets = [
    os.path.join(ROOT_DIR, 'Arquivos.js', 'data.js'),
    os.path.join(ROOT_DIR, 'data.js')
]
for jt in js_targets:
    try:
        os.makedirs(os.path.dirname(jt), exist_ok=True)
        with open(jt, 'w', encoding='utf-8') as f:
            f.write(js_str)
    except Exception as e:
        print(f"! Erro ao gravar {jt}: {e}")

size_mb = os.path.getsize(json_targets[0]) / (1024 * 1024)
print("\n" + "=" * 75)
print(f"✓ SUCESSO! Base compilada salva em: data_dashboard.json e data.js ({size_mb:.2f} MB)")
print(f"  • Total Consolidado: R$ {metricas_consolidado['resumo_executivo']['total_faturamento']:,.2f}")
print(f"  • Metalúrgica Brilho: R$ {metricas_mb['resumo_executivo']['total_faturamento']:,.2f}")
print(f"  • Moderna:            R$ {metricas_moderna['resumo_executivo']['total_faturamento']:,.2f}")
print(f"  • Clientes Inativos:  {metricas_consolidado['analise_churn']['inativos_2026']} clientes (R$ {metricas_consolidado['analise_churn']['faturamento_inativo_total']:,.2f} histórico)")
print(f"  • Folha Anualizada:   {len(todos_ano_meses)} meses processados (Nov/2025 a Out/2026) | {len(todos_colaboradores)} colabs ativos")
print("=" * 75)
