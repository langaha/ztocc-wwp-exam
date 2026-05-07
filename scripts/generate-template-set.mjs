import * as XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = process.argv[2] || path.join(__dirname, "..", "docs", "templates");
fs.mkdirSync(outDir, { recursive: true });

function writeXlsx(fileName, aoa, options = {}) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colCount = Math.max(...aoa.map((r) => (Array.isArray(r) ? r.length : 0)), 1);
  ws["!cols"] = new Array(colCount).fill(null).map(() => ({ wch: 18 }));
  if (options.merges) ws["!merges"] = options.merges;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName || "orders");
  const p = path.join(outDir, fileName);
  XLSX.writeFile(wb, p);
  return p;
}

const templates = [];

templates.push(
  writeXlsx(
    "01-标准模板.xlsx",
    [
      ["标准导入模板（表头在第 1 行）"],
      [
        "外部编码",
        "发件人姓名",
        "发件人电话",
        "发件人地址",
        "收件人姓名",
        "收件人电话",
        "收件人地址",
        "重量(kg)",
        "件数",
        "温层",
        "备注",
      ],
      [
        "EXT-STD-001",
        "张三",
        "13800138000",
        "上海市浦东新区世纪大道 2000 号",
        "李四",
        "13900139000",
        "北京市海淀区中关村大街 10 号",
        "1.2",
        "1",
        "常温",
        "标准模板示例",
      ],
    ],
    { merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }] }
  )
);

templates.push(
  writeXlsx(
    "02-英文列名模板.xlsx",
    [
      ["English Headers (Receiver/Sender/Weight/Pieces/Temp/Remark)"],
      [""],
      [
        "Reference",
        "Sender",
        "SenderPhone",
        "SenderAddress",
        "Receiver",
        "ReceiverPhone",
        "ReceiverAddress",
        "Weight",
        "Pieces",
        "Temp",
        "Remark",
      ],
      [
        "EXT-EN-001",
        "Alice",
        "+86 13800138000",
        "Shanghai Pudong Century Ave 2000",
        "Bob",
        "+86 13900139000",
        "Beijing Haidian Zhongguancun 10",
        "2.5",
        "2",
        "Frozen",
        "english template",
      ],
    ],
    { merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }] }
  )
);

templates.push(
  writeXlsx(
    "03-列序变化模板.xlsx",
    [
      ["列序变化：温层在第 1 列，重量/件数交换位置"],
      [""],
      [
        "温层",
        "收方姓名",
        "收方电话",
        "寄件人",
        "寄方电话",
        "发件人地址",
        "收件人地址",
        "件数",
        "重量",
        "外部单号",
        "说明",
      ],
      [
        "冷藏",
        "小王",
        "13800138001",
        "小李",
        "13900139001",
        "浙江省杭州市西湖区文三路 100 号",
        "江苏省南京市玄武区中山路 1 号",
        "3",
        "1.8",
        "EXT-ORDER-001",
        "列序变化示例",
      ],
    ],
    { merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }] }
  )
);

templates.push(
  writeXlsx(
    "04-缺少可选列模板.xlsx",
    [
      ["缺少可选列：不含外部编码、不含备注（应仍可导入）"],
      [""],
      [
        "发件人姓名",
        "发件人电话",
        "发件人地址",
        "收件人姓名",
        "收件人电话",
        "收件人地址",
        "重量(kg)",
        "件数",
        "温层",
      ],
      [
        "张三",
        "13800138002",
        "上海市浦东新区世纪大道 2000 号",
        "李四",
        "13900139002",
        "北京市海淀区中关村大街 10 号",
        "0.9",
        "1",
        "常温",
      ],
    ],
    { merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }] }
  )
);

templates.push(
  writeXlsx(
    "05-地址拆分模板.xlsx",
    [
      ["地址拆分：省/市/区/详细地址 分列（会自动拼接到地址字段）"],
      [""],
      [
        "外部订单号",
        "寄件人姓名",
        "寄件人电话",
        "发件省",
        "发件市",
        "发件区",
        "发件详细地址",
        "收件人姓名",
        "收件人电话",
        "收件省",
        "收件市",
        "收件区",
        "收件详细地址",
        "重量",
        "数量",
        "温区",
        "备注",
      ],
      [
        "EXT-SPLIT-001",
        "张三",
        "13800138003",
        "上海市",
        "上海市",
        "浦东新区",
        "世纪大道 2000 号",
        "李四",
        "13900139003",
        "北京市",
        "北京市",
        "海淀区",
        "中关村大街 10 号",
        "3.2",
        "2",
        "Ambient",
        "地址拆分示例",
      ],
    ],
    { merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }] }
  )
);

console.log("Wrote templates:");
for (const p of templates) console.log(p);

