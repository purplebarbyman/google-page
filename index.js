// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER (FINAL VERSION)
// =================================================================
// This version uses the live database for users/stats and quizzes,
// and serves an expanded content library for flashcards, scenarios,
// and puzzles to ensure a rich, interactive experience.
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

// --- BUILT-IN CONTENT LIBRARY (for non-quiz features) ---
const contentDB = {
    flashcards: {
        'mi': { id: 'mi', name: 'Motivational Interviewing', cards: [
            { id: 1, term: 'Empathy', definition: 'The ability to understand and share the feelings of another from their perspective, which is a cornerstone of the client-coach relationship.' },
            { id: 2, term: 'Change Talk', definition: 'Any self-expressed language that is an argument for change. The coach\'s role is to elicit and reinforce this.' },
            { id: 3, term: 'Sustain Talk', definition: 'The client\'s own arguments for not changing, for maintaining the status quo.' },
            { id: 4, term: 'Rolling with Resistance', definition: 'A strategy of not directly opposing client resistance but rather flowing with it to avoid confrontation.' },
            { id: 5, term: 'Developing Discrepancy', definition: 'Helping a client see the gap between their current behavior and their deeper goals and values.' },
            { id: 6, term: 'OARS', definition: 'A set of core communication skills: Open questions, Affirmations, Reflections, and Summaries.' },
            { id: 7, term: 'Simple Reflection', definition: 'A reflection that repeats or slightly rephrases what the client has said.' },
            { id: 8, term: 'Complex Reflection', definition: 'A reflection that adds meaning or reflects an unstated feeling, often leading to deeper insight.' },
        ]},
        'smart': { id: 'smart', name: 'SMART Goals', cards: [
            { id: 9, term: 'Specific', definition: 'The goal is clear, unambiguous, and answers the questions: Who, what, where, when, and why.' },
            { id: 10, term: 'Measurable', definition: 'The goal has concrete criteria for tracking progress and measuring success.' },
            { id: 11, term: 'Achievable', definition: 'The goal is realistic and attainable for the individual, given their resources and constraints.' },
            { id: 12, term: 'Relevant', definition: 'The goal matters to the individual and aligns with their broader objectives and values.' },
            { id: 13, term: 'Time-bound', definition: 'The goal has a target date or deadline, which creates a sense of urgency.' },
        ]},
        'ethics': { id: 'ethics', name: 'Core Ethics', cards: [
            { id: 14, term: 'Confidentiality', definition: 'The ethical duty to keep all client information private, unless required by law.' },
            { id: 15, term: 'Scope of Practice', definition: 'The procedures, actions, and processes that a professional is permitted to undertake in keeping with the terms of their certification.' },
            { id: 16, term: 'Dual Relationship', definition: 'When a coach has a second, significantly different relationship with their client in addition to the coaching relationship (e.g., friend, family, business partner).' },
            { id: 17, term: 'Informed Consent', definition: 'The process of ensuring a client understands the nature of the coaching relationship, including risks, benefits, and logistics, before it begins.' },
        ]}
    },
    scenarios: {
        1: {
            id: 1,
            title: "Handling Client Resistance",
            startNode: 'start',
            nodes: {
                'start': { prompt: "Your client says, 'I know I should exercise, but I just don't feel like it. I failed again this week.' What's your first response?", choices: [ { text: "Don't worry, you can try again next week. What's your plan?", nextNode: 'reassurance' }, { text: "It sounds like you're feeling discouraged because your actions aren't aligning with your goals.", nextNode: 'reflection' }, { text: "Why do you think you failed? You need to be more disciplined.", nextNode: 'confrontation' } ] },
                'reassurance': { prompt: "Sarah replies, 'I guess so.' She still seems disengaged. This response was okay, but it glossed over her feelings. What's a better approach?", choices: [ { text: "Let's explore that feeling of discouragement a bit more.", nextNode: 'reflection' }, { text: "Okay, let's make a more detailed plan for next week.", nextNode: 'end_neutral' } ] },
                'reflection': { prompt: "Sarah's posture changes. 'Yes, that's exactly it! I feel like a failure.' You've successfully reflected her feelings, building trust. What's your next step?", choices: [ { text: "What would it feel like to get just one small win this week?", nextNode: 'end_positive' }, { text: "Tell me about the last time you did feel successful with your fitness.", nextNode: 'end_positive' } ] },
                'confrontation': { prompt: "Sarah becomes defensive. 'It's not about discipline, I'm just tired.' This confrontational style has damaged rapport. The scenario ends here.", choices: [], end: "This approach created conflict. A core coaching skill is to avoid judgment and roll with resistance." },
                'end_positive': { prompt: "You've successfully navigated the conversation, building rapport and opening the door for productive goal-setting. Excellent work!", choices: [], end: "You used reflective listening to validate the client's feelings, which is a key coaching competency." },
                'end_neutral': { prompt: "You've moved on, but missed a key opportunity to connect with the client's emotional state. The scenario ends here.", choices: [], end: "While not a bad outcome, exploring the client's feelings first would have been more effective." }
            }
        }
    },
    puzzles: {
        1: {
            id: 1,
            title: 'The Coaching Session Flow',
            correctOrder: ['Establish Trust & Rapport', 'Create Coaching Agreement', 'Explore Client\'s Vision & Goals', 'Co-create Action Plan', 'Manage Progress & Accountability'],
            items: ['Explore Client\'s Vision & Goals', 'Manage Progress & Accountability', 'Establish Trust & Rapport', 'Co-create Action Plan', 'Create Coaching Agreement']
        },
        2: {
            id: 2,
            title: 'Stages of Change (Transtheoretical Model)',
            correctOrder: ['Precontemplation', 'Contemplation', 'Preparation', 'Action', 'Maintenance'],
            items: ['Action', 'Preparation', 'Maintenance', 'Precontemplation', 'Contemplation']
        }
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

        await client.query('INSERT INTO user_stats (user_id) VALUES ($1)', [userId]);
        
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
    
    const [statsRes, masteryRes, achievementsRes, planRes] = await Promise.all([
        pool.query('SELECT * FROM user_stats WHERE user_id = $1', [userId]),
        pool.query('SELECT topic_name, mastery_score FROM user_mastery WHERE user_id = $1', [userId]),
        pool.query('SELECT achievement_id FROM user_achievements WHERE user_id = $1', [userId]),
        pool.query('SELECT settings, plan_data FROM user_study_plans WHERE user_id = $1', [userId])
    ]);

    if (statsRes.rows.length === 0) return res.status(404).json({ message: 'User data not found.' });

    const mastery = masteryRes.rows.reduce((acc, row) => ({...acc, [row.topic_name]: row.mastery_score }), {});
    const unlockedAchievements = achievementsRes.rows.map(row => row.achievement_id);
    const plan = planRes.rows[0];

    res.json({
        stats: statsRes.rows[0],
        mastery: mastery,
        unlockedAchievements: unlockedAchievements,
        planSettings: plan ? plan.settings : null,
        personalizedPlan: plan ? plan.plan_data : null
    });

  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/study-plan', authenticateToken, async (req, res) => {
    const { settings, plan } = req.body;
    const userId = req.user.userId;

    try {
        const query = `
            INSERT INTO user_study_plans (user_id, settings, plan_data)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE
            SET settings = EXCLUDED.settings, plan_data = EXCLUDED.plan_data;
        `;
        await pool.query(query, [userId, settings, plan]);
        res.status(200).json({ message: 'Study plan saved successfully.' });
    } catch (error) {
        console.error('Error saving study plan:', error);
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
        
        if (questionsResult.rows.length > 0) {
            const formattedQuestions = questionsResult.rows.map(q => {
                if (!q.options || q.options.length === 0) {
                    console.error(`Question ID ${q.question_id} has no options.`);
                    return null;
                }
                const correctAnswer = q.options.find(opt => opt.is_correct);
                if (!correctAnswer) {
                    console.error(`Question ID ${q.question_id} is missing a correct answer.`);
                    return null;
                }
                return {
                    id: q.question_id,
                    question: q.question_text,
                    explanation: q.explanation,
                    eli5: q.eli5_explanation,
                    answer: correctAnswer.option_text,
                    options: q.options.map(opt => opt.option_text)
                };
            }).filter(Boolean);
            
            return res.json(formattedQuestions);
        }
        
        // --- FALLBACK TO MOCK DATA IF DB IS EMPTY ---
        console.warn(`No questions found in DB for topic "${topic}". Falling back to mock data.`);
        const mockQuestions = contentDB.questions[topic] || [];
        const shuffled = mockQuestions.sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffled.slice(0, numQuestions);
        res.json(selectedQuestions);

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

app.get('/api/flashcards/decks', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT DISTINCT t.topic_name as name, t.topic_id as id FROM topics t JOIN flashcards f ON t.topic_id = f.topic_id ORDER BY t.topic_name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching flashcard decks:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.get('/api/flashcards/decks/:deckId', authenticateToken, async (req, res) => {
    try {
        const { deckId } = req.params;
        const result = await pool.query('SELECT term, definition FROM flashcards WHERE topic_id = $1', [deckId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching flashcards:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
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
