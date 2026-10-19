// The scan the user is picking from, kept between the Add tab and the pick screen. Lost on restart
// on purpose: the server keeps the scan (24 h), and pending results are listed from the server.
import type { OutfitScan } from "../api/types";

const scans = new Map<string, OutfitScan>();

export const rememberScan = (scan: OutfitScan) => void scans.set(scan.id, scan);
export const cachedScan = (id: string) => scans.get(id);
export const forgetScans = () => scans.clear();
