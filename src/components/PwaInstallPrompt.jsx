import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PwaInstallPrompt() {
  const { t } = useTranslation();
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed this session
    if (sessionStorage.getItem('pwa_prompt_dismissed')) return;

    const handler = (e) => {
      e.preventDefault();
      setInstallEvent(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setInstallEvent(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem('pwa_prompt_dismissed', '1');
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-24 left-4 right-4 z-50 max-w-sm mx-auto"
        >
          <div className="bg-[#1A1A1A] border border-[#CCFF00]/30 rounded-2xl p-4 flex items-center gap-4 shadow-2xl shadow-black/50">
            <div className="w-12 h-12 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center shrink-0">
              <img src="/pwa-192x192.png" alt="NEXUS" className="w-10 h-10 rounded-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white">
                {t('pwa.installTitle', 'Add NEXUS to Home Screen')}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('pwa.installSubtitle', 'Use like a native app — offline ready')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 rounded-lg bg-[#CCFF00] text-black text-xs font-bold flex items-center gap-1 hover:bg-[#CCFF00]/90 transition-colors"
              >
                <Download className="w-3 h-3" />
                {t('pwa.install', 'Install')}
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
