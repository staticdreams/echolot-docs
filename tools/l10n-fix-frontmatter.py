#!/usr/bin/env python3
"""Makes the front matter of translated pages valid YAML: title and description on one line each, in double quotes.
Usage: python3 tools/l10n-fix-frontmatter.py <code>…   (default: every language)"""
import glob, re, sys, json

codes = sys.argv[1:] or ['de', 'es', 'fr', 'ja', 'ko', 'ru', 'zh']
changed = 0
for code in codes:
    for path in glob.glob(f'content/docs/**/*.{code}.mdx', recursive=True):
        text = open(path, encoding='utf8').read()
        m = re.match(r'^---\n(.*?)\n---\n(.*)$', text, re.S)
        if not m:
            continue
        front, body = m.groups()
        entries = {}
        key = None
        for line in front.split('\n'):
            k = re.match(r'^(\w+):[ \t]*(.*)$', line)
            if k:
                key = k.group(1)
                entries[key] = k.group(2)
            elif key:
                entries[key] += ' ' + line.strip()
        out = []
        for key, value in entries.items():
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
                value = value[1:-1]
            if value.startswith('"') and not value.endswith('"'):
                value = value[1:]
            value = value.replace('\\"', '"')
            out.append(f'{key}: {json.dumps(value, ensure_ascii=False)}')
        new = '---\n' + '\n'.join(out) + '\n---\n' + body
        if new != text:
            open(path, 'w', encoding='utf8').write(new)
            changed += 1
print(f'{changed} pages changed')
