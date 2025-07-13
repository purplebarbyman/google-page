// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER (V5)
// =================================================================
// This version includes a significantly expanded mock content
// library to provide a richer, less repetitive user experience.
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
// In a real application, this data would be in your PostgreSQL database.
// We are expanding this section significantly to simulate a robust content library.
const contentDB = {
    topics: [
        { id: 1, name: 'Coaching Structure' },
        { id: 2, name: 'Coaching Process' },
        { id: 3, name: 'Health & Wellness' },
        { id: 4, name: 'Ethics, Legal & Professional Responsibility' },
        { id: 5, name: 'Motivational Interviewing' },
        { id: 6, name: 'SMART Goals' },
        { id: 7, name: 'HIPAA Basics' },
        { id: 8, name: 'Positive Psychology' },
        { id: 9, name: 'Sleep Science' },
        { id: 10, name: 'Nutrition Basics' },
    ],
    questions: {
        'Motivational Interviewing': [
            { id: 1, question: "Which is a core principle of MI?", options: ["Expressing empathy", "Giving advice"], answer: "Expressing empathy", explanation: "Expressing empathy involves seeing the world from the client's perspective and communicating that understanding. It's foundational to building trust and is a core part of the MI spirit.", eli5: "It means showing you understand how someone feels." },
            { id: 2, question: "What is 'rolling with resistance'?", options: ["Arguing with the client", "Accepting client's reluctance"], answer: "Accepting client's reluctance", explanation: "Resistance is a signal to change strategies. Instead of confronting it, the coach 'rolls with it' to avoid a power struggle.", eli5: "Instead of fighting when someone says 'I can't,' you say 'Okay, let's talk about that.'" },
            { id: 3, question: "Change talk is elicited from the...", options: ["Coach", "Client"], answer: "Client", explanation: "The coach's job is to evoke and strengthen the client's own arguments for change.", eli5: "You help the person say why *they* want to change." },
            { id: 4, question: "The 'D' in DARN CAT stands for:", options: ["Desire", "Decision"], answer: "Desire", explanation: "DARN CAT is a mnemonic for types of change talk. 'D' stands for Desire (e.g., 'I want to...').", eli5: "'D' is for 'Desire,' like 'I wish I could...'" },
            { id: 12, question: "OARS stands for Open questions, Affirmations, Reflections, and...?", options: ["Summaries", "Solutions"], answer: "Summaries", explanation: "OARS is a set of fundamental communication skills in MI.", eli5: "OARS are the basic tools for a good coaching chat." },
            { id: 15, question: "Which is an example of an Affirmation?", options: ["'You're so dedicated for coming today.'", "'Good job.'"], answer: "'You're so dedicated for coming today.'", explanation: "Affirmations should be specific and genuine, recognizing the client's strengths and efforts.", eli5: "It's like giving a specific compliment, not just a general one." },
            { id: 16, question: "A 'complex reflection' goes beyond what is stated and infers...", options: ["Meaning or feeling", "The next logical step"], answer: "Meaning or feeling", explanation: "A complex reflection adds meaning or reflects an unstated feeling, which can lead to deeper insights for the client.", eli5: "It's like guessing the 'why' behind what someone said." },
            { id: 18, question: "Developing discrepancy is about highlighting the gap between a client's current behavior and their...", options: ["Coach's expectations", "Core values and goals"], answer: "Core values and goals", explanation: "Motivation for change is enhanced when clients perceive a mismatch between where they are and where they want to be.", eli5: "It's showing the difference between what you're doing and what you say you want." },
            { id: 19, question: "Which question is most likely to elicit change talk?", options: ["'Why haven't you exercised?'", "'What are some of the good things about exercising?'"], answer: "'What are some of the good things about exercising?'", explanation: "Asking about the benefits of change (the pros) is a key strategy to evoke change talk.", eli5: "Asking about the good parts of changing makes people talk about why they should." },
            { id: 20, question: "The 'spirit' of MI is best described as:", options: ["Directive and authoritative", "Collaborative and evocative"], answer: "Collaborative and evocative", explanation: "MI is a partnership that honors the client's autonomy and is designed to draw out their own motivation and resources for change.", eli5: "It's about working together, not being a boss." },
        ],
        'SMART Goals': [
            { id: 5, question: "What does 'S' in SMART stand for?", options: ["Specific", "Simple"], answer: "Specific", explanation: "A specific goal has a much greater chance of being accomplished than a general goal.", eli5: "Instead of 'be healthier,' you say exactly *what* you'll do." },
            { id: 6, question: "Which goal is most 'Measurable'?", options: ["'I will exercise more'", "'I will walk 3 times a week for 30 minutes'"], answer: "'I will walk 3 times a week for 30 minutes'", explanation: "A measurable goal allows you to track your progress.", eli5: "You can count '3 times a week.' You can't easily count 'more.'" },
            { id: 7, question: "'T' in SMART?", options: ["Time-bound", "Truthful"], answer: "Time-bound", explanation: "A time-bound goal has a target date, creating urgency.", eli5: "It means you set a deadline." },
            { id: 13, question: "'A' in SMART?", options: ["Achievable", "Ambitious"], answer: "Achievable", explanation: "The goal should be realistic and attainable for the individual.", eli5: "It means it's something you can actually do." },
            { id: 14, question: "'R' in SMART?", options: ["Relevant", "Realistic"], answer: "Relevant", explanation: "The goal matters to the individual and aligns with their broader objectives.", eli5: "It means the goal is important to you." },
            { id: 17, question: "Which is the BEST example of a SMART goal?", options: ["'I will lose weight by next month.'", "'I will lose 5 pounds in 6 weeks by replacing soda with water and walking 4 times a week.'"], answer: "'I will lose 5 pounds in 6 weeks by replacing soda with water and walking 4 times a week.'", explanation: "This goal is Specific, Measurable, Achievable, Relevant, and Time-bound.", eli5: "This one has all the right pieces: what, how much, how, and by when." },
            { id: 21, question: "A goal of 'being happier' is not SMART because it is not...", options: ["Achievable", "Specific and Measurable"], answer: "Specific and Measurable", explanation: "'Happier' is subjective and not easily measured. A better goal would define what actions lead to happiness.", eli5: "You can't really measure 'happier' with a number." },
            { id: 22, question: "Setting a goal to 'run a marathon next week' when you don't currently run likely violates which SMART principle?", options: ["Relevant", "Achievable"], answer: "Achievable", explanation: "While ambitious, a goal must be realistic. Setting an unachievable goal leads to discouragement.", eli5: "It's probably not possible to go from zero to marathon in one week." },
        ],
        'HIPAA Basics': [
            { id: 8, question: "What does HIPAA stand for?", options: ["Health Info Portability & Accountability Act", "Health Insurance Privacy & Access Act"], answer: "Health Info Portability & Accountability Act", explanation: "HIPAA is a federal law that protects sensitive patient health information.", eli5: "It's the law that says doctors must keep your health info private." },
            { id: 9, question: "Which is considered PHI?", options: ["A client's name", "Public data"], answer: "A client's name", explanation: "Any information that can be used to identify an individual and relates to their health is PHI.", eli5: "If it's about your health and has your name on it, it's private." },
            { id: 10, question: "Can a coach share client info without consent?", options: ["Yes, if it helps the client", "No, not without explicit consent"], answer: "No, not without explicit consent", explanation: "Sharing PHI without written authorization is a violation of HIPAA.", eli5: "You can't tell anyone about a client's health stuff unless they say it's okay in writing." },
            { id: 11, question: "A 'business associate' under HIPAA must also...?", options: ["Protect PHI", "Ignore PHI"], answer: "Protect PHI", explanation: "Business associates are also directly liable under HIPAA and must protect any PHI they handle.", eli5: "If a company helps a doctor, that company also has to keep patient info safe." },
            { id: 23, question: "The 'Privacy Rule' of HIPAA primarily governs:", options: ["Data security standards", "The use and disclosure of PHI"], answer: "The use and disclosure of PHI", explanation: "The Privacy Rule sets the standards for who may have access to PHI.", eli5: "It's the part of the law about who is allowed to see your health information." },
            { id: 24, question: "The 'Security Rule' of HIPAA applies specifically to:", options: ["All PHI, paper or electronic", "Electronic PHI (ePHI) only"], answer: "Electronic PHI (ePHI) only", explanation: "The Security Rule deals with the technical and physical safeguards for health information in electronic form.", eli5: "This rule is all about protecting health info that's on a computer." },
        ]
    },
    flashcards: {
        'mi': [
            { id: 1, term: 'Empathy', definition: 'The ability to understand and share the feelings of another from their perspective.' },
            { id: 2, term: 'Change Talk', definition: 'Any self-expressed language that is an argument for change.' },
            { id: 3, term: 'Rolling with Resistance', definition: 'A strategy of not directly opposing client resistance but rather flowing with it.' },
            { id: 11, term: 'OARS', definition: 'A set of core communication skills: Open questions, Affirmations, Reflections, and Summaries.' },
            { id: 12, term: 'Sustain Talk', definition: 'The client\'s own arguments for not changing, for maintaining the status quo.' },
            { id: 13, term: 'Developing Discrepancy', definition: 'Helping a client see the gap between their current behavior and their deeper goals and values.' },
        ],
        'smart': [
            { id: 4, term: 'Specific', definition: 'The goal is clear and unambiguous, answering who, what, where, and why.' },
            { id: 5, term: 'Measurable', definition: 'The goal has concrete criteria for tracking progress.' },
            { id: 6, term: 'Achievable', definition: 'The goal is realistic and attainable for the individual.' },
            { id: 7, term: 'Relevant', definition: 'The goal matters to the individual and aligns with their broader objectives.' },
            { id: 8, term: 'Time-bound', definition: 'The goal has a target date or deadline.' },
        ],
        'ethics': [
            { id: 9, term: 'Confidentiality', definition: 'The ethical duty to keep client information private.' },
            { id: 10, term: 'Scope of Practice', definition: 'The procedures, actions, and processes that a professional is permitted to undertake in keeping with the terms of their professional license or certification.' },
            { id: 13, term: 'Dual Relationship', definition: 'When a coach has a second, significantly different relationship with their client in addition to the coaching relationship.' },
            { id: 14, term: 'Informed Consent', definition: 'The process of ensuring a client understands the nature of the coaching relationship, including risks, benefits, and logistics, before it begins.' },
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


// --- 6. START THE SERVER ---
app.listen(port, () => {
  console.log(`NBHWC Backend Server is running on http://localhost:${port}`);
});
