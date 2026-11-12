import pandas as pd
import glob
import sys

sys.stdout.reconfigure(encoding='utf-8')

files = sorted(glob.glob('*VENDAS*.xlsx') + glob.glob('*RELAORIO*.xlsx'))
dfs = [pd.read_excel(f) for f in files if not f.startswith('~$')]
df = pd.concat(dfs, ignore_index=True)

df['Data'] = pd.to_datetime(df['Data da venda'], errors='coerce')
df = df.dropna(subset=['Data'])
df['Ano'] = df['Data'].dt.year

max_date = df['Data'].max()
print("Data máxima no histórico de vendas:", max_date.strftime('%d/%m/%Y'))

# Agrupar por Cliente
cli_agg = df.groupby('Cliente').agg(
    faturamento_total=('Valor Total', 'sum'),
    total_pedidos=('Número da venda', 'nunique'),
    total_itens=('Quantidade de itens', 'sum'),
    primeira_compra=('Data', 'min'),
    ultima_compra=('Data', 'max'),
    cidade=('Cidade do cliente', 'first')
).reset_index()

cli_agg['dias_sem_comprar'] = (max_date - cli_agg['ultima_compra']).dt.days
cli_agg['ano_ultima_compra'] = cli_agg['ultima_compra'].dt.year

# Clientes ativos em 2026 vs inativos
ativos_2026 = set(df[df['Ano'] == 2026]['Cliente'].unique())
cli_agg['ativo_2026'] = cli_agg['Cliente'].isin(ativos_2026)

# Segmentação de Risco de Churn
def classificar_churn(row):
    dias = row['dias_sem_comprar']
    fat = row['faturamento_total']
    
    if dias <= 120:
        return '🟢 ATIVO (Comprou nos últimos 4 meses)'
    elif dias <= 270:
        if fat >= 20000:
            return '🚨 RISCO CRÍTICO (Grande cliente sem comprar há 4 a 9 meses)'
        else:
            return '🟡 EM ALERTA (Sem compras há 4 a 9 meses)'
    elif dias <= 540:
        if fat >= 20000:
            return '🔴 CHURN DE ALTO VALOR (Comprou em 2025 mas parou em 2026)'
        else:
            return '🟠 INATIVO RECENTE (Mais de 9 meses sem comprar)'
    else:
        return '💤 INATIVO DE LONGO PRAZO (Sem compras há mais de 1 ano e meio)'

cli_agg['status_churn'] = cli_agg.apply(classificar_churn, axis=1)

print(f"\nTotal Geral de Clientes na Carteira: {len(cli_agg)}")
print(f"Clientes Ativos em 2026: {len(ativos_2026)} ({len(ativos_2026)/len(cli_agg)*100:.1f}%)")
print(f"Clientes que NÃO compraram nada em 2026: {len(cli_agg) - len(ativos_2026)} ({(len(cli_agg) - len(ativos_2026))/len(cli_agg)*100:.1f}%)")

print("\n--- DISTRIBUIÇÃO POR STATUS DE CHURN ---")
print(cli_agg['status_churn'].value_counts().to_string())

inativos_top = cli_agg[~cli_agg['ativo_2026']].sort_values(by='faturamento_total', ascending=False)
print("\n--- TOP 20 CLIENTES INATIVOS EM 2026 COM MAIOR HISTÓRICO DE COMPRAS (RESGATE URGENTE) ---")
for idx, r in inativos_top.head(20).iterrows():
    nome = str(r['Cliente'])[:38]
    cid = str(r['cidade'])[:20]
    dt = r['ultima_compra'].strftime('%d/%m/%Y')
    print(f"{nome:<38} | R$ {r['faturamento_total']:>10,.2f} | {r['total_pedidos']:>3} ped | {int(r['total_itens']):>6,d} un | Última: {dt} ({r['dias_sem_comprar']:>4} dias) | {cid}")
