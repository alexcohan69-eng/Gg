import { pool } from "@/lib/db"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export async function GET() {
  const cols = await db.execute(sql`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications'
    order by ordinal_position
  `)
  const tables = await db.execute(sql`
    select table_name from information_schema.tables where table_schema='public' order by table_name
  `)
  return Response.json({ notificationsColumns: cols.rows, tables: tables.rows })
}

export async function POST(req: Request) {
  const { statements } = (await req.json()) as { statements: string[] }
  const results: { statement: string; ok: boolean; error?: string }[] = []
  const client = await pool.connect()
  try {
    for (const statement of statements) {
      try {
        await client.query(statement)
        results.push({ statement, ok: true })
      } catch (err) {
        results.push({
          statement,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } finally {
    client.release()
  }
  return Response.json({ results })
}
