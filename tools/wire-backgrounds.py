"""Update large visual backdrops to individually editable page PNG files."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
maps={
 'index': {'image/bg1.jpg':'image/backgrounds/index/slide-01.png','image/bg2.jpg':'image/backgrounds/index/slide-02.png','image/bg3.jpg':'image/backgrounds/index/slide-03.png'},
 'zy': {**{'/image/jing/shou'+str(i)+'.jpg':'image/backgrounds/zy/slide-'+f'{i:02d}'+'.png' for i in range(1,6)}},
 'gy': dict(zip(['image/jing/cundang.png','image/yx/3.jpg','image/jing/zhucheng.jpg','image/jing/dtld.jpg','image/yx/8.png','image/bg2.jpg','image/jing/gongye.jpg','image/bg3.jpg'],['image/backgrounds/gy/'+n+'.png' for n in ['hero','co-build','innovation','planning','infrastructure','ecology','water','vision']])),
 'fq': {**dict(zip(['image/jing/dtld.jpg','image/jing/caikuang.jpg','image/jing/linwosen.jpg','image/yx/6.png'],['image/backgrounds/fq/'+n+'.png' for n in ['dongtai','mining','linwosen','outpost']]))}
}
for route, pairs in maps.items():
 p=root/(route+'.html');s=p.read_text()
 for old,new in pairs.items():s=s.replace('src="'+old+'"','src="'+new+'"')
 p.write_text(s)
# Page-specific classified artwork replaces the previous loose PNG folder.
p=root/'assets/pages/zy.css';s=p.read_text().replace("url('https://i.imgur.com/3x7qQ8Y.png')","url('../../image/backgrounds/zy/slide-01.png')")
s=s.replace("url('../../image/department-backgrounds/","url('../../image/backgrounds/zy/")
p.write_text(s)
