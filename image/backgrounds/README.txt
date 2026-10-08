背景版 PNG 使用说明

每个页面一个同名目录：index 入口、zy 首页、gy 关于、fq 分区、bm 部门、da 档案、yx 影像、xw 新闻、xz 下载、sm 声明。

hero-overlay.png 是各内页独立透明叠层（1600×820）：可改色、删网格，或换自己的透明 PNG。
index 入口不生成、不加载格纹前置图；zy/hero-overlay.png 是保留的备用素材，主页轮播当前也不显示此叠层。
section.png 是浅蓝网格内容底板（1600×960）：可换图，文字由 HTML 绘制，不烘焙在图片中。
hero.png、slide-xx.png、主题名.png 是从原网站实景无损转为 PNG 的影像底板，名字对应模块；每张图可独立替换。
zy/overview.png、planning.png 等为原首页部门背景版的分类副本。
所有页面仍保留原始 JPG/PNG 内容图片，不修改旧素材；替换分类目录内同名 PNG 即能修改对应的背景。
本目录的 HTML 和 CSS 用相对路径引用，网站静态部署和本地离线打开均可找到。
shared/card.png：浅蓝卡片底板；shared/caption.png：照片底部标题遮罩；shared/grid.png：透明网格纹理。
