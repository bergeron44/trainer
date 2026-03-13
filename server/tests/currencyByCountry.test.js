const test = require('node:test');
const assert = require('node:assert/strict');

const {
    getDefaultCurrencyForCountry,
    resolveDefaultCurrencyFromContext,
} = require('../utils/currencyByCountry');

test('maps IL to ILS', () => {
    assert.equal(getDefaultCurrencyForCountry('IL'), 'ILS');
});

test('maps US to USD', () => {
    assert.equal(getDefaultCurrencyForCountry('US'), 'USD');
});

test('maps eurozone country to EUR', () => {
    assert.equal(getDefaultCurrencyForCountry('FR'), 'EUR');
});

test('resolves currency from context country_code', () => {
    assert.equal(resolveDefaultCurrencyFromContext({ providedCountryCode: 'IL' }), 'ILS');
});

test('resolves currency from accept-language fallback', () => {
    assert.equal(
        resolveDefaultCurrencyFromContext({ acceptLanguage: 'he-IL,he;q=0.9,en-US;q=0.8' }),
        'ILS'
    );
});
