# Quotes front matter titles and descriptions that YAML would misread (a ": " inside, or a leading special character).
import pathlib, re, json
for path in pathlib.Path('content/docs').rglob('*.mdx'):
    text = path.read_text()
    if not text.startswith('---\n'): continue
    end = text.index('\n---', 4)
    head, body = text[4:end], text[end:]
    lines = []
    for line in head.split('\n'):
        m = re.match(r'^(title|description): (.*)$', line)
        if m and not m.group(2).startswith(('"', "'")) and (': ' in m.group(2) or m.group(2)[:1] in '{[&*!|>%@`#'):
            line = f'{m.group(1)}: {json.dumps(m.group(2), ensure_ascii=False)}'
            print('quoted', path, m.group(1))
        lines.append(line)
    path.write_text('---\n' + '\n'.join(lines) + body)
