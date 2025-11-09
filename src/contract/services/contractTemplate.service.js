const { ContractTemplate } = require('../models/contract.model');
const crypto = require('crypto');

/**
 * Contract Template Service
 * Manages versioned contract templates with multi-language support
 */
class ContractTemplateService {

  /**
   * Helper method to find template by ID (supports both custom id and MongoDB _id)
   */
  static async findTemplateById(templateId, includeInactive = false) {
    // Try to find by custom id first
    let query = { id: templateId };
    if (!includeInactive) {
      query.isActive = true;
    }

    let template = await ContractTemplate.findOne(query);

    if (!template) {
      // Check if templateId is a valid MongoDB ObjectId and try finding by _id
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(templateId)) {
        const objectIdQuery = { _id: templateId };
        if (!includeInactive) {
          objectIdQuery.isActive = true;
        }
        template = await ContractTemplate.findOne(objectIdQuery);
      }
    }

    return template;
  }

  /**
   * Create a new contract template
   */
  static async createTemplate(templateData, userId, userName) {
    try {
      // Debug: Log incoming template data
      console.log('🔧 [Service] Received templateData:', {
        name: templateData.name,
        category: templateData.category,
        status: templateData.status,
        locale: templateData.locale,
        contentBodyLength: templateData.content?.body?.length,
        contentHtmlLength: templateData.content?.htmlBody?.length,
        variablesCount: templateData.content?.variables?.length,
        hasMetadata: !!templateData.metadata,
        hasLegal: !!templateData.legal,
      });
      console.log('📄 [Service] Full content object:', JSON.stringify(templateData.content, null, 2));

      // Generate unique template ID (never allow frontend to override this)
      const templateId = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Create clean template data without any potential ID override
      const cleanTemplateData = {
        ...templateData,
        id: templateId, // Always use our generated ID
        status: templateData.status || 'draft', // Default to draft status
        version: '1.0.0', // Always start with version 1.0.0
        isActive: true,
        audit: {
          createdBy: userId,
          createdByName: userName,
          createdAt: new Date(),
          lastModifiedBy: userId,
          lastModifiedByName: userName,
          lastModifiedAt: new Date()
        }
      };

      // Debug: Log clean template data before save
      console.log('🧹 [Service] Clean template data:', {
        id: cleanTemplateData.id,
        name: cleanTemplateData.name,
        contentBodyLength: cleanTemplateData.content?.body?.length,
        contentHtmlLength: cleanTemplateData.content?.htmlBody?.length,
        variablesCount: cleanTemplateData.content?.variables?.length,
      });
      console.log('📄 [Service] Clean content object:', JSON.stringify(cleanTemplateData.content, null, 2));

      const template = new ContractTemplate(cleanTemplateData);

      // Debug: Log template before save
      console.log('💾 [Service] Template before save:', {
        id: template.id,
        name: template.name,
        contentBodyLength: template.content?.body?.length,
        contentHtmlLength: template.content?.htmlBody?.length,
        variablesCount: template.content?.variables?.length,
      });

      await template.save();

      // Debug: Log template after save
      console.log('✅ [Service] Template after save:', {
        id: template.id,
        name: template.name,
        contentBodyLength: template.content?.body?.length,
        contentHtmlLength: template.content?.htmlBody?.length,
        variablesCount: template.content?.variables?.length,
      });
      console.log('📄 [Service] Saved content object:', JSON.stringify(template.content, null, 2));

      return template;
    } catch (error) {
      console.error('❌ [Service] Error creating template:', error);
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplate(templateId, includeInactive = false) {
    try {
      const template = await this.findTemplateById(templateId, includeInactive);

      if (!template) {
        throw new Error('Template not found');
      }

      return template.toObject();
    } catch (error) {
      throw new Error(`Failed to get template: ${error.message}`);
    }
  }

  /**
   * Get all templates with filters
   */
  static async getTemplates(filters = {}, options = {}) {
    try {
      const {
        isActive = true,
        applicablePlans,
        applicableRegions,
        search,
        category,
        status
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'audit.lastModifiedAt',
        sortOrder = 'desc'
      } = options;

      const query = {};

      if (isActive !== undefined) {
        query.isActive = isActive;
      }

      if (applicablePlans && applicablePlans.length > 0) {
        query['config.applicablePlans'] = { $in: applicablePlans };
      }

      if (applicableRegions && applicableRegions.length > 0) {
        query['config.applicableRegions'] = { $in: applicableRegions };
      }

      if (category && category !== 'all') {
        query.category = category;
      }

      if (status && status !== 'all') {
        query.status = status;
      }

      if (search) {
        query.$or = [
          { name: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
          { 'content.body': new RegExp(search, 'i') },
          { 'metadata.title': new RegExp(search, 'i') },
          { 'metadata.description': new RegExp(search, 'i') }
        ];
      }

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [templates, total] = await Promise.all([
        ContractTemplate.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        ContractTemplate.countDocuments(query)
      ]);

      return {
        templates,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get templates: ${error.message}`);
    }
  }

  /**
   * Update template
   */
  static async updateTemplate(templateId, updates, userId, userName) {
    try {
      const template = await this.findTemplateById(templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      // Prevent modification of critical fields
      const protectedFields = ['id', '_id', 'version', 'audit.createdBy', 'audit.createdAt', 'audit.createdByName'];
      const cleanUpdates = { ...updates };

      // Remove protected fields from updates
      delete cleanUpdates.id;
      delete cleanUpdates._id;
      delete cleanUpdates.version;
      if (cleanUpdates.audit) {
        delete cleanUpdates.audit.createdBy;
        delete cleanUpdates.audit.createdAt;
        delete cleanUpdates.audit.createdByName;
      }

      // Update template with validated data
      Object.assign(template, cleanUpdates);

      // Update audit info
      template.audit.lastModifiedBy = userId;
      template.audit.lastModifiedByName = userName;
      template.audit.lastModifiedAt = new Date();

      await template.save();
      return template;
    } catch (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }

  /**
   * Create new version of template
   */
  static async createNewVersion(templateId, updates, userId, userName) {
    try {
      const currentTemplate = await this.findTemplateById(templateId, true); // Include inactive for versioning

      if (!currentTemplate) {
        throw new Error('Template not found');
      }

      // Deactivate current version
      currentTemplate.isActive = false;
      await currentTemplate.save();

      // Create new version using template method
      const newVersionData = currentTemplate.createNewVersion(updates, userId, userName);
      const newTemplate = new ContractTemplate(newVersionData);

      await newTemplate.save();
      return newTemplate;
    } catch (error) {
      throw new Error(`Failed to create new version: ${error.message}`);
    }
  }

  /**
   * Approve template
   */
  static async approveTemplate(templateId, userId, userName) {
    try {
      const template = await this.findTemplateById(templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      template.audit.approvedBy = userId;
      template.audit.approvedByName = userName;
      template.audit.approvedAt = new Date();

      await template.save();
      return template;
    } catch (error) {
      throw new Error(`Failed to approve template: ${error.message}`);
    }
  }

  /**
   * Publish template
   */
  static async publishTemplate(templateId, userId, userName) {
    try {
      const template = await this.findTemplateById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      if (!template.audit.approvedAt) {
        throw new Error('Template must be approved before publishing');
      }

      template.audit.publishedBy = userId;
      template.audit.publishedByName = userName;
      template.audit.publishedAt = new Date();
      template.isActive = true;

      await template.save();
      return template;
    } catch (error) {
      throw new Error(`Failed to publish template: ${error.message}`);
    }
  }

  /**
   * Deactivate template
   */
  static async deactivateTemplate(templateId, userId, userName) {
    try {
      const template = await this.findTemplateById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      template.isActive = false;
      template.audit.lastModifiedBy = userId;
      template.audit.lastModifiedByName = userName;
      template.audit.lastModifiedAt = new Date();

      await template.save();
      return template;
    } catch (error) {
      throw new Error(`Failed to deactivate template: ${error.message}`);
    }
  }

  /**
   * Get template by plan and region
   */
  static async getTemplateForPlan(planId, region = 'US', language = 'en') {
    try {
      const templates = await ContractTemplate.find({
        isActive: true,
        'config.applicablePlans': planId,
        'config.applicableRegions': { $in: [region, 'ALL'] },
        [`content.languages.${language}`]: { $exists: true }
      }).sort({ 'audit.publishedAt': -1 });

      if (templates.length === 0) {
        // Fallback to default template
        const defaultTemplate = await ContractTemplate.findOne({
          isActive: true,
          'config.applicablePlans': 'DEFAULT',
          [`content.languages.${language}`]: { $exists: true }
        });

        if (!defaultTemplate) {
          throw new Error(`No template found for plan ${planId} in region ${region}`);
        }

        return defaultTemplate;
      }

      return templates[0]; // Return the most recent template
    } catch (error) {
      throw new Error(`Failed to get template for plan: ${error.message}`);
    }
  }

  /**
   * Render template with placeholder values
   */
  static async renderTemplate(templateId, placeholderValues, language = 'en') {
    try {
      const template = await this.getTemplate(templateId, language);

      // Validate placeholder values
      const validationErrors = template.validatePlaceholders(placeholderValues);
      if (validationErrors.length > 0) {
        throw new Error(`Placeholder validation failed: ${validationErrors.join(', ')}`);
      }

      // Render content
      const renderedContent = template.render(placeholderValues, language);

      return {
        template: template,
        renderedContent,
        placeholderValues,
        language
      };
    } catch (error) {
      throw new Error(`Failed to render template: ${error.message}`);
    }
  }

  /**
   * Clone template
   */
  static async cloneTemplate(templateId, newName, userId, userName) {
    try {
      const originalTemplate = await this.findTemplateById(templateId, true);
      if (!originalTemplate) {
        throw new Error('Template not found');
      }

      const clonedData = JSON.parse(JSON.stringify(originalTemplate.toObject()));

      // Update clone data
      delete clonedData._id;
      delete clonedData.__v;
      clonedData.id = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      clonedData.name = newName;
      clonedData.version = '1.0.0';
      clonedData.previousVersionId = null;
      clonedData.isActive = false; // Clones start inactive

      // Reset audit info
      clonedData.audit = {
        createdBy: userId,
        createdByName: userName,
        createdAt: new Date()
      };

      // Reset statistics
      clonedData.statistics = {
        totalSent: 0,
        totalSigned: 0,
        totalDeclined: 0,
        totalExpired: 0,
        averageSigningTime: 0
      };

      const clonedTemplate = new ContractTemplate(clonedData);
      await clonedTemplate.save();

      return clonedTemplate;
    } catch (error) {
      throw new Error(`Failed to clone template: ${error.message}`);
    }
  }

  /**
   * Get template statistics
   */
  static async getTemplateStatistics(templateId) {
    try {
      const template = await this.findTemplateById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Get usage data from signed contracts
      const { SignedContract } = require('../models/contract.model');

      const [totalSent, totalSigned, totalDeclined, totalExpired] = await Promise.all([
        SignedContract.countDocuments({ templateId }),
        SignedContract.countDocuments({ templateId, status: 'fully_signed' }),
        SignedContract.countDocuments({ templateId, status: 'declined' }),
        SignedContract.countDocuments({ templateId, status: 'expired' })
      ]);

      // Calculate average signing time
      const signedContracts = await SignedContract.find({
        templateId,
        status: 'fully_signed',
        'dates.sent': { $exists: true },
        'dates.completed': { $exists: true }
      }).select('dates.sent dates.completed');

      let averageSigningTime = 0;
      if (signedContracts.length > 0) {
        const totalTime = signedContracts.reduce((sum, contract) => {
          const timeDiff = contract.dates.completed - contract.dates.sent;
          return sum + (timeDiff / (1000 * 60)); // Convert to minutes
        }, 0);
        averageSigningTime = Math.round(totalTime / signedContracts.length);
      }

      // Update template statistics
      template.statistics = {
        totalSent,
        totalSigned,
        totalDeclined,
        totalExpired,
        averageSigningTime,
        lastUsed: await SignedContract.findOne({ templateId })
          .sort({ 'dates.created': -1 })
          .select('dates.created')
          .then(contract => contract?.dates.created)
      };

      await template.save();

      return {
        ...template.statistics,
        conversionRate: totalSent > 0 ? Math.round((totalSigned / totalSent) * 100) : 0,
        declineRate: totalSent > 0 ? Math.round((totalDeclined / totalSent) * 100) : 0,
        expireRate: totalSent > 0 ? Math.round((totalExpired / totalSent) * 100) : 0
      };
    } catch (error) {
      throw new Error(`Failed to get template statistics: ${error.message}`);
    }
  }

  /**
   * Get template audit history
   */
  static async getTemplateAuditHistory(templateId) {
    try {
      // Get all versions of this template
      const templates = await ContractTemplate.find({
        $or: [
          { id: templateId },
          { previousVersionId: templateId },
          { id: { $regex: templateId.split('_')[0] } } // Find all versions
        ]
      }).sort({ 'audit.createdAt': 1 });

      const auditHistory = [];

      templates.forEach(template => {
        // Created event
        auditHistory.push({
          event: 'created',
          timestamp: template.audit.createdAt,
          user: template.audit.createdByName,
          userId: template.audit.createdBy,
          version: template.version,
          templateId: template.id
        });

        // Modified events
        if (template.audit.lastModifiedAt) {
          auditHistory.push({
            event: 'modified',
            timestamp: template.audit.lastModifiedAt,
            user: template.audit.lastModifiedByName,
            userId: template.audit.lastModifiedBy,
            version: template.version,
            templateId: template.id
          });
        }

        // Approved event
        if (template.audit.approvedAt) {
          auditHistory.push({
            event: 'approved',
            timestamp: template.audit.approvedAt,
            user: template.audit.approvedByName,
            userId: template.audit.approvedBy,
            version: template.version,
            templateId: template.id
          });
        }

        // Published event
        if (template.audit.publishedAt) {
          auditHistory.push({
            event: 'published',
            timestamp: template.audit.publishedAt,
            user: template.audit.publishedByName,
            userId: template.audit.publishedBy,
            version: template.version,
            templateId: template.id
          });
        }
      });

      // Sort by timestamp
      auditHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return auditHistory;
    } catch (error) {
      throw new Error(`Failed to get audit history: ${error.message}`);
    }
  }

  /**
   * Validate template before activation
   */
  static async validateTemplate(templateId) {
    try {
      const template = await ContractTemplate.findOne({ id: templateId });
      if (!template) {
        throw new Error('Template not found');
      }

      const errors = [];
      const warnings = [];

      // Check required fields
      if (!template.name) errors.push('Template name is required');
      if (!template.content.languages.size) errors.push('At least one language must be defined');

      // Check content for each language
      for (const [lang, content] of template.content.languages) {
        if (!content.title) errors.push(`Title is required for language: ${lang}`);
        if (!content.body) errors.push(`Body content is required for language: ${lang}`);

        // Check for placeholder usage
        const placeholders = template.placeholders.map(p => p.key);
        const usedPlaceholders = [];

        placeholders.forEach(placeholder => {
          const regex = new RegExp(`{{${placeholder}}}`, 'g');
          if (content.body.match(regex)) {
            usedPlaceholders.push(placeholder);
          }
        });

        const unusedPlaceholders = placeholders.filter(p => !usedPlaceholders.includes(p));
        if (unusedPlaceholders.length > 0) {
          warnings.push(`Unused placeholders in ${lang}: ${unusedPlaceholders.join(', ')}`);
        }
      }

      // Check styling
      if (template.styling.customCSS) {
        // Basic CSS validation
        if (template.styling.customCSS.includes('<script')) {
          errors.push('Custom CSS cannot contain script tags');
        }
      }

      // Check legal requirements
      if (!template.config.legal.jurisdiction) {
        warnings.push('Jurisdiction is not specified');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        checkedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to validate template: ${error.message}`);
    }
  }

  /**
   * Export template as JSON
   */
  static async exportTemplate(templateId, includeStatistics = false) {
    try {
      const template = await this.findTemplateById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const exportData = template.toObject();

      if (!includeStatistics) {
        delete exportData.statistics;
      }

      // Add export metadata
      exportData._export = {
        exportedAt: new Date(),
        exportedBy: 'system',
        version: '1.0'
      };

      return exportData;
    } catch (error) {
      throw new Error(`Failed to export template: ${error.message}`);
    }
  }

  /**
   * Delete a contract template
   */
  static async deleteTemplate(templateId, userId, userName) {
    try {
      const template = await this.findTemplateById(templateId, true);

      if (!template) {
        throw new Error('Template not found');
      }

      // Check if template is being used in active contracts
      const { SignedContract } = require('../models/contract.model');
      const activeContractsCount = await SignedContract.countDocuments({
        templateId: template.id,
        status: { $in: ['draft', 'sent', 'partially_signed'] }
      });

      if (activeContractsCount > 0) {
        throw new Error(
          `Cannot delete template: It is being used by ${activeContractsCount} active contract(s). Please complete or void these contracts first.`
        );
      }

      // Perform soft delete by setting isActive to false
      template.isActive = false;
      template.status = 'archived';
      template.audit = template.audit || {};
      template.audit.lastModifiedBy = userId;
      template.audit.lastModifiedByName = userName;
      template.audit.lastModifiedAt = new Date();
      template.audit.deletedBy = userId;
      template.audit.deletedByName = userName;
      template.audit.deletedAt = new Date();

      await template.save();

      return template;
    } catch (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Import template from JSON
   */
  static async importTemplate(templateData, userId, userName) {
    try {
      // Validate import data
      if (!templateData.name || !templateData.content) {
        throw new Error('Invalid template data');
      }

      // Generate new ID for imported template
      const newId = `tpl_imported_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const importedData = {
        ...templateData,
        id: newId,
        isActive: false, // Imported templates start inactive
        audit: {
          createdBy: userId,
          createdByName: userName,
          createdAt: new Date()
        },
        statistics: {
          totalSent: 0,
          totalSigned: 0,
          totalDeclined: 0,
          totalExpired: 0,
          averageSigningTime: 0
        }
      };

      // Remove export metadata
      delete importedData._export;
      delete importedData._id;
      delete importedData.__v;

      const template = new ContractTemplate(importedData);
      await template.save();

      return template;
    } catch (error) {
      throw new Error(`Failed to import template: ${error.message}`);
    }
  }

  /**
   * Delete template (soft delete by default)
   */
  static async deleteTemplate(templateId, userId, userName, permanent = false) {
    try {
      const template = await this.findTemplateById(templateId, true); // Include inactive templates for deletion
      
      if (!template) {
        throw new Error('Template not found');
      }

      // Check if template is being used by any contracts
      const { SignedContract } = require('../models/contract.model');
      const contractsUsingTemplate = await SignedContract.countDocuments({
        'template.templateRef': template.id
      });

      if (contractsUsingTemplate > 0 && permanent) {
        throw new Error(`Cannot permanently delete template: It is being used by ${contractsUsingTemplate} contract(s)`);
      }

      if (permanent) {
        // Permanent deletion
        await ContractTemplate.findByIdAndDelete(template._id);
        return { deleted: true, permanent: true };
      } else {
        // Soft delete - mark as inactive and archived
        template.isActive = false;
        template.status = 'archived';
        template.audit.lastModifiedBy = userId;
        template.audit.lastModifiedByName = userName;
        template.audit.lastModifiedAt = new Date();
        
        // Add deletion audit entry
        if (!template.audit.deletionHistory) {
          template.audit.deletionHistory = [];
        }
        
        template.audit.deletionHistory.push({
          deletedBy: userId,
          deletedByName: userName,
          deletedAt: new Date(),
          reason: 'User requested deletion'
        });

        await template.save();
        return { deleted: true, permanent: false, template };
      }
    } catch (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Restore deleted template
   */
  static async restoreTemplate(templateId, userId, userName) {
    try {
      const template = await this.findTemplateById(templateId, true);
      
      if (!template) {
        throw new Error('Template not found');
      }

      if (template.isActive) {
        throw new Error('Template is not deleted');
      }

      // Restore template
      template.isActive = true;
      template.status = 'draft'; // Restore as draft for review
      template.audit.lastModifiedBy = userId;
      template.audit.lastModifiedByName = userName;
      template.audit.lastModifiedAt = new Date();

      // Add restoration audit entry
      if (!template.audit.restorationHistory) {
        template.audit.restorationHistory = [];
      }
      
      template.audit.restorationHistory.push({
        restoredBy: userId,
        restoredByName: userName,
        restoredAt: new Date()
      });

      await template.save();
      return template;
    } catch (error) {
      throw new Error(`Failed to restore template: ${error.message}`);
    }
  }
}

module.exports = ContractTemplateService;





