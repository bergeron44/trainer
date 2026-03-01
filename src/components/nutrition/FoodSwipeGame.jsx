import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { X, Heart, Loader2, Flame, Beef, Wheat, Droplet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/api/axios';

const CDN = 'https://spoonacular.com/cdn/ingredients_500x500';
const SESSION_LIMIT = 20;

// 240 foods — USDA nutrition values (per 100g) + verified Spoonacular CDN images
// null image → shows 🍽️ emoji fallback automatically
const FOOD_DATABASE = [
    // ── POULTRY ──────────────────────────────────────────────
    { id: 'chicken-breast', name: 'Chicken Breast', image: `${CDN}/chicken-breast.jpg`, calories: 165, protein: 31, carbs: 0, fat: 4 },
    { id: 'turkey-breast', name: 'Turkey Breast', image: `${CDN}/turkey-breast.jpg`, calories: 135, protein: 30, carbs: 0, fat: 1 },
    { id: 'chicken-drumstick', name: 'Chicken Drumsticks', image: `${CDN}/chicken-drumsticks.jpg`, calories: 172, protein: 21, carbs: 0, fat: 9 },
    { id: 'chicken-liver', name: 'Chicken Liver', image: `${CDN}/chicken-liver.jpg`, calories: 116, protein: 17, carbs: 1, fat: 4 },
    { id: 'whole-chicken', name: 'Whole Chicken', image: `${CDN}/whole-chicken.jpg`, calories: 239, protein: 27, carbs: 0, fat: 14 },
    { id: 'duck-breast', name: 'Duck Breast', image: `${CDN}/duck-breast.jpg`, calories: 133, protein: 19, carbs: 0, fat: 6 },
    { id: 'chicken-thighs', name: 'Chicken Thighs', image: null, calories: 209, protein: 18, carbs: 0, fat: 15 },
    { id: 'ground-turkey', name: 'Ground Turkey', image: null, calories: 170, protein: 22, carbs: 0, fat: 9 },

    // ── BEEF & PORK ──────────────────────────────────────────
    { id: 'flank-steak', name: 'Beef Steak', image: `${CDN}/flank-steak.jpg`, calories: 180, protein: 27, carbs: 0, fat: 7 },
    { id: 'beef-tenderloin', name: 'Beef Tenderloin', image: `${CDN}/beef-tenderloin.jpg`, calories: 250, protein: 26, carbs: 0, fat: 15 },
    { id: 'ground-beef', name: 'Ground Beef (lean)', image: null, calories: 218, protein: 26, carbs: 0, fat: 12 },
    { id: 'veal', name: 'Veal', image: `${CDN}/veal.jpg`, calories: 172, protein: 26, carbs: 0, fat: 7 },
    { id: 'pork-loin', name: 'Pork Loin', image: `${CDN}/pork-loin.jpg`, calories: 165, protein: 27, carbs: 0, fat: 6 },
    { id: 'pork-belly', name: 'Pork Belly', image: `${CDN}/pork-belly.jpg`, calories: 518, protein: 9, carbs: 0, fat: 53 },
    { id: 'ham', name: 'Ham', image: `${CDN}/ham.jpg`, calories: 145, protein: 21, carbs: 1, fat: 6 },
    { id: 'salami', name: 'Salami', image: `${CDN}/salami.jpg`, calories: 336, protein: 20, carbs: 2, fat: 27 },
    { id: 'chorizo', name: 'Chorizo', image: `${CDN}/chorizo.jpg`, calories: 455, protein: 24, carbs: 2, fat: 38 },
    { id: 'lamb', name: 'Lamb', image: null, calories: 294, protein: 25, carbs: 0, fat: 21 },
    { id: 'pork-chop', name: 'Pork Chop', image: null, calories: 231, protein: 25, carbs: 0, fat: 14 },
    { id: 'beef-jerky', name: 'Beef Jerky', image: null, calories: 338, protein: 33, carbs: 11, fat: 7 },

    // ── FISH & SEAFOOD ───────────────────────────────────────
    { id: 'salmon', name: 'Salmon', image: `${CDN}/salmon.jpg`, calories: 179, protein: 20, carbs: 0, fat: 10 },
    { id: 'smoked-salmon', name: 'Tuna', image: `${CDN}/smoked-salmon.jpg`, calories: 117, protein: 18, carbs: 0, fat: 5 },
    { id: 'rainbow-trout', name: 'Rainbow Trout', image: `${CDN}/rainbow-trout.jpg`, calories: 168, protein: 23, carbs: 0, fat: 8 },
    { id: 'swordfish', name: 'Swordfish', image: `${CDN}/swordfish.jpg`, calories: 121, protein: 20, carbs: 0, fat: 4 },
    { id: 'sea-bass', name: 'Sea Bass', image: `${CDN}/sea-bass.jpg`, calories: 97, protein: 18, carbs: 0, fat: 2 },
    { id: 'catfish', name: 'Catfish', image: `${CDN}/catfish.jpg`, calories: 95, protein: 16, carbs: 0, fat: 3 },
    { id: 'shrimp', name: 'Shrimp', image: `${CDN}/shrimp.jpg`, calories: 85, protein: 20, carbs: 1, fat: 1 },
    { id: 'scallops', name: 'Scallops', image: `${CDN}/scallops.jpg`, calories: 88, protein: 17, carbs: 4, fat: 1 },
    { id: 'lobster', name: 'Lobster', image: `${CDN}/lobster.jpg`, calories: 89, protein: 19, carbs: 0, fat: 1 },
    { id: 'mussels', name: 'Mussels', image: `${CDN}/mussels.jpg`, calories: 86, protein: 12, carbs: 4, fat: 2 },
    { id: 'oysters', name: 'Oysters', image: `${CDN}/oysters.jpg`, calories: 51, protein: 6, carbs: 3, fat: 1 },
    { id: 'clams', name: 'Clams', image: `${CDN}/clams.jpg`, calories: 74, protein: 13, carbs: 3, fat: 1 },
    { id: 'anchovies', name: 'Anchovies', image: `${CDN}/anchovies.jpg`, calories: 131, protein: 20, carbs: 0, fat: 5 },
    { id: 'sardines', name: 'Sardines', image: null, calories: 208, protein: 25, carbs: 0, fat: 11 },
    { id: 'crab', name: 'Crab', image: null, calories: 97, protein: 19, carbs: 0, fat: 2 },
    { id: 'tilapia', name: 'Tilapia', image: null, calories: 96, protein: 20, carbs: 0, fat: 2 },
    { id: 'cod', name: 'Cod', image: null, calories: 82, protein: 18, carbs: 0, fat: 1 },
    { id: 'mackerel', name: 'Mackerel', image: null, calories: 205, protein: 19, carbs: 0, fat: 14 },

    // ── EGGS & DAIRY ─────────────────────────────────────────
    { id: 'egg', name: 'Eggs', image: `${CDN}/egg.jpg`, calories: 155, protein: 13, carbs: 1, fat: 11 },
    { id: 'plain-yogurt', name: 'Greek Yogurt', image: `${CDN}/plain-yogurt.jpg`, calories: 59, protein: 10, carbs: 4, fat: 0 },
    { id: 'cottage-cheese', name: 'Cottage Cheese', image: `${CDN}/cottage-cheese.jpg`, calories: 98, protein: 11, carbs: 3, fat: 4 },
    { id: 'milk', name: 'Whole Milk', image: `${CDN}/milk.jpg`, calories: 61, protein: 3, carbs: 5, fat: 3 },
    { id: 'butter', name: 'Butter', image: `${CDN}/butter.jpg`, calories: 717, protein: 1, carbs: 0, fat: 81 },
    { id: 'sour-cream', name: 'Sour Cream', image: `${CDN}/sour-cream.jpg`, calories: 198, protein: 3, carbs: 5, fat: 19 },
    { id: 'cream-cheese', name: 'Cream Cheese', image: `${CDN}/cream-cheese.jpg`, calories: 342, protein: 6, carbs: 4, fat: 34 },
    { id: 'cheddar-cheese', name: 'Cheddar Cheese', image: `${CDN}/cheddar-cheese.jpg`, calories: 402, protein: 25, carbs: 1, fat: 33 },
    { id: 'parmesan', name: 'Parmesan', image: `${CDN}/parmesan.jpg`, calories: 431, protein: 38, carbs: 4, fat: 29 },
    { id: 'gouda', name: 'Gouda', image: `${CDN}/gouda.jpg`, calories: 356, protein: 25, carbs: 2, fat: 27 },
    { id: 'brie', name: 'Brie', image: `${CDN}/brie.jpg`, calories: 334, protein: 21, carbs: 0, fat: 28 },
    { id: 'camembert', name: 'Camembert', image: `${CDN}/camembert.jpg`, calories: 300, protein: 20, carbs: 0, fat: 24 },
    { id: 'colby-jack', name: 'Colby Jack', image: `${CDN}/colby-jack.jpg`, calories: 393, protein: 25, carbs: 3, fat: 31 },
    { id: 'mozzarella', name: 'Mozzarella', image: null, calories: 280, protein: 28, carbs: 2, fat: 17 },
    { id: 'ricotta', name: 'Ricotta', image: null, calories: 174, protein: 11, carbs: 3, fat: 13 },
    { id: 'heavy-cream', name: 'Heavy Cream', image: null, calories: 340, protein: 3, carbs: 3, fat: 36 },
    { id: 'kefir', name: 'Kefir', image: null, calories: 64, protein: 3, carbs: 5, fat: 4 },
    { id: 'almond-milk', name: 'Almond Milk', image: `${CDN}/almond-milk.jpg`, calories: 17, protein: 1, carbs: 1, fat: 1 },
    { id: 'oat-milk', name: 'Oat Milk', image: `${CDN}/oat-milk.jpg`, calories: 45, protein: 1, carbs: 7, fat: 2 },
    { id: 'soy-milk', name: 'Soy Milk', image: `${CDN}/soy-milk.jpg`, calories: 33, protein: 3, carbs: 3, fat: 2 },
    { id: 'coconut-milk', name: 'Coconut Milk', image: `${CDN}/coconut-milk.jpg`, calories: 197, protein: 2, carbs: 6, fat: 19 },
    { id: 'evaporated-milk', name: 'Evaporated Milk', image: `${CDN}/evaporated-milk.jpg`, calories: 134, protein: 7, carbs: 10, fat: 8 },
    { id: 'protein-powder', name: 'Whey Protein', image: `${CDN}/protein-powder.jpg`, calories: 400, protein: 80, carbs: 8, fat: 4 },

    // ── PLANT PROTEINS & LEGUMES ─────────────────────────────
    { id: 'tofu', name: 'Tofu', image: `${CDN}/tofu.jpg`, calories: 76, protein: 8, carbs: 2, fat: 5 },
    { id: 'tempeh', name: 'Tempeh', image: `${CDN}/tempeh.jpg`, calories: 193, protein: 20, carbs: 9, fat: 11 },
    { id: 'edamame', name: 'Edamame', image: `${CDN}/edamame.jpg`, calories: 121, protein: 11, carbs: 10, fat: 5 },
    { id: 'black-beans', name: 'Black Beans', image: `${CDN}/black-beans.jpg`, calories: 132, protein: 9, carbs: 24, fat: 1 },
    { id: 'chickpeas', name: 'Chickpeas', image: `${CDN}/chickpeas.jpg`, calories: 164, protein: 9, carbs: 27, fat: 3 },
    { id: 'kidney-beans', name: 'Kidney Beans', image: `${CDN}/kidney-beans.jpg`, calories: 127, protein: 9, carbs: 23, fat: 1 },
    { id: 'pinto-beans', name: 'Pinto Beans', image: `${CDN}/pinto-beans.jpg`, calories: 143, protein: 9, carbs: 27, fat: 1 },
    { id: 'black-lentils', name: 'Lentils', image: `${CDN}/black-lentils.jpg`, calories: 116, protein: 9, carbs: 20, fat: 0 },
    { id: 'red-lentils', name: 'Red Lentils', image: null, calories: 116, protein: 9, carbs: 20, fat: 0 },
    { id: 'navy-beans', name: 'Navy Beans', image: null, calories: 140, protein: 10, carbs: 26, fat: 1 },
    { id: 'fava-beans', name: 'Fava Beans', image: null, calories: 88, protein: 8, carbs: 14, fat: 0 },
    { id: 'split-peas', name: 'Split Peas', image: null, calories: 341, protein: 25, carbs: 60, fat: 1 },

    // ── GRAINS & STARCHES ────────────────────────────────────
    { id: 'rolled-oats', name: 'Oatmeal', image: `${CDN}/rolled-oats.jpg`, calories: 389, protein: 17, carbs: 66, fat: 7 },
    { id: 'quinoa', name: 'Quinoa', image: `${CDN}/quinoa.jpg`, calories: 120, protein: 4, carbs: 21, fat: 2 },
    { id: 'spaghetti', name: 'Pasta', image: `${CDN}/spaghetti.jpg`, calories: 158, protein: 6, carbs: 31, fat: 1 },
    { id: 'sweet-potato', name: 'Sweet Potato', image: `${CDN}/sweet-potato.jpg`, calories: 86, protein: 2, carbs: 20, fat: 0 },
    { id: 'whole-wheat-bread', name: 'Whole Wheat Bread', image: `${CDN}/whole-wheat-bread.jpg`, calories: 247, protein: 13, carbs: 41, fat: 4 },
    { id: 'white-bread', name: 'White Bread', image: `${CDN}/white-bread.jpg`, calories: 265, protein: 9, carbs: 51, fat: 3 },
    { id: 'rye-bread', name: 'Rye Bread', image: `${CDN}/rye-bread.jpg`, calories: 259, protein: 9, carbs: 48, fat: 3 },
    { id: 'pita-bread', name: 'Pita Bread', image: `${CDN}/pita-bread.jpg`, calories: 275, protein: 9, carbs: 56, fat: 1 },
    { id: 'cornbread', name: 'Cornbread', image: `${CDN}/cornbread.jpg`, calories: 198, protein: 4, carbs: 29, fat: 7 },
    { id: 'granola', name: 'Granola', image: `${CDN}/granola.jpg`, calories: 471, protein: 11, carbs: 65, fat: 20 },
    { id: 'rice-cakes', name: 'Rice Cakes', image: `${CDN}/rice-cakes.jpg`, calories: 387, protein: 8, carbs: 82, fat: 3 },
    { id: 'crackers', name: 'Crackers', image: `${CDN}/crackers.jpg`, calories: 502, protein: 9, carbs: 68, fat: 22 },
    { id: 'tortilla-chips', name: 'Tortilla Chips', image: `${CDN}/tortilla-chips.jpg`, calories: 489, protein: 7, carbs: 63, fat: 23 },
    { id: 'popcorn', name: 'Popcorn', image: `${CDN}/popcorn.jpg`, calories: 375, protein: 12, carbs: 74, fat: 4 },
    { id: 'rice-noodles', name: 'Rice Noodles', image: `${CDN}/rice-noodles.jpg`, calories: 108, protein: 2, carbs: 25, fat: 0 },
    { id: 'egg-noodles', name: 'Egg Noodles', image: `${CDN}/egg-noodles.jpg`, calories: 138, protein: 5, carbs: 25, fat: 2 },
    { id: 'soba-noodles', name: 'Soba Noodles', image: `${CDN}/soba-noodles.jpg`, calories: 99, protein: 5, carbs: 21, fat: 0 },
    { id: 'almond-flour', name: 'Almond Flour', image: `${CDN}/almond-flour.jpg`, calories: 571, protein: 21, carbs: 21, fat: 50 },
    { id: 'brown-rice', name: 'Brown Rice', image: null, calories: 216, protein: 5, carbs: 45, fat: 2 },
    { id: 'white-rice', name: 'White Rice', image: null, calories: 130, protein: 3, carbs: 28, fat: 0 },
    { id: 'potato', name: 'Potato', image: null, calories: 77, protein: 2, carbs: 17, fat: 0 },
    { id: 'corn', name: 'Corn', image: null, calories: 86, protein: 3, carbs: 19, fat: 1 },
    { id: 'barley', name: 'Barley', image: null, calories: 354, protein: 12, carbs: 73, fat: 2 },
    { id: 'couscous', name: 'Couscous', image: null, calories: 112, protein: 4, carbs: 23, fat: 0 },
    { id: 'bulgur', name: 'Bulgur Wheat', image: null, calories: 83, protein: 3, carbs: 19, fat: 0 },
    { id: 'millet', name: 'Millet', image: null, calories: 378, protein: 11, carbs: 73, fat: 4 },
    { id: 'whole-wheat-pasta', name: 'Whole Wheat Pasta', image: null, calories: 157, protein: 7, carbs: 32, fat: 1 },
    { id: 'bagel', name: 'Bagel', image: null, calories: 245, protein: 10, carbs: 48, fat: 1 },
    { id: 'tortilla', name: 'Flour Tortilla', image: null, calories: 312, protein: 8, carbs: 51, fat: 8 },
    { id: 'english-muffin', name: 'English Muffin', image: null, calories: 227, protein: 8, carbs: 44, fat: 2 },

    // ── VEGETABLES ───────────────────────────────────────────
    { id: 'broccoli', name: 'Broccoli', image: `${CDN}/broccoli.jpg`, calories: 34, protein: 3, carbs: 7, fat: 0 },
    { id: 'spinach', name: 'Spinach', image: `${CDN}/spinach.jpg`, calories: 23, protein: 3, carbs: 4, fat: 0 },
    { id: 'kale', name: 'Kale', image: `${CDN}/kale.jpg`, calories: 49, protein: 4, carbs: 9, fat: 1 },
    { id: 'tomato', name: 'Tomato', image: `${CDN}/tomato.jpg`, calories: 18, protein: 1, carbs: 4, fat: 0 },
    { id: 'cherry-tomatoes', name: 'Cherry Tomatoes', image: `${CDN}/cherry-tomatoes.jpg`, calories: 18, protein: 1, carbs: 4, fat: 0 },
    { id: 'cucumber', name: 'Cucumber', image: `${CDN}/cucumber.jpg`, calories: 15, protein: 1, carbs: 4, fat: 0 },
    { id: 'red-bell-pepper', name: 'Red Bell Pepper', image: `${CDN}/red-bell-pepper.jpg`, calories: 31, protein: 1, carbs: 6, fat: 0 },
    { id: 'green-bell-pepper', name: 'Green Bell Pepper', image: `${CDN}/green-bell-pepper.jpg`, calories: 20, protein: 1, carbs: 5, fat: 0 },
    { id: 'carrots', name: 'Carrots', image: `${CDN}/carrots.jpg`, calories: 41, protein: 1, carbs: 10, fat: 0 },
    { id: 'zucchini', name: 'Zucchini', image: `${CDN}/zucchini.jpg`, calories: 17, protein: 1, carbs: 3, fat: 0 },
    { id: 'asparagus', name: 'Asparagus', image: `${CDN}/asparagus.jpg`, calories: 20, protein: 2, carbs: 4, fat: 0 },
    { id: 'peas', name: 'Green Peas', image: `${CDN}/peas.jpg`, calories: 81, protein: 5, carbs: 14, fat: 0 },
    { id: 'mushrooms', name: 'Mushrooms', image: `${CDN}/mushrooms.jpg`, calories: 22, protein: 3, carbs: 3, fat: 0 },
    { id: 'garlic', name: 'Garlic', image: `${CDN}/garlic.jpg`, calories: 149, protein: 6, carbs: 33, fat: 1 },
    { id: 'celery', name: 'Celery', image: `${CDN}/celery.jpg`, calories: 16, protein: 1, carbs: 3, fat: 0 },
    { id: 'cauliflower', name: 'Cauliflower', image: `${CDN}/cauliflower.jpg`, calories: 25, protein: 2, carbs: 5, fat: 0 },
    { id: 'brussels-sprouts', name: 'Brussels Sprouts', image: `${CDN}/brussels-sprouts.jpg`, calories: 43, protein: 3, carbs: 9, fat: 0 },
    { id: 'cabbage', name: 'Cabbage', image: `${CDN}/cabbage.jpg`, calories: 25, protein: 1, carbs: 6, fat: 0 },
    { id: 'beets', name: 'Beets', image: `${CDN}/beets.jpg`, calories: 43, protein: 2, carbs: 10, fat: 0 },
    { id: 'eggplant', name: 'Eggplant', image: `${CDN}/eggplant.jpg`, calories: 25, protein: 1, carbs: 6, fat: 0 },
    { id: 'artichoke-hearts', name: 'Artichoke Hearts', image: `${CDN}/artichoke-hearts.jpg`, calories: 53, protein: 3, carbs: 12, fat: 0 },
    { id: 'snow-peas', name: 'Snow Peas', image: `${CDN}/snow-peas.jpg`, calories: 42, protein: 3, carbs: 8, fat: 0 },
    { id: 'bean-sprouts', name: 'Bean Sprouts', image: `${CDN}/bean-sprouts.jpg`, calories: 30, protein: 3, carbs: 6, fat: 0 },
    { id: 'bok-choy', name: 'Bok Choy', image: `${CDN}/bok-choy.jpg`, calories: 13, protein: 2, carbs: 2, fat: 0 },
    { id: 'swiss-chard', name: 'Swiss Chard', image: `${CDN}/swiss-chard.jpg`, calories: 19, protein: 2, carbs: 4, fat: 0 },
    { id: 'collard-greens', name: 'Collard Greens', image: `${CDN}/collard-greens.jpg`, calories: 32, protein: 3, carbs: 6, fat: 1 },
    { id: 'watercress', name: 'Watercress', image: `${CDN}/watercress.jpg`, calories: 11, protein: 2, carbs: 1, fat: 0 },
    { id: 'red-onion', name: 'Red Onion', image: `${CDN}/red-onion.jpg`, calories: 40, protein: 1, carbs: 9, fat: 0 },
    { id: 'fennel', name: 'Fennel', image: `${CDN}/fennel.jpg`, calories: 31, protein: 1, carbs: 7, fat: 0 },
    { id: 'leeks', name: 'Leeks', image: `${CDN}/leeks.jpg`, calories: 61, protein: 2, carbs: 14, fat: 0 },
    { id: 'turnips', name: 'Turnips', image: `${CDN}/turnips.jpg`, calories: 28, protein: 1, carbs: 6, fat: 0 },
    { id: 'jicama', name: 'Jicama', image: `${CDN}/jicama.jpg`, calories: 38, protein: 1, carbs: 9, fat: 0 },
    { id: 'avocado', name: 'Avocado', image: `${CDN}/avocado.jpg`, calories: 160, protein: 2, carbs: 9, fat: 15 },
    { id: 'onion', name: 'Onion', image: null, calories: 40, protein: 1, carbs: 9, fat: 0 },
    { id: 'green-beans', name: 'Green Beans', image: null, calories: 31, protein: 2, carbs: 7, fat: 0 },
    { id: 'lettuce', name: 'Lettuce', image: null, calories: 15, protein: 1, carbs: 3, fat: 0 },
    { id: 'radish', name: 'Radish', image: null, calories: 16, protein: 1, carbs: 3, fat: 0 },
    { id: 'arugula', name: 'Arugula', image: null, calories: 25, protein: 3, carbs: 4, fat: 1 },

    // ── FRUITS ───────────────────────────────────────────────
    { id: 'bananas', name: 'Banana', image: `${CDN}/bananas.jpg`, calories: 89, protein: 1, carbs: 23, fat: 0 },
    { id: 'strawberries', name: 'Strawberries', image: `${CDN}/strawberries.jpg`, calories: 32, protein: 1, carbs: 8, fat: 0 },
    { id: 'blueberries', name: 'Blueberries', image: `${CDN}/blueberries.jpg`, calories: 57, protein: 1, carbs: 14, fat: 1 },
    { id: 'raspberries', name: 'Raspberries', image: `${CDN}/raspberries.jpg`, calories: 52, protein: 1, carbs: 12, fat: 1 },
    { id: 'apple', name: 'Apple', image: `${CDN}/apple.jpg`, calories: 52, protein: 0, carbs: 14, fat: 0 },
    { id: 'orange', name: 'Orange', image: `${CDN}/orange.jpg`, calories: 47, protein: 1, carbs: 12, fat: 0 },
    { id: 'mango', name: 'Mango', image: `${CDN}/mango.jpg`, calories: 60, protein: 1, carbs: 15, fat: 0 },
    { id: 'pineapple', name: 'Pineapple', image: `${CDN}/pineapple.jpg`, calories: 50, protein: 1, carbs: 13, fat: 0 },
    { id: 'watermelon', name: 'Watermelon', image: `${CDN}/watermelon.jpg`, calories: 30, protein: 1, carbs: 8, fat: 0 },
    { id: 'pear', name: 'Pear', image: `${CDN}/pear.jpg`, calories: 57, protein: 0, carbs: 15, fat: 0 },
    { id: 'grapefruit', name: 'Grapefruit', image: `${CDN}/grapefruit.jpg`, calories: 42, protein: 1, carbs: 11, fat: 0 },
    { id: 'cherries', name: 'Cherries', image: `${CDN}/cherries.jpg`, calories: 63, protein: 1, carbs: 16, fat: 0 },
    { id: 'pomegranate', name: 'Pomegranate', image: `${CDN}/pomegranate.jpg`, calories: 83, protein: 2, carbs: 19, fat: 1 },
    { id: 'lemon', name: 'Lemon', image: `${CDN}/lemon.jpg`, calories: 29, protein: 1, carbs: 9, fat: 0 },
    { id: 'peaches', name: 'Peach', image: `${CDN}/peaches.jpg`, calories: 39, protein: 1, carbs: 10, fat: 0 },
    { id: 'plum', name: 'Plum', image: `${CDN}/plum.jpg`, calories: 46, protein: 1, carbs: 11, fat: 0 },
    { id: 'apricot', name: 'Apricot', image: `${CDN}/apricot.jpg`, calories: 48, protein: 1, carbs: 11, fat: 0 },
    { id: 'dates', name: 'Dates', image: `${CDN}/dates.jpg`, calories: 282, protein: 2, carbs: 75, fat: 0 },
    { id: 'papaya', name: 'Papaya', image: `${CDN}/papaya.jpg`, calories: 43, protein: 0, carbs: 11, fat: 0 },
    { id: 'passion-fruit', name: 'Passion Fruit', image: `${CDN}/passion-fruit.jpg`, calories: 97, protein: 2, carbs: 23, fat: 1 },
    { id: 'guava', name: 'Guava', image: `${CDN}/guava.jpg`, calories: 68, protein: 3, carbs: 14, fat: 1 },
    { id: 'coconut', name: 'Coconut', image: `${CDN}/coconut.jpg`, calories: 354, protein: 3, carbs: 15, fat: 33 },
    { id: 'dried-mango', name: 'Dried Mango', image: `${CDN}/dried-mango.jpg`, calories: 319, protein: 3, carbs: 78, fat: 1 },
    { id: 'raisins', name: 'Raisins', image: `${CDN}/raisins.jpg`, calories: 299, protein: 3, carbs: 79, fat: 0 },
    { id: 'prunes', name: 'Prunes', image: `${CDN}/prunes.jpg`, calories: 240, protein: 2, carbs: 64, fat: 0 },
    { id: 'goji-berries', name: 'Goji Berries', image: `${CDN}/goji-berries.jpg`, calories: 349, protein: 14, carbs: 77, fat: 0 },
    { id: 'grapes', name: 'Grapes', image: null, calories: 69, protein: 1, carbs: 18, fat: 0 },
    { id: 'kiwi', name: 'Kiwi', image: null, calories: 61, protein: 1, carbs: 15, fat: 1 },
    { id: 'dried-apricots', name: 'Dried Apricots', image: null, calories: 241, protein: 3, carbs: 63, fat: 0 },

    // ── NUTS & SEEDS ─────────────────────────────────────────
    { id: 'almonds', name: 'Almonds', image: `${CDN}/almonds.jpg`, calories: 579, protein: 21, carbs: 22, fat: 50 },
    { id: 'peanut-butter', name: 'Peanut Butter', image: `${CDN}/peanut-butter.jpg`, calories: 588, protein: 25, carbs: 20, fat: 50 },
    { id: 'walnuts', name: 'Walnuts', image: `${CDN}/walnuts.jpg`, calories: 654, protein: 15, carbs: 14, fat: 65 },
    { id: 'cashews', name: 'Cashews', image: `${CDN}/cashews.jpg`, calories: 553, protein: 18, carbs: 30, fat: 44 },
    { id: 'pistachios', name: 'Pistachios', image: `${CDN}/pistachios.jpg`, calories: 562, protein: 20, carbs: 28, fat: 45 },
    { id: 'pecans', name: 'Pecans', image: `${CDN}/pecans.jpg`, calories: 691, protein: 9, carbs: 14, fat: 72 },
    { id: 'macadamia-nuts', name: 'Macadamia Nuts', image: `${CDN}/macadamia-nuts.jpg`, calories: 718, protein: 8, carbs: 14, fat: 76 },
    { id: 'hazelnuts', name: 'Hazelnuts', image: `${CDN}/hazelnuts.jpg`, calories: 628, protein: 15, carbs: 17, fat: 61 },
    { id: 'sunflower-seeds', name: 'Sunflower Seeds', image: `${CDN}/sunflower-seeds.jpg`, calories: 584, protein: 21, carbs: 20, fat: 51 },
    { id: 'pumpkin-seeds', name: 'Pumpkin Seeds', image: `${CDN}/pumpkin-seeds.jpg`, calories: 559, protein: 30, carbs: 11, fat: 49 },
    { id: 'chia-seeds', name: 'Chia Seeds', image: `${CDN}/chia-seeds.jpg`, calories: 486, protein: 17, carbs: 42, fat: 31 },
    { id: 'sesame-seeds', name: 'Sesame Seeds', image: `${CDN}/sesame-seeds.jpg`, calories: 573, protein: 17, carbs: 23, fat: 50 },
    { id: 'pine-nuts', name: 'Pine Nuts', image: `${CDN}/pine-nuts.jpg`, calories: 673, protein: 14, carbs: 13, fat: 68 },
    { id: 'almond-butter', name: 'Almond Butter', image: `${CDN}/almond-butter.jpg`, calories: 614, protein: 21, carbs: 22, fat: 55 },
    { id: 'tahini', name: 'Tahini', image: null, calories: 595, protein: 17, carbs: 21, fat: 54 },
    { id: 'hemp-seeds', name: 'Hemp Seeds', image: null, calories: 553, protein: 32, carbs: 9, fat: 49 },
    { id: 'flaxseeds', name: 'Flaxseeds', image: null, calories: 534, protein: 18, carbs: 29, fat: 42 },

    // ── OILS & FATS ──────────────────────────────────────────
    { id: 'olive-oil', name: 'Olive Oil', image: `${CDN}/olive-oil.jpg`, calories: 884, protein: 0, carbs: 0, fat: 100 },
    { id: 'coconut-oil', name: 'Coconut Oil', image: `${CDN}/coconut-oil.jpg`, calories: 862, protein: 0, carbs: 0, fat: 100 },
    { id: 'ghee', name: 'Ghee', image: `${CDN}/ghee.jpg`, calories: 876, protein: 0, carbs: 0, fat: 99 },
    { id: 'avocado-oil', name: 'Avocado Oil', image: `${CDN}/avocado-oil.jpg`, calories: 884, protein: 0, carbs: 0, fat: 100 },
    { id: 'flaxseed-oil', name: 'Flaxseed Oil', image: `${CDN}/flaxseed-oil.jpg`, calories: 884, protein: 0, carbs: 0, fat: 100 },
    { id: 'walnut-oil', name: 'Walnut Oil', image: `${CDN}/walnut-oil.jpg`, calories: 884, protein: 0, carbs: 0, fat: 100 },
    { id: 'peanut-oil', name: 'Peanut Oil', image: `${CDN}/peanut-oil.jpg`, calories: 884, protein: 0, carbs: 0, fat: 100 },
    { id: 'sesame-oil', name: 'Sesame Oil', image: `${CDN}/sesame-oil.jpg`, calories: 884, protein: 0, carbs: 0, fat: 100 },

    // ── SUPERFOODS & SUPPLEMENTS ─────────────────────────────
    { id: 'spirulina', name: 'Spirulina', image: `${CDN}/spirulina.jpg`, calories: 290, protein: 57, carbs: 24, fat: 8 },
    { id: 'wheat-germ', name: 'Wheat Germ', image: `${CDN}/wheat-germ.jpg`, calories: 382, protein: 23, carbs: 51, fat: 10 },
    { id: 'cocoa-powder', name: 'Cocoa Powder', image: `${CDN}/cocoa-powder.jpg`, calories: 228, protein: 20, carbs: 58, fat: 14 },
    { id: 'dark-chocolate', name: 'Dark Chocolate', image: `${CDN}/dark-chocolate.jpg`, calories: 598, protein: 5, carbs: 46, fat: 43 },
    { id: 'coconut-water', name: 'Coconut Water', image: `${CDN}/coconut-water.jpg`, calories: 19, protein: 0, carbs: 4, fat: 0 },
    { id: 'matcha-powder', name: 'Matcha', image: `${CDN}/matcha-powder.jpg`, calories: 324, protein: 30, carbs: 40, fat: 5 },
    { id: 'nutritional-yeast', name: 'Nutritional Yeast', image: null, calories: 325, protein: 50, carbs: 38, fat: 8 },
    { id: 'acai-powder', name: 'Acai', image: null, calories: 70, protein: 2, carbs: 4, fat: 5 },

    // ── CONDIMENTS & SAUCES ──────────────────────────────────
    { id: 'honey', name: 'Honey', image: `${CDN}/honey.jpg`, calories: 304, protein: 0, carbs: 82, fat: 0 },
    { id: 'maple-syrup', name: 'Maple Syrup', image: null, calories: 260, protein: 0, carbs: 67, fat: 0 },
    { id: 'molasses', name: 'Molasses', image: `${CDN}/molasses.jpg`, calories: 290, protein: 0, carbs: 75, fat: 0 },
    { id: 'mustard', name: 'Mustard', image: `${CDN}/mustard.jpg`, calories: 66, protein: 4, carbs: 8, fat: 4 },
    { id: 'soy-sauce', name: 'Soy Sauce', image: `${CDN}/soy-sauce.jpg`, calories: 53, protein: 8, carbs: 5, fat: 1 },
    { id: 'ketchup', name: 'Ketchup', image: `${CDN}/ketchup.jpg`, calories: 101, protein: 1, carbs: 27, fat: 0 },
    { id: 'capers', name: 'Capers', image: `${CDN}/capers.jpg`, calories: 23, protein: 2, carbs: 5, fat: 1 },
    { id: 'apple-cider-vinegar', name: 'Apple Cider Vinegar', image: `${CDN}/apple-cider-vinegar.jpg`, calories: 21, protein: 0, carbs: 1, fat: 0 },
    { id: 'balsamic-vinegar', name: 'Balsamic Vinegar', image: `${CDN}/balsamic-vinegar.jpg`, calories: 88, protein: 0, carbs: 17, fat: 0 },
    { id: 'fish-sauce', name: 'Fish Sauce', image: `${CDN}/fish-sauce.jpg`, calories: 35, protein: 5, carbs: 4, fat: 0 },
    { id: 'hot-sauce', name: 'Hot Sauce', image: null, calories: 20, protein: 0, carbs: 5, fat: 0 },
    { id: 'agave', name: 'Agave Nectar', image: null, calories: 310, protein: 0, carbs: 76, fat: 0 },

    // ── SPICES & HERBS ───────────────────────────────────────
    { id: 'turmeric', name: 'Turmeric', image: `${CDN}/turmeric.jpg`, calories: 312, protein: 10, carbs: 67, fat: 3 },
    { id: 'ginger', name: 'Ginger', image: `${CDN}/ginger.jpg`, calories: 80, protein: 2, carbs: 18, fat: 1 },
    { id: 'cinnamon', name: 'Cinnamon', image: `${CDN}/cinnamon.jpg`, calories: 247, protein: 4, carbs: 81, fat: 1 },
    { id: 'paprika', name: 'Paprika', image: `${CDN}/paprika.jpg`, calories: 282, protein: 14, carbs: 54, fat: 13 },
    { id: 'oregano', name: 'Oregano', image: `${CDN}/oregano.jpg`, calories: 265, protein: 9, carbs: 69, fat: 4 },
    { id: 'basil', name: 'Basil', image: `${CDN}/basil.jpg`, calories: 233, protein: 23, carbs: 26, fat: 4 },
    { id: 'black-pepper', name: 'Black Pepper', image: `${CDN}/black-pepper.jpg`, calories: 251, protein: 10, carbs: 64, fat: 3 },
    { id: 'curry-powder', name: 'Curry Powder', image: `${CDN}/curry-powder.jpg`, calories: 325, protein: 14, carbs: 58, fat: 14 },
    { id: 'cumin', name: 'Cumin', image: `${CDN}/cumin.jpg`, calories: 375, protein: 18, carbs: 44, fat: 22 },
    { id: 'thyme', name: 'Thyme', image: `${CDN}/thyme.jpg`, calories: 276, protein: 9, carbs: 64, fat: 7 },
    { id: 'chili-powder', name: 'Chili Powder', image: `${CDN}/chili-powder.jpg`, calories: 282, protein: 14, carbs: 50, fat: 14 },
    { id: 'garlic-powder', name: 'Garlic Powder', image: `${CDN}/garlic-powder.jpg`, calories: 331, protein: 16, carbs: 73, fat: 1 },
    { id: 'onion-powder', name: 'Onion Powder', image: `${CDN}/onion-powder.jpg`, calories: 341, protein: 11, carbs: 79, fat: 1 },

    // ── FERMENTED & BEVERAGES ────────────────────────────────
    { id: 'kimchi', name: 'Kimchi', image: `${CDN}/kimchi.jpg`, calories: 15, protein: 1, carbs: 3, fat: 0 },
    { id: 'sauerkraut', name: 'Sauerkraut', image: `${CDN}/sauerkraut.jpg`, calories: 27, protein: 1, carbs: 6, fat: 0 },
    { id: 'apple-juice', name: 'Apple Juice', image: `${CDN}/apple-juice.jpg`, calories: 46, protein: 0, carbs: 11, fat: 0 },
    { id: 'orange-juice', name: 'Orange Juice', image: `${CDN}/orange-juice.jpg`, calories: 45, protein: 1, carbs: 10, fat: 0 },
    { id: 'cranberry-juice', name: 'Cranberry Juice', image: `${CDN}/cranberry-juice.jpg`, calories: 46, protein: 0, carbs: 12, fat: 0 },
    { id: 'espresso', name: 'Espresso', image: `${CDN}/espresso.jpg`, calories: 9, protein: 0, carbs: 2, fat: 0 },
    { id: 'kombucha', name: 'Kombucha', image: null, calories: 30, protein: 0, carbs: 7, fat: 0 },
    { id: 'green-tea', name: 'Green Tea', image: null, calories: 2, protein: 0, carbs: 0, fat: 0 },
];

// ─── Single Swipe Card ─────────────────────────────────────
function SwipeCard({ food, onSwipe, isTop, exitDir }) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-150, 0, 150], [-12, 0, 12]);
    const likeOpacity = useTransform(x, [20, 100], [0, 1]);
    const nopeOpacity = useTransform(x, [-100, -20], [1, 0]);
    const [imageError, setImageError] = useState(false);

    const handleDragEnd = (_, info) => {
        const THRESHOLD_OFFSET = 100;
        const THRESHOLD_VELOCITY = 500;
        if (info.offset.x > THRESHOLD_OFFSET || info.velocity.x > THRESHOLD_VELOCITY) {
            onSwipe('right');
        } else if (info.offset.x < -THRESHOLD_OFFSET || info.velocity.x < -THRESHOLD_VELOCITY) {
            onSwipe('left');
        }
    };

    return (
        <motion.div
            className="absolute inset-x-0 top-0 cursor-grab active:cursor-grabbing"
            style={{ x, rotate, zIndex: isTop ? 10 : 5 }}
            drag={isTop ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
            onDragEnd={isTop ? handleDragEnd : undefined}
            initial={isTop ? { scale: 1 } : { scale: 0.95 }}
            animate={isTop ? { scale: 1 } : { scale: 0.95 }}
            exit={{ x: exitDir === 'right' ? 500 : -500, opacity: 0, transition: { duration: 0.3 } }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
            <div className="w-full rounded-2xl overflow-hidden bg-[#1A1A1A] border border-[#2A2A2A] shadow-2xl flex flex-col">
                <div className="relative w-full shrink bg-[#111] border-b border-[#2A2A2A]" style={{ aspectRatio: '1/1', maxHeight: '38vh' }}>
                    {food.image && !imageError ? (
                        <img
                            src={food.image}
                            alt={food.name}
                            className="w-full h-full object-cover"
                            draggable={false}
                            onError={() => setImageError(true)}
                        />
                    ) : null}
                    <div className="absolute inset-0 flex items-center justify-center text-6xl" style={{ display: (food.image && !imageError) ? 'none' : 'flex' }}>
                        🍽️
                    </div>
                    {isTop && (
                        <motion.div className="absolute top-6 left-6 px-4 py-2 border-4 border-green-400 rounded-xl -rotate-12" style={{ opacity: likeOpacity }}>
                            <span className="text-green-400 text-3xl font-black tracking-wider">LIKE</span>
                        </motion.div>
                    )}
                    {isTop && (
                        <motion.div className="absolute top-6 right-6 px-4 py-2 border-4 border-red-400 rounded-xl rotate-12" style={{ opacity: nopeOpacity }}>
                            <span className="text-red-400 text-3xl font-black tracking-wider">NOPE</span>
                        </motion.div>
                    )}
                </div>
                <div className="p-4 shrink-0 bg-[#1A1A1A]">
                    <h3 className="text-xl font-bold text-white truncate mb-3">{food.name}</h3>
                    <div className="flex justify-between gap-2">
                        <div className="flex items-center gap-1.5 bg-[#00F2FF]/10 rounded-lg px-2.5 py-2 flex-1 justify-center">
                            <Flame className="w-4 h-4 text-[#00F2FF]" />
                            <span className="text-sm font-bold text-[#00F2FF]">{food.calories}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-[#CCFF00]/10 rounded-lg px-2.5 py-2 flex-1 justify-center">
                            <Beef className="w-4 h-4 text-[#CCFF00]" />
                            <span className="text-sm font-bold text-[#CCFF00]">{food.protein}g</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-[#FF6B6B]/10 rounded-lg px-2.5 py-2 flex-1 justify-center">
                            <Wheat className="w-4 h-4 text-[#FF6B6B]" />
                            <span className="text-sm font-bold text-[#FF6B6B]">{food.carbs}g</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-[#FFD93D]/10 rounded-lg px-2.5 py-2 flex-1 justify-center">
                            <Droplet className="w-4 h-4 text-[#FFD93D]" />
                            <span className="text-sm font-bold text-[#FFD93D]">{food.fat}g</span>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Main FoodSwipeGame Component ───────────────────────────
export default function FoodSwipeGame({ onClose, existingLiked = [], existingDisliked = [] }) {
    const { t } = useTranslation();
    const [foods, setFoods] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [swipedCount, setSwipedCount] = useState(0);
    const [lastAction, setLastAction] = useState(null);
    const [exitDir, setExitDir] = useState(null);
    const [allFoodsRated, setAllFoodsRated] = useState(false);
    const currentIndexRef = useRef(0);
    const foodsRef = useRef([]);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        const existingNames = new Set([
            ...existingLiked.map(f => f.name?.toLowerCase()),
            ...existingDisliked.map(f => f.name?.toLowerCase())
        ]);
        const available = FOOD_DATABASE
            .filter(f => !existingNames.has(f.name.toLowerCase()))
            .sort(() => Math.random() - 0.5);

        if (available.length === 0) {
            setAllFoodsRated(true);
            setIsLoading(false);
            return;
        }

        const session = available.slice(0, SESSION_LIMIT);
        foodsRef.current = session;
        setFoods(session);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'ArrowRight') triggerSwipe('right');
            if (e.key === 'ArrowLeft') triggerSwipe('left');
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, []);

    const triggerSwipe = (direction) => {
        if (currentIndexRef.current >= foodsRef.current.length) return;
        handleSwipe(direction);
    };

    const handleSwipe = useCallback(async (direction) => {
        const idx = currentIndexRef.current;
        const food = foodsRef.current[idx];
        if (!food) return;

        const action = direction === 'right' ? 'like' : 'dislike';
        setExitDir(direction);
        setLastAction(action);
        setSwipedCount(prev => prev + 1);
        currentIndexRef.current = idx + 1;
        setCurrentIndex(idx + 1);

        // Auto-close after last food in session
        if (idx + 1 >= foodsRef.current.length) {
            setTimeout(() => onCloseRef.current(), 1000);
        }

        try {
            await api.post('/users/food-preference', {
                food: { name: food.name, image: food.image, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat },
                action
            });
        } catch (err) {
            console.error('Failed to save preference:', err);
        }
    }, []);

    const currentFood = foods[currentIndex];
    const nextFood = foods[currentIndex + 1];
    const sessionTotal = foods.length;
    const isFinished = !isLoading && currentIndex >= sessionTotal;

    return (
        <motion.div
            className="fixed inset-0 z-[70] bg-black/95 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="flex items-center justify-between px-4 py-3 shrink-0">
                <span className="text-sm text-gray-500 w-16">{swipedCount}/{Math.min(SESSION_LIMIT, sessionTotal)}</span>
                <h2 className="text-lg font-bold text-white">{t('nutrition.rateYourFood', 'Rate Your Food')} 💘</h2>
                <div className="w-16" />
            </div>

            <div className="flex-1 relative mx-4 mt-2 max-w-sm w-full self-center">
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-[#00F2FF]" />
                        <p className="text-gray-400 text-sm">{t('nutrition.loadingFoods', 'Loading foods...')}</p>
                    </div>
                ) : allFoodsRated ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8">
                        <div className="text-6xl mb-4">😊</div>
                        <h3 className="text-2xl font-bold text-white">{t('nutrition.allRatedTitle', 'We already know your preferences!')}</h3>
                        <p className="text-gray-400 text-base">{t('nutrition.allRatedSub', 'You can request a meal from the AI coach')}</p>
                        <button onClick={onClose} className="mt-4 px-8 py-3 rounded-xl gradient-cyan text-black font-semibold">
                            {t('nutrition.requestMeal', 'Request a Meal')}
                        </button>
                    </div>
                ) : isFinished ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8">
                        <div className="text-6xl mb-4">🎉</div>
                        <h3 className="text-2xl font-bold text-white">{t('nutrition.sessionDone', 'Session Complete!')}</h3>
                        <p className="text-gray-400">{t('nutrition.savingPrefs', 'Saving your preferences...')}</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {nextFood && (
                            <SwipeCard key={nextFood.id} food={nextFood} onSwipe={() => { }} isTop={false} exitDir={null} />
                        )}
                        {currentFood && (
                            <SwipeCard key={currentFood.id} food={currentFood} onSwipe={handleSwipe} isTop={true} exitDir={exitDir} />
                        )}
                    </AnimatePresence>
                )}
            </div>

            {!isLoading && !isFinished && !allFoodsRated && (
                <div className="flex flex-col items-center gap-3 pb-2 mb-[72px] shrink-0 relative z-20">
                    <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-xs text-gray-500 tracking-wide text-center px-6"
                    >
                        <span className="text-red-400 font-semibold">✕</span>
                        {' '}{t('nutrition.swipeHint', 'Swipe what you love — so we know what to cook for you 🍽️')}{'  '}
                        <span className="text-green-400 font-semibold">♥</span>
                    </motion.p>
                    <div className="flex justify-center gap-10">
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => handleSwipe('left')}
                            className="w-12 h-12 rounded-full border-2 border-red-400/50 flex items-center justify-center bg-red-400/10 hover:bg-red-400/20 transition-colors"
                        >
                            <X className="w-6 h-6 text-red-400" />
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            onClick={() => handleSwipe('right')}
                            className="w-12 h-12 rounded-full border-2 border-green-400/50 flex items-center justify-center bg-green-400/10 hover:bg-green-400/20 transition-colors"
                        >
                            <Heart className="w-6 h-6 text-green-400" />
                        </motion.button>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {lastAction && (
                    <motion.div
                        key={lastAction + swipedCount}
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.8 }}
                        className={`absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold ${lastAction === 'like' ? 'bg-green-400/20 text-green-400' : 'bg-red-400/20 text-red-400'}`}
                    >
                        {lastAction === 'like' ? '❤️ Liked!' : '✕ Nope'}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
