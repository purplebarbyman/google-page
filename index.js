// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER (V6)
// =================================================================
// This version adds live API endpoints for serving flashcard content,
// moving it from the frontend mock to the backend.
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
            { id: 3, term: 'Rolling with Resistance', definition: 'A strategy of not directly opposing client resistance but rather flowing with it.' },
        ]},
        'smart': { name: 'SMART Goals', cards: [
            { id: 4, term: 'Specific', definition: 'The goal is clear and unambiguous, answering who, what, where, and why.' },
            { id: 5, term: 'Measurable', definition: 'The goal has concrete criteria for tracking progress.' },
            { id: 6, term: 'Achievable', definition: 'The goal is realistic and attainable for the individual.' },
        ]},
        'ethics': { name: 'Core Ethics', cards: [
            { id: 9, term: 'Confidentiality', definition: 'The ethical duty to keep client information private.' },
            { id: 10, term: 'Scope of Practice', definition: 'The procedures, actions, and processes that a professional is permitted to undertake.' },
        ]}
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

// --- NEW FLASHCARD ROUTES ---
app.get('/api/flashcards/decks', authenticateToken, (req, res) => {
    const decks = Object.keys(contentDB.flashcards).map(id => ({
        id: id,
        name: contentDB.flashcards[id].name
    }));
    res.json(decks);
});

app.get('/api/flashcards/decks/:deckId', authenticateToken, (req, res) => {
    const { deckId } = req.params;
    const deck = contentDB.flashcards[deckId];
    if (deck) {
        res.json(deck.cards);
    } else {
        res.status(404).json({ message: 'Deck not found' });
    }
});


// --- 6. START THE SERVER ---
app.listen(port, () => {
  console.log(`NBHWC Backend Server is running on http://localhost:${port}`);
});
