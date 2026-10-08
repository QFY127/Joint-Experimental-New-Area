"""Rebuild the four editorial pages while preserving their data and interactions."""
from copy import deepcopy
from lxml import html, etree
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def parse(fragment): return html.fragment_fromstring(fragment)
def klass(node,c):
    return node.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," '+c+' ")]')
def save(name, main):
    file=ROOT/(name+'.html');source=file.read_text()
    start=source.index('<div id="page-content"')
    end=source.index('</div>\n<footer',start)+6
    source=source[:start]+html.tostring(main,encoding='unicode',method='html')+'\n'+source[end:]
    file.write_text(source)
    print('Rebuilt',name)

def breadcrumb(page):
    return parse('<nav class="editorial-breadcrumb" aria-label="当前位置"><a href="zy.html">首页</a><span aria-hidden="true">/</span><span aria-current="page">'+page+'</span></nav>')

def replace(node,replacement):
    node.getparent().replace(node,replacement)

def main_for(name):return html.parse(str(ROOT/(name+'.html'))).getroot().get_element_by_id('page-content')

def addbefore(parent,target,element):parent.insert(parent.index(target),element)

# Archive: all eight records, previews, description, pagination and modal remain.
m=main_for('da'); m.remove(m[0])
hero=parse('''<section class="editorial-hero da-hero" data-site-reveal aria-labelledby="da-hero-title"><img class="editorial-hero-photo" src="image/backgrounds/da/hero.png" width="1920" height="1051" alt="新区黄昏街区影像" fetchpriority="high" decoding="async"><div class="editorial-hero-shade" aria-hidden="true"></div><div class="editorial-hero-copy"><p class="editorial-eyebrow">THE ARCHIVE · 2020—2026</p><h1 id="da-hero-title">岁月有迹<br>规划成章</h1><p>从初代草案到今天的建设档案，沿着图纸与影像，读懂新区一步步生长的轨迹。</p><a href="#archiveListWrap">浏览档案 <span aria-hidden="true">↓</span></a></div><div class="editorial-hero-end" aria-hidden="true">08 FILES / ONE SHARED WORLD</div></section>''')
m.insert(0,hero);m.insert(1,breadcrumb('档案管理'))
container=klass(m,'container')[0];container.set('class','container da-layout')
left=klass(container,'left-column')[0];left.set('class','left-column da-timeline')
center=klass(container,'center-column')[0];center.set('class','center-column da-content')
right=klass(container,'right-column')[0];right.set('class','right-column da-links')
oldtitle=klass(center,'section-title')[0];oldtitle.getparent().replace(oldtitle,parse('''<div class="editorial-heading" data-site-reveal><div><p class="editorial-eyebrow">PLANS &amp; RECORDS</p><h2>规划方案档案</h2></div><span class="editorial-heading-count">08 <small>份收录</small></span></div>'''))
intro=klass(center,'page-desc')[0];intro.text='官方规划与建设记录依时间收录。点击卡片可查看完整档案；早期档案的原稿与新稿分别保留。'
fix={'D:\\JENA\\Joint-Experimental-New-Area\\image\\da\\20211012.jpg':'image/da/20241001.jpg','/image/da/20240411.jpg':'image/da/20240411.jpeg'}
for i,card in enumerate(klass(center,'archive-card'),1):
    img=klass(card,'archive-modal-source')[0].xpath('.//img')[0]
    image=fix.get(img.get('src'),img.get('src').lstrip('/'))
    img.set('src',image)
    preview=klass(card,'archive-img-box')[0]
    preview.append(parse(f'<img src="{image}" alt="档案 {i:02d} 封面预览" loading="lazy" decoding="async">'))
    card.insert(0,parse(f'<div class="archive-card-top"><span>ARCHIVE / {i:02d}</span><span>联合实验新区</span></div>'))
    original=klass(card,'open-modal-btn')[0];original.tag='button';original.set('type','button');original.attrib.pop('href',None);original.text='查看档案详情  ↗'
# Archive links are actionable and stay in the original project.
quick=klass(right,'quick-link-card')[0]
quick.getparent().replace(quick,parse('''<div class="quick-link-card"><p class="editorial-eyebrow">EXPLORE MORE</p><h2>继续探索</h2><a href="xz.html">下载新区存档 <span>↗</span></a><a href="fq.html">了解三大分区 <span>↗</span></a><a href="yx.html">浏览新区影像 <span>↗</span></a><a href="https://qm.qq.com/q/dQHwMfowp4">加入社区交流 <span>↗</span></a></div>'''))
save('da',m)

# Gallery: existing carousel, switch/anchors, five sights and six team stories.
m=main_for('yx');m.remove(m.xpath('./div[@class="breadcrumb"]')[0]);m.insert(1,breadcrumb('影像记录'))
container=klass(m,'container')[0];container.set('class','container yx-layout')
side=klass(container,'left-column')[0];side.set('class','left-column yx-index')
side.insert(0,side[-1]);side.remove(side[-1]) if len(side)>2 else None # Move switch before scene links.
center=klass(container,'center-column')[0];center.set('class','center-column yx-main')
intro=parse('''<section class="yx-intro" data-site-reveal><div><p class="editorial-eyebrow">IMAGE RECORDS</p><h1>把新区的故事<br>留在画面里</h1></div><p>从城市与田园的长镜头，到伙伴们共同建造的合影。沿着镜头，发现这座世界的风景与人。</p><div class="yx-count"><strong>05</strong><span>处影像地点</span><strong>06</strong><span>组建设合影</span></div></section>''')
container.addprevious(intro)
photo_map={'/image/jing/city3.jpg':'image/jing/dtld.jpg','/image/jing/mine1.jpg':'image/jing/caikuang.jpg','/image/jing/farm1.jpg':'image/jing/linwosen.jpg','/image/jing/island3.jpg':'image/yx/9.png','/image/jing/pano1.jpg':'image/jing/haigang.jpg'}
for img in m.xpath('.//img'):
    if img.get('src') in photo_map:img.set('src',photo_map[img.get('src')])
for i,src in enumerate(['slide-01','slide-02','slide-03']):
    klass(m,'carousel-slide')[i].xpath('.//img')[0].set('src',f'image/backgrounds/yx/{src}.png')
for i,c in enumerate(klass(m,'scene-image-card')):
    c.tag='a';c.set('href','#'+['city-scene','mine-scene','farm-scene','island-scene'][i]);c.set('aria-label','查看'+''.join(c.xpath('.//h4//text()')).strip())
for i,p in enumerate(klass(m,'photo-card'),1):
    p.insert(0,parse(f'<div class="yx-card-number" aria-hidden="true">{i:02d} / 05</div>'))
for i,t in enumerate(klass(m,'team-item'),1):
    # Earlier markup wrapped the second image twice. Use a single image box.
    boxes=klass(t,'team-img-box')
    if len(boxes)>1 and boxes[0].getparent() is t:
        image=boxes[0].xpath('.//img')[0]
        new=parse('<div class="team-img-box"></div>');new.append(deepcopy(image));t.replace(boxes[0],new)
    t.insert(0,parse(f'<span class="yx-card-number" aria-hidden="true">{i:02d} / 06</span>'))
for block in klass(m,'content-block'):
    heading=klass(block,'section-title')[0];heading.tag='header';heading.set('class','yx-block-heading')
    heading.insert(0,parse('<span class="editorial-eyebrow">SCENES &amp; PEOPLE</span>'))
    brief=block.xpath('./p')[0]
    brief.text=('四处特色景观与一幅全域航拍，记录新区的地貌与日常。' if block.get('id')=='scene-block' else '每一次同行都值得留存。从早期城区到周年纪念，翻看属于建造者的故事。')
save('yx',m)

# News: the eight original items and tag/page logic are preserved.
m=main_for('xw');m.remove(m[0])
hero=parse('''<section class="editorial-hero xw-hero" data-site-reveal aria-labelledby="xw-hero-title"><img class="editorial-hero-photo" src="image/backgrounds/xw/hero.png" width="1920" height="1051" alt="新区街道与樱花景色" fetchpriority="high" decoding="async"><div class="editorial-hero-shade" aria-hidden="true"></div><div class="editorial-hero-copy"><p class="editorial-eyebrow">NEWS &amp; ANNOUNCEMENTS</p><h1 id="xw-hero-title">新区正在发生</h1><p>建设进度、版本更新、共建活动。每一条消息，都是新区生长的注脚。</p><a href="#newsList">查看最新动态 <span aria-hidden="true">↓</span></a></div><div class="editorial-hero-end" aria-hidden="true">STORIES IN PROGRESS</div></section>''')
m.insert(0,hero);m.insert(1,breadcrumb('新闻公告'))
container=klass(m,'news-container')[0];container.set('class','container news-container xw-layout')
news=klass(container,'news-main')[0]
heading=klass(news,'section-title')[0];heading.getparent().replace(heading,parse('''<div class="editorial-heading" data-site-reveal><div><p class="editorial-eyebrow">WHAT'S NEW</p><h2>新闻公告</h2></div><span class="editorial-heading-count">08 <small>条动态</small></span></div>'''))
for f in klass(news,'filter-item'):
    f.tag='button';f.set('type','button')
article=klass(news,'news-article-list')[0];article.set('id','newsList')
for i,item in enumerate(klass(news,'news-item'),1):
    item.insert(0,parse(f'<span class="news-order" aria-hidden="true">{i:02d}</span>'))
    a=klass(item,'news-title')[0].xpath('.//a')[0]
    if a.get('href')=='#':
        dest={'version':'xz.html','build':'fq.html','notice':'bm.html','activity':'gy.html'}[item.get('data-tag')]
        a.set('href',dest)
    img=klass(item,'news-item-right')[0].xpath('.//img')[0];img.set('loading','lazy');img.set('src',img.get('src').lstrip('/'))
for button in klass(news,'page-btn'):
    button.tag='button';button.set('type','button')
right=klass(container,'right-column')[0];right.set('class','right-column xw-side')
right.clear()
right.append(parse('''<div class="quick-link-card"><p class="editorial-eyebrow">DISCOVER</p><h2>继续探索</h2><a href="yx.html">影像记录 <span>↗</span></a><a href="fq.html">分区介绍 <span>↗</span></a><a href="bm.html">部门职能 <span>↗</span></a><a href="xz.html">下载存档 <span>↗</span></a></div>'''))
right.append(parse('''<div class="hot-news-card"><p class="editorial-eyebrow">FEATURED</p><h2>近期焦点</h2><a href="https://mp.weixin.qq.com/s/-9mH7CDM9RsYxsHD1gErqw">新区启用新版区徽 <span>↗</span></a><a href="https://mp.weixin.qq.com/s/IBYDM90CWvOjMwsQJ_BaEQ">六周年纪念活动 <span>↗</span></a><a href="https://mp.weixin.qq.com/s/SY23Qih-r3ELO4JiHhJ8Cw">林沃森建设进程 <span>↗</span></a></div>'''))
save('xw',m)

# Departments: retain all five duty sections and the sticky directory/news.
m=main_for('bm');old=klass(m,'page-banner')[0]
replace(old,parse('''<section class="bm-hero" aria-labelledby="bm-hero-title" data-site-reveal><img class="bm-hero-photo" src="image/backgrounds/bm/hero.png" width="1920" height="1051" alt="新区建设与交通实景" fetchpriority="high" decoding="async"><div class="bm-hero-overlay" aria-hidden="true"></div><div class="bm-hero-copy"><p class="editorial-eyebrow">PEOPLE WHO BUILD THE AREA</p><h1 id="bm-hero-title">让每一份建设<br>各有担当</h1><p>从规划、施工到公共服务，认识维系新区日常运转的职能部门。</p><a href="#department-overview">了解部门职能 <span aria-hidden="true">↓</span></a></div><div class="bm-hero-stamp" aria-hidden="true">05 DEPARTMENTS · ONE NEW AREA</div></section>'''))
old=klass(m,'breadcrumb')[0];replace(old,breadcrumb('部门介绍'))
container=klass(m,'department-container')[0];container.set('class','container department-container bm-layout')
overview=klass(m,'department-overview')[0]
overview.insert(0,parse('<p class="editorial-eyebrow">HOW WE WORK TOGETHER</p>'))
for i,section in enumerate(klass(m,'department-section'),1):
    section.insert(0,parse(f'<span class="bm-section-number" aria-hidden="true">DEPARTMENT / {i:02d}</span>'))
save('bm',m)
