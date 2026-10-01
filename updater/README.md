# poker-deals 每周自动更新器

每周从网上自动抓取 5 家店的传单特价，生成 app 用的 `deals-data.json`。

## 数据源

| 店 | 来源 | 传单周期 |
|---|---|---|
| 冠业 First Choice (Kennedy) | GoFlyer API `backend-prod.goflyer.ca` | 周五–周四 |
| 百福 Sunfood (Denison) | GoFlyer API `backend-prod.goflyer.ca` | 周五–周四 |
| FreshCo (McCowan) | Flipp API `backflipp.wishabi.com`（邮编 L3R1P3） | 周四–周三 |
| Food Basics | Flipp API | 周四–周三 |
| No Frills (Markham Road) | Flipp API | 周四–周三 |

GoFlyer 的商品自带中英文名、价格、单位、分类、折扣价；Flipp 的商品名走
`normalize.py` 做清洗 + 词库（`items.js` GLOSSARY）匹配。

## 文件

- `build.py` — 主脚本：抓取 → 规范化 → 选品 → 重算 analysis → 原子写入
- `flipp.py` — Flipp/Wishabi 抓取（多关键词窗口合并，单查询 150 条上限）
- `goflyer.py` — GoFlyer 抓取（store/flyer/item 三级接口）
- `normalize.py` — 商品名清洗、词库匹配、价格格式化（`$1.44/lb` / `98¢/ea` 风格）

## GitHub Actions 自动运行（推荐）

1. 把本目录的 `updater/` 和 `.github/` 放到网站仓库根目录：
   ```
   仓库根/
     index.html  app.js  deals.js  items.js  deals-data.json  style.css
     updater/build.py  updater/flipp.py  updater/goflyer.py  updater/normalize.py
     .github/workflows/weekly-deals.yml
   ```
2. push 后，Actions 每周五美东上午 9 点自动跑，更新 `deals-data.json` 并提交。
3. 想立刻跑一次：仓库 → Actions → "weekly deals update" → Run workflow。
4. 每次运行的日志可在 Actions 那次运行的 Artifacts 里下载 `deals-run-log`。

不需要装任何依赖，纯 Python 标准库。

## 本地手动运行

```bash
cd updater   # 或脚本所在目录
python3 build.py                                  # 写默认位置
DEALS_DATA_FILE=/tmp/test.json python3 build.py  # 试跑不碰真实文件
```

可用环境变量：`DEALS_DATA_FILE`、`GLOSSARY_FILE`、`BACKUP_DIR`。

建议每周 **周五上午** 跑（西超传单周四开、华超传单周五开，周五两边新数据最齐）。

## 安全机制

- 某店抓取失败 / 商品太少（<8 条）/ 华超新一周商品还没录入 → **保留该店旧数据**，不清空
- 全部失败 → 不写文件
- 先写临时文件再 `os.replace` 原子替换；写之前备份旧文件
- 每店最多 50 条；`featured` 取折扣最大的 2 条（华超用传单自带的 topSale）
- `analysis`（bestDeals / deepestDiscounts / categoryWinners /
  cheapestStoreSummary / benchmarksComparison）每次重算
- 无词库匹配的商品显示英文原名，日志列出清单供人工补词库

## 已知局限

- Flipp 单查询最多 150 条：用相关性 + 价格排序 + 约 78 个关键词窗口合并去重覆盖
- 冠业的 GoFlyer 商品录入较慢：新一周商品若还没录入会自动沿用旧数据并在日志注明
- `items.js` 词库只增不减，脚本不自动加词；未匹配商品名见运行日志
