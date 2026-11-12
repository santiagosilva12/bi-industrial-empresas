import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')

for pdf_name in ["Folha Analitica 092026 METALURGICA (1).pdf", "Folha Analitica 092026 MODERNA (1).pdf"]:
    print("=" * 80)
    print(f"LENDO: {pdf_name}")
    print("=" * 80)
    reader = pypdf.PdfReader(pdf_name)
    print(f"Total de páginas: {len(reader.pages)}")
    for i, page in enumerate(reader.pages):
        print(f"\n--- PÁGINA {i+1} ---")
        text = page.extract_text()
        print(text[:2500]) # Primeiros 2500 caracteres
