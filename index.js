// =================================================================
// NBHWC STUDY PLATFORM - BACKEND API SERVER
// =================================================================
// This file represents the complete backend for the study platform.
// It is built with Node.js and the Express.js framework.
// It is designed to connect to a PostgreSQL database.
// =================================================================

// --- 1. IMPORTS & SETUP ---
// -----------------------------------------------------------------
// We import Express to create our server, 'pg' to connect to our
// PostgreSQL database, 'bcrypt' for hashing passwords, 'jsonwebtoken'
// for creating secure tokens, and 'cors' to allow our frontend
// to communicate with this backend.

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001; // Use environment variable for port or default to 3001

// --- 2. CONFIGURATION & MIDDLEWARE ---
// -----------------------------------------------------------------

// Middleware to parse incoming JSON request bodies
app.use(express.json());

// Middleware to enable Cross-Origin Resource Sharing (CORS)
// This is crucial for allowing our React frontend (on a different domain/port)
// to make requests to this API.
app.use(cors());

// --- DATABASE CONNECTION ---
// The connection details should be stored in environment variables, not hardcoded.
// This is a critical security practice.
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'nbhwc_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// --- JWT CONFIGURATION ---
// The JWT secret should be a long, complex, random string stored securely
// as an environment variable.
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
    last_study_date DATE
  );

  -- Add other tables for topics, questions, mastery, etc. as needed.
*/
// =================================================================


// --- 4. AUTHENTICATION MIDDLEWARE ---
// -----------------------------------------------------------------
// This function is middleware. It will be used on protected routes
// to ensure the user is authenticated before they can access data.

const authenticateToken = (req, res, next) => {
  // Get the token from the Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format is "Bearer TOKEN"

  if (token == null) {
    // If no token is provided, send a 401 Unauthorized response
    return res.sendStatus(401);
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // If the token is invalid or expired, send a 403 Forbidden response
      return res.sendStatus(403);
    }
    // If the token is valid, add the user payload to the request object
    req.user = user;
    next(); // Proceed to the next middleware or the route handler
  });
};


// =================================================================
// --- 5. API ROUTES ---
// =================================================================

// --- AUTHENTICATION ROUTES ---

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Basic validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if user already exists
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user into the database
    const newUser = await pool.query(
      'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, email, full_name',
      [fullName, email, passwordHash]
    );
    
    // Create initial stats for the new user
    await pool.query('INSERT INTO user_stats (user_id) VALUES ($1)', [newUser.rows[0].user_id]);

    res.status(201).json(newUser.rows[0]);

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login - Log in a user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // If credentials are correct, create a JWT
    const payload = {
      userId: user.user_id,
      email: user.email,
      name: user.full_name
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expires in 1 hour

    res.json({
      token,
      user: payload
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
});


// --- PROTECTED DATA ROUTES ---
// These routes use our 'authenticateToken' middleware. A user must provide
// a valid JWT to access them.

// GET /api/user/data - Get the logged-in user's data
app.get('/api/user/data', authenticateToken, async (req, res) => {
  try {
    // The user's ID is available from the token payload via our middleware
    const userId = req.user.userId;

    // Fetch user stats from the database
    const statsResult = await pool.query('SELECT * FROM user_stats WHERE user_id = $1', [userId]);
    
    // In a real app, we would also fetch mastery, achievements, plan, etc.
    // For now, we'll just return the stats.

    if (statsResult.rows.length === 0) {
        return res.status(404).json({ message: 'User data not found.' });
    }

    res.json({
        stats: statsResult.rows[0],
        // mastery: ... ,
        // achievements: ... ,
    });

  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});


// --- 6. START THE SERVER ---
// -----------------------------------------------------------------
app.listen(port, () => {
  console.log(`NBHWC Backend Server is running on http://localhost:${port}`);
});
