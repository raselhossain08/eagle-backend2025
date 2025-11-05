const { SignedContract } = require('../models/contract.model');
const ContractSigningService = require('./contractSigning.service');

/**
 * Contract Integration Service
 * Adapter pattern for third-party e-signature providers
 */
class ContractIntegrationService {

  /**
   * Initialize integration based on provider
   */
  static async initializeProvider(provider, config) {
    switch (provider) {
      case 'docusign':
        return new DocuSignAdapter(config);
      case 'adobe_sign':
        return new AdobeSignAdapter(config);
      case 'dropbox_sign':
        return new DropboxSignAdapter(config);
      case 'native':
      default:
        return new NativeAdapter(config);
    }
  }

  /**
   * Send contract via specified provider
   */
  static async sendContract(contractId, provider = 'native', providerConfig = {}) {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      const adapter = await this.initializeProvider(provider, providerConfig);
      const result = await adapter.sendContract(contract);

      // Update contract with integration details
      contract.integration = {
        provider,
        externalId: result.externalId,
        externalStatus: result.status,
        webhookData: new Map(),
        syncedAt: new Date()
      };

      contract.status = 'sent';
      contract.dates.sent = new Date();

      await contract.save();

      return {
        success: true,
        contract,
        providerResponse: result
      };
    } catch (error) {
      throw new Error(`Failed to send contract via ${provider}: ${error.message}`);
    }
  }

  /**
   * Check status from provider
   */
  static async syncContractStatus(contractId) {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      if (!contract.integration || !contract.integration.provider) {
        throw new Error('Contract not sent via external provider');
      }

      const adapter = await this.initializeProvider(
        contract.integration.provider,
        {} // Config would be retrieved from environment/database
      );

      const status = await adapter.getContractStatus(contract.integration.externalId);
      
      // Update contract status based on provider response
      await this.updateContractFromProvider(contract, status);

      return {
        success: true,
        contract,
        providerStatus: status
      };
    } catch (error) {
      throw new Error(`Failed to sync contract status: ${error.message}`);
    }
  }

  /**
   * Handle webhook from provider
   */
  static async handleWebhook(provider, payload) {
    try {
      const adapter = await this.initializeProvider(provider, {});
      const webhookData = await adapter.parseWebhook(payload);

      // Find contract by external ID
      const contract = await SignedContract.findOne({
        'integration.externalId': webhookData.externalId
      });

      if (!contract) {
        throw new Error('Contract not found for webhook');
      }

      // Store webhook data
      contract.integration.webhookData.set(
        Date.now().toString(),
        webhookData
      );

      // Update contract status
      await this.updateContractFromProvider(contract, webhookData);

      return {
        success: true,
        contract,
        webhookData
      };
    } catch (error) {
      throw new Error(`Failed to handle webhook: ${error.message}`);
    }
  }

  /**
   * Update contract based on provider data
   */
  static async updateContractFromProvider(contract, providerData) {
    try {
      const { status, signers = [], completedAt, voidedAt, declinedAt } = providerData;

      // Map provider status to internal status
      const statusMapping = {
        'sent': 'sent',
        'delivered': 'sent',
        'opened': 'partially_signed',
        'signed': 'fully_signed',
        'completed': 'completed',
        'declined': 'declined',
        'voided': 'voided',
        'expired': 'expired'
      };

      const mappedStatus = statusMapping[status.toLowerCase()] || contract.status;
      contract.status = mappedStatus;
      contract.integration.externalStatus = status;

      // Update signer statuses
      signers.forEach(providerSigner => {
        const contractSigner = contract.signers.find(s => 
          s.email === providerSigner.email
        );

        if (contractSigner) {
          contractSigner.status = statusMapping[providerSigner.status?.toLowerCase()] || 'pending';
          
          if (providerSigner.signedAt) {
            contractSigner.signedAt = new Date(providerSigner.signedAt);
          }
          if (providerSigner.declinedAt) {
            contractSigner.declinedAt = new Date(providerSigner.declinedAt);
          }
        }
      });

      // Update completion timestamps
      if (completedAt && !contract.dates.completed) {
        contract.dates.completed = new Date(completedAt);
      }
      if (voidedAt && !contract.dates.voided) {
        contract.dates.voided = new Date(voidedAt);
      }

      contract.integration.syncedAt = new Date();
      await contract.save();

      return contract;
    } catch (error) {
      throw new Error(`Failed to update contract from provider: ${error.message}`);
    }
  }

  /**
   * Download completed document from provider
   */
  static async downloadCompletedDocument(contractId) {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      if (contract.integration.provider === 'native') {
        throw new Error('Native contracts do not require downloading');
      }

      const adapter = await this.initializeProvider(
        contract.integration.provider,
        {}
      );

      const documentData = await adapter.downloadDocument(contract.integration.externalId);

      // Store document reference
      contract.content.finalHtml = documentData.html || contract.content.originalHtml;
      contract.content.pdfUrl = documentData.pdfUrl;

      await contract.save();

      return {
        success: true,
        documentData,
        contract
      };
    } catch (error) {
      throw new Error(`Failed to download document: ${error.message}`);
    }
  }
}

/**
 * Native Eagle E-Signature Adapter
 */
class NativeAdapter {
  constructor(config) {
    this.config = config;
  }

  async sendContract(contract) {
    // Use native signing service
    const signingUrls = ContractSigningService.generateSigningUrls(contract);
    
    return {
      externalId: contract.id,
      status: 'sent',
      signingUrls,
      message: 'Contract sent via native Eagle system'
    };
  }

  async getContractStatus(externalId) {
    const contract = await SignedContract.findOne({ id: externalId });
    return {
      externalId,
      status: contract.status,
      signers: contract.signers.map(s => ({
        email: s.email,
        status: s.status,
        signedAt: s.signedAt,
        declinedAt: s.declinedAt
      })),
      completedAt: contract.dates.completed,
      voidedAt: contract.dates.voided
    };
  }

  async parseWebhook(payload) {
    // Native system doesn't use webhooks, return the payload as-is
    return payload;
  }

  async downloadDocument(externalId) {
    const contract = await SignedContract.findOne({ id: externalId });
    return {
      html: contract.content.finalHtml || contract.content.originalHtml,
      pdfUrl: contract.content.pdfUrl
    };
  }
}

/**
 * DocuSign Integration Adapter
 */
class DocuSignAdapter {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://demo.docusign.net/restapi';
    this.accountId = config.accountId;
    this.accessToken = config.accessToken;
  }

  async sendContract(contract) {
    try {
      // Prepare DocuSign envelope
      const envelopeData = {
        emailSubject: `Please sign: ${contract.title}`,
        documents: [{
          documentBase64: Buffer.from(contract.content.originalHtml).toString('base64'),
          name: `${contract.title}.html`,
          fileExtension: 'html',
          documentId: '1'
        }],
        recipients: {
          signers: contract.signers.map((signer, index) => ({
            email: signer.email,
            name: signer.fullName,
            recipientId: (index + 1).toString(),
            tabs: {
              signHereTabs: [{
                documentId: '1',
                pageNumber: '1',
                xPosition: '100',
                yPosition: '100'
              }]
            }
          }))
        },
        status: 'sent'
      };

      // Mock DocuSign API call (replace with actual API integration)
      const response = await this.makeDocuSignRequest('POST', '/envelopes', envelopeData);

      return {
        externalId: response.envelopeId,
        status: 'sent',
        message: 'Contract sent via DocuSign',
        providerData: response
      };
    } catch (error) {
      throw new Error(`DocuSign integration failed: ${error.message}`);
    }
  }

  async getContractStatus(externalId) {
    try {
      const response = await this.makeDocuSignRequest('GET', `/envelopes/${externalId}`);
      
      return {
        externalId,
        status: this.mapDocuSignStatus(response.status),
        signers: response.recipients?.signers?.map(signer => ({
          email: signer.email,
          status: this.mapDocuSignStatus(signer.status),
          signedAt: signer.signedDateTime,
          declinedAt: signer.declinedDateTime
        })) || [],
        completedAt: response.completedDateTime,
        voidedAt: response.voidedDateTime
      };
    } catch (error) {
      throw new Error(`Failed to get DocuSign status: ${error.message}`);
    }
  }

  async parseWebhook(payload) {
    const data = JSON.parse(payload);
    
    return {
      externalId: data.envelopeId,
      status: this.mapDocuSignStatus(data.envelopeStatus),
      signers: data.recipients?.map(recipient => ({
        email: recipient.email,
        status: this.mapDocuSignStatus(recipient.status),
        signedAt: recipient.signedDateTime,
        declinedAt: recipient.declinedDateTime
      })) || [],
      completedAt: data.completedDateTime,
      voidedAt: data.voidedDateTime,
      rawData: data
    };
  }

  async downloadDocument(externalId) {
    try {
      const response = await this.makeDocuSignRequest('GET', `/envelopes/${externalId}/documents/combined`);
      
      return {
        pdfUrl: response.documentUrl,
        html: null // DocuSign typically returns PDF
      };
    } catch (error) {
      throw new Error(`Failed to download DocuSign document: ${error.message}`);
    }
  }

  mapDocuSignStatus(status) {
    const statusMap = {
      'created': 'draft',
      'sent': 'sent',
      'delivered': 'sent',
      'signed': 'signed',
      'completed': 'completed',
      'declined': 'declined',
      'voided': 'voided',
      'expired': 'expired'
    };
    return statusMap[status?.toLowerCase()] || 'pending';
  }

  async makeDocuSignRequest(method, endpoint, data = null) {
    // Mock implementation - replace with actual DocuSign API calls
    console.log(`DocuSign ${method} ${endpoint}`, data);
    
    // Return mock response
    return {
      envelopeId: `ds_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: 'sent',
      recipients: {
        signers: data?.recipients?.signers || []
      }
    };
  }
}

/**
 * Adobe Sign Integration Adapter
 */
class AdobeSignAdapter {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.adobesign.com/api/rest/v6';
    this.accessToken = config.accessToken;
  }

  async sendContract(contract) {
    try {
      // Prepare Adobe Sign agreement
      const agreementData = {
        fileInfos: [{
          libraryDocumentId: null,
          transientDocumentId: await this.uploadDocument(contract.content.originalHtml, contract.title)
        }],
        name: contract.title,
        participantSetsInfo: [{
          memberInfos: contract.signers.map(signer => ({
            email: signer.email,
            name: signer.fullName
          })),
          order: 1,
          role: 'SIGNER'
        }],
        signatureType: 'ESIGN',
        state: 'IN_PROCESS'
      };

      // Mock Adobe Sign API call
      const response = await this.makeAdobeSignRequest('POST', '/agreements', agreementData);

      return {
        externalId: response.agreementId,
        status: 'sent',
        message: 'Contract sent via Adobe Sign',
        providerData: response
      };
    } catch (error) {
      throw new Error(`Adobe Sign integration failed: ${error.message}`);
    }
  }

  async getContractStatus(externalId) {
    try {
      const response = await this.makeAdobeSignRequest('GET', `/agreements/${externalId}`);
      
      return {
        externalId,
        status: this.mapAdobeSignStatus(response.status),
        signers: response.participantSets?.flatMap(set => 
          set.memberInfos?.map(member => ({
            email: member.email,
            status: this.mapAdobeSignStatus(member.status),
            signedAt: member.signedDate,
            declinedAt: member.declinedDate
          }))
        ) || [],
        completedAt: response.events?.find(e => e.type === 'SIGNED')?.date,
        voidedAt: response.events?.find(e => e.type === 'CANCELLED')?.date
      };
    } catch (error) {
      throw new Error(`Failed to get Adobe Sign status: ${error.message}`);
    }
  }

  async parseWebhook(payload) {
    const data = JSON.parse(payload);
    
    return {
      externalId: data.agreement?.id,
      status: this.mapAdobeSignStatus(data.agreement?.status),
      signers: data.agreement?.participantSets?.flatMap(set => 
        set.memberInfos?.map(member => ({
          email: member.email,
          status: this.mapAdobeSignStatus(member.status),
          signedAt: member.signedDate,
          declinedAt: member.declinedDate
        }))
      ) || [],
      completedAt: data.agreement?.events?.find(e => e.type === 'SIGNED')?.date,
      rawData: data
    };
  }

  async downloadDocument(externalId) {
    try {
      const response = await this.makeAdobeSignRequest('GET', `/agreements/${externalId}/combinedDocument`);
      
      return {
        pdfUrl: response.documentUrl,
        html: null // Adobe Sign returns PDF
      };
    } catch (error) {
      throw new Error(`Failed to download Adobe Sign document: ${error.message}`);
    }
  }

  async uploadDocument(htmlContent, fileName) {
    // Mock implementation for uploading transient document
    console.log(`Uploading document: ${fileName}`);
    return `td_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  mapAdobeSignStatus(status) {
    const statusMap = {
      'AUTHORING': 'draft',
      'IN_PROCESS': 'sent',
      'SIGNED': 'completed',
      'CANCELLED': 'voided',
      'EXPIRED': 'expired',
      'REJECTED': 'declined'
    };
    return statusMap[status] || 'pending';
  }

  async makeAdobeSignRequest(method, endpoint, data = null) {
    // Mock implementation - replace with actual Adobe Sign API calls
    console.log(`Adobe Sign ${method} ${endpoint}`, data);
    
    return {
      agreementId: `as_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: 'IN_PROCESS',
      participantSets: data?.participantSetsInfo || []
    };
  }
}

/**
 * Dropbox Sign (formerly HelloSign) Integration Adapter
 */
class DropboxSignAdapter {
  constructor(config) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.hellosign.com/v3';
    this.apiKey = config.apiKey;
  }

  async sendContract(contract) {
    try {
      // Prepare Dropbox Sign signature request
      const requestData = {
        title: contract.title,
        subject: `Please sign: ${contract.title}`,
        message: 'Please review and sign this document.',
        signers: contract.signers.map((signer, index) => ({
          email_address: signer.email,
          name: signer.fullName,
          order: index
        })),
        files: [Buffer.from(contract.content.originalHtml)],
        test_mode: this.config.testMode || true
      };

      // Mock Dropbox Sign API call
      const response = await this.makeDropboxSignRequest('POST', '/signature_request/send', requestData);

      return {
        externalId: response.signature_request.signature_request_id,
        status: 'sent',
        message: 'Contract sent via Dropbox Sign',
        providerData: response
      };
    } catch (error) {
      throw new Error(`Dropbox Sign integration failed: ${error.message}`);
    }
  }

  async getContractStatus(externalId) {
    try {
      const response = await this.makeDropboxSignRequest('GET', `/signature_request/${externalId}`);
      const request = response.signature_request;
      
      return {
        externalId,
        status: this.mapDropboxSignStatus(request.status_code),
        signers: request.signatures?.map(signature => ({
          email: signature.signer_email_address,
          status: this.mapDropboxSignStatus(signature.status_code),
          signedAt: signature.signed_at ? new Date(signature.signed_at * 1000) : null
        })) || [],
        completedAt: request.is_complete ? new Date(request.final_copy_uri) : null
      };
    } catch (error) {
      throw new Error(`Failed to get Dropbox Sign status: ${error.message}`);
    }
  }

  async parseWebhook(payload) {
    const data = JSON.parse(payload);
    const request = data.signature_request;
    
    return {
      externalId: request.signature_request_id,
      status: this.mapDropboxSignStatus(request.status_code),
      signers: request.signatures?.map(signature => ({
        email: signature.signer_email_address,
        status: this.mapDropboxSignStatus(signature.status_code),
        signedAt: signature.signed_at ? new Date(signature.signed_at * 1000) : null
      })) || [],
      completedAt: request.is_complete ? new Date() : null,
      rawData: data
    };
  }

  async downloadDocument(externalId) {
    try {
      const response = await this.makeDropboxSignRequest('GET', `/signature_request/files/${externalId}`);
      
      return {
        pdfUrl: response.file_url,
        html: null // Dropbox Sign returns PDF
      };
    } catch (error) {
      throw new Error(`Failed to download Dropbox Sign document: ${error.message}`);
    }
  }

  mapDropboxSignStatus(statusCode) {
    const statusMap = {
      'awaiting_signature': 'sent',
      'signed': 'completed',
      'declined': 'declined',
      'cancelled': 'voided',
      'expired': 'expired'
    };
    return statusMap[statusCode] || 'pending';
  }

  async makeDropboxSignRequest(method, endpoint, data = null) {
    // Mock implementation - replace with actual Dropbox Sign API calls
    console.log(`Dropbox Sign ${method} ${endpoint}`, data);
    
    return {
      signature_request: {
        signature_request_id: `hs_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        status_code: 'awaiting_signature',
        signatures: data?.signers?.map(signer => ({
          signer_email_address: signer.email_address,
          status_code: 'awaiting_signature'
        })) || []
      }
    };
  }
}

module.exports = ContractIntegrationService;





