import mysql from "mysql2/promise";
import type { FieldPacket, QueryResult } from "mysql2";
import { env } from "../../config/env.js";

export type SqlParamValue =
  | string
  | number
  | bigint
  | boolean
  | Date
  | null
  | Buffer
  | Uint8Array;

export const mysqlPool = mysql.createPool({
  host: env.mysqlHost,
  port: env.mysqlPort,
  user: env.mysqlUser,
  password: env.mysqlPassword,
  database: env.mysqlDatabase,
  waitForConnections: true,
  connectionLimit: env.mysqlConnectionLimit,
  queueLimit: 0,
  charset: "utf8mb4",
  decimalNumbers: true,
  dateStrings: true,
  timezone: "Z",
});

export async function executeQuery<T extends QueryResult>(
  sql: string,
  values: readonly SqlParamValue[] = [],
): Promise<[T, FieldPacket[]]> {
  return mysqlPool.execute<T>(sql, [...values] as unknown as []);
}
