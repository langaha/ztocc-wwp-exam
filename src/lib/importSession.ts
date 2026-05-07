import type { ShipmentDraft } from "@/lib/shipment";

export type ImportSession = {
  fileName: string;
  fingerprint: string;
  columns: string[];
  items: ShipmentDraft[];
  excelRowNumbers: number[];
};

const KEY = "universal-import-session-v1";

export function saveImportSession(session: ImportSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function loadImportSession(): ImportSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImportSession;
  } catch {
    return null;
  }
}

export function clearImportSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}

