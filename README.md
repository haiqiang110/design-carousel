# 购后设计决策方式 - 3D 流程轮播

基于 [3D Infinite Carousel with Reactive Background Gradients](https://github.com/clementgrellier/gradientslider) (MIT License) 修改，用于高级设计师晋升汇报。

## 一、保留的原项目能力

1. 无限循环的 3D 卡片轮播
2. 中心卡片放大、两侧卡片旋转并后退的空间效果
3. 鼠标滚轮切换
4. 鼠标拖拽切换
5. 惯性滑动
6. 当前卡片变化时，背景渐变平滑切换
7. 响应式布局
8. GPU 优化与流畅动画

## 二、新增功能

1. 7 个流程节点数据独立维护
2. 信息型流程卡片（激活卡片/非激活卡片不同样式）
3. 详情展示区域（关键动作、核心产出、决策价值）
4. 顶部标题与当前阶段标签
5. 底部进度提示与操作说明
6. 点击卡片切换至该节点
7. 键盘左右方向键切换
8. 点击中心卡片展开详情
9. 进度指示器（圆点 + 数字）
10. 每个节点预设渐变颜色
11. Canvas 动态渐变与柔和漂移效果
12. prefers-reduced-motion 支持
13. 触控设备滑动支持

## 三、项目结构

```
├── index.html      # 页面结构
├── styles.css      # 样式（含响应式）
├── base.css        # 基础样式
├── script.js       # 主要逻辑
├── data.js         # 7 个流程节点数据
├── LICENSE.md      # MIT License
└── README.md       # 本文件
```

## 四、本地启动

直接在浏览器中打开 `index.html`，或使用本地服务器：

```bash
# Python
python3 -m http.server 8000

# Node.js
npx serve .
```

然后访问 http://localhost:8000

## 五、文案与节点修改

所有节点数据都在 `data.js` 中，修改 `NODES` 数组即可：

```javascript
const NODES = [
  {
    id: '01',
    number: '01',
    title: '收敛资源位',
    englishTitle: 'Resource Consolidation',
    summary: '...',
    action: '...',
    output: '...',
    value: '...',
    gradientColors: {
      c1: [45, 55, 80],   // [R, G, B]
      c2: [70, 80, 140]   // [R, G, B]
    },
    stage: '设计判断'
  },
  // ...
];
```

### 调整渐变颜色

每个节点的 `gradientColors` 包含两个 RGB 颜色：
- `c1` - 第一个径向渐变颜色
- `c2` - 第二个径向渐变颜色

颜色格式为 `[R, G, B]` 数组，数值范围 0-255。

建议使用低饱和、克制的颜色，保持高级感。

## 六、3D 与动画参数调整

所有参数都在 `script.js` 顶部的 CONFIGURATION 区域：

```javascript
// 物理参数
const FRICTION = 0.9;           // 摩擦力 (0-1，越小摩擦越大)
const WHEEL_SENS = 0.6;         // 鼠标滚轮灵敏度
const DRAG_SENS = 1.0;          // 拖拽灵敏度

// 视觉参数
const MAX_ROTATION = 28;        // 卡片最大旋转角度（度）
const MAX_DEPTH = 140;          // Z 轴最大深度（像素）
const MIN_SCALE = 0.92;         // 最小缩放比例
const SCALE_RANGE = 0.1;        // 缩放变化范围
const GAP = 28;                 // 卡片间距（像素）
```

### 调整建议

- **想让 3D 效果更强**：增大 `MAX_ROTATION` 和 `MAX_DEPTH`
- **想让轮播更顺滑**：增大 `FRICTION`（接近 1）
- **想让滚轮更快**：增大 `WHEEL_SENS`
- **想让卡片间距更大**：增大 `GAP`

## 七、License

本项目基于 MIT License 的开源项目修改。

原项目作者：Clément Grellier
原项目地址：https://github.com/clementgrellier/gradientslider

完整 License 请见 [LICENSE.md](./LICENSE.md)
