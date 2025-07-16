// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER (V7)
// =================================================================
// This version moves quiz submission and progress tracking to the
// backend to enable live analytics.
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

// --- MOCK DATABASE (for content, as DB is not populated yet) ---
const contentDB = {
    topics: [
        { id: 1, name: 'Coaching Structure' },
        { id: 2, name: 'Coaching Process' },
        { id: 3, name: 'Health & Wellness' },
        { id: 4, name: 'Ethics, Legal & Professional Responsibility' },
        { id: 5, name: 'Motivational Interviewing' },
        { id: 6, name: 'SMART Goals' },
        { id: 7, name: 'HIPAA Basics' },
    ],
    questions: {
        'Motivational Interviewing': [
            { id: 1, question: "Which is a core principle of MI?", options: ["Expressing empathy", "Giving advice"], answer: "Expressing empathy", explanation: "Expressing empathy involves seeing the world from the client's perspective and communicating that understanding. It's foundational to building trust and is a core part of the MI spirit.", eli5: "It means showing you understand how someone feels." },
            { id: 2, question: "What is 'rolling with resistance'?", options: ["Arguing with the client", "Accepting client's reluctance"], answer: "Accepting client's reluctance", explanation: "Resistance is a signal to change strategies. Instead of confronting it, the coach 'rolls with it' to avoid a power struggle.", eli5: "Instead of fighting when someone says 'I can't,' you say 'Okay, let's talk about that.'" },
        ],
        'SMART Goals': [
            { id: 5, question: "What does 'S' in SMART stand for?", options: ["Specific", "Simple"], answer: "Specific", explanation: "A specific goal has a much greater chance of being accomplished than a general goal.", eli5: "Instead of 'be healthier,' you say exactly *what* you'll do." },
        ],
    },
    flashcards: {
        'mi': { name: 'Motivational Interviewing', cards: [
            { id: 1, term: 'Empathy', definition: 'The ability to understand and share the feelings of another from their perspective.' },
            { id: 2, term: 'Change Talk', definition: 'Any self-expressed language that is an argument for change.' },
        ]},
        'smart': { name: 'SMART Goals', cards: [
            { id: 4, term: 'Specific', definition: 'The goal is clear and unambiguous, answering who, what, where, and why.' },
        ]},
    }
};

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
        for (const topic of contentDB.topics) {
            await client.query('INSERT INTO user_mastery (user_id, topic_name, mastery_score) VALUES ($1, $2, 0)', [userId, topic.name]);
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

    const mastery = masteryRes.rows.reduce((acc, row) => {
        acc[row.topic_name] = row.mastery_score;
        return acc;
    }, {});
    
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
        
        const allTopicQuestions = contentDB.questions[topic] || [];
        const shuffled = allTopicQuestions.sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffled.slice(0, numQuestions);

        res.json(selectedQuestions);

    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// --- NEW QUIZ SUBMISSION ROUTE ---
app.post('/api/quizzes/submit', authenticateToken, async (req, res) => {
    const { topic, correctAnswers, totalQuestions } = req.body;
    const userId = req.user.userId;
    const score = (correctAnswers / totalQuestions) * 100;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Update points
        const pointsEarned = (correctAnswers * 10) + (score === 100 ? 50 : 0);
        await client.query('UPDATE user_stats SET points = points + $1 WHERE user_id = $2', [pointsEarned, userId]);

        // 2. Update mastery
        const masteryResult = await client.query('SELECT mastery_score FROM user_mastery WHERE user_id = $1 AND topic_name = $2', [userId, topic]);
        const currentMastery = masteryResult.rows[0]?.mastery_score || 0;
        const newMastery = Math.min(100, Math.round(currentMastery + (score / 100 * 20))); // Increased impact
        await client.query(
            'UPDATE user_mastery SET mastery_score = $1 WHERE user_id = $2 AND topic_name = $3',
            [newMastery, userId, topic]
        );
        
        // 3. Log mastery history for analytics
        await client.query(
            'INSERT INTO user_mastery_history (user_id, topic_name, mastery_score) VALUES ($1, $2, $3)',
            [userId, topic, newMastery]
        );

        // 4. Check for new achievements (simplified for now)
        // In a real app, this would be more robust
        
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

// --- NEW ANALYTICS ROUTE ---
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
