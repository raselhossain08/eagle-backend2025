const crypto = require('crypto');

/**
 * Evidence Compliance Helper Functions
 */

class EvidenceComplianceHelper {
    /**
     * Calculate hash for evidence data
     */
    static calculateEvidenceHash(evidenceData) {
        const dataString = JSON.stringify(evidenceData, Object.keys(evidenceData).sort());
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Check eIDAS compliance
     */
    static checkEIDASCompliance(contract) {
        // Basic eIDAS requirements
        return !!(
            contract.security?.originalHash &&
            contract.signers.every(s =>
                s.status !== 'signed' || (
                    s.evidence?.ipAddress &&
                    s.evidence?.timestamp &&
                    s.signature?.data
                )
            )
        );
    }

    /**
     * Check ESIGN Act compliance (US)
     */
    static checkESIGNCompliance(contract) {
        // ESIGN Act requirements
        return !!(
            contract.signers.every(s =>
                s.status !== 'signed' || (
                    s.consents?.some(c => c.consentId === 'electronic_signature_consent' && c.accepted) &&
                    s.signature?.data &&
                    s.evidence?.timestamp
                )
            )
        );
    }

    /**
     * Check UETA compliance (US)
     */
    static checkUETACompliance(contract) {
        // UETA requirements (similar to ESIGN)
        return !!(
            contract.security?.originalHash &&
            contract.signers.every(s =>
                s.status !== 'signed' || (
                    s.signature?.data &&
                    s.evidence?.timestamp &&
                    s.evidence?.ipAddress
                )
            )
        );
    }

    /**
     * Generate audit trail for a contract
     */
    static async generateAuditTrail(contract) {
        const auditTrail = [];

        // Contract creation
        auditTrail.push({
            eventId: `evt_${Date.now()}_1`,
            timestamp: contract.dates.created,
            event: 'contract_created',
            actor: 'system',
            actorType: 'system',
            details: {
                contractId: contract.id,
                templateId: contract.templateId,
                templateVersion: contract.templateVersion
            },
            ipAddress: null,
            userAgent: null
        });

        // Process each signer's events
        contract.signers.forEach((signer, index) => {
            // Contract sent
            if (signer.sentAt) {
                auditTrail.push({
                    eventId: `evt_${Date.now()}_${index + 2}`,
                    timestamp: signer.sentAt,
                    event: 'contract_sent',
                    actor: 'system',
                    actorType: 'system',
                    details: {
                        signerId: signer.signerId,
                        signerEmail: signer.email,
                        signerName: signer.fullName
                    },
                    ipAddress: null,
                    userAgent: null
                });
            }

            // Contract opened
            if (signer.openedAt) {
                auditTrail.push({
                    eventId: `evt_${Date.now()}_${index + 100}`,
                    timestamp: signer.openedAt,
                    event: 'contract_opened',
                    actor: signer.email,
                    actorType: 'signer',
                    details: {
                        signerId: signer.signerId,
                        signerName: signer.fullName
                    },
                    ipAddress: signer.evidence?.ipAddress,
                    userAgent: signer.evidence?.userAgent
                });
            }

            // Access log events
            if (signer.evidence?.accessLog) {
                signer.evidence.accessLog.forEach((log, logIndex) => {
                    auditTrail.push({
                        eventId: `evt_${Date.now()}_${index}_${logIndex}`,
                        timestamp: log.timestamp,
                        event: log.action,
                        actor: signer.email,
                        actorType: 'signer',
                        details: {
                            signerId: signer.signerId,
                            signerName: signer.fullName,
                            ...log.data
                        },
                        ipAddress: log.ipAddress,
                        userAgent: log.userAgent
                    });
                });
            }

            // Signature events
            if (signer.signedAt) {
                auditTrail.push({
                    eventId: `evt_${Date.now()}_${index + 200}`,
                    timestamp: signer.signedAt,
                    event: 'contract_signed',
                    actor: signer.email,
                    actorType: 'signer',
                    details: {
                        signerId: signer.signerId,
                        signerName: signer.fullName,
                        signatureType: signer.signature?.type,
                        consents: signer.consents?.length || 0,
                        verified: signer.verification?.method ? true : false
                    },
                    ipAddress: signer.evidence?.ipAddress,
                    userAgent: signer.evidence?.userAgent
                });
            }
        });

        // Contract completion
        if (contract.dates.completed) {
            auditTrail.push({
                eventId: `evt_${Date.now()}_999`,
                timestamp: contract.dates.completed,
                event: 'contract_completed',
                actor: 'system',
                actorType: 'system',
                details: {
                    contractId: contract.id,
                    totalSigners: contract.signers.length,
                    allSigned: contract.signers.every(s => s.status === 'signed')
                },
                ipAddress: null,
                userAgent: null
            });
        }

        // Sort by timestamp
        auditTrail.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        return auditTrail;
    }

    /**
     * Generate README content for evidence package
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
    }

    /**
     * Validate compliance issues
     */
    static getComplianceIssues(contract) {
        const issues = [];

        // Check for missing signatures
        const unsignedSigners = contract.signers.filter(s => s.status !== 'signed');
        if (unsignedSigners.length > 0) {
            issues.push({
                severity: 'high',
                type: 'missing_signatures',
                message: `${unsignedSigners.length} signer(s) have not signed the contract`,
                signers: unsignedSigners.map(s => s.email)
            });
        }

        // Check for missing evidence
        const signersWithoutEvidence = contract.signers.filter(s =>
            s.status === 'signed' && (!s.evidence || !s.evidence.ipAddress)
        );
        if (signersWithoutEvidence.length > 0) {
            issues.push({
                severity: 'medium',
                type: 'incomplete_evidence',
                message: 'Some signers have incomplete evidence data',
                signers: signersWithoutEvidence.map(s => s.email)
            });
        }

        // Check document integrity
        if (!contract.security?.originalHash) {
            issues.push({
                severity: 'high',
                type: 'missing_hash',
                message: 'Document hash is missing'
            });
        }

        // Check for missing consents
        const signersWithoutConsents = contract.signers.filter(s =>
            s.status === 'signed' && (!s.consents || s.consents.length === 0)
        );
        if (signersWithoutConsents.length > 0) {
            issues.push({
                severity: 'medium',
                type: 'missing_consents',
                message: 'Some signers have not provided required consents',
                signers: signersWithoutConsents.map(s => s.email)
            });
        }

        return issues;
    }
}

module.exports = EvidenceComplianceHelper;
