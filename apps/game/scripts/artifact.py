# The built page (dist/index.html) as the Artifact tool publishes it: no document skeleton of its own (the
# tool adds one with charset and viewport), the <title> first.   python3 scripts/artifact.py <out.html>
import pathlib, re, sys

s = (pathlib.Path(__file__).resolve().parents[1] / 'dist' / 'index.html').read_text(encoding='utf-8')
head = s[s.find('<head>') + 6:s.find('</head>')]
body = s[s.find('<body>') + 6:s.rfind('</body>')]
head = re.sub(r'<meta charset="utf-8">\s*', '', head)
head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head)
title = re.search(r'<title>.*?</title>', head).group(0)
head = head.replace(title, '')
pathlib.Path(sys.argv[1]).write_text(title + '\n' + head.strip() + '\n' + body.strip() + '\n', encoding='utf-8')
