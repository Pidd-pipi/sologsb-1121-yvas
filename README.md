# sologsb-1121 森林样地调查记录台（gbforestplot）

面向森林资源调查员的固定样地工作台：为样地建档，逐株记录胸径、树高、枝下高与检尺位置，登记更新幼苗与灌木层，并在复查期与上一期数据逐株比对生长量、计算林分因子。纯前端单页应用，数据全部保存在浏览器本地。

## Docker 一键启动（推荐）

```bash
cp .env.example .env
docker compose up -d --build
```

访问地址：**http://localhost:21821**

停止服务：

```bash
docker compose down
```

## 技术栈

| 层次 | 选型 |
| --- | --- |
| 框架 | React 18 + TypeScript |
| UI | Ant Design 5 |
| 构建 | Vite 5 |
| 状态管理 | Zustand |
| 路由 | React Router v6（BrowserRouter） |
| 本地存储 | IndexedDB（Dexie 4），含结构版本号与升级迁移 |

## 本地开发

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc 类型检查 + vite 构建
```

> 生产环境由 nginx 托管 `dist`，`nginx.conf` 已启用 `try_files $uri $uri/ /index.html;` 与 gzip。

## 目录结构

```
sologsb-1121/
├── docker-compose.yml
├── .env.example
├── .env
└── frontend/
    ├── Dockerfile              # 多阶段：node:20-alpine 构建 → nginx:alpine 托管
    ├── nginx.conf
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── public/favicon.svg
    └── src/
        ├── main.tsx
        ├── index.css
        ├── router/index.tsx
        ├── types/{plot,tree,regen,recheck,submission}.ts
        ├── stores/{plot,tree,regen,submission}Store.ts
        ├── components/common/{PlotCard,TreeTable,GrowthDiffTable,RoundTag,ReviewTag}.tsx
        ├── components/review/{SubmitReviewModal,ReviewDecisionModal,SubmissionDrawer}.tsx
        ├── hooks/{usePlotFilter,useTreeStats}.ts
        ├── pages/{PlotList,TreeEntry,RegenView,RecheckView,PlotSummary,ReviewCenter}.tsx
        └── utils/{db,forestCalc,id}.ts
```

## 页面与路由

| 路由 | 页面 | 消费模型 |
| --- | --- | --- |
| `/plots` | 样地台账：按地点/林型/复查期次/郁闭度区间筛选，显示面积、优势树种、已录样木数与送审状态，可锁定往期；含送审入口 | Plot、SubmissionRecord |
| `/plots/:id/trees` | 样木录入与清单：径阶分组快速录入、行内改胸径、树种联想、胸径异常提示；送审期次停改只读 | TreeRecord、SubmissionRecord |
| `/plots/:id/regen` | 更新苗与灌木样方记录，按高度级与株数分组合计；按期切换，送审期次停改只读 | RegenShrub、SubmissionRecord |
| `/plots/:id/recheck` | 复查比对：逐株两期胸径/树高与生长量，标记缺失与状态变化，保存比对结果 | RecheckDiff、TreeRecord |
| `/summary/:plotId` | 林分因子汇总：每公顷株数、平均胸径、断面积、郁闭度、更新密度，可导出调查记录文本 | Plot、TreeRecord、RegenShrub |
| `/reviews` | 送审审核：待审核队列与全部留档，审核人写意见后退回补录或通过归档，可回看每个版本的快照 | SubmissionRecord |

`/` 重定向到 `/plots`，未匹配路由同样兜底到 `/plots`。

## 数据存储说明

- 数据库名 `gbforestplot`，当前结构版本 **v3**（`localStorage['gbforestplot:db-version']` 记录）。
- 五张表：`plots`（样地）、`trees`（样木，按期次分行）、`regens`（更新苗与灌木样方）、`rechecks`（复查逐株比对）、`submissions`（送审留档，含版本、状态、时间线与资料快照）。
- v1 → v2 迁移：为老样地补 `locked`、`surveyRound`，为老样木补 `round`、`measuredAt`，并新增索引。
- v2 → v3 迁移：新增 `submissions` 表，老库无需搬移数据；索引为 `id, plotId, round, version, status, submittedAt`。
- 容器无状态、不挂载命名卷；清空站点数据即回到初始示范数据。
- 首次打开灌入 2 个示范样地、11 条样木（含第 1/2 两期，便于直接做复查比对）与 6 条样方记录，并预置送审留档（第 1 期 v1 退回 → v2 通过归档，第 2 期送审中，便于直接体验停改）。

## 送审与审核流程

- **送审入口在样地台账**：顶部「送审」任选样地与期次，或在某张样地卡上直接点「送审」。送审时把当期样地卡、样木、更新苗与灌木深拷贝成一份快照（草本样方不随送审），并固化为一个版本（同一样地同一期次版本号从 v1 递增）。
- **提交即停改**：该期次进入「待审核」，样木录入页与更新/灌木页对应期次全部只读，避免审核期间数据变动。
- **审核处置**：审核人在「送审审核」页写意见——**退回补录**后当期解冻，调查员可继续修改并重新送审，系统只冻结新版本，旧版记录与意见保留；**通过归档**后当期永久只读。
- **全程留档**：每次送审、退回、通过都记录操作人、时间与意见（时间线），并能按版本回看送审时刻的完整资料快照；送审记录不随重新送审或样地删除而丢失。
- 送审冻结按期独立判定，与台账原有的「锁定往期」人工开关互不影响。

## 功能要点

- **径阶归组**：按「6/8/12/16/20/24/28/32+」cm 径阶自动归组，表格内联展示各径阶株数。
- **胸径异常提示**：数值超出 0~200 cm 或与本树种同期均值偏离 >60% 时标黄并给出提示。
- **复查比对**：任选上下两期生成逐株差值表，标记「本期未复测（疑似采伐或倒伏）」与「本期新增进界木」，生长率为负或缺失行高亮，并计算保留木生长率。
- **林分因子**：每公顷株数、平均胸径/树高、断面积与每公顷断面积、冠幅折算郁闭度、更新苗/灌木密度。
- **导出**：复查比对结果写入本地档案库；林分汇总可复制或导出调查记录 txt。
