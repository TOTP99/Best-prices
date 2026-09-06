# 扑克扇形卡片 · 超市特价页

竖屏/横屏自适应。华超（一对A）+ 西超（三条K）以扑克扇形展示，点击卡片可伸出来看完整特价。

## 文件

- `index.html` — 骨架 + 交互 + 分析弹层
- `style.css` — 样式
- `deals.js` — 配置 + 牌面渲染
- `deals-data.json` — **每周只改这个文件**

## 超市

**华超（一对A）：** 冠业Kennedy（红桃A）、百福超市Denison（黑桃A）  
**西超（三条K）：** FreshCo McCowan（梅花K）、Food Basics（方块K）、No Frills Markham Road（黑桃K）

Flyer 链接在 `deals.js` 的 `STORE_CONFIG` 里。

## 卡片显示规则（最多 5 条）

优先固定显示（若该店有特价则必出）：鸡蛋、西红柿、三文鱼、桃、鸡胸肉、黑巧克力、圆葱、苹果、黄瓜。  
其余名额从其他特价中随机抽取。点 🔄 可重新随机非优先项。  
分析弹层仍使用**全部**商品数据。

## 每周更新

只改 `deals-data.json`。无数据时特价区留空。`updatedAt` 可选（绿色星标）。  
基准商品键：`eggs` `salmon` `tomato` `banana` `grape` `chocolate` `porkchop` `orange` `chickenwing`。

## 店铺 ID

| 店铺 | id | 组 | 点数 | 花色 |
|---|---|---|---|---|
| 冠业Kennedy | `guanye` | 华超 | A | ♥ |
| 百福超市Denison | `baifu` | 华超 | A | ♠ |
| FreshCo McCowan | `freshco` | 西超 | K | ♣ |
| Food Basics | `foodbasics` | 西超 | K | ♦ |
| No Frills Markham Road | `nofrills` | 西超 | K | ♠ |

店名按华超/西超固定中英文，不受语言切换影响。

## 交互

- **竖屏：** switch 切换华超/西超；📊 🔄 🔊 在 switch 旁。点卡片弹出。
- **横屏：** 5 张牌叠成长方形；控制键在卡片**右侧纵向**（➡️ 📊 🔄 🔊），左侧 ⬅️；卡片垂直居中。点露出的牌立刻置顶并略抬高，带洗牌音效。华超/西超牌 z-index 统一，选中即到最前。
- 底部「看完整 Flyer」打开该店链接。
- 📊 数据分析弹层（含全部特价）。
