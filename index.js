// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER (V3)
// =================================================================
// This version includes a new endpoint for generating quizzes
// with a dynamic number of questions based on requested duration.
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
// Render provides the DATABASE_URL environment variable automatically.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- JWT CONFIGURATION ---
const JWT_SECRET = process.env.JWT_SECRET || 'a-very-secret-and-secure-key-for-development';


// =================================================================
// --- 3. DATABASE SCHEMA (For Reference) ---
// =================================================================
/*
  This backend assumes the following PostgreSQL tables exist.
  You would run these CREATE TABLE commands in your database once.

  CREATE TABLE users (...);
  CREATE TABLE user_stats (...);
  CREATE TABLE user_mastery (...);
  CREATE TABLE user_achievements (...);

  CREATE TABLE topics (
    topic_id SERIAL PRIMARY KEY,
    topic_name VARCHAR(255) UNIQUE NOT NULL
  );

  CREATE TABLE questions (
    question_id SERIAL PRIMARY KEY,
    topic_id INT NOT NULL REFERENCES topics(topic_id),
    question_text TEXT NOT NULL,
    difficulty INT NOT NULL, -- 1 to 5
    explanation TEXT,
    eli5_explanation TEXT
  );

  CREATE TABLE question_options (
    option_id SERIAL PRIMARY KEY,
    question_id INT NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    option_text VARCHAR(255) NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false
  );
*/
// =================================================================


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


// =================================================================
// --- 5. API ROUTES ---
// =================================================================

// --- AUTHENTICATION ROUTES ---
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

        // Initialize stats and mastery for the new user
        await client.query('INSERT INTO user_stats (user_id, points, current_streak) VALUES ($1, 0, 0)', [userId]);
        const topics = ['Coaching Structure', 'Coaching Process', 'Health & Wellness', 'Ethics, Legal & Professional Responsibility', 'Motivational Interviewing', 'SMART Goals', 'HIPAA Basics'];
        for (const topic of topics) {
            await client.query('INSERT INTO user_mastery (user_id, topic_name, mastery_score) VALUES ($1, $2, 0)', [userId, topic]);
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
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: payload });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});


// --- PROTECTED DATA ROUTES ---

app.get('/api/user/data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [statsRes, masteryRes, achievementsRes] = await Promise.all([
        pool.query('SELECT * FROM user_stats WHERE user_id = $1', [userId]),
        pool.query('SELECT topic_name, mastery_score FROM user_mastery WHERE user_id = $1', [userId]),
        pool.query('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId])
    ]);

    if (statsRes.rows.length === 0) return res.status(404).json({ message: 'User data not found.' });

    const mastery = masteryRes.rows.reduce((acc, row) => {
        acc[row.topic_name] = row.mastery_score;
        return acc;
    }, {});
    
    const unlockedAchievements = achievementsRes.rows.map(row => row.achievement_id);

    res.json({
        stats: statsRes.rows[0],
        mastery: mastery,
        unlockedAchievements: unlockedAchievements,
        planSettings: null, 
        personalizedPlan: null
    });

  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /api/quizzes - Generate a new quiz
app.post('/api/quizzes', authenticateToken, async (req, res) => {
    try {
        const { topic, duration } = req.body;
        const userId = req.user.userId;

        // Simple logic: assume 1.5 minutes per question
        const numQuestions = Math.max(1, Math.floor(duration / 1.5));

        // In a real app, you would have a much more sophisticated query here
        // that uses the adaptive logic from our blueprint (checking mastery, etc.)
        // For now, we'll just grab random questions on the topic.
        // This part of the code assumes you have populated your database with questions.
        // Since we haven't done that, this will return an empty array.
        // We will rely on the frontend's mockApi for quiz questions for now.
        
        // This is a placeholder for where the real database query would go.
        const questionsFromDb = []; // This would be populated from your DB.

        // If the database has no questions for the topic, we fall back to the mock.
        if (questionsFromDb.length === 0) {
            console.log(`No questions found in DB for topic "${topic}". Falling back to mock data.`);
            const mockQuestions = await getMockQuestions(topic, userId, numQuestions);
            return res.json(mockQuestions);
        }
        
        // This part would format the questions from the DB if they existed.
        const formattedQuestions = questionsFromDb.map(q => ({
            id: q.question_id,
            question: q.question_text,
            explanation: q.explanation,
            eli5: q.eli5_explanation,
            answer: q.options.find(opt => opt.is_correct).option_text,
            options: q.options.map(opt => opt.option_text).sort(() => Math.random() - 0.5)
        }));

        res.json(formattedQuestions);

    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Helper function to get mock questions (as our DB is empty)
async function getMockQuestions(topic, userId, numQuestions) {
    // This function simulates the logic that would exist in a real app
    // to generate questions when the database is not yet populated.
    const allQuestions = {
        'Motivational Interviewing': [
            { id: 1, question: "Which is a core principle of MI?", options: ["Expressing empathy", "Giving advice"], answer: "Expressing empathy", difficulty: 'easy', explanation: "Expressing empathy involves seeing the world from the client's perspective and communicating that understanding. It's foundational to building trust and is a core part of the MI spirit.", eli5: "It means showing you understand how someone feels, like saying 'that sounds really tough' instead of just telling them what to do." },
            { id: 2, question: "What is 'rolling with resistance'?", options: ["Arguing with the client", "Accepting client's reluctance"], answer: "Accepting client's reluctance", difficulty: 'medium', explanation: "Resistance is a signal to change strategies. Instead of confronting it, the coach 'rolls with it,' acknowledging the client's perspective without judgment to avoid a power struggle.", eli5: "Instead of fighting when someone says 'I can't,' you say 'Okay, let's talk about that.' You don't push back." },
            { id: 3, question: "Change talk is elicited from the...", options: ["Coach", "Client"], answer: "Client", difficulty: 'easy', explanation: "The coach's job is to evoke and strengthen the client's own arguments for change. People are more persuaded by the reasons they discover themselves.", eli5: "You help the person say why *they* want to change, instead of you telling them why they should." },
        ],
        'SMART Goals': [
            { id: 5, question: "What does 'S' in SMART stand for?", options: ["Specific", "Simple"], answer: "Specific", difficulty: 'easy', explanation: "A specific goal has a much greater chance of being accomplished than a general goal. It answers the questions: Who? What? Where? When? Why?", eli5: "Instead of 'be healthier,' you say exactly *what* you'll do, like 'eat one apple every day.'" },
        ]
    };
    const topicQuestions = allQuestions[topic] || [];
    return topicQuestions.slice(0, numQuestions);
}


// --- 6. START THE SERVER ---
app.listen(port, () => {
  console.log(`NBHWC Backend Server is running on http://localhost:${port}`);
});
