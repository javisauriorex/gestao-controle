import { getDatabase } from "@netlify/database";
const db = getDatabase();
export const sql = db.sql;
