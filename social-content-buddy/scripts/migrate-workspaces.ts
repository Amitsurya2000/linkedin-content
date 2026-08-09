import pg from "pg";

/**
 * Migration: Create default workspaces from existing batches.
 * Groups batches by (userId, businessName) and creates a workspace for each unique combo.
 */
async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Find unique (userId, businessName) pairs from existing batches
  const { rows: groups } = await client.query(`
    SELECT DISTINCT user_id, business_name, website_url, target_audience, tone_prefs
    FROM post_batches
    WHERE workspace_id IS NULL
    ORDER BY business_name
  `);

  console.log(`Found ${groups.length} unique business/user combos to migrate.`);

  for (const group of groups) {
    // Create workspace
    const { rows: [ws] } = await client.query(
      `INSERT INTO workspaces (user_id, name, business_name, website_url, target_audience, tone_prefs)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name`,
      [
        group.user_id,
        group.business_name,
        group.business_name,
        group.website_url,
        group.target_audience,
        group.tone_prefs,
      ]
    );

    // Link batches to this workspace
    const { rowCount } = await client.query(
      `UPDATE post_batches
       SET workspace_id = $1
       WHERE user_id = $2 AND business_name = $3 AND workspace_id IS NULL`,
      [ws.id, group.user_id, group.business_name]
    );

    console.log(`  Created workspace "${ws.name}" (${ws.id}) — linked ${rowCount} batches`);
  }

  console.log("Migration complete.");
  await client.end();
}

main().catch(console.error);
