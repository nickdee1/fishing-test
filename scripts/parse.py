import re, json, html, sys
d = sys.argv[1]
top = open(d+'/t.html', encoding='cp1250').read()
names = dict(re.findall(r'tema=(\d)"><span[^>]*>([^<]*)</span>', top))
out = []
for t in range(1, 6):
    s = open(f'{d}/tema{t}.html', encoding='utf-8').read()
    blocks = re.split(r'background=/img/obr/oddelovac\d\.gif', s)
    for b in blocks:
        m = re.search(r'<B>(\d+)\.</B></td>\s*<td[^>]*><B>(.*?)</B>', b, re.S)
        if not m: continue
        opts = re.findall(r"browserLink\('\d+_([abc])_(spravna|spatna)'\).*?<span id=\d+_[abc]>(.*?)</span>", b, re.S)
        img = re.search(r"<img src='([^']+)'", b)
        clean = lambda x: html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', x))).strip()
        q = {
            'id': f'{t}-{m.group(1)}', 'topic': t, 'n': int(m.group(1)),
            'q': clean(m.group(2)),
            'options': [clean(o[2]) for o in opts],
            'correct': [o[1] for o in opts].index('spravna') if any(o[1]=='spravna' for o in opts) else -1,
        }
        if img: q['img'] = img.group(1)
        out.append(q)
topics = [{'id': i, 'name': names.get(str(i), '').strip().rstrip('.')} for i in range(1, 6)]
bad = [q['id'] for q in out if len(q['options']) != 3 or q['correct'] < 0]
print(len(out), 'questions; bad:', bad, file=sys.stderr)
for t in topics: print(t, sum(q['topic']==t['id'] for q in out), file=sys.stderr)
print(sum('img' in q for q in out), 'with images', file=sys.stderr)
json.dump({'topics': topics, 'questions': out}, open(sys.argv[2], 'w'), ensure_ascii=False, indent=1)
