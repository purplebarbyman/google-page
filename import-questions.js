// =================================================================
// NBHWC PLATFORM - CSV IMPORTER SCRIPT (Batch Processing Version)
// =================================================================
// This version processes the CSV in batches to prevent timeouts
// and provide progress updates for large files.
// =================================================================

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Pool } = require('pg');

// --- DATABASE CONNECTION ---
// PASTE YOUR FULL EXTERNAL DATABASE URL FROM RENDER INSIDE THE QUOTES.
const connectionString = "postgresql://nbhwc_database_user:hXvbl1bm6yIXXz68YERj2zaeo86NvIlE@dpg-d1ptic7fte5s73co1qsg-a.oregon-postgres.render.com/nbhwc_database"; 

if (connectionString === "YOUR_DATABASE_URL_HERE" || !connectionString) {
    console.error("ERROR: Please replace 'YOUR_DATABASE_URL_HERE' in the import-questions.js file with your actual database URL from Render.");
    process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const csvFilePath = path.join(process.cwd(), 'questions.csv');

async function processCSV() {
  const questions = [];

  console.log('Starting to read CSV file...');

  const stream = fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
      const questionData = {
        topic: data.topic,
        question: data.question,
        options: [data.option1, data.option2, data.option3, data.option4].filter(Boolean),
        correctAnswerIndex: parseInt(data.correct_answer_index, 10),
        explanation: data.explanation,
        eli5: data.eli5,
        difficulty: parseInt(data.difficulty, 10) || 2,
      };
      questions.push(questionData);
    });

  await new Promise((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  console.log(`CSV file successfully processed. Found ${questions.length} questions.`);
  
  if (questions.length === 0) {
    console.log('No questions found to import. Exiting.');
    return;
  }

  console.log('Connecting to the database...');
  const client = await pool.connect();
  console.log('Database connection established.');

  try {
    console.log('Ensuring database tables exist...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users ( user_id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(255), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );
      CREATE TABLE IF NOT EXISTS user_stats ( user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE, points INT DEFAULT 0, current_streak INT DEFAULT 0, last_study_date DATE, level INT DEFAULT 1, readiness INT DEFAULT 0 );
      CREATE TABLE IF NOT EXISTS topics ( topic_id SERIAL PRIMARY KEY, topic_name VARCHAR(255) UNIQUE NOT NULL );
      CREATE TABLE IF NOT EXISTS questions ( question_id SERIAL PRIMARY KEY, topic_id INT NOT NULL REFERENCES topics(topic_id), question_text TEXT NOT NULL, difficulty INT NOT NULL, explanation TEXT, eli5_explanation TEXT );
      CREATE TABLE IF NOT EXISTS question_options ( option_id SERIAL PRIMARY KEY, question_id INT NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE, option_text VARCHAR(255) NOT NULL, is_correct BOOLEAN NOT NULL DEFAULT false );
      CREATE TABLE IF NOT EXISTS user_mastery ( mastery_id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, topic_name VARCHAR(255) NOT NULL, mastery_score INT NOT NULL DEFAULT 0, UNIQUE(user_id, topic_name) );
      CREATE TABLE IF NOT EXISTS user_achievements ( achievement_id VARCHAR(50) NOT NULL, user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, achievement_id) );
      CREATE TABLE IF NOT EXISTS user_mastery_history ( history_id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, topic_name VARCHAR(255) NOT NULL, mastery_score INT NOT NULL, recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );
    `);
    console.log('Tables verified/created successfully.');
    
    await client.query('BEGIN');
    console.log('Clearing existing questions...');
    await client.query('DELETE FROM question_options');
    await client.query('DELETE FROM questions');
    await client.query('DELETE FROM topics');
    await client.query('COMMIT');
    console.log('Existing questions cleared.');

    const topicMap = new Map();
    const batchSize = 100;
    const totalBatches = Math.ceil(questions.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
        const batch = questions.slice(i * batchSize, (i + 1) * batchSize);
        console.log(`Processing batch ${i + 1} of ${totalBatches}...`);

        await client.query('BEGIN');
        for (const q of batch) {
            let topicId;
            if (topicMap.has(q.topic)) {
                topicId = topicMap.get(q.topic);
            } else {
                const topicResult = await client.query(
                    'INSERT INTO topics (topic_name) VALUES ($1) ON CONFLICT (topic_name) DO UPDATE SET topic_name = EXCLUDED.topic_name RETURNING topic_id',
                    [q.topic]
                );
                topicId = topicResult.rows[0].topic_id;
                topicMap.set(q.topic, topicId);
            }

            const questionResult = await client.query(
                'INSERT INTO questions (topic_id, question_text, difficulty, explanation, eli5_explanation) VALUES ($1, $2, $3, $4, $5) RETURNING question_id',
                [topicId, q.question, q.difficulty, q.explanation, q.eli5]
            );
            const questionId = questionResult.rows[0].question_id;

            for (let j = 0; j < q.options.length; j++) {
                await client.query(
                    'INSERT INTO question_options (question_id, option_text, is_correct) VALUES ($1, $2, $3)',
                    [questionId, q.options[j], j === q.correctAnswerIndex]
                );
            }
        }
        await client.query('COMMIT');
        console.log(`Batch ${i + 1} successfully inserted.`);
    }

    console.log(`Successfully inserted all ${questions.length} questions into the database.`);

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
processCSV().catch(err => {
    console.error("An unhandled error occurred:", err);
    pool.end();
});
