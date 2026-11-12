import json
import unicodedata
import glob
import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower().strip()

with open('ibge_lookup.json', 'r', encoding='utf-8') as f:
    lookup = json.load(f)

files = sorted(glob.glob('*VENDAS*.xlsx'))
dfs = [pd.read_excel(f) for f in files]
df = pd.concat(dfs, ignore_index=True)

def get_uf(c):
    if not isinstance(c, str) or not c.strip() or c == '(em branco)': return 'N/D'
    return lookup.get(norm(c), {}).get('uf', 'OUTRO')

def get_regiao(c):
    if not isinstance(c, str) or not c.strip() or c == '(em branco)': return 'Não Identificado'
    return lookup.get(norm(c), {}).get('regiao', 'Outro')

df['UF'] = df['Cidade do cliente'].apply(get_uf)
df['Regiao'] = df['Cidade do cliente'].apply(get_regiao)

total_sales = df['Valor Total'].sum()
print(f"Total Faturamento: R$ {total_sales:,.2f}")

uf_agg = df.groupby('UF').agg(
    faturamento=('Valor Total', 'sum'),
    quantidade=('Quantidade de itens', 'sum'),
    pedidos=('Número da venda', 'nunique'),
    clientes=('Cliente', 'nunique')
).sort_values(by='faturamento', ascending=False)
uf_agg['pct'] = uf_agg['faturamento'] / total_sales * 100

print("\n--- RANKING DE VENDAS POR ESTADO (UF) ---")
for uf, r in uf_agg.head(15).iterrows():
    print(f"{uf:<4}: R$ {r['faturamento']:>11,.2f} ({r['pct']:>5.1f}%) | Qtd: {int(r['quantidade']):>8,d} | Pedidos: {int(r['pedidos']):>5,d} | Clientes: {int(r['clientes']):>4,d}")

reg_agg = df.groupby('Regiao').agg(
    faturamento=('Valor Total', 'sum'),
    quantidade=('Quantidade de itens', 'sum')
).sort_values(by='faturamento', ascending=False)
reg_agg['pct'] = reg_agg['faturamento'] / total_sales * 100
print("\n--- RANKING POR MACRO-REGIÃO ---")
for reg, r in reg_agg.iterrows():
    print(f"{reg:<16}: R$ {r['faturamento']:>11,.2f} ({r['pct']:>5.1f}%) | Qtd: {int(r['quantidade']):>8,d}")
