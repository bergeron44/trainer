const API_KEY  = import.meta.env.VITE_EXERCISEDB_API_KEY;
const BASE_URL = 'https://exercisedb.p.rapidapi.com';
const HEADERS  = {
  'X-RapidAPI-Key':  API_KEY,
  'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
};

// Returns the gifUrl for the best-matching exercise, or null if not found.
export async function fetchExerciseGif(name) {
  const encoded = encodeURIComponent(name.toLowerCase());
  const res = await fetch(
    `${BASE_URL}/exercises/name/${encoded}?limit=1&offset=0`,
    { headers: HEADERS },
  );
  if (!res.ok) throw new Error(`ExerciseDB ${res.status}`);
  const data = await res.json();
  return data[0]?.gifUrl ?? null;
}

// Fetches GIFs for all exercises in parallel.
// Returns a map: { [exerciseName]: gifUrl | null }
export async function fetchAllExerciseGifs(exercises) {
  const settled = await Promise.allSettled(
    exercises.map(ex => fetchExerciseGif(ex.name)),
  );
  return Object.fromEntries(
    exercises.map((ex, i) => [
      ex.name,
      settled[i].status === 'fulfilled' ? settled[i].value : null,
    ]),
  );
}
