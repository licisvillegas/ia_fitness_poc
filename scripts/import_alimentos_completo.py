import os
import fitz  # PyMuPDF
from pymongo import MongoClient
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración de MongoDB desde .env
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB", "ia_fitness_db")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
collection = db['alimentos_equivalentes']

def procesar_pagina(page):
    """
    Procesa una página del PDF detectando columnas dinámicamente mediante gaps.
    """
    words = page.get_text("words")
    if not words: return []
    
    # Agrupar por líneas (Y coordinada similar)
    rows = {}
    for w in words:
        y_coord = round(w[1], 0)
        if y_coord not in rows: rows[y_coord] = []
        rows[y_coord].append(w)
    
    sorted_y = sorted(rows.keys())
    page_data = []
    current_group = "General"
    current_tipo = "Desconocido"
    
    for y in sorted_y:
        line_words = sorted(rows[y], key=lambda x: x[0])
        if not line_words: continue
        
        # Detectar "celdas" en la línea buscando gaps grandes (>15 puntos)
        cells = []
        current_cell = []
        for i, w in enumerate(line_words):
            if not current_cell:
                current_cell.append(w)
            else:
                last_w = current_cell[-1]
                # Si el gap entre palabras es > 15 puntos, es otra celda
                if w[0] - last_w[2] > 15:
                    cells.append(" ".join([x[4] for x in current_cell]))
                    current_cell = [w]
                else:
                    current_cell.append(w)
        if current_cell:
            cells.append(" ".join([x[4] for x in current_cell]))
            
        line_text = " ".join(cells).strip()
        
        # Detectar cabeceras (mayúsculas, pocas celdas)
        if line_text.isupper() and len(cells) < 3 and "taza" not in line_text.lower():
            text_clean = line_text.replace("(", "").replace(")", "").strip()
            if any(t in text_clean for t in ["GRASAS", "ACEITES"]): current_tipo = "Grasa"
            elif "CEREALES" in text_clean: current_tipo = "Cereal"
            elif "VERDURAS" in text_clean: current_tipo = "Verdura"
            elif any(t in text_clean for t in ["ANIMAL", "AOA"]): current_tipo = "Animal"
            elif "FRUTAS" in text_clean: current_tipo = "Fruta"
            elif "LECHE" in text_clean: current_tipo = "Lácteo"
            
            if len(text_clean) > 3:
                current_group = text_clean
            continue

        # Si tenemos un número par de celdas, asumimos que son pares (Nombre, Cantidad)
        # Esto maneja 2 columnas (4 celdas), 3 columnas (6 celdas), etc.
        if len(cells) >= 2:
            # Iterar de 2 en 2
            for i in range(0, len(cells) - 1, 2):
                nombre = cells[i].strip()
                cantidad = cells[i+1].strip()
                
                # Validaciones básicas
                if nombre and cantidad and len(nombre) > 2:
                    if nombre.lower() not in ["nombre", "alimento", "cantidad", "porción"]:
                        page_data.append({
                            "nombre": nombre,
                            "cantidad": cantidad,
                            "grupo": current_group,
                            "tipo": current_tipo
                        })
                        
    return page_data

import json

def main():
    pdf_path = 'lista de alimentos intercambiables_v2.pdf'
    if not os.path.exists(pdf_path):
        print(f"Error: No se encuentra el archivo {pdf_path}")
        return

    doc = fitz.open(pdf_path)
    todos_los_alimentos = []
    
    for page in doc:
        alimentos_pag = procesar_pagina(page)
        todos_los_alimentos.extend(alimentos_pag)

    json_path = 'docs/alimentos_all.json'
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(todos_los_alimentos, f, ensure_ascii=False, indent=2)
    
    print(f"Extraction complete. {len(todos_los_alimentos)} items saved to {json_path}")

if __name__ == "__main__":
    main()
