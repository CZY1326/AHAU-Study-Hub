# -*- coding: utf-8 -*-
"""补下 403 的图片：带 Referer 走 https 重定向，替换页面里的热链。"""
import re, os, subprocess, glob

DOCS = r'E:\AHAU-Study-Hub\docs'

pages = glob.glob(os.path.join(DOCS, '03-学业专栏', '*', 'index.md')) + \
        glob.glob(os.path.join(DOCS, '04-生活专栏', '*', 'index.md'))

def dl(url, dest):
    r = subprocess.run(['curl', '-sL', '-o', dest, '--max-time', '60', '-w', '%{http_code}',
                        '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
                        '-e', 'https://mooc1.chaoxing.com/', url], capture_output=True, text=True, cwd=os.path.dirname(dest) or '.')
    return r.stdout.strip()

total_ok = total_fail = 0
for page in pages:
    text = open(page, encoding='utf-8').read()
    urls = re.findall(r'\]\((http://p\.ananas\.chaoxing\.com/[^)]+)\)', text)
    if not urls:
        continue
    img_dir = os.path.join(os.path.dirname(page), 'images')
    os.makedirs(img_dir, exist_ok=True)
    for url in urls:
        name = url.rsplit('/', 1)[-1].split('?')[0]
        dest = os.path.join(img_dir, name)
        code = dl(url, name if False else dest)
        # curl 的 -o 需要相对/绝对路径; 上面用绝对路径
        if code == '200' and os.path.exists(dest) and os.path.getsize(dest) > 500:
            text = text.replace(f']({url})', f'](./images/{name})')
            total_ok += 1
        else:
            total_fail += 1
            print('失败', code, url)
    open(page, 'w', encoding='utf-8', newline='\n').write(text)

print('成功', total_ok, '失败', total_fail)
