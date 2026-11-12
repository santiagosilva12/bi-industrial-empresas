import json

with open('data_dashboard.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

for emp_key, emp_name in [('consolidado', 'Consolidado'), ('mb', 'Metalúrgica Brilho'), ('moderna', 'Moderna')]:
    rh = d['empresas'][emp_key]['produtividade_rh']
    print(f"=== {emp_name} ===")
    print(f"  Total Colaboradores: {rh['total_colaboradores']}")
    print(f"  Custo Folha Mensal: R$ {rh['custo_folha_mensal']:,.2f}")
    print(f"  Faturamento per Capita: R$ {rh['fat_per_capita_mensal']:,.2f}")
    print(f"  Custo Médio / Colaborador: R$ {rh['custo_medio_colaborador']:,.2f}")
    print(f"  Margem Líquida / Colaborador: R$ {rh['lucro_bruto_per_capita_mensal']:,.2f}")
    print(f"  Índice de Folha s/ Receita: {rh['indice_folha_faturamento']:.1f}%")
    print(f"  ROI de Mão de Obra: {rh['roi_mao_de_obra']:.2f}x\n")
