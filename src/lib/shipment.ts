export type TempLayer = "常温" | "冷藏" | "冷冻";

export type ShipmentField =
  | "externalCode"
  | "senderName"
  | "senderPhone"
  | "senderAddress"
  | "receiverName"
  | "receiverPhone"
  | "receiverAddress"
  | "weightKg"
  | "pieceCount"
  | "tempLayer"
  | "remark";

export type ShipmentDraft = Record<ShipmentField, string>;

export type FieldErrorMap = Partial<Record<ShipmentField, string>>;

export const shipmentFieldMeta: Array<{
  key: ShipmentField;
  label: string;
  required: boolean;
}> = [
  { key: "externalCode", label: "外部编码", required: false },
  { key: "senderName", label: "发件人姓名", required: true },
  { key: "senderPhone", label: "发件人电话", required: true },
  { key: "senderAddress", label: "发件人地址", required: true },
  { key: "receiverName", label: "收件人姓名", required: true },
  { key: "receiverPhone", label: "收件人电话", required: true },
  { key: "receiverAddress", label: "收件人地址", required: true },
  { key: "weightKg", label: "重量(kg)", required: true },
  { key: "pieceCount", label: "件数", required: true },
  { key: "tempLayer", label: "温层", required: true },
  { key: "remark", label: "备注", required: false },
];

export const requiredFields = shipmentFieldMeta
  .filter((f) => f.required)
  .map((f) => f.key);

export const allFields = shipmentFieldMeta.map((f) => f.key);

export function createEmptyDraft(): ShipmentDraft {
  return {
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
}

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function normalizeTempLayer(input: string): string {
  const v = normalizeText(input).replace(/\s+/g, "");
  if (v === "常温" || v === "冷藏" || v === "冷冻") return v;
  if (v === "冷凍") return "冷冻";
  if (v === "冷蔵") return "冷藏";
  if (v.toLowerCase() === "ambient") return "常温";
  if (v.toLowerCase() === "chilled") return "冷藏";
  if (v.toLowerCase() === "frozen") return "冷冻";
  return normalizeText(input);
}

export function normalizePhone(input: string): string {
  return normalizeText(input);
}

export function validateDraft(draft: ShipmentDraft): FieldErrorMap {
  const errors: FieldErrorMap = {};

  for (const meta of shipmentFieldMeta) {
    if (!meta.required) continue;
    const v = normalizeText(draft[meta.key]);
    if (!v) errors[meta.key] = "必填";
  }

  const senderPhone = normalizePhone(draft.senderPhone);
  if (senderPhone && !/^[+()\-\s\d]{6,20}$/.test(senderPhone)) {
    errors.senderPhone = "格式错误";
  }

  const receiverPhone = normalizePhone(draft.receiverPhone);
  if (receiverPhone && !/^[+()\-\s\d]{6,20}$/.test(receiverPhone)) {
    errors.receiverPhone = "格式错误";
  }

  const weightStr = normalizeText(draft.weightKg);
  if (weightStr) {
    const w = Number(weightStr);
    if (!Number.isFinite(w) || w <= 0) errors.weightKg = "必须为正数";
  }

  const pieceStr = normalizeText(draft.pieceCount);
  if (pieceStr) {
    const n = Number(pieceStr);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      errors.pieceCount = "必须为正整数";
    }
  }

  const temp = normalizeTempLayer(draft.tempLayer);
  if (temp && temp !== "常温" && temp !== "冷藏" && temp !== "冷冻") {
    errors.tempLayer = "必须为 常温/冷藏/冷冻";
  }

  return errors;
}

export function hasAnyErrors(errorMap: FieldErrorMap): boolean {
  return Object.keys(errorMap).length > 0;
}

