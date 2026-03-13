const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });

const DUMMY_USER_ID = '000000000000000000000000';
const SECRET = process.env.JWT_SECRET || 'fallback_secret';
const token = jwt.sign({ id: DUMMY_USER_ID }, SECRET, { expiresIn: '1h' });

const aiApi = axios.create({
    baseURL: 'http://localhost:5002/ai',
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true
});

const serverApi = axios.create({
    baseURL: 'http://localhost:5001/api',
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true
});

async function runTests() {
    console.log('--- TESTING AI SERVICE MIGRATED ROUTES ---');
    
    console.log('\n[1] PUT /ai/users/nutrition-preferences/extract-phase1');
    try {
        let res1 = await aiApi.put('/users/nutrition-preferences/extract-phase1', { text: "I like bananas" });
        console.log(`Status: ${res1.status}`);
        if(res1.status === 404) console.log("ERROR: Route doesn't exist!");
        else console.log(`Response keys:`, Object.keys(res1.data || {}));
    } catch(e) { console.log('Error hitting AI Phase1 route'); }

    console.log('\n[2] PUT /ai/users/nutrition-preferences/extract');
    try {
        let res2 = await aiApi.put('/users/nutrition-preferences/extract', { text: "No peanuts" });
        console.log(`Status: ${res2.status}`);
        if(res2.status === 404) console.log("ERROR: Route doesn't exist!");
        else console.log(`Response keys:`, Object.keys(res2.data || {}));
    } catch(e) { console.log('Error hitting AI Phase2 route'); }

    console.log('\n--- TESTING REGULAR SERVER ROUTES ---');
    
    console.log('\n[3] GET /api/nutrition/menu/active');
    try {
        let res3 = await serverApi.get('/nutrition/menu/active');
        console.log(`Status: ${res3.status}`);
        if(res3.status === 404) console.log("ERROR: Route doesn't exist!");
    } catch(e) { console.log('Error hitting generic menu route'); }
    
    console.log('\n[4] POST /api/users/forgot-password');
    try {
        let res4 = await serverApi.post('/users/forgot-password', { email: "fake@example.com" });
        console.log(`Status: ${res4.status}`);
        if(res4.status === 404) console.log("ERROR: Route doesn't exist!");
        else console.log(`Message:`, res4.data?.message);
    } catch (e) { console.log('Error hitting forgot-password route');}
}

runTests().catch(console.error);
