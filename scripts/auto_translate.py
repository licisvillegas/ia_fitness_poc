#!/usr/bin/env python3
r"""
auto_translate.py

Escanea `static/js/lang.js` y rellena automáticamente las entradas vacías de `en` usando
una API de traducción (DeepL o Google Translate).

Uso (PowerShell):
  # dry-run (no modifica archivos)
  $env:TRANSLATE_PROVIDER='deepl'; $env:TRANSLATE_API_KEY='tu_clave'; python .\scripts\auto_translate.py --dry-run

  # ejecutar y escribir resultados en el archivo (se crea copia de seguridad)
  $env:TRANSLATE_PROVIDER='google'; $env:TRANSLATE_API_KEY='tu_clave'; python .\scripts\auto_translate.py

Variables de entorno:
  TRANSLATE_PROVIDER  - 'deepl' o 'google' (default: deepl)
  TRANSLATE_API_KEY   - clave de la API (no se recomienda pasarla por línea de comandos)

Nota: el script no enviará llamadas de red si no encuentra la variable de entorno TRANSLATE_API_KEY;
en ese caso imprimirá las traducciones propuestas y saldrá (modo dry-run implícito).

Requisitos:
  pip install requests

Este archivo realiza copias de seguridad automáticas: `static/js/lang.js.bak` antes de sobrescribir.
"""

import re
import os
import sys
import json
import time
from argparse import ArgumentParser

try:
    import requests
except Exception:
    requests = None


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANG_JS = os.path.join(ROOT, 'static', 'js', 'lang.js')


def js_escape(s: str) -> str:
    # Escapa comillas simples y barras para que quepan en strings JS entre comillas simples
    return s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')


def extract_entries(text: str):
    """Extrae todas las entradas con su clave y valores ES/EN.

    Soporta dos formatos:
      - En el literal inicial:  'key': { es: '...', en: '...' },
      - Asignaciones: dict['key'] = { es: '...', en: '' };
    """
    entries = {}
    # patrón para literal dentro de const dict = { ... }
    literal_block = None
    m_block = re.search(r"const\s+dict\s*=\s*\{(.*?)\};", text, re.S)
    if m_block:
        literal_block = m_block.group(1)
        pattern = re.compile(r"'(?P<key>[^']+)'\s*:\s*\{\s*es\s*:\s*'(?P<es>(?:\\'|[^'])*)'\s*,\s*en\s*:\s*'(?P<en>(?:\\'|[^'])*)'\s*\}\s*,?", re.S)
        for mm in pattern.finditer(literal_block):
            key = mm.group('key')
            es = mm.group('es').replace("\\'", "'")
            en = mm.group('en').replace("\\'", "'")
            entries[key] = {'es': es, 'en': en}

    # patrón para asignaciones dict['key'] = { es: '...', en: '...' };
    pattern2 = re.compile(r"dict\['(?P<key>[^']+)'\]\s*=\s*\{\s*es\s*:\s*'(?P<es>(?:\\'|[^'])*)'\s*,\s*en\s*:\s*'(?P<en>(?:\\'|[^'])*)'\s*\}\s*;", re.S)
    for mm in pattern2.finditer(text):
        key = mm.group('key')
        es = mm.group('es').replace("\\'", "'")
        en = mm.group('en').replace("\\'", "'")
        entries[key] = {'es': es, 'en': en}

    return entries


def translate_deepl(text: str, api_key: str, target_lang='EN') -> str:
    # DeepL API - detect free vs pro automatically by trying api-free first if fails
    if requests is None:
        raise RuntimeError('requests library is required for API calls')
    urls = [
        'https://api-free.deepl.com/v2/translate',
        'https://api.deepl.com/v2/translate'
    ]
    for url in urls:
        try:
            resp = requests.post(url, data={'auth_key': api_key, 'text': text, 'target_lang': target_lang})
            if resp.status_code == 200:
                data = resp.json()
                return ' '.join(d['text'] for d in data.get('translations', []))
            # try next URL on error
        except Exception:
            continue
    raise RuntimeError('DeepL translation failed; check API key and network')


def translate_google(text: str, api_key: str, target='en') -> str:
    if requests is None:
        raise RuntimeError('requests library is required for API calls')
    url = 'https://translation.googleapis.com/language/translate/v2'
    params = {'key': api_key}
    data = {'q': text, 'target': target, 'format': 'text'}
    resp = requests.post(url, params=params, data=data)
    if resp.status_code != 200:
        raise RuntimeError(f'Google Translate API error: {resp.status_code} {resp.text}')
    obj = resp.json()
    translations = obj.get('data', {}).get('translations', [])
    return ' '.join(t.get('translatedText', '') for t in translations)


def main():
    p = ArgumentParser()
    p.add_argument('--provider', choices=['deepl', 'google'], help='Proveedor de traducción (env override)')
    p.add_argument('--key', help='Clave API (no recomendado en CLI; preferir variable de entorno)')
    p.add_argument('--dry-run', action='store_true', help='No modifica archivos, solo muestra propuestas')
    p.add_argument('--wait', type=float, default=0.5, help='Segundos de espera entre llamadas (rate-limit)')
    args = p.parse_args()

    provider = (args.provider or os.getenv('TRANSLATE_PROVIDER') or 'deepl').lower()
    api_key = args.key or os.getenv('TRANSLATE_API_KEY')

    if provider not in ('deepl', 'google'):
        print('Proveedor no soportado:', provider)
        sys.exit(1)

    print(f'Leyendo {LANG_JS} ...')
    with open(LANG_JS, 'r', encoding='utf-8') as f:
        text = f.read()

    entries = extract_entries(text)
    print(f'Entradas totales detectadas: {len(entries)}')

    to_translate = {k: v['es'] for k, v in entries.items() if not v['en'].strip()}
    if not to_translate:
        print('No hay entradas con `en` vacío. Nada que traducir.')
        return

    print(f'Entradas a traducir (en vacías): {len(to_translate)}')

    # If no API key provided, act as dry-run
    if not api_key:
        print('\nNo se proporcionó clave API. Modo dry-run: mostrar propuestas.\n')
        for i, (k, es_text) in enumerate(to_translate.items(), 1):
            print(f'{i}. {k}: "{es_text}"')
        print('\nPara traducir realmente, exporta TRANSLATE_PROVIDER y TRANSLATE_API_KEY y vuelve a ejecutar con --dry-run opcional.\n')
        return

    if requests is None:
        print('La librería `requests` no está instalada. Ejecuta: pip install requests')
        sys.exit(1)

    translations = {}
    for i, (k, es_text) in enumerate(to_translate.items(), 1):
        print(f'[{i}/{len(to_translate)}] Traduciendo {k}...')
        try:
            if provider == 'deepl':
                tr = translate_deepl(es_text, api_key, target_lang='EN')
            else:
                tr = translate_google(es_text, api_key, target='en')
        except Exception as e:
            print(f'  ERROR traductor para {k}: {e}')
            tr = ''
        translations[k] = tr
        time.sleep(args.wait)

    # Apply translations to file content
    new_text = text
    for k, tr in translations.items():
        if not tr:
            continue
        esc = js_escape(tr)
        # Try to replace in const dict literal
        pattern_literal = re.compile(r"('" + re.escape(k) + r"'\s*:\s*\{\s*es\s*:\s*'(?P<es>(?:\\'|[^'])*)'\s*,\s*en\s*:\s*')(?P<en>(?:\\'|[^'])*)('\s*\}\s*,?)", re.S)
        new_text, n1 = pattern_literal.subn(lambda m: m.group(1) + esc + m.group(4), new_text)
        # Try to replace assignment form
        pattern_assign = re.compile(r"(dict\[\s*['\"]" + re.escape(k) + r"['\"]\s*\]\s*=\s*\{\s*es\s*:\s*'(?P<es>(?:\\'|[^'])*)'\s*,\s*en\s*:\s*')(?P<en>(?:\\'|[^'])*)('\s*\}\s*;?)", re.S)
        new_text, n2 = pattern_assign.subn(lambda m: m.group(1) + esc + m.group(4), new_text)
        if (n1 + n2) == 0:
            print(f'  WARNING: No se encontró patrón para la clave {k} - no se actualizó automáticamente')

    # Backup and write
    backup = LANG_JS + '.bak'
    print(f'Creando copia de seguridad: {backup}')
    with open(backup, 'w', encoding='utf-8') as f:
        f.write(text)

    if args.dry_run:
        print('Dry-run solicitado: no se escribirán cambios en el archivo original.')
        return

    with open(LANG_JS, 'w', encoding='utf-8') as f:
        f.write(new_text)

    print('Traducciones aplicadas y archivo actualizado.')


if __name__ == '__main__':
    main()
