const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

export const appParams = {
	// Keeping this file simple or empty as most Base44 params are no longer needed.
	// We can expose environment variables here if needed.
	appBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000'
}
