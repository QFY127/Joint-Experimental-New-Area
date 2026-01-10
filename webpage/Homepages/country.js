// 当页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 获取所有字母导航链接
    const navLinks = document.querySelectorAll('.directory a');
    // 获取所有国家区域
    const sections = document.querySelectorAll('.country-section');
    
    // 为每个导航链接添加点击事件
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // 移除所有链接的active类
            navLinks.forEach(l => l.classList.remove('active'));
            // 给当前点击的链接添加active类
            this.classList.add('active');
            
            // 平滑滚动到对应区域（浏览器原生支持）
            // 不需要额外代码，因为链接使用了锚点
        });
    });
    
    // 监听页面滚动，更新当前激活的导航项
    window.addEventListener('scroll', function() {
        let current = '';
        
        // 检查哪个区域在视口中
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            // 如果滚动位置超过区域顶部减去200px，则认为该区域是当前活跃的
            if (pageYOffset >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });
        
        // 更新导航链接的激活状态
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
    
    // 初始化 - 设置默认激活的导航项
    navLinks[0].classList.add('active');
});
