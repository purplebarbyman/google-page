// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER (V4)
// =================================================================
// This version includes a much larger, more realistic set of mock
// questions and topics to simulate a populated database and provide
// a richer, less repetitive user experience.
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
            { id: 1, question: "Which is a core principle of MI?", options: ["Expressing empathy", "Giving advice"], answer: "Expressing empathy", explanation: "Expressing empathy is foundational to building trust and is a core part of the MI spirit.", eli5: "It means showing you understand how someone feels." },
            { id: 2, question: "What is 'rolling with resistance'?", options: ["Arguing with the client", "Accepting client's reluctance"], answer: "Accepting client's reluctance", explanation: "Resistance is a signal to change strategies. Instead of confronting it, the coach 'rolls with it' to avoid a power struggle.", eli5: "Instead of fighting when someone says 'I can't,' you say 'Okay, let's talk about that.'" },
            { id: 3, question: "Change talk is elicited from the...", options: ["Coach", "Client"], answer: "Client", explanation: "The coach's job is to evoke and strengthen the client's own arguments for change.", eli5: "You help the person say why *they* want to change." },
            { id: 4, question: "The 'D' in DARN CAT stands for:", options: ["Desire", "Decision"], answer: "Desire", explanation: "DARN CAT is a mnemonic for types of change talk. 'D' stands for Desire (e.g., 'I want to...').", eli5: "'D' is for 'Desire,' like 'I wish I could...'" },
            { id: 12, question: "OARS stands for Open questions, Affirmations, Reflections, and...?", options: ["Summaries", "Solutions"], answer: "Summaries", explanation: "OARS is a set of fundamental communication skills in MI.", eli5: "OARS are the basic tools for a good coaching chat." },
        ],
        'SMART Goals': [
            { id: 5, question: "What does 'S' in SMART stand for?", options: ["Specific", "Simple"], answer: "Specific", explanation: "A specific goal has a much greater chance of being accomplished than a general goal.", eli5: "Instead of 'be healthier,' you say exactly *what* you'll do." },
            { id: 6, question: "Which goal is most 'Measurable'?", options: ["'I will exercise more'", "'I will walk 3 times a week for 30 minutes'"], answer: "'I will walk 3 times a week for 30 minutes'", explanation: "A measurable goal allows you to track your progress.", eli5: "You can count '3 times a week.' You can't easily count 'more.'" },
            { id: 7, question: "'T' in SMART?", options: ["Time-bound", "Truthful"], answer: "Time-bound", explanation: "A time-bound goal has a target date, creating urgency.", eli5: "It means you set a deadline." },
            { id: 13, question: "'A' in SMART?", options: ["Achievable", "Ambitious"], answer: "Achievable", explanation: "The goal should be realistic and attainable for the individual.", eli5: "It means it's something you can actually do." },
            { id: 14, question: "'R' in SMART?", options: ["Relevant", "Realistic"], answer: "Relevant", explanation: "The goal matters to the individual and aligns with their broader objectives.", eli5: "It means the goal is important to you." },
        ],
        'HIPAA Basics': [
            { id: 8, question: "What does HIPAA stand for?", options: ["Health Info Portability & Accountability Act", "Health Insurance Privacy & Access Act"], answer: "Health Info Portability & Accountability Act", explanation: "HIPAA is a federal law that protects sensitive patient health information.", eli5: "It's the law that says doctors must keep your health info private." },
            { id: 9, question: "Which is considered PHI?", options: ["A client's name", "Public data"], answer: "A client's name", explanation: "Any information that can be used to identify an individual and relates to their health is PHI.", eli5: "If it's about your health and has your name on it, it's private." },
            { id: 10, question: "Can a coach share client info without consent?", options: ["Yes, if it helps the client", "No, not without explicit consent"], answer: "No, not without explicit consent", explanation: "Sharing PHI without written authorization is a violation of HIPAA.", eli5: "You can't tell anyone about a client's health stuff unless they say it's okay in writing." },
            { id: 11, question: "A 'business associate' under HIPAA must also...?", options: ["Protect PHI", "Ignore PHI"], answer: "Protect PHI", explanation: "Business associates are also directly liable under HIPAA and must protect any PHI they handle.", eli5: "If a company helps a doctor, that company also has to keep patient info safe." },
        ]
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
        const numQuestions = Math.max(1, Math.floor(duration / 1.5));
        
        const allTopicQuestions = contentDB.questions[topic] || [];
        
        // Shuffle and slice to get a random assortment of the requested length
        const shuffled = allTopicQuestions.sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffled.slice(0, numQuestions);

        res.json(selectedQuestions);

    } catch (error) {
        console.error('Error generating quiz:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


// --- 6. START THE SERVER ---
app.listen(port, () => {
  console.log(`NBHWC Backend Server is running on http://localhost:${port}`);
});
