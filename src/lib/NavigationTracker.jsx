import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { pagesConfig } from '@/pages.config';

export default function NavigationTracker() {
    const location = useLocation();

    // Simple console logging for debug instead of external service
    useEffect(() => {
        // console.log('Navigated to:', location.pathname);
    }, [location]);

    return null;
}