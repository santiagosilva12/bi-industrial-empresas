import pandas as pd

colaboradores_data = [
    {'Nome': 'Carlos Eduardo Silva', 'Cargo': 'Gerente de Produção Industrial', 'Setor': 'Gestão Fabril', 'Salario_Base': 5500.00, 'Encargos_Beneficios': 2750.00, 'Custo_Total_Mensal': 8250.00, 'Status': 'Ativo', 'Data_Admissao': '2021-03-15'},
    {'Nome': 'Marcos Vinicius Santos', 'Cargo': 'Torneiro Mecânico CNC Sênior', 'Setor': 'Usinagem & Mandris', 'Salario_Base': 3800.00, 'Encargos_Beneficios': 1900.00, 'Custo_Total_Mensal': 5700.00, 'Status': 'Ativo', 'Data_Admissao': '2020-08-10'},
    {'Nome': 'Lucas Ferreira Lima', 'Cargo': 'Torneiro Mecânico Pleno', 'Setor': 'Usinagem & Mandris', 'Salario_Base': 3100.00, 'Encargos_Beneficios': 1550.00, 'Custo_Total_Mensal': 4650.00, 'Status': 'Ativo', 'Data_Admissao': '2022-02-01'},
    {'Nome': 'Diego Alves Rocha', 'Cargo': 'Operador de Usinagem Junior', 'Setor': 'Usinagem & Mandris', 'Salario_Base': 2400.00, 'Encargos_Beneficios': 1200.00, 'Custo_Total_Mensal': 3600.00, 'Status': 'Ativo', 'Data_Admissao': '2023-05-18'},
    {'Nome': 'Antônio Pereira Souza', 'Cargo': 'Especialista em Diamantação', 'Setor': 'Diamantação & Galvanoplastia', 'Salario_Base': 4200.00, 'Encargos_Beneficios': 2100.00, 'Custo_Total_Mensal': 6300.00, 'Status': 'Ativo', 'Data_Admissao': '2020-05-20'},
    {'Nome': 'Rodrigo Barbosa Mendes', 'Cargo': 'Operador de Banho Diamantado', 'Setor': 'Diamantação & Galvanoplastia', 'Salario_Base': 2900.00, 'Encargos_Beneficios': 1450.00, 'Custo_Total_Mensal': 4350.00, 'Status': 'Ativo', 'Data_Admissao': '2021-11-10'},
    {'Nome': 'Gabriel Costa Ribeiro', 'Cargo': 'Operador de Eletrodeposição', 'Setor': 'Diamantação & Galvanoplastia', 'Salario_Base': 2700.00, 'Encargos_Beneficios': 1350.00, 'Custo_Total_Mensal': 4050.00, 'Status': 'Ativo', 'Data_Admissao': '2022-09-01'},
    {'Nome': 'Fernando Martins Dias', 'Cargo': 'Brasador de Pontas Tungstênio', 'Setor': 'Usinagem & Tungstênio', 'Salario_Base': 3300.00, 'Encargos_Beneficios': 1650.00, 'Custo_Total_Mensal': 4950.00, 'Status': 'Ativo', 'Data_Admissao': '2021-04-12'},
    {'Nome': 'Rafael Nogueira', 'Cargo': 'Operador de Prensa e Corte Lixas', 'Setor': 'Abrasivos & Lixas', 'Salario_Base': 2500.00, 'Encargos_Beneficios': 1250.00, 'Custo_Total_Mensal': 3750.00, 'Status': 'Ativo', 'Data_Admissao': '2022-06-15'},
    {'Nome': 'Juliana Ramos Pinto', 'Cargo': 'Montadora de Tiras e Fibras', 'Setor': 'Abrasivos & Lixas', 'Salario_Base': 2300.00, 'Encargos_Beneficios': 1150.00, 'Custo_Total_Mensal': 3450.00, 'Status': 'Ativo', 'Data_Admissao': '2023-01-10'},
    {'Nome': 'Patrícia Souza Castro', 'Cargo': 'Inspetora de Controle de Qualidade', 'Setor': 'Qualidade & Inspeção', 'Salario_Base': 3200.00, 'Encargos_Beneficios': 1600.00, 'Custo_Total_Mensal': 4800.00, 'Status': 'Ativo', 'Data_Admissao': '2021-01-20'},
    {'Nome': 'Beatriz Oliveira Santos', 'Cargo': 'Auxiliar de Embalagem e Separação', 'Setor': 'Embalagem & Expedição', 'Salario_Base': 2200.00, 'Encargos_Beneficios': 1100.00, 'Custo_Total_Mensal': 3300.00, 'Status': 'Ativo', 'Data_Admissao': '2023-03-01'},
    {'Nome': 'Camila Silveira', 'Cargo': 'Operadora de Etiquetagem e Blister', 'Setor': 'Embalagem & Expedição', 'Salario_Base': 2100.00, 'Encargos_Beneficios': 1050.00, 'Custo_Total_Mensal': 3150.00, 'Status': 'Ativo', 'Data_Admissao': '2024-02-15'},
    {'Nome': 'Marcelo Henrique Vieira', 'Cargo': 'Líder de Expedição e Logística', 'Setor': 'Embalagem & Expedição', 'Salario_Base': 3000.00, 'Encargos_Beneficios': 1500.00, 'Custo_Total_Mensal': 4500.00, 'Status': 'Ativo', 'Data_Admissao': '2020-09-01'},
    {'Nome': 'Roberto Freitas Carvalho', 'Cargo': 'Mecânico de Manutenção Fabril', 'Setor': 'Manutenção & Ferramentaria', 'Salario_Base': 3600.00, 'Encargos_Beneficios': 1800.00, 'Custo_Total_Mensal': 5400.00, 'Status': 'Ativo', 'Data_Admissao': '2021-07-05'},
    {'Nome': 'Vanessa Cristina Machado', 'Cargo': 'Analista Administrativo / Faturamento', 'Setor': 'Administração & Fiscal', 'Salario_Base': 3400.00, 'Encargos_Beneficios': 1700.00, 'Custo_Total_Mensal': 5100.00, 'Status': 'Ativo', 'Data_Admissao': '2021-02-18'},
    {'Nome': 'Aline Fernandes Borges', 'Cargo': 'Assistente Comercial e Pós-Venda', 'Setor': 'Comercial & Atendimento', 'Salario_Base': 2600.00, 'Encargos_Beneficios': 1300.00, 'Custo_Total_Mensal': 3900.00, 'Status': 'Ativo', 'Data_Admissao': '2022-10-01'},
    {'Nome': 'Leandro Moreira Duarte', 'Cargo': 'Auxiliar Fabril Geral', 'Setor': 'Apoio Fabril', 'Salario_Base': 2100.00, 'Encargos_Beneficios': 1050.00, 'Custo_Total_Mensal': 3150.00, 'Status': 'Ativo', 'Data_Admissao': '2024-05-02'}
]

df = pd.DataFrame(colaboradores_data)
df.to_excel('MODELO_CUSTO_COLABORADORES.xlsx', index=False)
print("Criado MODELO_CUSTO_COLABORADORES.xlsx com sucesso!")
print(f"Total Colaboradores: {len(df)}")
print(f"Folha Base Mensal: R$ {df['Salario_Base'].sum():,.2f}")
print(f"Custo Total Mensal Empresa: R$ {df['Custo_Total_Mensal'].sum():,.2f}")
print(f"Custo Total Anualizado: R$ {df['Custo_Total_Mensal'].sum()*13.33:,.2f}")
