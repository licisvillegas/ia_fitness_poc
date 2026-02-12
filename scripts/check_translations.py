import re, json, sys
p = r"c:\Users\licis\OneDrive\Documentos\ai_fitness\static\js\lang.js"
text = open(p, encoding='utf-8').read()
entries = {}
# literal block
m = re.search(r"const\s+dict\s*=\s*\{(.*?)\};", text, re.S)
if m:
    block = m.group(1)
    for mm in re.finditer(r"'(?P<key>[^']+)'\s*:\s*\{\s*es\s*:\s*'(?P<es>(?:\\'|[^'])*)'\s*,\s*en\s*:\s*'(?P<en>(?:\\'|[^'])*)'\s*\}\s*,?", block, re.S):
        k=mm.group('key')
        es=mm.group('es').replace("\\'","'")
        en=mm.group('en').replace("\\'","'")
        entries[k]={'es':es,'en':en}
# assignments
for mm in re.finditer(r"dict\['(?P<key>[^']+)'\]\s*=\s*\{\s*es\s*:\s*'(?P<es>(?:\\'|[^'])*)'\s*,\s*en\s*:\s*'(?P<en>(?:\\'|[^'])*)'\s*\}\s*;", text, re.S):
    k=mm.group('key')
    es=mm.group('es').replace("\\'","'")
    en=mm.group('en').replace("\\'","'")
    entries[k]={'es':es,'en':en}
need=[]
for k,v in entries.items():
    if not v['en'].strip() or v['es'].strip()==v['en'].strip():
        need.append({'key':k,'es':v['es'],'en':v['en']})
print(json.dumps({'count':len(need),'keys':need}, ensure_ascii=False, indent=2))
