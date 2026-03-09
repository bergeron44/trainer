const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { requestContext } = require('./middleware/requestContextMiddleware');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestContext);

connectDB();

// Routes
app.use('/ai/meal', require('./routes/mealRoutes'));
app.use('/ai/workout', require('./routes/workoutRoutes'));
app.use('/ai/food', require('./routes/foodRoutes'));
app.use('/ai/chat', require('./routes/chatRoutes'));

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'NEXUS AI Service',
        version: '1.0.0',
        endpoints: [
            'POST /ai/meal/next',
            'POST /ai/workout/daily',
            'POST /ai/food/lookup',
            'POST /ai/chat/response',
            'GET  /ai/chat/summaries',
            'POST /ai/chat/summaries',
        ]
    });
});

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
    console.log(`\n🤖 NEXUS AI Service running on port ${PORT}`);
    console.log(`   Endpoints:`);
    console.log(`   POST http://localhost:${PORT}/ai/meal/next`);
    console.log(`   POST http://localhost:${PORT}/ai/workout/daily\n`);
});
