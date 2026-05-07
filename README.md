# 万能导入 —— 多模板自动导入下单系统

对应需求文档：`docs/考试系统.pdf`

## 功能概览

- 模板管理与文件导入：上传/解析 Excel（.xlsx/.xls），自动识别多模板（列名/列序/表头行数差异），支持手动映射与模板记忆
- 数据预览与在线编辑：类 Excel 表格（表头固定、横向滚动、单元格可编辑，Tab/回车切换）
- 错误处理与校验：必填/格式/范围校验一次性展示；外部编码重复（同批次 + 历史数据）高亮提示
- 导出：将当前预览数据导出为 Excel
- 提交下单：无错误时可批量提交，展示提交进度条与结果汇总
- 已导入运单列表：从数据库读取，支持搜索/筛选/分页

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS
- Excel 解析：xlsx
- 数据库：Postgres（`pg`），通过环境变量 `DATABASE_URL` / `POSTGRES_URL` / `PRISMA_DATABASE_URL` 连接

## 本地运行

1. 安装依赖

```bash
npm install
```

2. 配置环境变量（可选）

新建 `.env.local`：

```env
DATABASE_URL="postgres://..."
```

3. 启动

```bash
npm run dev
```

访问：

- 导入：`http://localhost:3005/`
- 预览与编辑：`http://localhost:3005/preview`
- 已导入运单：`http://localhost:3005/orders`

## 多模板兼容测试

已提供 5 份不同模板（中文/英文/列序变化/缺少可选列/地址拆分）：

- `docs/templates/01-标准模板.xlsx`
- `docs/templates/02-英文列名模板.xlsx`
- `docs/templates/03-列序变化模板.xlsx`
- `docs/templates/04-缺少可选列模板.xlsx`
- `docs/templates/05-地址拆分模板.xlsx`

也可重新生成：

```bash
node scripts/generate-template-set.mjs
```
