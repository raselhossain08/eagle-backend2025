const axios = require('axios');

/**
 * Multi-Currency Exchange Rate Service
 * Supports multiple providers for currency conversion
 */
class CurrencyService {
  constructor() {
    this.baseCurrency = process.env.BASE_CURRENCY || 'USD';
    this.exchangeRateProviders = {
      FIXER: new FixerProvider(),
      EXCHANGERATE_API: new ExchangeRateAPIProvider(),
      OPEN_EXCHANGE_RATES: new OpenExchangeRatesProvider()
    };
    
    this.defaultProvider = process.env.EXCHANGE_RATE_PROVIDER || 'EXCHANGERATE_API';
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes
    this.exchangeRateCache = new Map();
  }

  /**
   * Get exchange rate from one currency to another
   */
  async getExchangeRate(fromCurrency, toCurrency, date = null) {
    try {
      // If same currency, return 1
      if (fromCurrency === toCurrency) {
        return 1.0;
      }

      // Check cache first
      const cacheKey = `${fromCurrency}_${toCurrency}_${date || 'latest'}`;
      const cached = this.exchangeRateCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.rate;
      }

      // Get rate from provider
      const provider = this.exchangeRateProviders[this.defaultProvider];
      const rate = await provider.getExchangeRate(fromCurrency, toCurrency, date);

      // Cache the result
      this.exchangeRateCache.set(cacheKey, {
        rate,
        timestamp: Date.now()
      });

      return rate;
    } catch (error) {
      console.error('Exchange rate fetch error:', error);
      
      // Try fallback provider
      if (this.defaultProvider !== 'EXCHANGERATE_API') {
        try {
          const fallbackProvider = this.exchangeRateProviders['EXCHANGERATE_API'];
          return await fallbackProvider.getExchangeRate(fromCurrency, toCurrency, date);
        } catch (fallbackError) {
          console.error('Fallback exchange rate error:', fallbackError);
        }
      }

      throw new Error(`Failed to get exchange rate from ${fromCurrency} to ${toCurrency}`);
    }
  }

  /**
   * Convert amount from one currency to another
   */
  async convertCurrency(amount, fromCurrency, toCurrency, date = null) {
    try {
      const rate = await this.getExchangeRate(fromCurrency, toCurrency, date);
      return amount * rate;
    } catch (error) {
      console.error('Currency conversion error:', error);
      throw error;
    }
  }

  /**
   * Get multiple exchange rates for a base currency
   */
  async getMultipleRates(baseCurrency, targetCurrencies, date = null) {
    try {
      const rates = {};
      
      // Use batch API if available
      const provider = this.exchangeRateProviders[this.defaultProvider];
      if (provider.getMultipleRates) {
        return await provider.getMultipleRates(baseCurrency, targetCurrencies, date);
      }

      // Otherwise get rates individually
      for (const targetCurrency of targetCurrencies) {
        rates[targetCurrency] = await this.getExchangeRate(baseCurrency, targetCurrency, date);
      }

      return rates;
    } catch (error) {
      console.error('Multiple rates fetch error:', error);
      throw error;
    }
  }

  /**
   * Get historical exchange rates for a currency pair
   */
  async getHistoricalRates(fromCurrency, toCurrency, startDate, endDate) {
    try {
      const provider = this.exchangeRateProviders[this.defaultProvider];
      
      if (!provider.getHistoricalRates) {
        throw new Error('Historical rates not supported by current provider');
      }

      return await provider.getHistoricalRates(fromCurrency, toCurrency, startDate, endDate);
    } catch (error) {
      console.error('Historical rates error:', error);
      throw error;
    }
  }

  /**
   * Format currency amount with proper symbol and decimal places
   */
  formatCurrency(amount, currency, locale = 'en-US') {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: this.getDecimalPlaces(currency),
        maximumFractionDigits: this.getDecimalPlaces(currency)
      }).format(amount);
    } catch (error) {
      console.error('Currency formatting error:', error);
      return `${this.getCurrencySymbol(currency)}${amount.toFixed(2)}`;
    }
  }

  /**
   * Get decimal places for currency
   */
  getDecimalPlaces(currency) {
    const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'CLP', 'ISK'];
    const threeDecimalCurrencies = ['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'];
    
    if (zeroDecimalCurrencies.includes(currency)) {
      return 0;
    } else if (threeDecimalCurrencies.includes(currency)) {
      return 3;
    }
    
    return 2;
  }

  /**
   * Get currency symbol
   */
  getCurrencySymbol(currency) {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'CHF': 'CHF',
      'CNY': '¥',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr',
      'PLN': 'zł',
      'CZK': 'Kč',
      'HUF': 'Ft',
      'RUB': '₽',
      'BRL': 'R$',
      'INR': '₹',
      'SGD': 'S$',
      'HKD': 'HK$',
      'MXN': '$',
      'ZAR': 'R',
      'NZD': 'NZ$',
      'TRY': '₺',
      'KRW': '₩',
      'THB': '฿'
    };
    
    return symbols[currency] || currency;
  }

  /**
   * Validate currency code
   */
  isValidCurrency(currency) {
    const validCurrencies = [
      'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NOK',
      'DKK', 'PLN', 'CZK', 'HUF', 'RUB', 'BRL', 'INR', 'SGD', 'HKD', 'MXN',
      'ZAR', 'NZD', 'TRY', 'KRW', 'THB', 'ILS', 'CLP', 'PHP', 'AED', 'SAR',
      'EGP', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LBP', 'TND', 'MAD', 'DZD'
    ];
    
    return validCurrencies.includes(currency);
  }

  /**
   * Clear exchange rate cache
   */
  clearCache() {
    this.exchangeRateCache.clear();
  }
}

/**
 * Fixer.io Exchange Rate Provider
 */
class FixerProvider {
  constructor() {
    this.apiKey = process.env.FIXER_API_KEY;
    this.baseUrl = 'http://data.fixer.io/api';
  }

  async getExchangeRate(fromCurrency, toCurrency, date = null) {
    try {
      if (!this.apiKey) {
        throw new Error('Fixer API key not configured');
      }

      const endpoint = date ? 'historical' : 'latest';
      const url = `${this.baseUrl}/${endpoint}`;
      
      const params = {
        access_key: this.apiKey,
        base: fromCurrency,
        symbols: toCurrency
      };
      
      if (date) {
        params.date = date;
      }

      const response = await axios.get(url, { params });
      
      if (!response.data.success) {
        throw new Error(response.data.error?.info || 'Fixer API error');
      }

      return response.data.rates[toCurrency];
    } catch (error) {
      console.error('Fixer API error:', error);
      throw error;
    }
  }

  async getMultipleRates(baseCurrency, targetCurrencies, date = null) {
    try {
      const endpoint = date ? 'historical' : 'latest';
      const url = `${this.baseUrl}/${endpoint}`;
      
      const params = {
        access_key: this.apiKey,
        base: baseCurrency,
        symbols: targetCurrencies.join(',')
      };
      
      if (date) {
        params.date = date;
      }

      const response = await axios.get(url, { params });
      
      if (!response.data.success) {
        throw new Error(response.data.error?.info || 'Fixer API error');
      }

      return response.data.rates;
    } catch (error) {
      console.error('Fixer multiple rates error:', error);
      throw error;
    }
  }
}

/**
 * ExchangeRate-API Provider
 */
class ExchangeRateAPIProvider {
  constructor() {
    this.apiKey = process.env.EXCHANGERATE_API_KEY;
    this.baseUrl = 'https://v6.exchangerate-api.com/v6';
  }

  async getExchangeRate(fromCurrency, toCurrency, date = null) {
    try {
      let url;
      
      if (this.apiKey) {
        url = `${this.baseUrl}/${this.apiKey}/pair/${fromCurrency}/${toCurrency}`;
      } else {
        // Free tier without API key
        url = `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`;
      }

      const response = await axios.get(url);
      
      if (this.apiKey) {
        if (response.data.result !== 'success') {
          throw new Error(response.data['error-type'] || 'ExchangeRate-API error');
        }
        return response.data.conversion_rate;
      } else {
        return response.data.rates[toCurrency];
      }
    } catch (error) {
      console.error('ExchangeRate-API error:', error);
      throw error;
    }
  }

  async getMultipleRates(baseCurrency, targetCurrencies, date = null) {
    try {
      const url = this.apiKey 
        ? `${this.baseUrl}/${this.apiKey}/latest/${baseCurrency}`
        : `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;

      const response = await axios.get(url);
      
      if (this.apiKey && response.data.result !== 'success') {
        throw new Error(response.data['error-type'] || 'ExchangeRate-API error');
      }

      const allRates = response.data.conversion_rates || response.data.rates;
      const filteredRates = {};
      
      targetCurrencies.forEach(currency => {
        if (allRates[currency]) {
          filteredRates[currency] = allRates[currency];
        }
      });

      return filteredRates;
    } catch (error) {
      console.error('ExchangeRate-API multiple rates error:', error);
      throw error;
    }
  }
}

/**
 * Open Exchange Rates Provider
 */
class OpenExchangeRatesProvider {
  constructor() {
    this.apiKey = process.env.OPEN_EXCHANGE_RATES_APP_ID;
    this.baseUrl = 'https://openexchangerates.org/api';
  }

  async getExchangeRate(fromCurrency, toCurrency, date = null) {
    try {
      if (!this.apiKey) {
        throw new Error('Open Exchange Rates API key not configured');
      }

      const endpoint = date ? 'historical' : 'latest';
      const url = `${this.baseUrl}/${endpoint}.json`;
      
      const params = {
        app_id: this.apiKey,
        base: fromCurrency,
        symbols: toCurrency
      };
      
      if (date) {
        params.date = date;
      }

      const response = await axios.get(url, { params });
      
      if (response.data.error) {
        throw new Error(response.data.description || 'Open Exchange Rates API error');
      }

      return response.data.rates[toCurrency];
    } catch (error) {
      console.error('Open Exchange Rates error:', error);
      throw error;
    }
  }

  async getMultipleRates(baseCurrency, targetCurrencies, date = null) {
    try {
      const endpoint = date ? 'historical' : 'latest';
      const url = `${this.baseUrl}/${endpoint}.json`;
      
      const params = {
        app_id: this.apiKey,
        base: baseCurrency,
        symbols: targetCurrencies.join(',')
      };
      
      if (date) {
        params.date = date;
      }

      const response = await axios.get(url, { params });
      
      if (response.data.error) {
        throw new Error(response.data.description || 'Open Exchange Rates API error');
      }

      return response.data.rates;
    } catch (error) {
      console.error('Open Exchange Rates multiple rates error:', error);
      throw error;
    }
  }

  async getHistoricalRates(fromCurrency, toCurrency, startDate, endDate) {
    try {
      const url = `${this.baseUrl}/time-series.json`;
      
      const params = {
        app_id: this.apiKey,
        base: fromCurrency,
        symbols: toCurrency,
        start: startDate,
        end: endDate
      };

      const response = await axios.get(url, { params });
      
      if (response.data.error) {
        throw new Error(response.data.description || 'Open Exchange Rates API error');
      }

      // Transform response to array format
      const rates = [];
      Object.entries(response.data.rates).forEach(([date, rateData]) => {
        rates.push({
          date,
          rate: rateData[toCurrency]
        });
      });

      return rates;
    } catch (error) {
      console.error('Open Exchange Rates historical error:', error);
      throw error;
    }
  }
}

module.exports = CurrencyService;





