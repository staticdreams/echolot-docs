# Checks that every /docs link in the pages, and every path the app's Help menu opens, exists in the built site (out/).
import pathlib, re, sys
out = pathlib.Path(".output/public")
def exists(path):
    path = path.split('#')[0].split('?')[0].rstrip('/')
    return (out / (path.lstrip('/') + '.html')).exists() or (out / path.lstrip('/') / 'index.html').exists()
missing = {}
for page in pathlib.Path('content/docs').rglob('*.mdx'):
    for link in re.findall(r'\]\((/docs[^)\s]*)\)|href="(/docs[^"]*)"', page.read_text()):
        link = link[0] or link[1]
        if not exists(link): missing.setdefault(link, []).append(str(page))
help_menu = ['/docs', '/docs/requests', '/docs/workspaces/environments', '/docs/requests/scripts-and-tests', '/docs/requests/runner',
             '/docs/workspaces/history', '/docs/mcp-servers', '/docs/specs', '/docs/mocks', '/docs/flows']
for link in help_menu:
    if not exists(link): missing.setdefault(link, []).append('Help menu')
for link, pages in sorted(missing.items()): print(f'{link}  <- {", ".join(sorted(set(pages)))}')
print(f'{len(missing)} missing') ; sys.exit(1 if missing else 0)
