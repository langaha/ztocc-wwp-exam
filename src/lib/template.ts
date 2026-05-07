import type { ShipmentDraft, ShipmentField } from "@/lib/shipment";

export type MappingRule = Partial<Record<ShipmentField, number[]>>;

export type HeaderDetection = {
  headerRowIndex: number;
  headerRow: string[];
  treatAsHeader: boolean;
};

function normalizeHeaderCell(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[：:（）()【】\[\]·•,，.。/\\_\-]/g, "")
    .trim();
}

const synonymMap: Record<ShipmentField, string[]> = {
  externalCode: ["外部编码", "外部单号", "外部订单号", "外部单据号", "订单号", "reference", "ref", "externalcode"],
  senderName: ["发件人姓名", "寄件人姓名", "寄方姓名", "发件人", "寄件人", "sender", "shipper", "fromname"],
  senderPhone: ["发件人电话", "寄件人电话", "寄方电话", "发件电话", "senderphone", "shipperphone", "fromphone"],
  senderAddress: ["发件人地址", "寄件人地址", "寄方地址", "发件地址", "senderaddress", "shipperaddress", "fromaddress"],
  receiverName: ["收件人姓名", "收货人姓名", "收方姓名", "收件人", "收货人", "收方", "receiver", "consignee", "toname"],
  receiverPhone: ["收件人电话", "收货人电话", "收方电话", "receiverphone", "consigneephone", "tophone"],
  receiverAddress: ["收件人地址", "收货人地址", "收方地址", "receiveraddress", "consigneeaddress", "toaddress"],
  weightKg: ["重量kg", "重量", "weight", "weightkg"],
  pieceCount: ["件数", "包裹数", "数量", "件", "count", "pieces", "piececount", "qty"],
  tempLayer: ["温层", "温区", "温度层", "温层常温冷藏冷冻", "templater", "temperature", "temp"],
  remark: ["备注", "说明", "remark", "note", "comment"],
};

const addressParts = {
  sender: ["发件省", "发件市", "发件区", "发件县", "发件街道", "发件详细地址", "发件地址详情"],
  receiver: ["收件省", "收件市", "收件区", "收件县", "收件街道", "收件详细地址", "收件地址详情"],
};

function buildSynonymIndex() {
  const index = new Map<string, ShipmentField>();
  for (const key of Object.keys(synonymMap) as ShipmentField[]) {
    for (const s of synonymMap[key]) {
      index.set(normalizeHeaderCell(s), key);
    }
  }
  return index;
}

const synonymIndex = buildSynonymIndex();

export function detectHeaderRow(rows: string[][]): HeaderDetection {
  let bestIdx = 0;
  let bestScore = -1;

  const scanCount = Math.min(rows.length, 30);
  for (let i = 0; i < scanCount; i++) {
    const row = rows[i] ?? [];
    let score = 0;
    for (const cell of row) {
      const n = normalizeHeaderCell(cell ?? "");
      if (!n) continue;
      if (synonymIndex.has(n)) score += 2;
      if (n.includes("地址") || n.includes("电话") || n.includes("姓名")) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const headerRow = (rows[bestIdx] ?? []).map((c) => String(c ?? "").trim());
  return {
    headerRowIndex: bestIdx,
    headerRow,
    treatAsHeader: bestScore >= 4,
  };
}

export function buildColumnsForMapping(headerRow: string[]): string[] {
  const cols: string[] = [];
  const maxLen = Math.max(headerRow.length, 1);
  for (let i = 0; i < maxLen; i++) {
    const v = headerRow[i] ? String(headerRow[i]).trim() : "";
    cols.push(v || `列${i + 1}`);
  }
  return cols;
}

export function computeFingerprint(columns: string[]): string {
  const normalized = columns.map((c) => normalizeHeaderCell(c)).join("|");
  return `v1:${normalized}`;
}

function safePush(map: MappingRule, key: ShipmentField, colIdx: number) {
  const cur = map[key] ?? [];
  if (!cur.includes(colIdx)) map[key] = [...cur, colIdx];
}

export function autoMapFromColumns(columns: string[]): MappingRule {
  const mapping: MappingRule = {};

  for (let i = 0; i < columns.length; i++) {
    const raw = columns[i] ?? "";
    const n = normalizeHeaderCell(raw);
    if (!n) continue;

    const direct = synonymIndex.get(n);
    if (direct) {
      safePush(mapping, direct, i);
      continue;
    }

    if (n.includes("发") && n.includes("电话")) safePush(mapping, "senderPhone", i);
    if (n.includes("收") && n.includes("电话")) safePush(mapping, "receiverPhone", i);
    if (n.includes("发") && n.includes("姓名")) safePush(mapping, "senderName", i);
    if (n.includes("收") && n.includes("姓名")) safePush(mapping, "receiverName", i);

    if (n.includes("发") && n.includes("地址")) safePush(mapping, "senderAddress", i);
    if (n.includes("收") && n.includes("地址")) safePush(mapping, "receiverAddress", i);

    for (const part of addressParts.sender) {
      if (n === normalizeHeaderCell(part)) safePush(mapping, "senderAddress", i);
    }
    for (const part of addressParts.receiver) {
      if (n === normalizeHeaderCell(part)) safePush(mapping, "receiverAddress", i);
    }
  }

  return mapping;
}

export function mapRowsToDrafts(args: {
  rows: string[][];
  mapping: MappingRule;
  dataStartIndex: number;
}): { items: ShipmentDraft[]; excelRowNumbers: number[] } {
  const { rows, mapping, dataStartIndex } = args;
  const items: ShipmentDraft[] = [];
  const excelRowNumbers: number[] = [];

  for (let r = dataStartIndex; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const draft: ShipmentDraft = {
      externalCode: "",
      senderName: "",
      senderPhone: "",
      senderAddress: "",
      receiverName: "",
      receiverPhone: "",
      receiverAddress: "",
      weightKg: "",
      pieceCount: "",
      tempLayer: "",
      remark: "",
    };

    for (const key of Object.keys(draft) as ShipmentField[]) {
      const cols = mapping[key] ?? [];
      if (cols.length === 0) continue;
      const parts = cols
        .map((idx) => String(row[idx] ?? "").trim())
        .filter((v) => v);
      draft[key] = parts.join("");
    }

    const anyNonEmpty = Object.values(draft).some((v) => String(v ?? "").trim());
    if (!anyNonEmpty) continue;

    items.push(draft);
    excelRowNumbers.push(r + 1);
  }

  return { items, excelRowNumbers };
}

