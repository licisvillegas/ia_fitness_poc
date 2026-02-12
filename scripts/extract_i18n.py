#!/usr/bin/env python3
import os
import re
import html

TEMPLATES_DIR = r"c:\Users\licis\OneDrive\Documentos\ai_fitness\templates"
LANG_JS = r"c:\Users\licis\OneDrive\Documentos\ai_fitness\static\js\lang.js"

def slugify(text):
    s = text.strip()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "_", s)
    s = s.lower()
    s = s.strip('_')
    if not s:
        s = 'text'
    if len(s) > 60:
        s = s[:60]
    return s

def extract_texts_from_html(content):
    # remove scripts and styles
    content = re.sub(r"<script[\s\S]*?</script>", "", content, flags=re.IGNORECASE)
    content = re.sub(r"<style[\s\S]*?</style>", "", content, flags=re.IGNORECASE)
    # find text between tags
    parts = re.findall(r">([^<>]+)<", content)
    texts = []
    for p in parts:
        t = html.unescape(p).strip()
        if not t: continue
        # remove template markers
        if re.search(r"\{\{.*\}\}|\{%.*%\}", t): continue
        # skip punctuation-only
        if re.fullmatch(r"[\W_]+", t): continue
        # skip very short
        if len(t) <= 1: continue
        # normalize whitespace
        t = re.sub(r"\s+", " ", t)
        texts.append(t)
    return texts

def read_existing_keys(lang_js_path):
    if not os.path.exists(lang_js_path):
        return set()
    with open(lang_js_path, 'r', encoding='utf-8') as fh:
        src = fh.read()
    # capture both literal keys in the dict and assignment-style dict['key'] = ...
    keys = set(re.findall(r"['\"]([\w\-áéíóúñüÁÉÍÓÚÑÜ]+)['\"]\s*:\s*\{", src, flags=re.IGNORECASE | re.UNICODE))
    keys |= set(re.findall(r"dict\['([^']+)'\]", src))
    return keys

def append_entries_to_langjs(entries, lang_js_path):
    if not entries:
        print('No new entries to add.')
        return 0
    with open(lang_js_path, 'r', encoding='utf-8') as fh:
        src = fh.read()
    # Append assignment-style entries at the end of the file (idempotent)
    block = []
    for key, text in entries.items():
        esc = text.replace("\\", "\\\\").replace("'", "\\'").replace('\n', '\\n')
        block.append(f"dict['{key}'] = {{ es: '{esc}', en: '' }};")
    block_text = "\n" + "\n".join(block) + "\n"

    if src.endswith('\n'):
        new_src = src + block_text
    else:
        new_src = src + '\n' + block_text

    with open(lang_js_path, 'w', encoding='utf-8') as fh:
        fh.write(new_src)
    return len(entries)

def main():
    all_texts = []
    for root, dirs, files in os.walk(TEMPLATES_DIR):
        for f in files:
            if not f.endswith('.html'): continue
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fh:
                content = fh.read()
            texts = extract_texts_from_html(content)
            all_texts.extend(texts)

    # dedupe preserving order
    seen = set(); unique = []
    for t in all_texts:
        if t in seen: continue
        seen.add(t); unique.append(t)

    existing = read_existing_keys(LANG_JS)

    entries = {}
    used_keys = set(existing)
    for text in unique:
        key = slugify(text)
        base = key
        i = 1
        while key in used_keys:
            i += 1
            key = f"{base}_{i}"
        used_keys.add(key)
        # Do not add keys that are obviously already present in dict (by matching text)
        entries[key] = text

    # Filter out entries whose text already exists in lang.js values (naive check)
    # Read lang.js; if text present, skip
    with open(LANG_JS, 'r', encoding='utf-8') as fh:
        langsrc = fh.read()
    to_add = {}
    for k,v in entries.items():
        if v in langsrc:
            continue
        to_add[k] = v

    added = append_entries_to_langjs(to_add, LANG_JS)
    print(f"Scanned templates: {TEMPLATES_DIR}")
    print(f"Unique texts found: {len(unique)}")
    print(f"New entries to add: {len(to_add)}")

if __name__ == '__main__':
    main()
