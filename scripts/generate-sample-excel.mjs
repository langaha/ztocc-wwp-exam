import * as XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outPath =
  process.argv[2] ||
  path.join(__dirname, "..", "docs", "sample_import.xlsx");

const aoa = [
  ["万能导入测试模板（含标题行/空行/地址拆分/列序差异）"],
  [""],
  [
    "收方电话",
    "收方姓名",
    "外部单号",
    "寄件人",
    "寄方电话",
    "发件省",
    "发件市",
    "发件区",
    "发件详细地址",
    "收件省",
    "收件市",
    "收件区",
    "收件详细地址",
    "件数",
    "重量",
    "温层",
    "说明",
  ],
  [
    "13800138000",
    "张三",
    "EXT-001",
    "李四",
    "13900139000",
    "浙江省",
    "杭州市",
    "西湖区",
    "文三路 100 号",
    "江苏省",
    "南京市",
    "玄武区",
    "中山路 1 号",
    "1",
    "2.5",
    "常温",
    "正常数据",
  ],
  [
    "13800138001",
    "王五",
    "EXT-002",
    "赵六",
    "13900139001",
    "上海市",
    "上海市",
    "浦东新区",
    "世纪大道 2000 号",
    "北京市",
    "北京市",
    "海淀区",
    "中关村大街 10 号",
    "2",
    "1",
    "Ambient",
    "温层英文别名（会归一化为常温）",
  ],
  [
    "abc",
    "小明",
    "EXT-003",
    "小红",
    "13900139002",
    "广东省",
    "深圳市",
    "南山区",
    "科苑路 88 号",
    "广东省",
    "广州市",
    "天河区",
    "体育西路 99 号",
    "1",
    "3",
    "冷藏",
    "收件人电话错误（abc）",
  ],
  [
    "13800138003",
    "小强",
    "EXT-004",
    "小美",
    "13900139003",
    "四川省",
    "成都市",
    "武侯区",
    "人民南路 1 号",
    "重庆市",
    "重庆市",
    "渝中区",
    "解放碑 1 号",
    "0",
    "-2",
    "冷冻",
    "件数/重量为非正数（应标红）",
  ],
  [
    "13800138000",
    "张三",
    "EXT-001",
    "李四",
    "13900139000",
    "浙江省",
    "杭州市",
    "西湖区",
    "文三路 100 号",
    "江苏省",
    "南京市",
    "玄武区",
    "中山路 1 号",
    "1",
    "2.5",
    "Frozen",
    "外部编码重复（同批次内）+ 温层英文别名（会归一化为冷冻）",
  ],
];

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws["!cols"] = new Array(aoa[2].length).fill(null).map(() => ({ wch: 18 }));
ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: aoa[2].length - 1 } }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "orders");
XLSX.writeFile(wb, outPath);

console.log(`Wrote: ${outPath}`);

