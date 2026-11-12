import pypdf
import re
import pandas as pd
import json

def parse_colaboradores(pdf_path, empresa_nome):
    reader = pypdf.PdfReader(pdf_path)
    colaboradores = []
    
    # Processar página por página
    for p_num, page in enumerate(reader.pages):
        text = page.extract_text()
        if "T O  T A  I S    D A    E  M P R E  S  A" in text:
            continue # Pular página de totais
            
        # Dividir em blocos de colaboradores
        # Cada bloco de colaborador tem "S A LÁ RIO :" ou "S A LÁ RIO:" ou código de funcionário
        # Vamos dividir por padrão de código de 6 dígitos: \n(\d{6})\s+
        # Ou por blocos
        linhas = text.split("\n")
        
        i = 0
        while i < len(linhas):
            l = linhas[i].strip()
            m_code = re.match(r'^(\d{6})\s+([A-Z\s]{4,})', l)
            if m_code:
                cod = m_code.group(1)
                nome_raw = m_code.group(2).strip()
                nome = " ".join(nome_raw.split())
                
                # Coletar linhas do colaborador até o próximo código ou final da página
                bloco_linhas = [l]
                j = i + 1
                while j < len(linhas) and not re.match(r'^\d{6}\s+[A-Z\s]{4,}', linhas[j].strip()) and "T O  T A  I S" not in linhas[j]:
                    bloco_linhas.append(linhas[j])
                    j += 1
                
                bloco_text = "\n".join(bloco_linhas)
                i = j - 1
                
                # Extrair Cargo
                # Ex: "CA RG O :- H /M:\n0001 - EMPRESA EM GERAL\nA UX ILIA R DE PRODUCA O B220,00\n2.759,66"
                cargo = "Operador Fabril"
                salario_base = 0.0
                admissao = ""
                
                # Procurar Admissão
                m_adm = re.search(r'A\s*DMIS\s*S\s*Ã\s*O\s*:\s*(\d{2}/\d{2}/\d{4})', bloco_text)
                if m_adm:
                    admissao = m_adm.group(1)
                
                # Procurar Cargo nas linhas
                for idx_b, bl in enumerate(bloco_linhas):
                    if "CA RG O" in bl or "CARGO" in bl:
                        # Olhar as próximas 3 linhas
                        for k in range(1, 4):
                            if idx_b + k < len(bloco_linhas):
                                cand = bloco_linhas[idx_b + k].strip()
                                if cand and not cand.startswith("0001") and not re.match(r'^\d', cand):
                                    # Limpar sufixos numéricos como "220,00"
                                    cand_clean = re.sub(r'\d+,\d+', '', cand).strip()
                                    if len(cand_clean) > 3:
                                        cargo = cand_clean
                                        break
                        break
                        
                # Se não achou por ali, tentar regex geral de cargo
                if cargo == "Operador Fabril":
                    m_c = re.search(r'(GERENTE\s+COMERCIA\s*L|A\s*UX\s*ILIA\s*R\s+DE\s+PRODUCA\s*O\s*[A-Z]?|A\s*SSISTENTE\s+DE\s+V\s*ENDA\s*S|LIDER\s+DE\s+PRODUCA\s*O|GESTOR\s+COMERCIA\s*L|A\s*UX\s*ILIA\s*R\s+DE\s+ESCRITORIO\s*[A-Z]?|A\s*NA\s*LISTA\s+DE\s+A\s*UTOMOCA\s*O|ESTA\s*GIA\s*RIO\s*[A-Z]?)', bloco_text, re.IGNORECASE)
                    if m_c:
                        cargo = m_c.group(1).strip()
                
                # Normalizar cargo
                cargo_norm = " ".join(cargo.split())
                cargo_norm = cargo_norm.replace("A ux iliar", "Auxiliar").replace("A UX ILIA R", "Auxiliar").replace("PRODUCA O", "PRODUÇÃO").replace("A UTOMOCA O", "AUTOMAÇÃO").replace("V ENDA S", "VENDAS").replace("LIDER", "LÍDER")
                
                # Salário Base
                m_sal = re.search(r'(\d{1,3}\.\d{3},\d{2}|\d{3,4},\d{2})\s*\n?\s*001\s+30,00', bloco_text)
                if not m_sal:
                    m_sal = re.search(r'001\s+30,00\s+(\d{1,3}\.\d{3},\d{2}|\d{3,4},\d{2})', bloco_text)
                if not m_sal:
                    m_sal = re.search(r'043\s+30,00\s+(\d{1,3}\.\d{3},\d{2}|\d{3,4},\d{2})', bloco_text) # Estagiário
                if not m_sal:
                    m_sal = re.search(r'013\s+0,00\s+(\d{1,3}\.\d{3},\d{2}|\d{3,4},\d{2})', bloco_text) # Pró-labore
                if m_sal:
                    try: salario_base = float(m_sal.group(1).replace('.', '').replace(',', '.'))
                    except: pass
                
                # Vencimentos, Descontos, Líquido
                vencimentos = 0.0
                descontos = 0.0
                liquido = 0.0
                
                # Linha de totais do funcionário:
                # Ex: "3.491,02 LÍQ UIDO :DE S CO N TO S :V E N CIME N TO S :TO TA IS >>> 1.552,95 1.938,07"
                # Ou: "1.562,21 LÍQ UIDO :DE S CO N TO S :V E N CIME N TO S :TO TA IS >>> 479,78 1.082,43"
                m_tot = re.search(r'(\d+\.?\d*,\d{2})\s+L[ÍI]Q\s*U\s*IDO\s*:DE\s*S\s*CO\s*N\s*TO\s*S\s*:V\s*E\s*N\s*CIME\s*N\s*TO\s*S\s*:TO\s*TA\s*IS\s*>>>\s*(\d+\.?\d*,\d{2})\s+(\d+\.?\d*,\d{2})', bloco_text)
                if m_tot:
                    vencimentos = float(m_tot.group(1).replace('.', '').replace(',', '.'))
                    descontos = float(m_tot.group(2).replace('.', '').replace(',', '.'))
                    liquido = float(m_tot.group(3).replace('.', '').replace(',', '.'))
                else:
                    # Alternativas
                    m_venc = re.search(r'901\s+(\d+\.?\d*,\d{2})\s*.*?V\s*ENCIMENTOS', bloco_text)
                    if m_venc: vencimentos = float(m_venc.group(1).replace('.', '').replace(',', '.'))
                    m_desc = re.search(r'902\s+(\d+\.?\d*,\d{2})\s*.*?DESCONTOS', bloco_text)
                    if m_desc: descontos = float(m_desc.group(1).replace('.', '').replace(',', '.'))
                    m_liq = re.search(r'903\s+(\d+\.?\d*,\d{2})\s*.*?LIQUIDO', bloco_text)
                    if m_liq: liquido = float(m_liq.group(1).replace('.', '').replace(',', '.'))
                
                # FGTS
                fgts = 0.0
                m_fgts = re.search(r'924\s+(\d+\.?\d*,\d{2})\s*V\s*A\s*LOR\s*FGTS', bloco_text)
                if m_fgts:
                    fgts = float(m_fgts.group(1).replace('.', '').replace(',', '.'))
                
                # Horas Extras
                he_110 = 0.0
                m_he110 = re.search(r'030\s+\d+,\d+\s+(\d+\.?\d*,\d{2})\s*HORA\s*EX\s*TRA\s*110%', bloco_text)
                if m_he110: he_110 = float(m_he110.group(1).replace('.', '').replace(',', '.'))
                
                he_70 = 0.0
                m_he70 = re.search(r'031\s+\d+,\d+\s+(\d+\.?\d*,\d{2})\s*HORA\s*EX\s*TRA\s*70%', bloco_text)
                if m_he70: he_70 = float(m_he70.group(1).replace('.', '').replace(',', '.'))
                
                # Vale Alimentação
                va = 0.0
                m_va = re.search(r'105\s+0,00\s+(\d+\.?\d*,\d{2})\s*V\s*A\s*LE\s*A\s*LIMENTA', bloco_text)
                if m_va: va = float(m_va.group(1).replace('.', '').replace(',', '.'))
                
                # Custo Total Real para a Empresa:
                # Vencimentos Brutos + FGTS + Vale Alimentação (se já não estiver no vencimento)
                # Na folha analítica, Vale Alimentação é item 105 que compõe proventos ou benefício direto.
                custo_total_empresa = vencimentos + fgts
                
                # Setor sugerido com base no cargo
                cargo_u = cargo_norm.upper()
                if "PRODUÇÃO" in cargo_u or "OPERADOR" in cargo_u:
                    setor = "Produção Fabril"
                elif "COMERCIAL" in cargo_u or "VENDAS" in cargo_u:
                    setor = "Comercial & Vendas"
                elif "ESCRITORIO" in cargo_u or "ESCRITÓRIO" in cargo_u or "ADMINISTRATIVO" in cargo_u:
                    setor = "Administração & Apoio"
                elif "AUTOMAÇÃO" in cargo_u or "AUTOMAÇAO" in cargo_u or "MECANICO" in cargo_u:
                    setor = "Engenharia & Automação"
                elif "DIRET" in cargo_u or "PRO-LABORE" in cargo_u:
                    setor = "Diretoria"
                elif "ESTAGI" in cargo_u:
                    setor = "Estágio / Apoio"
                else:
                    setor = "Operacional Fabril"
                
                colaboradores.append({
                    'Empresa': empresa_nome,
                    'Código': cod,
                    'Nome': nome,
                    'Cargo': cargo_norm,
                    'Setor': setor,
                    'Admissão': admissao,
                    'Salário_Base': salario_base,
                    'Horas_Extras': he_110 + he_70,
                    'Vale_Alimentação': va,
                    'Vencimentos_Bruto': vencimentos,
                    'Descontos': descontos,
                    'Salário_Líquido': liquido,
                    'FGTS_Empresa': fgts,
                    'Custo_Total_Mensal': round(custo_total_empresa, 2),
                    'Custo_Total_Anual': round(custo_total_empresa * 13.33, 2)
                })
            i += 1
            
    # Deduplicar por Código
    unicos = {}
    for c in colaboradores:
        unicos[c['Código']] = c
    return list(unicos.values())

mb_list = parse_colaboradores("Folha Analitica 092026 METALURGICA (1).pdf", "Metalúrgica Brilho")
mod_list = parse_colaboradores("Folha Analitica 092026 MODERNA (1).pdf", "Moderna")

print(f"\nMETALÚRGICA BRILHO: {len(mb_list)} colaboradores extraídos")
print(f"MODERNA: {len(mod_list)} colaboradores extraídos")
todos = mb_list + mod_list
print(f"TOTAL GRUPO: {len(todos)} colaboradores")

df_colabs = pd.DataFrame(todos)
df_colabs.to_excel("FOLHA_COLABORADORES_CONSOLIDADA.xlsx", index=False)
print("Salvo em FOLHA_COLABORADORES_CONSOLIDADA.xlsx com sucesso!")

# Resumo por empresa
print("\n--- RESUMO CONSOLIDADO DA FOLHA REAL (SETEMBRO/2026) ---")
resumo = df_colabs.groupby('Empresa').agg(
    Colaboradores=('Código', 'count'),
    Salario_Base=('Salário_Base', 'sum'),
    Vencimentos_Bruto=('Vencimentos_Bruto', 'sum'),
    Horas_Extras=('Horas_Extras', 'sum'),
    FGTS=('FGTS_Empresa', 'sum'),
    Custo_Total_Mensal=('Custo_Total_Mensal', 'sum')
)
print(resumo.to_string())
