const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { randomUUID } = require('crypto');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, _res, next) => {
    const incoming = req.header('x-request-id');
    req.requestId = (incoming && String(incoming).trim()) ? String(incoming).trim() : randomUUID();
    next();
});

// Connect to Database
connectDB();

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/workouts', require('./routes/workoutRoutes'));
app.use('/api/nutrition', require('./routes/nutritionRoutes'));
app.use('/api/exercises', require('./routes/exerciseRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));

// Health Check
app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
