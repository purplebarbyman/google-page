// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER (FINAL VERSION)
// =================================================================
// This is the production-ready backend. It reads all content,
// including quizzes and user data, directly from the PostgreSQL
// database. All mock data has been removed.
// =================================================================

// --- 1. IMPORTS & SETUP ---
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// --- 2. CONFIGURATION & MIDDLEWARE ---
app.use(express.json());
app.use(cors());

// --- DATABASE CONNECTION ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- JWT CONFIGURATION ---
const JWT_SECRET = process.env.JWT_SECRET || 'a-very-secret-and-secure-key-for-development';

// --- 4. AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- 5. API ROUTES ---

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ message: 'All fields are required.' });
    
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) return res.status(409).json({ message: 'Email already exists.' });
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const newUserQuery = 'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, email, full_name';
        const newUser = await client.query(newUserQuery, [fullName, email, passwordHash]);
        const userId = newUser.rows[0].user_id;

        await client.query('INSERT INTO user_stats (user_id, points, current_streak, level, readiness) VALUES ($1, 0, 0, 1, 5)', [userId]);
        
        const topicsResult = await client.query('SELECT topic_name FROM topics');
        for (const row of topicsResult.rows) {
            await client.query('INSERT INTO user_mastery (user_id, topic_name, mastery_score) VALUES ($1, $2, 0)', [userId, row.topic_name]);
        }

        await client.query('COMMIT');
        res.status(201).json(newUser.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    const payload = { userId: user.user_id, email: user.email, name: user.full_name };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: payload });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// --- DATA ROUTES ---

app.get('/api/user/data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [statsRes, masteryRes, achievementsRes] = await Promise.all([
        pool.query('SELECT * FROM user_stats WHERE user_id = $1', [userId]),
        pool.query('SELECT topic_name, mastery_score FROM user_mastery WHERE user_id = $1', [userId]),
        pool.query('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId])
    ]);

    if (statsRes.rows.length === 0) return res.status(404).json({ message: 'User data not found.' });

    const mastery = masteryRes.rows.reduce((acc, row) => ({...acc, [row.topic_name]: row.mastery_score }), {});
    const unlockedAchievements = achievementsRes.rows.map(row => row.achievement_id);

    res.json({
        stats: statsRes.rows[0],
        mastery: mastery,
        unlockedAchievements: unlockedAchievements
    });

  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/quizzes', authenticateToken, async (req, res) => {
    try {
        const { topic, duration } = req.body;
        const numQuestions = Math.max(3, Math.floor(duration / 1.5));

        const questionsQuery = `
            SELECT q.question_id, q.question_text, q.explanation, q.eli5_explanation,
                   (SELECT json_agg(o) FROM (SELECT option_text, is_correct FROM question_options WHERE question_id = q.question_id ORDER BY random()) o) as options
            FROM questions q
            JOIN topics t ON q.topic_id = t.topic_id
            WHERE t.topic_name = $1
            ORDER BY RANDOM()
            LIMIT $2;
        `;
        
        const questionsResult = await pool.query(questionsQuery, [topic, numQuestions]);
        
        if (questionsResult.rows.length === 0) {
            return res.status(404).json({ message: `No questions found for topic: ${topic}`});
        }
        
        const formattedQuestions = questionsResult.rows.map(q => {
            const correctAnswer = q.options.find(opt => opt.is_correct);
            if (!correctAnswer) {
                console.error(`Question ID ${q.question_id} is missing a correct answer.`);
                return null; // Skip this question if it's malformed
            }
            return {
                id: q.question_id,
                question: q.question_text,
                explanation: q.explanation,
                eli5: q.eli5_explanation,
                answer: correctAnswer.option_text,
                options: q.options.map(opt => opt.option_text)
            };
        }).filter(Boolean); // Remove any null questions
        
        res.json(formattedQuestions);

    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.post('/api/quizzes/submit', authenticateToken, async (req, res) => {
    const { topic, correctAnswers, totalQuestions } = req.body;
    const userId = req.user.userId;
    const score = (correctAnswers / totalQuestions) * 100;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const pointsEarned = (correctAnswers * 10) + (score === 100 ? 50 : 0);
        await client.query('UPDATE user_stats SET points = points + $1 WHERE user_id = $2', [pointsEarned, userId]);

        const masteryResult = await client.query('SELECT mastery_score FROM user_mastery WHERE user_id = $1 AND topic_name = $2', [userId, topic]);
        const currentMastery = masteryResult.rows[0]?.mastery_score || 0;
        const newMastery = Math.min(100, Math.round(currentMastery + (score / 100 * 20)));
        await client.query(
            'UPDATE user_mastery SET mastery_score = $1 WHERE user_id = $2 AND topic_name = $3',
            [newMastery, userId, topic]
        );
        
        await client.query(
            'INSERT INTO user_mastery_history (user_id, topic_name, mastery_score) VALUES ($1, $2, $3)',
            [userId, topic, newMastery]
        );
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Progress saved successfully.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting quiz:', error);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        client.release();
    }
});

app.get('/api/analytics/mastery-trend', authenticateToken, async (req, res) => {
    const { topic } = req.query;
    const userId = req.user.userId;

    if (!topic) {
        return res.status(400).json({ message: 'A topic is required.' });
    }

    try {
        const result = await pool.query(
            'SELECT mastery_score, recorded_at FROM user_mastery_history WHERE user_id = $1 AND topic_name = $2 ORDER BY recorded_at ASC',
            [userId, topic]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching mastery trend:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// --- 6. START THE SERVER ---
app.listen(port, () => {
  console.log(`NBHWC Backend Server is running on http://localhost:${port}`);
});
