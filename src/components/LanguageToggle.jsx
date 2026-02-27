import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LanguageToggle() {
    const { i18n } = useTranslation();
    const currentLang = i18n.language;
    const isHebrew = currentLang === 'he';

    const toggleLanguage = () => {
        const newLang = isHebrew ? 'en' : 'he';
        i18n.changeLanguage(newLang);
    };

    return (
        <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleLanguage}
            className="fixed top-4 ltr:right-4 rtl:left-4 z-[60] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1A1A]/80 backdrop-blur-md border border-[#2A2A2A] hover:border-[#3A3A3A] transition-all text-sm text-gray-300 hover:text-white shadow-lg"
            title={isHebrew ? 'Switch to English' : 'עברו לעברית'}
        >
            <Globe className="w-3.5 h-3.5" />
            <span className="font-medium text-xs">{isHebrew ? 'EN' : 'עב'}</span>
        </motion.button>
    );
}
