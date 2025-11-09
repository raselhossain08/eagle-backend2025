/**
 * Tax Provider Configuration
 * বিভিন্ন Tax Providers এর configuration
 */

// TaxJar Provider Configuration
const taxJarConfig = {
    apiUrl: process.env.TAXJAR_API_URL || 'https://api.taxjar.com',
    apiToken: process.env.TAXJAR_API_TOKEN,
    apiVersion: process.env.TAXJAR_API_VERSION || 'v2',
    isEnabled: process.env.TAXJAR_ENABLED === 'true',
    priority: parseInt(process.env.TAXJAR_PRIORITY) || 1,

    // Default settings
    defaultSettings: {
        nexusStates: ['CA', 'NY', 'TX', 'FL', 'WA'], // States where you have tax nexus
        enabledCountries: ['US', 'CA'],
        useOriginBased: false, // Use destination-based tax calculation
        includeShipping: true,
        enableRounding: true
    },

    // Rate limits
    rateLimits: {
        requestsPerSecond: 5,
        requestsPerMonth: 100000,
        burst: 10
    },

    // Error handling
    errorHandling: {
        retryAttempts: 3,
        retryDelay: 1000,
        fallbackToDefault: true,
        logErrors: true
    }
};

// Stripe Tax Configuration
const stripeTaxConfig = {
    apiUrl: process.env.STRIPE_API_URL || 'https://api.stripe.com',
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    isEnabled: process.env.STRIPE_TAX_ENABLED === 'true',
    priority: parseInt(process.env.STRIPE_TAX_PRIORITY) || 2,

    // Default settings
    defaultSettings: {
        enabledCountries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'],
        autoCalculation: true,
        includeTaxInPrice: false,
        taxBehavior: 'exclusive', // 'inclusive' or 'exclusive'
        enableRegistrations: true
    },

    // Features
    features: {
        automaticTax: true,
        taxReporting: true,
        vatCalculation: true,
        gstCalculation: true,
        multiJurisdiction: true
    },

    // Error handling
    errorHandling: {
        retryAttempts: 3,
        retryDelay: 1500,
        fallbackToDefault: true,
        logErrors: true
    }
};

// Avalara AvaTax Configuration
const avalaraConfig = {
    apiUrl: process.env.AVALARA_API_URL || 'https://rest.avatax.com',
    accountId: process.env.AVALARA_ACCOUNT_ID,
    licenseKey: process.env.AVALARA_LICENSE_KEY,
    isEnabled: process.env.AVALARA_ENABLED === 'true',
    priority: parseInt(process.env.AVALARA_PRIORITY) || 3,
    environment: process.env.AVALARA_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'

    // Default settings
    defaultSettings: {
        companyCode: process.env.AVALARA_COMPANY_CODE || 'DEFAULT',
        enabledCountries: ['US', 'CA'],
        customerUsageType: '', // Exemption certificate
        businessIdentificationNo: '',
        enableCommit: false, // Set to true for production
        enableDetailedLogging: true
    },

    // Features
    features: {
        addressValidation: true,
        certificateManagement: true,
        returnsFiling: true,
        multiLocationSupport: true,
        exemptionHandling: true
    },

    // Error handling
    errorHandling: {
        retryAttempts: 3,
        retryDelay: 2000,
        fallbackToDefault: true,
        logErrors: true
    }
};

// Custom/Manual Tax Configuration
const manualTaxConfig = {
    isEnabled: true,
    priority: parseInt(process.env.MANUAL_TAX_PRIORITY) || 99, // Lowest priority (fallback)

    // Default tax rates by country/region
    defaultRates: {
        US: {
            federal: 0.00,
            state: {
                'AL': 4.00, 'AK': 0.00, 'AZ': 5.60, 'AR': 6.50, 'CA': 7.25,
                'CO': 2.90, 'CT': 6.35, 'DE': 0.00, 'FL': 6.00, 'GA': 4.00,
                'HI': 4.17, 'ID': 6.00, 'IL': 6.25, 'IN': 7.00, 'IA': 6.00,
                'KS': 6.50, 'KY': 6.00, 'LA': 4.45, 'ME': 5.50, 'MD': 6.00,
                'MA': 6.25, 'MI': 6.00, 'MN': 6.88, 'MS': 7.00, 'MO': 4.23,
                'MT': 0.00, 'NE': 5.50, 'NV': 6.85, 'NH': 0.00, 'NJ': 6.63,
                'NM': 5.13, 'NY': 8.00, 'NC': 4.75, 'ND': 5.00, 'OH': 5.75,
                'OK': 4.50, 'OR': 0.00, 'PA': 6.00, 'RI': 7.00, 'SC': 6.00,
                'SD': 4.50, 'TN': 7.00, 'TX': 6.25, 'UT': 5.95, 'VT': 6.00,
                'VA': 5.30, 'WA': 6.50, 'WV': 6.00, 'WI': 5.00, 'WY': 4.00
            },
            local: 0.00 // Average local tax rate
        },
        CA: {
            gst: 5.00,
            pst: {
                'AB': 0.00, 'BC': 7.00, 'MB': 7.00, 'NB': 10.00, 'NL': 10.00,
                'NT': 0.00, 'NS': 10.00, 'NU': 0.00, 'ON': 8.00, 'PE': 10.00,
                'QC': 9.98, 'SK': 6.00, 'YT': 0.00
            },
            hst: {
                'NB': 15.00, 'NL': 15.00, 'NS': 15.00, 'ON': 13.00, 'PE': 15.00
            }
        },
        GB: { vat: 20.00 },
        DE: { vat: 19.00 },
        FR: { vat: 20.00 },
        AU: { gst: 10.00 },
        NZ: { gst: 15.00 },
        IN: { gst: 18.00 },
        BR: { icms: 17.00 },
        MX: { iva: 16.00 }
    },

    // Configuration
    settings: {
        useDestinationBased: true,
        includeShipping: true,
        roundingMethod: 'nearest', // 'up', 'down', 'nearest'
        decimalPlaces: 2,
        enableLogging: true
    }
};

// Provider Priority Configuration
const providerPriority = [
    { name: 'stripe', priority: 1, config: stripeTaxConfig },
    { name: 'taxjar', priority: 2, config: taxJarConfig },
    { name: 'avalara', priority: 3, config: avalaraConfig },
    { name: 'manual', priority: 99, config: manualTaxConfig }
];

// Tax Calculation Settings
const taxCalculationSettings = {
    // General settings
    enabled: process.env.TAX_CALCULATION_ENABLED !== 'false',
    currency: process.env.DEFAULT_CURRENCY || 'USD',

    // Fallback configuration
    fallback: {
        useDefaultRates: true,
        defaultRate: parseFloat(process.env.DEFAULT_TAX_RATE) || 0.00,
        enableGracefulFailure: true,
        logFailures: true
    },

    // Rounding and precision
    rounding: {
        method: process.env.TAX_ROUNDING_METHOD || 'nearest',
        decimalPlaces: parseInt(process.env.TAX_DECIMAL_PLACES) || 2,
        roundTotalOnly: false // Round each line item vs total only
    },

    // Caching
    cache: {
        enabled: process.env.TAX_CACHE_ENABLED !== 'false',
        ttl: parseInt(process.env.TAX_CACHE_TTL) || 3600, // 1 hour
        keyPrefix: 'tax_calc_',
        provider: process.env.TAX_CACHE_PROVIDER || 'memory' // 'redis', 'memory'
    },

    // Validation
    validation: {
        validateAddresses: true,
        requirePostalCode: false,
        allowEstimates: true,
        strictMode: process.env.NODE_ENV === 'production'
    }
};

// Environment-specific overrides
const environmentConfig = {
    development: {
        taxJar: { ...taxJarConfig, isEnabled: false },
        stripe: { ...stripeTaxConfig, isEnabled: false },
        avalara: { ...avalaraConfig, environment: 'sandbox' },
        manual: { ...manualTaxConfig, isEnabled: true }
    },

    staging: {
        taxJar: { ...taxJarConfig, isEnabled: true },
        stripe: { ...stripeTaxConfig, isEnabled: true },
        avalara: { ...avalaraConfig, environment: 'sandbox' },
        manual: { ...manualTaxConfig, isEnabled: true }
    },

    production: {
        taxJar: { ...taxJarConfig, isEnabled: true },
        stripe: { ...stripeTaxConfig, isEnabled: true },
        avalara: { ...avalaraConfig, environment: 'production', defaultSettings: { ...avalaraConfig.defaultSettings, enableCommit: true } },
        manual: { ...manualTaxConfig, priority: 99 }
    }
};

// Get configuration based on environment
function getTaxProviderConfig() {
    const env = process.env.NODE_ENV || 'development';
    const envConfig = environmentConfig[env] || environmentConfig.development;

    return {
        providers: {
            taxjar: envConfig.taxJar,
            stripe: envConfig.stripe,
            avalara: envConfig.avalara,
            manual: envConfig.manual
        },
        priority: providerPriority.filter(p => envConfig[p.name]?.isEnabled !== false),
        settings: taxCalculationSettings
    };
}

// Configuration validation
function validateTaxProviderConfig() {
    const config = getTaxProviderConfig();
    const enabledProviders = config.priority.filter(p => config.providers[p.name]?.isEnabled);

    if (enabledProviders.length === 0) {
        console.warn('⚠️ No tax providers enabled. Manual fallback will be used.');
    }

    // Validate provider credentials
    enabledProviders.forEach(provider => {
        const providerConfig = config.providers[provider.name];

        switch (provider.name) {
            case 'taxjar':
                if (!providerConfig.apiToken) {
                    console.warn(`⚠️ TaxJar API token not configured. Set TAXJAR_API_TOKEN environment variable.`);
                }
                break;

            case 'stripe':
                if (!providerConfig.secretKey) {
                    console.warn(`⚠️ Stripe secret key not configured. Set STRIPE_SECRET_KEY environment variable.`);
                }
                break;

            case 'avalara':
                if (!providerConfig.accountId || !providerConfig.licenseKey) {
                    console.warn(`⚠️ Avalara credentials not configured. Set AVALARA_ACCOUNT_ID and AVALARA_LICENSE_KEY environment variables.`);
                }
                break;
        }
    });

    return {
        isValid: enabledProviders.length > 0,
        enabledProviders: enabledProviders.map(p => p.name),
        warnings: []
    };
}

module.exports = {
    taxJarConfig,
    stripeTaxConfig,
    avalaraConfig,
    manualTaxConfig,
    providerPriority,
    taxCalculationSettings,
    getTaxProviderConfig,
    validateTaxProviderConfig
};