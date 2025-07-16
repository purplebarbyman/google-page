// =================================================================
// NBHWC PLATFORM - CSV IMPORTER SCRIPT (Corrected)
// =================================================================
// This is a one-time use script to read questions from a CSV file
// and insert them into your live PostgreSQL database on Render.
// This version corrects the load order for environment variables.
// =================================================================

// Load environment variables from .env file immediately. This MUST be the first line.
require('dotenv').config(); 

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Pool } = require('pg');

// --- DATABASE CONNECTION ---
// Now that dotenv has run, process.env.DATABASE_URL will be correctly populated.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const csvFilePath = path.join(process.cwd(), 'questions.csv');
const questions = [];

console.log('Starting to read CSV file...');

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (data) => {
    // This assumes your CSV has these exact column names
    const questionData = {
      topic: data.topic,
      question: data.question,
      options: [data.option1, data.option2, data.option3, data.option4].filter(Boolean), // Filter out empty options
      correctAnswerIndex: parseInt(data.correct_answer_index, 10),
      explanation: data.explanation,
      eli5: data.eli5,
      difficulty: parseInt(data.difficulty, 10) || 2, // Default difficulty to 2 if not specified
    };
    questions.push(questionData);
  })
  .on('end', async () => {
    console.log(`CSV file successfully processed. Found ${questions.length} questions.`);
    console.log('Connecting to the database...');
    
    const client = await pool.connect();
    console.log('Database connection established.');

    try {
      await client.query('BEGIN');
      console.log('Starting database transaction...');

      // Clear existing questions to avoid duplicates if you run this multiple times
      console.log('Clearing existing questions...');
      await client.query('DELETE FROM question_options');
      await client.query('DELETE FROM questions');
      await client.query('DELETE FROM topics');
      console.log('Existing questions cleared.');

      // Using a Map to ensure topics are only inserted once
      const topicMap = new Map();

      for (const q of questions) {
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

        for (let i = 0; i < q.options.length; i++) {
          await client.query(
            'INSERT INTO question_options (question_id, option_text, is_correct) VALUES ($1, $2, $3)',
            [questionId, q.options[i], i === q.correctAnswerIndex]
          );
        }
      }

      await client.query('COMMIT');
      console.log(`Successfully inserted ${questions.length} questions into the database.`);

    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Database transaction failed. Rolled back.', e);
    } finally {
      client.release();
      console.log('Database connection closed.');
      pool.end();
    }
  });
