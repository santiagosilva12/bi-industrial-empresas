import pypdf
import re
import json

def parse_pdf(pdf_path, empresa_nome):
    reader = pypdf.PdfReader(pdf_path)
    full_text = "\n".join([page.extract_text() for page in reader.pages])
    
    print(f"\n=======================================================")
    print(f"PARSING: {empresa_nome} ({pdf_path})")
    print(f"=======================================================")
    
    # Extrair totais da empresa (última página)
    last_page = reader.pages[-1].extract_text()
    
    # Total de funcionários
    tot_func_match = re.search(r'CLT:\s*(\d+)', last_page)
    tot_func = int(tot_func_match.group(1)) if tot_func_match else 0
    
    # Totais financeiros da folha
    # Procurar vencimentos, descontos, líquido
    venc_match = re.search(r'38\.916,96|4\d\.\d{3},\d{2}|\d+\.\d{3},\d{2}\s+LÍQ\s*U\s*IDO', last_page)
    
    print(f"Total Colaboradores CLT: {tot_func}")
    
    # Vamos extrair colaborador por colaborador
    # Cada colaborador começa com: "S A LÁ RIO :" seguido pelo código e Nome
    # ou "0000XX NOME DO COLABORADOR"
    pages_text = [page.extract_text() for page in reader.pages]
    
    colaboradores = []
    
    for p_idx, text in enumerate(pages_text):
        # Quebrar por "S A LÁ RIO :" ou código do funcionário
        # Ex: "000001 NOME..." ou "000011 NOME..."
        lines = text.split("\n")
        current_colab = None
        
        for i, line in enumerate(lines):
            line_s = line.strip()
            # Detectar funcionário: formato "0000XX NOME..."
            m_colab = re.match(r'^(\d{6})\s+([A-Z\s]{4,})', line_s)
            if m_colab:
                codigo = m_colab.group(1)
                nome = m_colab.group(2).strip()
                # Limpar espaços duplos
                nome_limpo = " ".join(nome.split())
                
                # Pegar linhas seguintes para cargo, admissão, salário
                cargo = "Não especificado"
                admissao = ""
                salario_base = 0.0
                vencimentos = 0.0
                descontos = 0.0
                liquido = 0.0
                fgts = 0.0
                
                # Olhar nas próximas 15 linhas
                contexto = "\n".join(lines[max(0, i-2):min(len(lines), i+25)])
                
                # Cargo
                m_cargo = re.search(r'CA\s*RG\s*O\s*:\s*-?\s*H\s*/\s*M\s*:\s*0001\s*-\s*empresa\s*em\s*geral\s*\n\s*([^\n\d]+)', contexto, re.IGNORECASE)
                if not m_cargo:
                    m_cargo = re.search(r'CA\s*RG\s*O\s*:\s*-?\s*\n\s*([^\n\d]+)', contexto, re.IGNORECASE)
                if not m_cargo:
                    # Procurar cargo comum
                    for c_cand in ['A ux iliar de Producao', 'A ux iliar Administrativo', 'LIDER DE PRODUCA O', 'A SSISTENTE DE V ENDA S', 'GESTOR COMERCIA L', 'Torneiro', 'Operador', 'Mecanico', 'Vendedor', 'Gerente', 'Auxiliar']:
                        if c_cand.lower() in contexto.lower():
                            cargo = c_cand
                            break
                else:
                    cargo = m_cargo.group(1).strip()
                
                # Admissão
                m_adm = re.search(r'A\s*DMIS\s*S\s*Ã\s*O\s*:\s*(\d{2}/\d{2}/\d{4})', contexto)
                if m_adm:
                    admissao = m_adm.group(1)
                
                # Salário Base
                m_sal = re.search(r'S\s*A\s*LÁ\s*RIO\s*:\s*\n?\s*(\d+\.?\d*,\d{2})', contexto)
                if m_sal:
                    try: salario_base = float(m_sal.group(1).replace('.', '').replace(',', '.'))
                    except: pass
                
                # FGTS
                m_fgts = re.search(r'V\s*A\s*LOR\s*FGTS\s*\n?\s*(\d+\.?\d*,\d{2})|TOT\s+(\d+\.?\d*,\d{2})\s+V\s*A\s*LOR\s*FGTS', contexto)
                if m_fgts:
                    val_str = m_fgts.group(1) or m_fgts.group(2)
                    try: fgts = float(val_str.replace('.', '').replace(',', '.'))
                    except: pass
                
                # Totais: Vencimentos, Descontos, Líquido
                # Ex: "3.517,60 LÍQ UIDO :DE S CO N TO S :V E N CIME N TO S :TO TA IS >>> 1.482,70 2.034,90"
                m_tot = re.search(r'(\d+\.?\d*,\d{2})\s+LÍQ\s*U\s*IDO\s*:DE\s*S\s*CO\s*N\s*TO\s*S\s*:V\s*E\s*N\s*CIME\s*N\s*TO\s*S\s*:TO\s*TA\s*IS\s*>>>\s*(\d+\.?\d*,\d{2})\s+(\d+\.?\d*,\d{2})', contexto)
                if m_tot:
                    try:
                        vencimentos = float(m_tot.group(1).replace('.', '').replace(',', '.'))
                        descontos = float(m_tot.group(2).replace('.', '').replace(',', '.'))
                        liquido = float(m_tot.group(3).replace('.', '').replace(',', '.'))
                    except: pass
                
                colaboradores.append({
                    'empresa': empresa_nome,
                    'codigo': codigo,
                    'nome': nome_limpo,
                    'cargo': cargo,
                    'admissao': admissao,
                    'salario_base': salario_base,
                    'vencimentos': vencimentos,
                    'descontos': descontos,
                    'liquido': liquido,
                    'fgts': fgts
                })
    
    # Remover duplicatas por código
    colab_dict = {}
    for c in colaboradores:
        colab_dict[c['codigo']] = c
    lista_final = list(colab_dict.values())
    
    print(f"Colaboradores encontrados: {len(lista_final)}")
    for c in lista_final:
        print(f"  [{c['codigo']}] {c['nome']} | Cargo: {c['cargo']} | Salário: R$ {c['salario_base']:,.2f} | Vencimentos: R$ {c['vencimentos']:,.2f} | FGTS: R$ {c['fgts']:,.2f}")
    
    return lista_final, last_page

mb_colabs, mb_last = parse_pdf("Folha Analitica 092026 METALURGICA (1).pdf", "Metalúrgica Brilho")
mod_colabs, mod_last = parse_pdf("Folha Analitica 092026 MODERNA (1).pdf", "Moderna")
