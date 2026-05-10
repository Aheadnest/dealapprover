import type { RowDataPacket } from "mysql2";
import { executeQuery } from "../../integrations/mysql/pool.js";

interface ScanSummary extends RowDataPacket {
  slug: string;
  title: string;
  total_scans: number;
  unique_countries: number;
  first_scan: string | null;
  last_scan: string | null;
}

export async function listScans(userId: string) {
  const [rows] = await executeQuery<ScanSummary[]>(
    `SELECT c.slug,
            JSON_UNQUOTE(JSON_EXTRACT(c.payload_canonical, '$.item.title')) AS title,
            COUNT(s.id) AS total_scans,
            COUNT(DISTINCT s.country_iso2) AS unique_countries,
            MIN(s.at) AS first_scan,
            MAX(s.at) AS last_scan
     FROM certificates c
     LEFT JOIN scan_events s ON s.certificate_id = c.id
     WHERE c.user_id = ?
     GROUP BY c.id, c.slug
     ORDER BY MAX(s.at) DESC
     LIMIT 100`,
    [userId],
  );
  return rows;
}
