const fs = require('fs');
const path = require('path');

function loadJsonFile(fileName, fallback) {
    try {
        const filePath = path.join(__dirname, fileName);
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (_error) {
        return fallback;
    }
}

function loadSafeRuleLayer() {
    return {
        fewShotExamples: loadJsonFile('fewShotExamples.json', []),
        normalizationDictionary: loadJsonFile('normalizationDictionary.json', {}),
        foodSynonyms: loadJsonFile('foodSynonyms.json', {}),
        promptClarifications: loadJsonFile('promptClarifications.json', []),
        ambiguityRules: loadJsonFile('ambiguityRules.json', []),
        noteRoutingRules: loadJsonFile('noteRoutingRules.json', []),
        conflictDetectionHints: loadJsonFile('conflictDetectionHints.json', []),
    };
}

module.exports = {
    loadSafeRuleLayer,
};
