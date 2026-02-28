/**
 * Quick API inspector — shows exactly what ExerciseDB returns for one exercise.
 * Run: node server/seeds/checkApiResponse.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const API_KEY  = process.env.VITE_EXERCISEDB_API_KEY;
const BASE_URL = 'https://exercisedb.p.rapidapi.com';
const HEADERS  = {
  'X-RapidAPI-Key':  API_KEY,
  'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
};

async function checkExercise(name) {
  const encoded = encodeURIComponent(name.toLowerCase());
  const res = await fetch(
    `${BASE_URL}/exercises/name/${encoded}?limit=1&offset=0`,
    { headers: HEADERS }
  );
  console.log(`\nStatus: ${res.status}`);
  const data = await res.json();
  const ex = data[0];
  if (!ex) { console.log('No results found'); return; }

  console.log('\n── Full response fields ──');
  Object.entries(ex).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      console.log(`  ${k}: [${v.length} items] ${JSON.stringify(v).slice(0,80)}`);
    } else {
      console.log(`  ${k}: ${String(v).slice(0,100)}`);
    }
  });
}

async function checkExercises() {
  console.log('API Key loaded:', API_KEY ? `${API_KEY.slice(0,8)}...` : 'MISSING ❌');

  await checkExercise('bench press');
  await checkExercise('squat');
}

checkExercises().catch(console.error);
