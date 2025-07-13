// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER (V2)
// =================================================================
// This version includes expanded endpoints to serve real user data
// for the dashboard, including stats, mastery, and achievements.
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

  CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE user_stats (
    user_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    points INT DEFAULT 0,
    current_streak INT DEFAULT 0,
    last_study_date DATE,
    level INT DEFAULT 1,
    readiness INT DEFAULT 0
  );
  
  CREATE TABLE user_mastery (
    mastery_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    topic_name VARCHAR(255) NOT NULL,
    mastery_score INT NOT NULL DEFAULT 0,
    UNIQUE(user_id, topic_name)
  );
  
  CREATE TABLE user_achievements (
    achievement_id VARCHAR(50) NOT NULL,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
  );

  -- You can pre-populate the mastery table for new users
  -- with a function or trigger after they register.
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

// GET /api/user/data - Get all of the logged-in user's data
app.get('/api/user/data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Fetch all data in parallel
    const [statsRes, masteryRes, achievementsRes] = await Promise.all([
        pool.query('SELECT * FROM user_stats WHERE user_id = $1', [userId]),
        pool.query('SELECT topic_name, mastery_score FROM user_mastery WHERE user_id = $1', [userId]),
        pool.query('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId])
    ]);

    if (statsRes.rows.length === 0) {
        return res.status(404).json({ message: 'User data not found.' });
    }

    // Format the data as the frontend expects
    const mastery = masteryRes.rows.reduce((acc, row) => {
        acc[row.topic_name] = row.mastery_score;
        return acc;
    }, {});
    
    const unlockedAchievements = achievementsRes.rows.map(row => row.achievement_id);

    res.json({
        stats: statsRes.rows[0],
        mastery: mastery,
        unlockedAchievements: unlockedAchievements,
        // The plan is still mock for now, but would be fetched here
        planSettings: null, 
        personalizedPlan: null
    });

  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});


// --- 6. START THE SERVER ---
app.listen(port, () => {
  console.log(`NBHWC Backend Server is running on http://localhost:${port}`);
});
