// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER (FINAL VERSION)
// =================================================================
// This version includes all necessary API endpoints for quizzes,
// flashcards, scenarios, and other interactive content.
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

// --- MOCK CONTENT DATABASE ---
// In a real-world scenario, this data would be loaded from the PostgreSQL database.
// For this prototype, it's included here to ensure all features are functional.
const contentDB = {
    topics: [
        { id: 1, name: 'Coaching Structure' },
        { id: 5, name: 'Motivational Interviewing' },
        { id: 6, name: 'SMART Goals' },
        { id: 7, name: 'HIPAA Basics' },
    ],
    questions: {
        'Motivational Interviewing': [
            { id: 1, question: "Which is a core principle of MI?", options: ["Expressing empathy", "Giving advice"], answer: "Expressing empathy", explanation: "Expressing empathy involves seeing the world from the client's perspective and communicating that understanding.", eli5: "It means showing you understand how someone feels." },
            { id: 2, question: "What is 'rolling with resistance'?", options: ["Arguing with the client", "Accepting client's reluctance"], answer: "Accepting client's reluctance", explanation: "Resistance is a signal to change strategies. Instead of confronting it, the coach 'rolls with it' to avoid a power struggle.", eli5: "Instead of fighting when someone says 'I can't,' you say 'Okay, let's talk about that.'" },
            { id: 3, question: "Change talk is elicited from the...", options: ["Coach", "Client"], answer: "Client", explanation: "The coach's job is to evoke and strengthen the client's own arguments for change.", eli5: "You help the person say why *they* want to change." },
        ],
        'SMART Goals': [
            { id: 5, question: "What does 'S' in SMART stand for?", options: ["Specific", "Simple"], answer: "Specific", explanation: "A specific goal has a much greater chance of being accomplished than a general goal.", eli5: "Instead of 'be healthier,' you say exactly *what* you'll do." },
        ],
    },
    flashcards: {
        'mi': { id: 'mi', name: 'Motivational Interviewing', cards: [
            { id: 1, term: 'Empathy', definition: 'The ability to understand and share the feelings of another from their perspective.' },
            { id: 2, term: 'Change Talk', definition: 'Any self-expressed language that is an argument for change.' },
        ]},
        'smart': { id: 'smart', name: 'SMART Goals', cards: [
            { id: 4, term: 'Specific', definition: 'The goal is clear and unambiguous, answering who, what, where, and why.' },
        ]},
    },
    scenarios: {
        1: {
            title: "Handling Client Resistance",
            startNode: 'start',
            nodes: {
                'start': { prompt: "Your client says, 'I know I should exercise, but I just don't feel like it.' What's your first response?", choices: [ { text: "Don't worry, you can try again next week.", nextNode: 'reassurance' }, { text: "It sounds like you're feeling discouraged.", nextNode: 'reflection' } ] },
                'reassurance': { prompt: "The client still seems disengaged. This response was okay, but glossed over her feelings. What's a better approach?", choices: [ { text: "Let's explore that feeling of discouragement.", nextNode: 'reflection' } ] },
                'reflection': { prompt: "The client opens up. 'Yes, that's exactly it! I feel like a failure.' You've built trust. What's next?", choices: [ { text: "What would one small win look like this week?", nextNode: 'end_positive' } ] },
                'end_positive': { prompt: "You've successfully navigated the conversation. Excellent work!", choices: [], end: "You used reflective listening to validate the client's feelings." },
            }
        }
    },
    puzzles: {
        1: {
            title: 'The Coaching Session Flow',
            correctOrder: ['Establish Trust & Rapport', 'Create Coaching Agreement', 'Explore Client\'s Vision & Goals', 'Co-create Action Plan', 'Manage Progress & Accountability'],
            items: ['Explore Client\'s Vision & Goals', 'Manage Progress & Accountability', 'Establish Trust & Rapport', 'Co-create Action Plan', 'Create Coaching Agreement']
        }
    }
};

// --- AUTHENTICATION MIDDLEWARE ---
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

// --- API ROUTES ---
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
        await client.query('INSERT INTO user_stats (user_id) VALUES ($1)', [userId]);
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
    res.json({ stats: statsRes.rows[0], mastery, unlockedAchievements });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/quizzes', authenticateToken, (req, res) => {
    const { topic, duration } = req.body;
    const numQuestions = Math.max(3, Math.floor(duration / 1.5));
    const allTopicQuestions = contentDB.questions[topic] || [];
    const shuffled = allTopicQuestions.sort(() => 0.5 - Math.random());
    res.json(shuffled.slice(0, numQuestions));
});

app.get('/api/flashcards/decks', authenticateToken, (req, res) => {
    const decks = Object.values(contentDB.flashcards).map(deck => ({ id: deck.id, name: deck.name }));
    res.json(decks);
});

app.get('/api/flashcards/decks/:deckId', authenticateToken, (req, res) => {
    const { deckId } = req.params;
    const deck = contentDB.flashcards[deckId];
    if (deck) res.json(deck.cards);
    else res.status(404).json({ message: 'Deck not found' });
});

app.get('/api/scenarios/:id', authenticateToken, (req, res) => {
    const scenario = contentDB.scenarios[req.params.id];
    if (scenario) res.json(scenario);
    else res.status(404).json({ message: 'Scenario not found' });
});

app.get('/api/puzzles/:id', authenticateToken, (req, res) => {
    const puzzle = contentDB.puzzles[req.params.id];
    if (puzzle) res.json(puzzle);
    else res.status(404).json({ message: 'Puzzle not found' });
});

// --- 6. START THE SERVER ---
app.listen(port, () => {
  console.log(`NBHWC Backend Server is running on http://localhost:${port}`);
});
