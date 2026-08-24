import { pool } from "@/lib/db"

// Temporary one-off migration endpoint — adds the `about` rich-text
// column if it's missing. Deleted after use.
export async function GET() {
  const client = await pool.connect()
  try {
    await client.query(`alter table "user" add column if not exists "about" text`)
    const result = await client.query(
      `select column_name from information_schema.columns where table_name = 'user' order by column_name`,
    )
    return Response.json({ ok: true, columns: result.rows.map((r) => r.column_name) })
  } catch (error) {
    return Response.json({ ok: false, error: String(error) }, { status: 500 })
  } finally {
    client.release()
  }
}
