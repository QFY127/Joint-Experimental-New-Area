"""Produce editable, page-classified PNG backdrop plates from the site's assets.

Photo exports preserve RGB pixels. Original images remain untouched; replace any
file in image/backgrounds/<page>/ to customize that backdrop independently.
"""
from pathlib import Path
from shutil import copyfile
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'image'
DEST = SRC / 'backgrounds'
PAGES = {
    'index': ('bg1.jpg', 'bg2.jpg', 'bg3.jpg'),
    'zy': tuple(f'jing/shou{i}.jpg' for i in range(1, 6)),
    'gy': ('jing/cundang.png', 'yx/3.jpg', 'jing/zhucheng.jpg', 'jing/dtld.jpg', 'yx/8.png', 'bg2.jpg', 'jing/gongye.jpg', 'bg3.jpg'),
    'fq': ('jing/dtld.jpg', 'jing/caikuang.jpg', 'jing/linwosen.jpg', 'yx/6.png'),
    'bm': ('jing/haigang.jpg',),
    'da': ('jing/cundang.png',),
    'yx': ('jing/shou1.jpg', 'jing/shou2.jpg', 'jing/shou3.jpg'),
    'xw': ('jing/shou2.jpg',),
    'xz': ('jing/zhucheng.jpg',),
}
NAMES = {
    'index': ('slide-01', 'slide-02', 'slide-03'),
    'zy': ('slide-01', 'slide-02', 'slide-03', 'slide-04', 'slide-05'),
    'gy': ('hero', 'co-build', 'innovation', 'planning', 'infrastructure', 'ecology', 'water', 'vision'),
    'fq': ('dongtai', 'mining', 'linwosen', 'outpost'),
    'bm': ('hero',), 'da': ('hero',), 'yx': ('slide-01', 'slide-02', 'slide-03'), 'xw': ('hero',), 'xz': ('hero',),
}
ACCENTS = {
    'index': (18, 85, 151), 'zy': (13, 95, 171), 'gy': (9, 95, 156),
    'fq': (16, 96, 159), 'bm': (20, 103, 174), 'da': (14, 71, 134),
    'yx': (15, 97, 158), 'xw': (15, 85, 153), 'xz': (23, 109, 170), 'sm': (37, 105, 160)
}
for page, sources in PAGES.items():
    folder = DEST / page
    folder.mkdir(parents=True, exist_ok=True)
    for filename, name in zip(sources, NAMES[page]):
        original = SRC / filename
        target = folder / f'{name}.png'
        staged = folder / f'{name}.staged.png'
        # A few large source exports have occasionally been truncated during
        # PNG encoding. Never replace the working plate until it verifies.
        for compression in (6, 6, 0):
            try:
                with Image.open(original) as im:
                    im.convert('RGB').save(staged, 'PNG', compress_level=compression)
                with Image.open(staged) as exported:
                    exported.verify()
                staged.replace(target)
                break
            except Exception:
                staged.unlink(missing_ok=True)
        else:
            raise RuntimeError(f'Could not write a valid PNG background: {target}')
    print(page, ', '.join(NAMES[page]))

for page, accent in ACCENTS.items():
    folder = DEST / page
    folder.mkdir(parents=True, exist_ok=True)
    # This plate is an independent overlay, not baked into the source photograph.
    w, h = 1600, 820
    overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ink = ImageDraw.Draw(overlay, 'RGBA')
    dark = tuple(max(0, round(c * .28)) for c in accent)
    for y in range(h):
        bottom = max(0, (y / h - .42) / .58)
        for a, b in ((0, 1120), (1120, 1600)):
            horizontal = 1 - a / w
            alpha = round(168 * horizontal + 80 * bottom)
            if a == 1120: alpha = round(46 + 80 * bottom)
            ink.rectangle((a, y, b, y), fill=(*dark, min(220, alpha)))
    for x in range(0, w, 80):
        ink.line((x, 0, x, h), fill=(158, 216, 255, 15), width=1)
    for y in range(0, h, 80):
        ink.line((0, y, w, y), fill=(158, 216, 255, 13), width=1)
    ink.rectangle((56, 54, 1544, 766), outline=(211, 238, 255, 45), width=2)
    ink.line((56, 54, 210, 54), fill=(180, 226, 255, 115), width=3)
    ink.line((56, 54, 56, 220), fill=(180, 226, 255, 115), width=3)
    if page != 'index':
        overlay.save(folder / 'hero-overlay.png', optimize=True)
    else:
        (folder / 'hero-overlay.png').unlink(missing_ok=True)
    # Gentle blue/white section plate for long-form content and page margins.
    surface = Image.new('RGB', (1600, 960), (248, 251, 255))
    draw = ImageDraw.Draw(surface)
    for y in range(960):
        t = y / 959
        color = (round(245 + 8*t), round(250 + 4*t), 255)
        draw.line((0, y, 1599, y), fill=color)
    for x in range(0, 1600, 80):
        draw.line((x, 0, x, 959), fill=(235, 243, 251))
    for y in range(0, 960, 80):
        draw.line((0, y, 1599, y), fill=(235, 243, 251))
    draw.ellipse((1090, -480, 1970, 400), outline=(*accent,), width=2)
    draw.ellipse((1140, -430, 1920, 350), outline=(214, 232, 246), width=2)
    draw.line((60, 108, 254, 108), fill=accent, width=4)
    surface.save(folder / 'section.png', optimize=True)

# Existing department artwork remains exactly editable, now grouped with home plates.
for original in (SRC / 'department-backgrounds').glob('*.png'):
    copyfile(original, DEST / 'zy' / original.name)
# Remove interrupted prior exports; they must never be included in the site.
for staged in DEST.rglob('*.staged.png'):
    staged.unlink()
# All page photo backgrounds above are distinct PNG files in their own folders.
manifest = '''背景版 PNG 使用说明\n\n每个页面一个同名目录：index 入口、zy 首页、gy 关于、fq 分区、bm 部门、da 档案、yx 影像、xw 新闻、xz 下载、sm 声明。\n\nhero-overlay.png 是各内页独立透明叠层（1600×820）：可改色、删网格，或换自己的透明 PNG。\nindex 入口不生成、不加载格纹前置图；zy/hero-overlay.png 是保留的备用素材，主页轮播当前也不显示此叠层。\nsection.png 是浅蓝网格内容底板（1600×960）：可换图，文字由 HTML 绘制，不烘焙在图片中。\nhero.png、slide-xx.png、主题名.png 是从原网站实景无损转为 PNG 的影像底板，名字对应模块；每张图可独立替换。\nzy/overview.png、planning.png 等为原首页部门背景版的分类副本。\n所有页面仍保留原始 JPG/PNG 内容图片，不修改旧素材；替换分类目录内同名 PNG 即能修改对应的背景。\n本目录的 HTML 和 CSS 用相对路径引用，网站静态部署和本地离线打开均可找到。\n'''
(DEST / 'README.txt').write_text(manifest, encoding='utf-8')

shared = DEST / 'shared'
shared.mkdir(parents=True, exist_ok=True)
card = Image.new('RGB', (900, 540), '#ffffff')
draw = ImageDraw.Draw(card)
for x in range(0, 900, 60):draw.line((x, 0, x, 539), fill=(244, 249, 253))
for y in range(0, 540, 60):draw.line((0, y, 899, y), fill=(244, 249, 253))
draw.line((740, 0, 900, 160), fill=(223, 238, 249), width=2)
draw.line((782, 0, 900, 118), fill=(236, 246, 253), width=3)
draw.line((0, 0, 142, 0), fill=(41, 132, 192), width=3)
card.save(shared / 'card.png', optimize=True)
caption = Image.new('RGBA', (900, 400), (0, 0, 0, 0))
draw = ImageDraw.Draw(caption)
for y in range(400):
    t = y / 399
    draw.line((0, y, 899, y), fill=(0, 30, 60, round(225 * (t ** 1.8))))
caption.save(shared / 'caption.png', optimize=True)
grid = Image.new('RGBA',(640,640),(0,0,0,0));draw=ImageDraw.Draw(grid)
for p in range(0,640,80):
    draw.line((p,0,p,639),fill=(190,231,255,31))
    draw.line((0,p,639,p),fill=(190,231,255,31))
grid.save(shared / 'grid.png', optimize=True)
(DEST / 'README.txt').write_text((DEST / 'README.txt').read_text(encoding='utf-8') + 'shared/card.png：浅蓝卡片底板；shared/caption.png：照片底部标题遮罩；shared/grid.png：透明网格纹理。\n', encoding='utf-8')
