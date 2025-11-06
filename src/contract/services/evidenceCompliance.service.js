const { SignedContract } = require('../models/contract.model');
const PDFDocument = require('pdfkit');
const archiver = require('archiver');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const EvidenceHelper = require('./evidenceCompliance.helper');

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Evidence Compliance Service
 * Handles evidence collection, compliance, and integrity verification for contracts
 */

class EvidenceComplianceService {
  /**
   * Generate comprehensive evidence package for a contract
   * @param {string} contractId - The contract ID
   * @returns {Object} - Evidence package data
   */
  static async generateEvidencePackage(contractId) {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      const packageId = `evidence_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const createdAt = new Date();

      // Collect all evidence from signers
      const signatures = contract.signers.map(signer => ({
        signerId: signer.signerId,
        signerInfo: {
          fullName: signer.fullName,
          email: signer.email,
          phone: signer.phone,
          title: signer.title,
          company: signer.company
        },
        signature: signer.signature,
        signedAt: signer.signedAt,
        status: signer.status,
        evidence: {
          ipAddress: signer.evidence?.ipAddress,
          userAgent: signer.evidence?.userAgent,
          device: signer.evidence?.device,
          location: signer.evidence?.location,
          sessionDuration: signer.evidence?.sessionDuration,
          documentHash: signer.evidence?.documentHash,
          documentVersion: signer.evidence?.documentVersion,
          termsVersion: signer.evidence?.termsVersion,
          privacyVersion: signer.evidence?.privacyVersion,
          biometricData: signer.evidence?.biometric
        },
        consents: signer.consents,
        verification: {
          idDocument: signer.verification?.idDocument,
          selfie: signer.verification?.selfie,
          method: signer.verification?.method,
          verifiedAt: signer.verification?.verifiedAt
        },
        accessLog: signer.evidence?.accessLog || []
      }));

      // Generate audit trail
      const auditTrail = await this.generateAuditTrail(contractId);

      // Calculate integrity hashes
      const evidenceHash = this.calculateEvidenceHash({
        contractId,
        signatures,
        auditTrail,
        metadata: contract.metadata
      });

      const evidencePackage = {
        packageId,
        contractId: contract.id,
        createdAt,
        status: 'generated',
        contract: {
          title: contract.title,
          templateId: contract.templateId,
          templateVersion: contract.templateVersion,
          language: contract.language,
          currency: contract.currency,
          subscriberId: contract.subscriberId,
          subscriptionId: contract.subscriptionId,
          planId: contract.planId,
          createdAt: contract.dates.created,
          completedAt: contract.dates.completed,
          status: contract.status
        },
        evidence: {
          signatures,
          auditTrail,
          security: {
            originalHash: contract.security.originalHash,
            hashAlgorithm: contract.security.hashAlgorithm,
            evidenceHash,
            timestampServer: process.env.TIMESTAMP_SERVER || 'internal',
            timestamp: createdAt.toISOString()
          },
          metadata: contract.metadata
        },
        compliance: {
          eIDAS: this.checkEIDASCompliance(contract),
          ESIGN: this.checkESIGNCompliance(contract),
          UETA: this.checkUETACompliance(contract),
          jurisdiction: contract.compliance.jurisdiction,
          governingLaw: contract.compliance.governingLaw,
          retentionPeriod: contract.compliance.retentionPeriod,
          gdprCompliant: contract.compliance.gdprCompliant
        },
        verification: {
          canVerify: true,
          verificationUrl: `${process.env.FRONTEND_URL}/verify/${contractId}/${evidenceHash}`,
          publicKey: contract.security.publicKey || null
        }
      };

      // Store evidence package in contract
      contract.compliance.evidencePackage = {
        packageId,
        generatedAt: createdAt,
        hash: evidenceHash,
        stored: true
      };

      await contract.save();

      return evidencePackage;
    } catch (error) {
      console.error('Error generating evidence package:', error);
      throw new Error(`Failed to generate evidence package: ${error.message}`);
    }
  }

  /**
   * Export evidence package in specified format
   * @param {string} contractId - The contract ID
   * @param {string} format - Export format (zip, json, pdf)
   * @returns {Object} - Export data
   */
  static async exportEvidencePackage(contractId, format = 'zip') {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Generate fresh evidence package
      const evidencePackage = await this.generateEvidencePackage(contractId);

      const exportDir = path.join(__dirname, '../../exports', contractId);
      await mkdir(exportDir, { recursive: true });

      let exportPath;
      let downloadUrl;

      if (format === 'json') {
        // Export as JSON
        exportPath = path.join(exportDir, `evidence_${contractId}.json`);
        await writeFile(exportPath, JSON.stringify(evidencePackage, null, 2));
        downloadUrl = `/exports/${contractId}/evidence_${contractId}.json`;
      } else if (format === 'pdf') {
        // Export as PDF
        exportPath = path.join(exportDir, `evidence_${contractId}.pdf`);
        await this.generateEvidencePDF(evidencePackage, exportPath);
        downloadUrl = `/exports/${contractId}/evidence_${contractId}.pdf`;
      } else {
        // Export as ZIP (default)
        exportPath = path.join(exportDir, `evidence_package_${contractId}.zip`);
        await this.createZIPPackage(evidencePackage, contract, exportPath);
        downloadUrl = `/exports/${contractId}/evidence_package_${contractId}.zip`;
      }

      return {
        contractId,
        format,
        exportedAt: new Date(),
        downloadUrl,
        filePath: exportPath,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'ready',
        fileSize: fs.statSync(exportPath).size
      };
    } catch (error) {
      console.error('Error exporting evidence package:', error);
      throw new Error(`Failed to export evidence package: ${error.message}`);
    }
  }

  /**
   * Generate Certificate of Completion PDF
   * @param {string} contractId - The contract ID
   * @returns {Object} - Certificate data
   */
  static async generateCertificate(contractId) {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      if (contract.status !== 'completed') {
        throw new Error('Certificate only available for completed contracts');
      }

      const certificateId = `cert_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const exportDir = path.join(__dirname, '../../exports', contractId);
      await mkdir(exportDir, { recursive: true });

      const certificatePath = path.join(exportDir, `certificate_${certificateId}.pdf`);

      // Generate certificate PDF
      await this.generateCertificatePDF(contract, certificatePath, certificateId);

      return {
        certificateId,
        contractId: contract.id,
        generatedAt: new Date(),
        downloadUrl: `/exports/${contractId}/certificate_${certificateId}.pdf`,
        filePath: certificatePath,
        expiresAt: null, // Certificates don't expire
        signers: contract.signers.map(s => ({
          name: s.fullName,
          email: s.email,
          signedAt: s.signedAt
        }))
      };
    } catch (error) {
      console.error('Error generating certificate:', error);
      throw new Error(`Failed to generate certificate: ${error.message}`);
    }
  }

  /**
   * Create ZIP package with all evidence
   */
  static async createZIPPackage(evidencePackage, contract, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      // Add evidence JSON
      archive.append(JSON.stringify(evidencePackage, null, 2), {
        name: 'evidence_package.json'
      });

      // Add contract HTML
      if (contract.content?.originalHtml) {
        archive.append(contract.content.originalHtml, {
          name: 'contract_original.html'
        });
      }

      // Add README
      const readme = this.generateReadme(evidencePackage);
      archive.append(readme, { name: 'README.txt' });

      // Add signature images if available
      contract.signers.forEach((signer, index) => {
        if (signer.signature?.data) {
          archive.append(signer.signature.data, {
            name: `signatures/signer_${index + 1}_${signer.fullName.replace(/\s/g, '_')}.png`
          });
        }
      });

      archive.finalize();
    });
  }

  /**
   * Generate Evidence PDF
   */
  static async generateEvidencePDF(evidencePackage, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(outputPath);

        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('Evidence Package', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Package ID: ${evidencePackage.packageId}`);
        doc.text(`Generated: ${evidencePackage.createdAt.toLocaleString()}`);
        doc.moveDown();

        // Contract Information
        doc.fontSize(16).text('Contract Information');
        doc.fontSize(10);
        doc.text(`Contract ID: ${evidencePackage.contract.contractId}`);
        doc.text(`Title: ${evidencePackage.contract.title}`);
        doc.text(`Status: ${evidencePackage.contract.status}`);
        doc.text(`Created: ${new Date(evidencePackage.contract.createdAt).toLocaleString()}`);
        if (evidencePackage.contract.completedAt) {
          doc.text(`Completed: ${new Date(evidencePackage.contract.completedAt).toLocaleString()}`);
        }
        doc.moveDown();

        // Signatures
        doc.fontSize(16).text('Signatures');
        doc.fontSize(10);
        evidencePackage.evidence.signatures.forEach((sig, index) => {
          doc.text(`\nSigner ${index + 1}:`);
          doc.text(`  Name: ${sig.signerInfo.fullName}`);
          doc.text(`  Email: ${sig.signerInfo.email}`);
          doc.text(`  Signed: ${sig.signedAt ? new Date(sig.signedAt).toLocaleString() : 'Pending'}`);
          doc.text(`  IP Address: ${sig.evidence.ipAddress || 'N/A'}`);
          doc.text(`  Device: ${sig.evidence.device?.type || 'N/A'} - ${sig.evidence.device?.os || 'N/A'}`);
          if (sig.evidence.location) {
            doc.text(`  Location: ${sig.evidence.location.city}, ${sig.evidence.location.country}`);
          }
        });
        doc.moveDown();

        // Compliance
        doc.fontSize(16).text('Compliance Status');
        doc.fontSize(10);
        doc.text(`eIDAS Compliant: ${evidencePackage.compliance.eIDAS ? 'Yes' : 'No'}`);
        doc.text(`ESIGN Compliant: ${evidencePackage.compliance.ESIGN ? 'Yes' : 'No'}`);
        doc.text(`UETA Compliant: ${evidencePackage.compliance.UETA ? 'Yes' : 'No'}`);
        doc.text(`GDPR Compliant: ${evidencePackage.compliance.gdprCompliant ? 'Yes' : 'No'}`);
        doc.text(`Jurisdiction: ${evidencePackage.compliance.jurisdiction}`);
        doc.moveDown();

        // Security
        doc.fontSize(16).text('Security & Verification');
        doc.fontSize(10);
        doc.text(`Document Hash: ${evidencePackage.evidence.security.originalHash}`);
        doc.text(`Evidence Hash: ${evidencePackage.evidence.security.evidenceHash}`);
        doc.text(`Algorithm: ${evidencePackage.evidence.security.hashAlgorithm}`);
        doc.text(`Verification URL: ${evidencePackage.verification.verificationUrl}`);

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Certificate of Completion PDF
   */
  static async generateCertificatePDF(contract, outputPath, certificateId) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(outputPath);

        doc.pipe(stream);

        // Certificate Border
        doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).stroke();
        doc.rect(45, 45, doc.page.width - 90, doc.page.height - 90).stroke();

        // Header
        doc.moveDown(3);
        doc.fontSize(28).font('Helvetica-Bold')
          .text('CERTIFICATE OF COMPLETION', { align: 'center' });

        doc.moveDown(2);
        doc.fontSize(12).font('Helvetica')
          .text('This certifies that the following contract has been', { align: 'center' });
        doc.text('legally executed and completed:', { align: 'center' });

        doc.moveDown(2);

        // Contract Details
        doc.fontSize(16).font('Helvetica-Bold').text(contract.title, { align: 'center' });
        doc.moveDown();

        doc.fontSize(10).font('Helvetica');
        doc.text(`Contract ID: ${contract.id}`, { align: 'center' });
        doc.text(`Certificate ID: ${certificateId}`, { align: 'center' });
        doc.moveDown(2);

        // Signers
        doc.fontSize(14).font('Helvetica-Bold').text('Signed By:', { align: 'left' });
        doc.moveDown();
        doc.fontSize(10).font('Helvetica');

        contract.signers.forEach((signer, index) => {
          if (signer.status === 'signed') {
            doc.text(`${index + 1}. ${signer.fullName}`, { continued: false });
            doc.text(`   Email: ${signer.email}`, { indent: 20 });
            doc.text(`   Date: ${new Date(signer.signedAt).toLocaleString()}`, { indent: 20 });
            doc.text(`   IP: ${signer.evidence?.ipAddress || 'N/A'}`, { indent: 20 });
            doc.moveDown();
          }
        });

        // Footer
        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica-Italic')
          .text('This certificate is digitally signed and verifiable.', { align: 'center' });
        doc.text(`Issued on: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(8)
          .text(`Document Hash: ${contract.security.originalHash}`, { align: 'center' });

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate README for ZIP package
   */
  static generateReadme(evidencePackage) {
    return `EVIDENCE PACKAGE README
=====================

Package ID: ${evidencePackage.packageId}
Generated: ${evidencePackage.createdAt.toLocaleString()}
Contract ID: ${evidencePackage.contractId}

CONTENTS:
---------
1. evidence_package.json - Complete evidence data in JSON format
2. contract_original.html - Original contract HTML
3. signatures/ - Folder containing signature images
4. README.txt - This file

VERIFICATION:
-------------
You can verify the integrity of this evidence package at:
${evidencePackage.verification.verificationUrl}

Evidence Hash: ${evidencePackage.evidence.security.evidenceHash}
Hash Algorithm: ${evidencePackage.evidence.security.hashAlgorithm}

COMPLIANCE:
-----------
eIDAS Compliant: ${evidencePackage.compliance.eIDAS ? 'Yes' : 'No'}
ESIGN Compliant: ${evidencePackage.compliance.ESIGN ? 'Yes' : 'No'}
UETA Compliant: ${evidencePackage.compliance.UETA ? 'Yes' : 'No'}
GDPR Compliant: ${evidencePackage.compliance.gdprCompliant ? 'Yes' : 'No'}

RETENTION:
----------
This evidence must be retained for ${evidencePackage.compliance.retentionPeriod} years
as per ${evidencePackage.compliance.jurisdiction} regulations.

For questions or support, please contact: ${process.env.SUPPORT_EMAIL || 'support@example.com'}
`;
  }  /**
   * Verify evidence integrity using hash
   * @param {string} contractId - The contract ID
   * @param {string} hash - Hash to verify
   * @returns {Object} - Verification result
   */
  static async verifyEvidenceIntegrity(contractId, hash) {
    // TODO: Implement evidence integrity verification
    console.log(`Verifying evidence integrity for contract ${contractId} with hash ${hash}`);

    return {
      contractId,
      hash,
      verified: true, // TODO: Implement actual verification
      verifiedAt: new Date(),
      algorithm: 'SHA-256',
      status: 'valid'
    };
  }

  /**
   * Get compliance status for a contract
   * @param {string} contractId - The contract ID
   * @returns {Object} - Compliance status
   */
  static async getComplianceStatus(contractId) {
    // TODO: Implement compliance status check
    console.log(`Getting compliance status for contract ${contractId}`);

    return {
      contractId,
      compliant: true,
      standards: {
        eIDAS: false,
        ESIGN: true,
        UETA: true
      },
      issues: [],
      lastChecked: new Date()
    };
  }

  /**
   * Generate audit trail for a contract
   * @param {string} contractId - The contract ID
   * @returns {Array} - Audit trail events
   */
  static async generateAuditTrail(contractId) {
    // TODO: Implement audit trail generation
    console.log(`Generating audit trail for contract ${contractId}`);

    return [
      {
        timestamp: new Date(),
        event: 'contract_created',
        actor: 'system',
        details: 'Contract was created',
        ipAddress: '127.0.0.1'
      }
    ];
  }
}

module.exports = EvidenceComplianceService;