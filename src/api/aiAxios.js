import axios from 'axios';

// AI Service runs on port 5002 (proxied via Vite: /ai → localhost:5002)
const aiApi = axios.create({
    baseURL: import.meta.env.VITE_AI_URL || '/ai',
    headers: { 'Content-Type': 'application/json' },
});

aiApi.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default aiApi;
