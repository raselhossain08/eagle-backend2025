// Address validation utilities

/**
 * Validates required address fields
 * @param {Object} addressData - Address data to validate
 * @param {string} addressData.country - Country (required)
 * @param {string} addressData.streetAddress - Street address (required)
 * @param {string} addressData.townCity - Town/City (required)
 * @param {string} addressData.stateCounty - State/County (required)
 * @param {string} addressData.postcodeZip - Postcode/Zip (required)
 * @param {string} addressData.flatSuiteUnit - Flat/Suite/Unit (optional)
 * @returns {Object} Validation result with isValid boolean and errors array
 */
const validateRequiredAddressFields = (addressData) => {
  const errors = [];
  const requiredFields = [
    { field: 'country', label: 'Country' },
    { field: 'streetAddress', label: 'Street Address' },
    { field: 'townCity', label: 'Town/City' },
    { field: 'stateCounty', label: 'State/County' },
    { field: 'postcodeZip', label: 'Postcode/Zip' },
  ];

  requiredFields.forEach(({ field, label }) => {
    if (!addressData[field] || !addressData[field].toString().trim()) {
      errors.push(`${label} is required`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates contact information including address
 * @param {Object} contactData - Contact data to validate
 * @returns {Object} Validation result
 */
const validateContactInformation = (contactData) => {
  const errors = [];

  // Required personal information
  const requiredPersonalFields = [
    { field: 'fullName', label: 'Full Name' },
    { field: 'email', label: 'Email Address' },
  ];

  requiredPersonalFields.forEach(({ field, label }) => {
    if (!contactData[field] || !contactData[field].toString().trim()) {
      errors.push(`${label} is required`);
    }
  });

  // Validate email format
  if (contactData.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactData.email.trim())) {
      errors.push('Please provide a valid email address');
    }
  }

  // Validate address fields
  const addressValidation = validateRequiredAddressFields(contactData);
  if (!addressValidation.isValid) {
    errors.push(...addressValidation.errors);
  }

  // Optional field validations - only validate if provided and not empty
  if (contactData.phone && contactData.phone.trim() && contactData.phone.trim().length > 0) {
    // Very flexible phone validation - just check it has some digits
    const cleanPhone = contactData.phone.replace(/[\s\-\(\)\.+]/g, '');
    
    // Just ensure it has at least 5 digits and is mostly numeric
    if (cleanPhone.length < 5 || !/^\d+$/.test(cleanPhone)) {
      errors.push('Please provide a valid phone number');
    }
  }

  if (contactData.discordUsername && contactData.discordUsername.trim()) {
    // Basic Discord username validation (username#discriminator or new format)
    const discordRegex = /^[a-zA-Z0-9._]{2,32}(#\d{4})?$/;
    if (!discordRegex.test(contactData.discordUsername.trim())) {
      errors.push('Please provide a valid Discord username');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Sanitizes address data by trimming whitespace
 * @param {Object} addressData - Address data to sanitize
 * @returns {Object} Sanitized address data
 */
const sanitizeAddressData = (addressData) => {
  const sanitized = {};
  
  const addressFields = [
    'country', 'streetAddress', 'flatSuiteUnit', 
    'townCity', 'stateCounty', 'postcodeZip'
  ];

  addressFields.forEach(field => {
    if (addressData[field]) {
      sanitized[field] = addressData[field].toString().trim();
    } else {
      sanitized[field] = null;
    }
  });

  return sanitized;
};

/**
 * Formats address for display
 * @param {Object} addressData - Address data to format
 * @returns {string} Formatted address string
 */
const formatAddressForDisplay = (addressData) => {
  if (!addressData) return '';

  const parts = [];
  
  if (addressData.streetAddress) parts.push(addressData.streetAddress);
  if (addressData.flatSuiteUnit) parts.push(addressData.flatSuiteUnit);
  if (addressData.townCity) parts.push(addressData.townCity);
  if (addressData.stateCounty) parts.push(addressData.stateCounty);
  if (addressData.postcodeZip) parts.push(addressData.postcodeZip);
  if (addressData.country) parts.push(addressData.country);

  return parts.filter(part => part && part.trim()).join(', ');
};

module.exports = {
  validateRequiredAddressFields,
  validateContactInformation,
  sanitizeAddressData,
  formatAddressForDisplay,
};
