# -*- coding: utf-8 -*-
"""把学习通「安农新生攻略」专题节点正文搬进站内待补充页面。"""
import re, os, sys, json, html, urllib.request

BASE = r'C:\Users\Orange\AppData\Local\Temp'
DOCS = r'E:\AHAU-Study-Hub\docs'

# kid -> (站内页面相对 DOCS 的目录, 页内小节标题)
TARGETS = {
    # 03-学业专栏
    '998070438': ('03-学业专栏/01-园艺学院本科人才培养方案', '园艺学院本科人才培养方案'),
    '998070439': ('03-学业专栏/02-本科生辅修文件', '本科生辅修文件'),
    '998070440': ('03-学业专栏/03-转专业', '转专业'),
    '998070441': ('03-学业专栏/04-课程查询', '课程查询'),
    '998070442': ('03-学业专栏/05-课程表详细导入方法', '课程表详细导入方法'),
    '998070443': ('03-学业专栏/06-大一如何学习', '大一如何学习'),
    '998070444': ('03-学业专栏/07-教学日历时间表及日常作息', '教学日历、时间表及日常作息'),
    '998070445': ('03-学业专栏/08-抢选课', '抢选课（体育、选修、退改）'),
    '998070446': ('03-学业专栏/09-体育课体测及步道乐跑', '体育课、体测及步道乐跑'),
    '998070447': ('03-学业专栏/10-外语类课程免修', '外语类课程免修'),
    '998070448': ('03-学业专栏/11-选修通识课', '选修通识课'),
    '998070449': ('03-学业专栏/12-实验培训', '实验培训'),
    '998070450': ('03-学业专栏/13-班委介绍', '班委介绍'),
    '998070451': ('03-学业专栏/14-心理学时', '心理学时'),
    '998070452': ('03-学业专栏/15-学分绩点与平均绩点', '学分、绩点、学分绩点以及平均绩点'),
    '998070453': ('03-学业专栏/16-PU及第二课堂活动', 'PU 及第二课堂活动'),
    '998070454': ('03-学业专栏/17-综测', '综测'),
    '998070455': ('03-学业专栏/18-学科和技能竞赛目录', '大学生学科和技能竞赛目录'),
    '998070456': ('03-学业专栏/19-入团', '入团'),
    '998070457': ('03-学业专栏/20-入党', '入党'),
    '998070458': ('03-学业专栏/21-推免保研政策', '保研'),
    '998070459': ('03-学业专栏/23-考研', '考研'),
    '998070460': ('03-学业专栏/22-山东农业大学交换生', '大二与山东农业大学交换生'),
    # 04-生活专栏
    '998070419': ('04-生活专栏/01-智慧安农是什么', '智慧安农是什么'),
    '998070420': ('04-生活专栏/02-智慧安农APP', '智慧安农APP'),
    '998070421': ('04-生活专栏/03-新生军训', '新生军训'),
    '998070410': ('04-生活专栏/04-寝室相关问题', '寝室相关问题'),
    '998070423': ('04-生活专栏/04-寝室相关问题', '寝室情况简介'),
    '998070424': ('04-生活专栏/06-浴室及卫生间', '浴室及卫生间'),
    '998070425': ('04-生活专栏/07-学生证与乘车优惠资质办理', '学生证及学生乘车优惠资质办理'),
    '998070426': ('04-生活专栏/09-校园流量卡', '校园流量卡'),
    '998070427': ('04-生活专栏/10-校园网', '校园网'),
    '998070428': ('04-生活专栏/11-学校VPN说明', '学校VPN说明'),
    '998070429': ('04-生活专栏/12-迎新系统使用及网选宿舍步骤', '迎新系统使用及网选宿舍步骤'),
    '998070430': ('04-生活专栏/14-大学必备软件', '大学必备软件'),
    '998070431': ('04-生活专栏/15-校园一卡通', '校园一卡通'),
    '998070432': ('04-生活专栏/16-校园分布', '校园分布'),
    '998070433': ('04-生活专栏/17-食堂', '食堂'),
    '998070434': ('04-生活专栏/18-出行', '出行'),
    '998070435': ('04-生活专栏/19-快递篇', '快递篇'),
    '998070436': ('04-生活专栏/20-外卖及小吃街', '外卖及小吃街'),
    '998070437': ('04-生活专栏/21-部门社团', '部门社团'),
}

NODE_URL = 'https://mooc1.chaoxing.com/mooc-ans/ztnodedetailcontroller/visitnodedetail?courseId=253549820&knowledgeId={kid}'


def extract_cc(h):
    m = re.search(r'<div class="ans-cc"[^>]*>', h)
    if not m:
        return ''
    i = m.end()
    depth, j = 1, i
    while depth > 0:
        mm = re.search(r'<div\b|</div>', h[j:])
        if not mm:
            break
        j2 = j + mm.end()
        if mm.group(0) == '</div>':
            depth -= 1
            if depth == 0:
                return h[i:j + mm.start()]
        depth += 1
        j = j2
    return ''


def dl_image(url, dest_dir, name):
    os.makedirs(dest_dir, exist_ok=True)
    path = os.path.join(dest_dir, name)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as r, open(path, 'wb') as f:
            f.write(r.read())


def inline(s):
    s = re.sub(r'<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)</a>',
               lambda m: '[%s](%s)' % (re.sub(r'<[^>]+>', '', m.group(2)).strip(), m.group(1)), s, flags=re.I)
    s = re.sub(r'</?(?:strong|b)\b[^>]*>', '**', s, flags=re.I)
    s = re.sub(r'</?(?:em|i)\b[^>]*>', '*', s, flags=re.I)
    s = re.sub(r'<br\s*/?>', '\n', s, flags=re.I)
    s = re.sub(r'<(?!/?(?:p|table|tr|td|th|li)\b)[a-z][^>]*>', '', s, flags=re.I)
    s = re.sub(r'</(?!p>|table>|tr>|td>|th>|li>)[a-z][^>]*>', '', s, flags=re.I)
    s = re.sub(r'[ \t\r]+', ' ', s)
    return html.unescape(s).strip()


def convert(cc, img_dir, kid):
    atts, tables, imgs = [], [], 0
    cc = html.unescape(cc)

    for m in re.finditer(r'<iframe[^>]*data="(\{.*?\})"', cc, re.S):
        try:
            data = json.loads(m.group(1))
            atts.append((data.get('name', '附件'), data.get('hsize', '')))
        except Exception:
            pass
    cc = re.sub(r'<iframe[^>]*>\s*(?:<br\s*/?>)?\s*', '', cc, flags=re.I)

    def img_repl(m):
        nonlocal imgs
        src = m.group(1)
        title = (m.group(2) or '').strip()
        ext = os.path.splitext(src.split('?')[0])[1] or '.jpg'
        imgs += 1
        name = f'{kid}_{imgs:02d}{ext}'
        try:
            dl_image(src, img_dir, name)
            alt = title if title and not re.match(r'^(IMG_|mmqrcode|WeChat|微信|\d{8})', title) else '插图'
            return f'\n\n![{alt}](./images/{name})\n\n'
        except Exception as e:
            print('  图片下载失败', src, e)
            return f'\n\n![{title or "插图"}]({src})\n\n'

    cc = re.sub(r'<img[^>]*?src="(http[^"]+)"[^>]*?(?:title="([^"]*)")?[^>]*/?>', img_repl, cc)

    def tab_repl(m):
        tables.append(m.group(0))
        return f'\n\n@@TABLE{len(tables)-1}@@\n\n'
    cc = re.sub(r'<table[\s\S]*?</table>', tab_repl, cc, flags=re.I)

    cc = re.sub(r'<li[^>]*>', '\n- ', cc, flags=re.I)
    cc = re.sub(r'</(ul|ol)>', '\n', cc, flags=re.I)

    out = []
    for b in re.split(r'</p\s*>|</h\d\s*>|</blockquote\s*>', cc, flags=re.I):
        b = re.sub(r'^\s*<(p|h\d|blockquote)[^>]*>', '', b, flags=re.I)
        t = inline(b)
        lines = [l.strip() for l in t.split('\n') if l.strip()]
        if lines:
            out.append('\n'.join(lines))
    md = '\n\n'.join(out)
    for i, tb in enumerate(tables):
        md = md.replace(f'@@TABLE{i}@@', '\n' + tb + '\n')
    md = re.sub(r'\n{3,}', '\n\n', md).strip()

    if atts:
        lines = ['\n## 相关文件', '', '> 以下文件挂在学习通上，需登录后到专题页下载，后续会逐步镜像进本仓库。', '']
        for name, hsize in atts:
            lines.append(f'- [{name}]({NODE_URL.format(kid=kid)})（{hsize}）')
        md += '\n' + '\n'.join(lines)
    return md, atts, imgs


def main():
    nodes = json.load(open(os.path.join(BASE, 'p1_nodes.json'), encoding='utf-8'))
    by_kid = {n[2]: (n[0], n[1]) for n in nodes}
    done_pages = {}
    for kid, (rel, sec_title) in TARGETS.items():
        grp, _ = by_kid.get(kid, ('', ''))
        page = os.path.join(DOCS, rel, 'index.md')
        node_url = NODE_URL.format(kid=kid)
        h = open(os.path.join(BASE, 'p1', kid + '.html'), encoding='utf-8', errors='ignore').read()
        cc = extract_cc(h)
        if not cc.strip():
            print('跳过（无正文）', rel, kid)
            continue
        md, atts, imgs = convert(cc, os.path.join(DOCS, rel, 'images'), kid)
        src = ('\n\n::: tip 原始出处\n'
               f'本节整理自学习通专题「安农新生攻略」节点 [{sec_title}]({node_url})（{grp}）。\n'
               ':::')
        block = f'### {sec_title}\n\n{md}{src}'

        if not os.path.exists(page):
            os.makedirs(os.path.join(DOCS, rel), exist_ok=True)
            open(page, 'w', encoding='utf-8', newline='\n').write(
                f'# {sec_title}\n\n> **所属模块**：学业专栏\n\n{block}\n')
            print('新建', rel, f'图片{imgs} 附件{len(atts)}')
            continue

        text = open(page, encoding='utf-8').read()
        warn_re = re.compile(r'::: warning 待补充[\s\S]*?:::')
        if warn_re.search(text):
            new = warn_re.sub(lambda m: block, text, count=1)
        elif rel in done_pages:
            # 第二个节点并入同一页：追加在末尾
            new = text.rstrip() + '\n\n' + block + '\n'
        else:
            print('警告：未找到占位块', rel, kid)
            continue
        open(page, 'w', encoding='utf-8', newline='\n').write(new)
        done_pages[rel] = kid
        print('填充', rel, kid, f'图片{imgs} 附件{len(atts)}')

main()
