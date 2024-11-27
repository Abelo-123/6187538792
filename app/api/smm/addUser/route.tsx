import { NextResponse } from "next/server";
import { Pool } from "pg";

// Set up the connection pool using your connection string
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

export async function POST(req) {
    try {
        // Parse the incoming JSON request
        const { name, username, profile } = await req.json();

        // Create a client from the connection pool
        const client = await pool.connect();

        // Insert data into the users table
        const queryText = `
      INSERT INTO users (name, username, profile)
      VALUES ($1, $2, $3)
      RETURNING name, username, profile;
    `;
        const values = [name, username, profile];

        // Execute the query

        await client.query(queryText, values);

        // Release the client back to the pool
        client.release();

        // Return the inserted user data
        return NextResponse.json({ userdata: values });
    } catch (error) {
        console.error('Error inserting data:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
