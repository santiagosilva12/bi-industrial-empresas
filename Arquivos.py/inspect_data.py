import pandas as pd
import glob
import os

print("--- ANALYZING SALES FILES ---")
sales_files = sorted(glob.glob('RELATORIO*.xlsx') + glob.glob('RELAORIO*.xlsx'))
total_rows = 0

for f in sales_files:
    if f.startswith('~$'):
        continue
    df = pd.read_excel(f, sheet_name=0)
    total_rows += len(df)
    min_date = df['Data da venda'].min()
    max_date = df['Data da venda'].max()
    revenue = df['Valor Total'].sum() if 'Valor Total' in df.columns else 0
    print(f"File: {f}")
    print(f"  Rows: {len(df)}")
    print(f"  Date range: {min_date} to {max_date}")
    print(f"  Total Revenue: R$ {revenue:,.2f}")
    print(f"  Unique Clients: {df['Cliente'].nunique() if 'Cliente' in df.columns else 0}")
    print(f"  Unique Products: {df['Nome do produto/serviço'].nunique() if 'Nome do produto/serviço' in df.columns else 0}")
    print(f"  Sample Cities: {df['Cidade do cliente'].dropna().unique()[:5] if 'Cidade do cliente' in df.columns else 'N/A'}")
    print()

print(f"TOTAL ROWS ACROSS ALL YEARS: {total_rows}")

print("\n--- ANALYZING PEDIDOS PENDENTES 2026.xlsx ---")
if os.path.exists('PEDIDOS PENDENTES 2026.xlsx'):
    xl = pd.ExcelFile('PEDIDOS PENDENTES 2026.xlsx')
    print("Sheets count:", len(xl.sheet_names))
    print("Sheets sample:", xl.sheet_names[:10])
    for s in ['PENDÊNCIAS', 'PEDIDOS PEÇAS FALTANDO', 'PEDIDOS PENDENTES 2025.2026', xl.sheet_names[0]]:
        if s in xl.sheet_names:
            df_s = xl.parse(s, nrows=5)
            print(f"\nSheet '{s}' shape:", df_s.shape)
            print("Headers/first row:", df_s.columns.tolist())
            print(df_s.head(3))
