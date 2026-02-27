import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useTranslation } from 'react-i18next';

export default function Register() {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const { register } = useAuth();
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await register({ name, email, password });
            navigate(createPageUrl('Onboarding'));
        } catch (err) {
            setError(err?.response?.data?.message || err.message || t('common.error'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#00F2FF]/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#CCFF00]/10 blur-[120px] rounded-full pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md bg-[#121212] border border-[#2A2A2A] rounded-3xl p-8 z-10 shadow-2xl"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00F2FF] to-[#CCFF00] flex items-center justify-center mb-4 shadow-lg shadow-[#CCFF00]/20">
                        <span className="text-3xl font-bold text-black">T</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">{t('register.createAccount')}</h1>
                    <p className="text-gray-400 text-sm">{t('register.joinUs')}</p>
                </div>

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-xl p-4 text-red-500 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('register.fullName')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-[#1A1A1A] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00F2FF] focus:ring-1 focus:ring-[#00F2FF] transition-all"
                            placeholder={t('register.namePlaceholder')}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('register.emailAddress')}</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#1A1A1A] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00F2FF] focus:ring-1 focus:ring-[#00F2FF] transition-all"
                            placeholder={t('register.emailPlaceholder')}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">{t('register.password')}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#1A1A1A] border border-[#333] rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00F2FF] focus:ring-1 focus:ring-[#00F2FF] transition-all"
                            placeholder={t('register.passwordPlaceholder')}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading || !name || !email || !password}
                        className="w-full h-12 mt-6 rounded-xl font-semibold bg-gradient-to-r from-[#00F2FF] to-[#CCFF00] text-black transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('register.signUp')}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-gray-400 text-sm">
                        {t('register.haveAccount')}{' '}
                        <button
                            onClick={() => navigate(createPageUrl('Login'))}
                            className="text-[#00F2FF] hover:underline font-medium"
                        >
                            {t('register.logIn')}
                        </button>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
