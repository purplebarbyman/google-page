// =================================================================
// NBHWC PLATFORM - FLASHCARD CSV IMPORTER SCRIPT
// =================================================================
// This is a one-time use script to read flashcards from a CSV file
// and insert them into your live PostgreSQL database on Render.
// =================================================================

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Pool } = require('pg');

// --- DATABASE CONNECTION ---
// PASTE YOUR FULL EXTERNAL DATABASE URL FROM RENDER INSIDE THE QUOTES.
const connectionString = "postgresql://nbhwc_database_user:hXvbl1bm6yIXXz68YERj2zaeo86NvIlE@dpg-d1ptic7fte5s73co1qsg-a.oregon-postgres.render.com/nbhwc_database"; 

if (connectionString === "postgresql://nbhwc_database_user:hXvbl1bm6yIXXz68YERj2zaeo86NvIlE@dpg-d1ptic7fte5s73co1qsg-a.oregon-postgres.render.com/nbhwc_database" || !connectionString) {
    console.error("ERROR: Please replace 'postgresql://nbhwc_database_user:hXvbl1bm6yIXXz68YERj2zaeo86NvIlE@dpg-d1ptic7fte5s73co1qsg-a.oregon-postgres.render.com/nbhwc_database' in this file with your actual database URL from Render.");
    process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const csvFilePath = path.join(process.cwd(), 'flashcards.csv');

async function processFlashcardCSV() {
  const flashcards = [];

  console.log('Starting to read flashcards.csv file...');

  const stream = fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
      flashcards.push({
        topic: data.topic,
        term: data.term,
        definition: data.definition,
      });
    });

  await new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  console.log(`CSV file successfully processed. Found ${flashcards.length} flashcards.`);
  
  if (flashcards.length === 0) {
    console.log('No flashcards found to import. Exiting.');
    return;
  }

  console.log('Connecting to the database...');
  const client = await pool.connect();
  console.log('Database connection established.');

  try {
    await client.query('BEGIN');
    console.log('Starting database transaction...');

    console.log('Clearing existing flashcards...');
    await client.query('DELETE FROM flashcards');
    console.log('Existing flashcards cleared.');

    const topicMap = new Map();
    const topicsResult = await client.query('SELECT topic_id, topic_name FROM topics');
    topicsResult.rows.forEach(row => topicMap.set(row.topic_name, row.topic_id));

    console.log('Inserting new flashcard data...');

    for (const card of flashcards) {
      const topicId = topicMap.get(card.topic);
      if (!topicId) {
        console.warn(`Warning: Topic "${card.topic}" not found in the database. Skipping flashcard: "${card.term}"`);
        continue;
      }

      await client.query(
        'INSERT INTO flashcards (topic_id, term, definition) VALUES ($1, $2, $3)',
        [topicId, card.term, card.definition]
      );
    }

    await client.query('COMMIT');
    console.log(`Successfully inserted flashcards into the database.`);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Database transaction failed. Rolled back.', e);
  } finally {
    client.release();
    console.log('Database connection closed.');
    await pool.end();
  }
}

// Execute the main function
processFlashcardCSV().catch(err => {
    console.error("An unhandled error occurred:", err);
    pool.end();
});
