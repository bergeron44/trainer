const COUNTRY_NAME_TO_CODE = new Map([
    ['israel', 'IL'],
    ['united states', 'US'],
    ['usa', 'US'],
    ['united kingdom', 'GB'],
    ['uk', 'GB'],
    ['canada', 'CA'],
    ['australia', 'AU'],
    ['new zealand', 'NZ'],
    ['switzerland', 'CH'],
    ['japan', 'JP'],
    ['china', 'CN'],
    ['india', 'IN'],
    ['south korea', 'KR'],
    ['singapore', 'SG'],
    ['mexico', 'MX'],
    ['brazil', 'BR'],
    ['argentina', 'AR'],
    ['south africa', 'ZA'],
    ['norway', 'NO'],
    ['sweden', 'SE'],
    ['denmark', 'DK'],
    ['poland', 'PL'],
    ['czech republic', 'CZ'],
    ['hungary', 'HU'],
    ['romania', 'RO'],
    ['turkey', 'TR'],
    ['united arab emirates', 'AE'],
    ['saudi arabia', 'SA'],
    ['qatar', 'QA'],
    ['kuwait', 'KW'],
    ['bahrain', 'BH'],
    ['jordan', 'JO'],
    ['egypt', 'EG'],
]);

const EUR_COUNTRIES = new Set([
    'AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT',
    'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'HR',
]);

const COUNTRY_TO_CURRENCY = new Map([
    ['US', 'USD'],
    ['IL', 'ILS'],
    ['GB', 'GBP'],
    ['CA', 'CAD'],
    ['AU', 'AUD'],
    ['NZ', 'NZD'],
    ['CH', 'CHF'],
    ['JP', 'JPY'],
    ['CN', 'CNY'],
    ['IN', 'INR'],
    ['KR', 'KRW'],
    ['SG', 'SGD'],
    ['MX', 'MXN'],
    ['BR', 'BRL'],
    ['AR', 'ARS'],
    ['ZA', 'ZAR'],
    ['NO', 'NOK'],
    ['SE', 'SEK'],
    ['DK', 'DKK'],
    ['PL', 'PLN'],
    ['CZ', 'CZK'],
    ['HU', 'HUF'],
    ['RO', 'RON'],
    ['TR', 'TRY'],
    ['AE', 'AED'],
    ['SA', 'SAR'],
    ['QA', 'QAR'],
    ['KW', 'KWD'],
    ['BH', 'BHD'],
    ['JO', 'JOD'],
    ['EG', 'EGP'],
]);

function toStringSafe(value) {
    return String(value || '').trim();
}

function extractCountryCodeFromLocale(localeValue = '') {
    const locale = toStringSafe(localeValue);
    const localeMatch = locale.match(/[-_]\s*([a-z]{2})\b/i);
    if (localeMatch) return localeMatch[1].toUpperCase();
    return '';
}

function normalizeCountryCode(countryInput = '') {
    const raw = toStringSafe(countryInput);
    if (!raw) return '';

    const exactCode = raw.match(/^[a-z]{2}$/i);
    if (exactCode) return exactCode[0].toUpperCase();

    const extractedFromLocale = extractCountryCodeFromLocale(raw);
    if (extractedFromLocale) return extractedFromLocale;

    const byName = COUNTRY_NAME_TO_CODE.get(raw.toLowerCase());
    if (byName) return byName;

    return '';
}

function extractCountryCodeFromAcceptLanguage(acceptLanguage = '') {
    const value = toStringSafe(acceptLanguage);
    if (!value) return '';

    const firstToken = value.split(',')[0] || '';
    return normalizeCountryCode(firstToken);
}

function getDefaultCurrencyForCountry(countryCode = '') {
    const normalizedCountry = normalizeCountryCode(countryCode);
    if (!normalizedCountry) return 'USD';
    if (EUR_COUNTRIES.has(normalizedCountry)) return 'EUR';
    return COUNTRY_TO_CURRENCY.get(normalizedCountry) || 'USD';
}

function resolveCountryCodeFromContext({
    providedCountryCode = '',
    headers = {},
    profile = {},
    acceptLanguage = '',
} = {}) {
    const headerCandidates = [
        headers['x-user-country'],
        headers['cf-ipcountry'],
        headers['x-vercel-ip-country'],
        headers['x-country-code'],
    ];

    const profileCandidates = [
        profile.country_code,
        profile.countryCode,
        profile.country,
        profile.locale,
    ];

    const candidates = [
        providedCountryCode,
        ...headerCandidates,
        ...profileCandidates,
        extractCountryCodeFromAcceptLanguage(acceptLanguage),
    ];

    for (const candidate of candidates) {
        const normalized = normalizeCountryCode(candidate);
        if (normalized) return normalized;
    }

    return '';
}

function resolveDefaultCurrencyFromContext(context = {}) {
    const countryCode = resolveCountryCodeFromContext(context);
    return getDefaultCurrencyForCountry(countryCode);
}

module.exports = {
    normalizeCountryCode,
    extractCountryCodeFromLocale,
    extractCountryCodeFromAcceptLanguage,
    getDefaultCurrencyForCountry,
    resolveCountryCodeFromContext,
    resolveDefaultCurrencyFromContext,
};
