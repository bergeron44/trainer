const fs = require('fs/promises');
const path = require('path');

const TRACKED_USER_EMAIL = String(process.env.LIVE_SNAPSHOT_EMAIL || 'aurh10@gmail.com').trim().toLowerCase();
const DEFAULT_SNAPSHOT_PATH = path.resolve(__dirname, '../../aurh10_live_snapshot.json');
const SNAPSHOT_PATH = String(process.env.LIVE_SNAPSHOT_PATH || DEFAULT_SNAPSHOT_PATH).trim();

function sanitizeUserForSnapshot(userInput) {
    if (!userInput) return null;
    const user = typeof userInput.toObject === 'function' ? userInput.toObject() : userInput;
    if (!user || typeof user !== 'object') return null;

    return {
        _id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile || {},
        liked_foods: user.liked_foods || [],
        disliked_foods: user.disliked_foods || [],
        nutrition_preferences: user.nutrition_preferences || {},
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        __v: user.__v,
    };
}

async function writeTrackedUserSnapshot(userInput) {
    const snapshot = sanitizeUserForSnapshot(userInput);
    if (!snapshot) return { written: false, reason: 'invalid-user' };

    const email = String(snapshot.email || '').trim().toLowerCase();
    if (!email || email !== TRACKED_USER_EMAIL) {
        return { written: false, reason: 'not-tracked-user', tracked: TRACKED_USER_EMAIL, actual: email };
    }

    await fs.mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await fs.writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    return { written: true, path: SNAPSHOT_PATH };
}

module.exports = {
    TRACKED_USER_EMAIL,
    SNAPSHOT_PATH,
    writeTrackedUserSnapshot,
    sanitizeUserForSnapshot,
};
