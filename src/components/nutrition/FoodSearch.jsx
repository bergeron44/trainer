import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, Plus, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function FoodSearch({ onAddFood, onClose }) {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 3) {
                searchFood(query);
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query]);

    const searchFood = async (searchTerm) => {
        setIsLoading(true);
        setError(null);
        try {
            // Using OpenFoodFacts free API
            const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchTerm)}&search_simple=1&action=process&json=1&page_size=20`);
            const data = await res.json();

            if (data.products) {
                // Filter out products that don't have basic nutritional info
                const validProducts = data.products.filter(p =>
                    p.product_name &&
                    p.nutriments &&
                    p.nutriments['energy-kcal_100g'] !== undefined
                ).map(p => ({
                    id: p._id || p.code || Math.random().toString(),
                    name: p.product_name,
                    brand: p.brands ? p.brands.split(',')[0] : 'Generic',
                    image: p.image_front_thumb_url || p.image_thumb_url,
                    cals: Math.round(p.nutriments['energy-kcal_100g']),
                    protein: Math.round(p.nutriments['proteins_100g'] || 0),
                    carbs: Math.round(p.nutriments['carbohydrates_100g'] || 0),
                    fat: Math.round(p.nutriments['fat_100g'] || 0),
                    portion: p.serving_size || '100g'
                }));

                setResults(validProducts);
            } else {
                setResults([]);
            }
        } catch (err) {
            setError(t('nutrition.demo.errorFetchingFood', 'Could not fetch generic food data. Please try again.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#121212] rounded-t-3xl sm:rounded-3xl border border-[#2A2A2A] overflow-hidden">
            {/* Search Header */}
            <div className="p-4 border-b border-[#2A2A2A] shrink-0 sticky top-0 bg-[#121212] z-10">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white">{t('nutrition.demo.findFood', 'Find Food')}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-[#2A2A2A] text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('nutrition.demo.searchPlaceholder', 'Search groceries or ingredients...')}
                        className="w-full bg-[#1A1A1A] border border-[#333] rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#00F2FF] focus:ring-1 focus:ring-[#00F2FF] transition-all"
                        autoFocus
                    />
                </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-[#2A2A2A]">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin text-[#00F2FF] mb-2" />
                        <span className="text-sm">{t('nutrition.demo.searchingDatabase', 'Searching global database...')}</span>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-2 p-4 m-2 rounded-xl bg-red-500/10 text-red-500 text-sm border border-red-500/20">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {!isLoading && query.length >= 3 && results.length === 0 && !error && (
                    <div className="text-center p-8 text-gray-500 text-sm">
                        {t('nutrition.demo.noFoodsFound', 'No foods found matching "{{query}}".', { query })}
                    </div>
                )}

                {!isLoading && results.length > 0 && (
                    <div className="space-y-2">
                        {results.map((food, i) => (
                            <motion.div
                                key={`${food.id}-${i}`} // Ensure unique key globally
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#1A1A1A] border border-transparent hover:border-[#2A2A2A] transition-all group"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-12 h-12 rounded-lg bg-[#2A2A2A] flex items-center justify-center shrink-0 overflow-hidden">
                                        {food.image ? (
                                            <img src={food.image} alt={food.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xs text-gray-500">{t('nutrition.demo.noImg', 'No Img')}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-white text-sm font-medium truncate">{food.name}</h3>
                                        <p className="text-gray-500 text-xs truncate mb-1">{food.brand} • {food.portion}</p>
                                        <div className="flex gap-2 text-[10px] uppercase font-semibold">
                                            <span className="text-[#00F2FF]">{food.cals} {t('nutrition.demo.kcal', 'kcal')}</span>
                                            <span className="text-[#CCFF00]">P: {food.protein}</span>
                                            <span className="text-[#FF6B6B]">C: {food.carbs}</span>
                                            <span className="text-[#FFD93D]">F: {food.fat}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onAddFood(food)}
                                    className="shrink-0 ml-3 p-2 rounded-lg bg-[#00F2FF]/10 text-[#00F2FF] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-[#00F2FF] hover:text-black"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                )}

                {query.length > 0 && query.length < 3 && (
                    <div className="text-center p-8 text-gray-500 text-sm">
                        {t('nutrition.demo.keepTyping', 'Keep typing to search...')}
                    </div>
                )}
            </div>
        </div>
    );
}
