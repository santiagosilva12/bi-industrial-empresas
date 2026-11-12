import pandas as pd
import glob
import json

files = sorted(glob.glob('*VENDAS*.xlsx') + glob.glob('*RELAORIO*.xlsx'))
dfs = []
for f in files:
    if f.startswith('~$'): continue
    empresa = 'Moderna' if ('MODERNA' in f or 'MOD' in f) else 'Metalúrgica Brilho'
    d = pd.read_excel(f)
    d['Empresa'] = empresa
    dfs.append(d)
df = pd.concat(dfs, ignore_index=True)
df['Data'] = pd.to_datetime(df['Data da venda'], errors='coerce')
df = df.dropna(subset=['Data'])
df['Ano'] = df['Data'].dt.year

def analisar_churn_empresa(df_sub):
    max_d = df_sub['Data'].max()
    cli = df_sub.groupby('Cliente').agg(
        faturamento=('Valor Total', 'sum'),
        quantidade=('Quantidade de itens', 'sum'),
        pedidos=('Número da venda', 'nunique'),
        cidade=('Cidade do cliente', 'first'),
        primeira_compra=('Data', 'min'),
        ultima_compra=('Data', 'max')
    ).reset_index().sort_values('faturamento', ascending=False)
    
    cli['dias_sem_comprar'] = (max_d - cli['ultima_compra']).dt.days
    cli['ativo_2026'] = cli['ultima_compra'].dt.year == 2026
    
    inativos = cli[~cli['ativo_2026']].copy()
    
    def classificar(r):
        fat = r['faturamento']
        dias = r['dias_sem_comprar']
        if fat >= 50000:
            return '🚨 CHURN CRÍTICO VIP', 'URGENTE', 'Contato Imediato da Diretoria / Gerente Comercial'
        elif fat >= 15000:
            return '🔴 ALTO VALOR EM RISCO', 'ALTA', 'Visita Técnica / Ligação com Oferta Especial'
        elif dias <= 365:
            return '⚠️ INATIVO RECENTE', 'MÉDIA', 'Campanha de Reativação WhatsApp / Novo Catálogo'
        else:
            return '💤 INATIVO DE LONGO PRAZO', 'BAIXA', 'E-mail Marketing / Proposta de Recompra'
            
    res_list = []
    for idx, r in inativos.iterrows():
        st, prio, acao = classificar(r)
        res_list.append({
            'cliente': r['Cliente'],
            'faturamento': round(float(r['faturamento']), 2),
            'quantidade': int(r['quantidade']),
            'pedidos': int(r['pedidos']),
            'cidade': str(r['cidade']),
            'ultima_compra': r['ultima_compra'].strftime('%d/%m/%Y'),
            'dias_sem_comprar': int(r['dias_sem_comprar']),
            'status': st,
            'prioridade': prio,
            'acao_sugerida': acao
        })
        
    return {
        'total_clientes': len(cli),
        'ativos_2026': int(cli['ativo_2026'].sum()),
        'inativos_2026': len(inativos),
        'faturamento_inativo_total': round(float(inativos['faturamento'].sum()), 2),
        'churn_vip_count': len([x for x in res_list if x['prioridade'] == 'URGENTE']),
        'lista_inativos': res_list
    }

res_cons = analisar_churn_empresa(df)
print(f"Total Clientes Consolidado: {res_cons['total_clientes']}")
print(f"Ativos 2026: {res_cons['ativos_2026']}")
print(f"Inativos 2026: {res_cons['inativos_2026']}")
print(f"Faturamento em Risco: R$ {res_cons['faturamento_inativo_total']:,.2f}")
print(f"Clientes VIP em Churn Crítico: {res_cons['churn_vip_count']}")
print(f"\nTop 5 Inativos:")
for c in res_cons['lista_inativos'][:5]:
    print(f"  • {c['cliente']} | R$ {c['faturamento']:,.2f} | Última: {c['ultima_compra']} ({c['dias_sem_comprar']} dias) | {c['status']}")
