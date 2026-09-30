"""Bundle src/ into one self-contained HTML file.

src/shell.html must contain the markers  /*__CSS__*/  (inside a <style>) and  //__JS__  (inside a classic <script>).
All src/*.css are concatenated in name order; all src/NN-*.js are concatenated in name order.
Usage:  python tools/build.py  [out.html]  [--estrutura private/estrutura.json]

--estrutura embute os dados do projeto estrutural (window.DD_STRUCT). Use só em builds privados: a prancha
proíbe disponibilizar o projeto a terceiros, então o index.html público é gerado sem essa opção.
"""
import json, pathlib, sys, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
args = sys.argv[1:]
struct_path = None
if '--estrutura' in args:
    i = args.index('--estrutura')
    if i + 1 >= len(args):
        sys.exit('ERROR: --estrutura precisa do caminho do arquivo .json')
    struct_path = pathlib.Path(args[i + 1])
    del args[i:i + 2]
out = pathlib.Path(args[0]) if args else ROOT / 'casa-decoracao.html'

shell = (SRC / 'shell.html').read_text(encoding='utf-8')
css = '\n'.join(f'/* ---- {p.name} ---- */\n' + p.read_text(encoding='utf-8') for p in sorted(SRC.glob('*.css')))
js_files = sorted(p for p in SRC.glob('*.js') if re.match(r'^\d\d-', p.name))
js = '\n'.join(f'// ---- {p.name} ----\n' + p.read_text(encoding='utf-8') for p in js_files)
if struct_path:
    data = json.loads(struct_path.read_text(encoding='utf-8'))
    js = '// ---- dados do projeto estrutural (build privado) ----\nwindow.DD_STRUCT = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n' + js
if '</script' in js.lower():
    sys.exit('ERROR: a JS module contains "</script" — split the string (e.g. "<\\/script>").')
if '/*__CSS__*/' not in shell or '//__JS__' not in shell:
    sys.exit('ERROR: shell.html is missing /*__CSS__*/ or //__JS__ markers')
html = shell.replace('/*__CSS__*/', css).replace('//__JS__', js)
out.write_text(html, encoding='utf-8')
print(f'built {out.name}: {len(html)//1024} KB from {len(js_files)} js modules + {len(list(SRC.glob("*.css")))} css' + (' + estrutura' if struct_path else ''))
