const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload PDF buffer to Cloudinary
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} fileName - Name for the file
 * @param {string} folder - Cloudinary folder to store the file
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadPDFToCloudinary = async (pdfBuffer, fileName, folder = 'contracts') => {
  try {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw', // For non-image files like PDF
          folder: folder,
          public_id: fileName,
          format: 'pdf',
          use_filename: true,
          unique_filename: false,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('PDF uploaded to Cloudinary successfully:', result.secure_url);
            resolve(result);
          }
        }
      ).end(pdfBuffer);
    });
  } catch (error) {
    console.error('Error uploading PDF to Cloudinary:', error);
    throw error;
  }
};

/**
 * Delete PDF from Cloudinary
 * @param {string} publicId - Cloudinary public ID of the file
 * @returns {Promise<Object>} Cloudinary deletion result
 */
const deletePDFFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw'
    });
    console.log('PDF deleted from Cloudinary:', result);
    return result;
  } catch (error) {
    console.error('Error deleting PDF from Cloudinary:', error);
    throw error;
  }
};

/**
 * Generate a secure URL for PDF access with expiration
 * @param {string} publicId - Cloudinary public ID
 * @param {number} expireTime - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns {string} Secure URL with expiration
 */
const generateSecurePDFUrl = (publicId, expireTime = 3600) => {
  try {
    const timestamp = Math.round(Date.now() / 1000) + expireTime;
    const secureUrl = cloudinary.url(publicId, {
      resource_type: 'raw',
      type: 'authenticated',
      sign_url: true,
      expires_at: timestamp,
    });
    return secureUrl;
  } catch (error) {
    console.error('Error generating secure PDF URL:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadPDFToCloudinary,
  deletePDFFromCloudinary,
  generateSecurePDFUrl,
};
