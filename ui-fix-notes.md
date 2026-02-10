# UI Fix Notes

## 截图观察 (2026-02-11)
- 底部导航栏文字被截断（"策略"、"动态"、"合购"、"订阅"文字底部被遮挡）
- 页面正在加载中（loading spinner显示正常）
- 底部导航栏的emoji图标可见，但文字被遮挡

## 需要修复的问题
1. **body overflow:hidden** - web-build/index.html中的overflow:hidden阻止页面滚动
2. **底部导航栏padding** - bottomPadding在web端只有12px，对于手机浏览器不够
3. **搜索页面居中** - 搜索结果和空状态需要居中
4. **空状态提示** - 首页等列表页面空状态需要更友好的提示
5. **动画效果** - 添加入场、点击反馈、过渡动画
