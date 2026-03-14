import axios from 'axios';

const AI_BASE = import.meta.env.DEV
    ? '/ai'
    : (import.meta.env.VITE_AI_URL || 'https://nexus-ai-service-ks3v.onrender.com/ai');

const aiApi = axios.create({
    baseURL: AI_BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 90000, // 90s — allows Render free tier to wake up from sleep
});

aiApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default aiApi;
