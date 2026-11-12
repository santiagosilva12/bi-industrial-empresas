import json
import pandas as pd
import glob
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Re-run or inspect data
with open('data_dashboard.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

split = d['split_empresas']
print("=" * 75)
print("  ANÁLISE DE EQUILÍBRIO FISCAL: METALÚRGICA BRILHO (MB) VS MODERNA")
print("=" * 75)

for ano, s in sorted(split.items()):
    total = s['total']
    mb_v = s['mb_faturamento']
    mb_p = s['mb_pct']
    mod_v = s['moderna_faturamento']
    mod_p = s['moderna_pct']
    print(f"\nAno {ano}:")
    print(f"  • Faturamento Total Grupo: R$ {total:>12,.2f}")
    print(f"  • Metalúrgica Brilho (MB):  R$ {mb_v:>12,.2f} ({mb_p:>5.1f}%) | Sublimite R$3,6M: {'⚠️ ATINGIDO' if s['mb_risco_sublimite'] else '✓ Seguro'} | Teto R$4,8M: {'🚨 ESTOUROU' if s['mb_risco_teto'] else '✓ Seguro'}")
    print(f"  • Moderna:                 R$ {mod_v:>12,.2f} ({mod_p:>5.1f}%) | Sublimite R$3,6M: {'⚠️ ATINGIDO' if mod_v > 3600000 else '✓ Seguro'} | Teto R$4,8M: {'🚨 ESTOUROU' if s['moderna_risco_teto'] else '✓ Seguro'}")
    
    # Avaliação de equilíbrio
    if mod_v == 0:
        print("  -> Status: 100% concentrado na MB (Moderna inativa ou sem faturamento neste ano).")
    elif mb_p > 75:
        print("  -> Status: ⚠️ DESBALANCEADO: Concentração excessiva na MB. Risco de tributação mais alta no Simples!")
    elif mb_p >= 40 and mb_p <= 60:
        print("  -> Status: 🎯 EQUILÍBRIO IDEAL: Faturamento bem distribuído entre as duas empresas (~50/50)!")
    else:
        print(f"  -> Status: Balanceamento moderado ({mb_p:.0f}% MB / {mod_p:.0f}% Moderna).")

print("\n" + "=" * 75)
