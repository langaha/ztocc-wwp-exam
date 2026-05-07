import * as XLSX from "xlsx";

function buildWorkbook() {
  const headers = [
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
  ];

  const example = [
    "EXT-0001",
    "张三",
    "13800138000",
    "上海市上海市浦东新区世纪大道 2000 号",
    "李四",
    "13900139000",
    "北京市北京市海淀区中关村大街 10 号",
    "1.2",
    "1",
    "常温",
    "示例数据（可删除）",
  ];

  const aoa = [headers, example];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "导入模板");
  return wb;
}

export async function GET() {
  const wb = buildWorkbook();
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;

  const cnName = "标准导入模板.xlsx";
  const encoded = encodeURIComponent(cnName);

  return new Response(buf, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="import_template.xlsx"; filename*=UTF-8''${encoded}`,
      "cache-control": "no-store",
    },
  });
}

