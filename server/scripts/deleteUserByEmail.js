const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = require('../config/db');
const User = require('../models/User');
const Workout = require('../models/Workout');
const WorkoutSession = require('../models/WorkoutSession');
const WorkoutLog = require('../models/WorkoutLog');
const NutritionLog = require('../models/NutritionLog');
const NutritionMenu = require('../models/NutritionMenu');
const ChatSummary = require('../models/ChatSummary');
const ToolExecutionAudit = require('../models/ToolExecutionAudit');
const ToolIdempotencyRecord = require('../models/ToolIdempotencyRecord');

function printUsage() {
    console.log('Usage: node scripts/deleteUserByEmail.js <email>');
    console.log('Example: node scripts/deleteUserByEmail.js asaf807@walla.com');
}

async function deleteUserByEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
        printUsage();
        process.exitCode = 1;
        return;
    }

    await connectDB();

    const user = await User.findOne({ email: normalizedEmail }).select('_id name email');

    if (!user) {
        console.log(`No user found for email: ${normalizedEmail}`);
        return;
    }

    const userId = user._id;
    const summary = {
        workouts: 0,
        workoutSessions: 0,
        workoutLogs: 0,
        nutritionLogs: 0,
        nutritionMenus: 0,
        chatSummaries: 0,
        toolExecutionAudits: 0,
        toolIdempotencyRecords: 0,
        users: 0,
    };

    summary.workouts = (await Workout.deleteMany({ user: userId })).deletedCount;
    summary.workoutSessions = (await WorkoutSession.deleteMany({ user: userId })).deletedCount;
    summary.workoutLogs = (await WorkoutLog.deleteMany({ user: userId })).deletedCount;
    summary.nutritionLogs = (await NutritionLog.deleteMany({ user: userId })).deletedCount;
    summary.nutritionMenus = (await NutritionMenu.deleteMany({ user: userId })).deletedCount;
    summary.chatSummaries = (await ChatSummary.deleteMany({ user: userId })).deletedCount;
    summary.toolExecutionAudits = (await ToolExecutionAudit.deleteMany({ user: userId })).deletedCount;
    summary.toolIdempotencyRecords = (await ToolIdempotencyRecord.deleteMany({ user: userId })).deletedCount;
    summary.users = (await User.deleteOne({ _id: userId })).deletedCount;

    console.log('Deleted user and linked records:');
    console.log(JSON.stringify({
        user: {
            id: userId.toString(),
            name: user.name,
            email: user.email,
        },
        deleted: summary,
    }, null, 2));
}

async function main() {
    try {
        const email = process.argv[2];

        if (email === '--help' || email === '-h') {
            printUsage();
            return;
        }

        await deleteUserByEmail(email);
    } catch (error) {
        console.error('Failed to delete user:', error.message);
        process.exitCode = 1;
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    }
}

main();
