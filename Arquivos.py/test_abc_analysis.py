import pandas as pd
import glob

files = sorted(glob.glob('*VENDAS*.xlsx'))
dfs = []
for f in files:
    d = pd.read_excel(f)
    dfs.append(d)
df = pd.concat(dfs, ignore_index=True)
df['Ano'] = pd.to_datetime(df['Data da venda']).dt.year

p_agg = df.groupby('Nome do produto/serviço').agg(
    total_rev=('Valor Total', 'sum'),
    total_qty=('Quantidade de itens', 'sum'),
    avg_price=('Valor unitário', 'mean'),
    sales_count=('Número da venda', 'count'),
    first_year=('Ano', 'min'),
    last_year=('Ano', 'max')
).reset_index()

p_agg = p_agg.sort_values(by='total_rev', ascending=False)
p_agg['cum_rev'] = p_agg['total_rev'].cumsum()
total_sales = p_agg['total_rev'].sum()
p_agg['cum_pct'] = p_agg['cum_rev'] / total_sales
p_agg['curva_abc'] = p_agg['cum_pct'].apply(lambda x: 'A' if x <= 0.80 else ('B' if x <= 0.95 else 'C'))

print(f"Total de Produtos Analisados: {len(p_agg)}")
print(f"Faturamento Total Analisado: R$ {total_sales:,.2f}")
print("\n--- RESUMO CURVA ABC ---")
abc_summary = p_agg.groupby('curva_abc').agg(
    itens=('Nome do produto/serviço', 'count'),
    total_rev=('total_rev', 'sum'),
    total_qty=('total_qty', 'sum')
)
abc_summary['pct_itens'] = abc_summary['itens'] / len(p_agg) * 100
abc_summary['pct_rev'] = abc_summary['total_rev'] / total_sales * 100
print(abc_summary.to_string())

print("\n--- TOP 20 PRODUTOS CLASSE A (MAIORES GERADORES DE RECEITA) ---")
for idx, r in p_agg.head(20).iterrows():
    name = str(r['Nome do produto/serviço'])[:45]
    print(f"{name:<45} | R$ {r['total_rev']:>10,.2f} | Qtd: {int(r['total_qty']):>8,d} | Preço Médio: R$ {r['avg_price']:>6.2f} | ABC: {r['curva_abc']}")

# Also let's check recent trend: 2024 vs 2025 vs 2026
recent = df[df['Ano'].isin([2024, 2025, 2026])].pivot_table(
    index='Nome do produto/serviço',
    columns='Ano',
    values='Quantidade de itens',
    aggfunc='sum',
    fill_value=0
)
recent.columns = [f"Qtd_{c}" for c in recent.columns]
p_agg = p_agg.merge(recent, on='Nome do produto/serviço', how='left').fillna(0)

# Calculate annual variation 2024 to 2025
p_agg['var_24_25_pct'] = ((p_agg['Qtd_2025'] - p_agg['Qtd_2024']) / p_agg['Qtd_2024'].replace(0, 1)) * 100

def get_recommendation(row):
    # Industrial decision rule
    if row['curva_abc'] == 'A':
        if row['Qtd_2025'] >= row['Qtd_2024'] * 0.9:
            return "🟢 PRODUZIR MAIS (Alta Rentabilidade & Demanda Máxima)"
        else:
            return "🟡 MANTER EM ESTOQUE (Alta Rentabilidade / Monitorar Giro)"
    elif row['curva_abc'] == 'B':
        if row['Qtd_2025'] > row['Qtd_2024']:
            return "🟢 EXPANDIR PRODUÇÃO (Produto em Ascensão / Potencial Classe A)"
        else:
            return "🟡 MANTER LOTE PADRÃO (Demanda Estável)"
    else: # Classe C
        if row['total_qty'] < 50:
            return "🔴 PRODUZIR APENAS SOB ENCOMENDA / AVALIAR CORTE"
        else:
            return "🟠 PRODUZIR EM LOTE REDUZIDO (Baixo Giro)"

p_agg['recomendacao'] = p_agg.apply(get_recommendation, axis=1)
print("\n--- DISTRIBUIÇÃO DAS RECOMENDAÇÕES INDUSTRIAIS ---")
print(p_agg['recomendacao'].value_counts().to_string())
