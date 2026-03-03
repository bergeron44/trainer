import axios from 'axios';

// Dev: Vite proxies /ai → localhost:5002
// Prod: points to Render service (override with VITE_AI_URL env var)
const AI_BASE = import.meta.env.VITE_AI_URL
    || (import.meta.env.PROD
        ? 'https://nexus-ai-service-ks3v.onrender.com/ai'
        : '/ai');

const aiApi = axios.create({
    baseURL: AI_BASE,
    headers: { 'Content-Type': 'application/json' },
});

aiApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default aiApi;
