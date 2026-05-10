import type { ResultSetHeader } from "mysql2";
import { v4 as uuidv4 } from "uuid";
import { executeQuery } from "../../integrations/mysql/pool.js";
import { Errors } from "../../utils/errors.js";

export async function createReport(input: {
  certificate_id: string;
  kind: string;
  message: string;
  contact_email?: string;
}): Promise<void> {
  if (!input.certificate_id || !input.kind || !input.message) {
    throw Errors.validation("certificate_id, kind, and message are required");
  }
  await executeQuery<ResultSetHeader>(
    `INSERT INTO reports (id, certificate_id, kind, message, contact_email, status, at)
     VALUES (?, ?, ?, ?, ?, 'open', NOW(3))`,
    [uuidv4(), input.certificate_id, input.kind, input.message, input.contact_email ?? null],
  );
}
