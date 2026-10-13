import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/index.js';

/**
 * Basic validation helper for request bodies
 * Can be extended with more sophisticated validation as needed
 */
export interface ValidationRule {
  (value: any): string | undefined;
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationSchema;
}

/**
 * Simple validation helper that checks required fields and basic types
 * Eliminates repetitive manual validation checks in route handlers
 */
export const validateRequest = (
  schema: ValidationSchema
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Record<string, string> = {};

    const validate = (obj: any, schema: ValidationSchema, path: string = '') => {
      for (const key in schema) {
        const fullPath = path ? `${path}.${key}` : key;
        const value = obj?.[key];
        const rule = schema[key];

        if (rule && typeof rule === 'function') {
          const error = rule(value);
          if (error) {
            errors[fullPath] = error;
          }
        } else if (rule && typeof rule === 'object' && !(rule instanceof Array)) {
          // Nested object validation
          if (value && typeof value === 'object') {
            validate(value, rule, fullPath);
          } else if (value === undefined) {
            errors[fullPath] = 'Object is required';
          }
        }
      }
    };

    validate(req.body, schema);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        data: errors
      } as ApiResponse);
    }

    next();
  };
};

// Common validation rules
export const rules = {
  required: (value: any): string | undefined => {
    if (value === undefined || value === null || value === '') {
      return 'This field is required';
    }
    return undefined;
  },

  email: (value: any): string | undefined => {
    if (!value) return undefined;
    if (typeof value !== 'string') return 'Must be a string';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Invalid email format';
    return undefined;
  },

  phone: (value: any): string | undefined => {
    if (!value) return undefined;
    if (typeof value !== 'string') return 'Must be a string';
    const phoneRegex = /^\+?[\d\s\-()]+$/;
    if (!phoneRegex.test(value)) return 'Invalid phone number format';
    return undefined;
  },

  minLength: (min: number) => {
    return (value: any): string | undefined => {
      if (!value) return undefined;
      if (typeof value !== 'string') return 'Must be a string';
      if (value.length < min) return `Must be at least ${min} characters`;
      return undefined;
    };
  },

  maxLength: (max: number) => {
    return (value: any): string | undefined => {
      if (!value) return undefined;
      if (typeof value !== 'string') return 'Must be a string';
      if (value.length > max) return `Must be at most ${max} characters`;
      return undefined;
    };
  }
};

// Additional validation rules
export const futureDate = () => {
  return (value: any): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) return 'Must be a valid date string';
      if (date < new Date()) return 'Schedule time must be in the future';
      return undefined;
    }
    return 'Must be a string';
  };
};

export const validateEnum = (enums: string[]) => {
  return (value: any): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') return 'Must be a string';
    if (!enums.includes(value)) return `Must be one of: ${enums.join(', ')}`;
    return undefined;
  };
};

export const arrayOfStrings = () => {
  return (value: any): string | undefined => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return 'Must be an array';
    if (value.some((item) => typeof item !== 'string')) return 'All elements must be strings';
    return undefined;
  };
};

// Common validation schemas
export const schemas = {
  createClient: {
    firstName: rules.required,
    lastName: rules.required, // Assuming lastName is required based on the API
    phone: rules.required,
    email: rules.email,
    birthday: (value: any): string | undefined => {
      if (!value) return undefined; // Optional
      if (typeof value !== 'string') return 'Must be a string';
      // Basic date validation (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Invalid date format';
      return undefined;
    },
    notes: (value: any): string | undefined => {
      if (!value) return undefined; // Optional
      if (typeof value !== 'string') return 'Must be a string';
      return undefined;
    }
  },
  createTemplate: {
    name: rules.required,
    category: (value: any): string | undefined => {
      if (!value) return 'Category is required';
      // Validate against TemplateCategory enum values
      const validCategories = ['APPOINTMENT', 'BIRTHDAY', 'HOLIDAY', 'PROMOTIONAL', 'REMINDER', 'FOLLOW_UP'];
      if (!validCategories.includes(value)) {
        return `Invalid category. Must be one of: ${validCategories.join(', ')}`;
      }
      return undefined;
    },
    content: rules.required
  },
  updateTemplate: {
    name: (value: any): string | undefined => {
      if (value === undefined) return undefined; // Optional
      if (typeof value !== 'string') return 'Must be a string';
      return undefined;
    },
    category: (value: any): string | undefined => {
      if (value === undefined) return undefined; // Optional
      // Validate against TemplateCategory enum values
      const validCategories = ['APPOINTMENT', 'BIRTHDAY', 'HOLIDAY', 'PROMOTIONAL', 'REMINDER', 'FOLLOW_UP'];
      if (!validCategories.includes(value)) {
        return `Invalid category. Must be one of: ${validCategories.join(', ')}`;
      }
      return undefined;
    },
    content: (value: any): string | undefined => {
      if (value === undefined) return undefined; // Optional
      if (typeof value !== 'string') return 'Must be a string';
      return undefined;
    }
  },
  createCampaign: {
    name: rules.required,
    description: (value: any): string | undefined => {
      if (value !== undefined && typeof value !== 'string') return 'Must be a string';
      return undefined;
    },
    templateId: (value: any): string | undefined => {
      if (value !== undefined && typeof value !== 'string') return 'Must be a string';
      return undefined;
    },
    scheduleTime: futureDate(),
    recurrence: validateEnum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    audience: validateEnum(['ALL', 'PREV_YEAR_ACTIVE', 'MANUAL']),
    manualRecipientIds: arrayOfStrings()
  },
  updateCampaign: {
    name: (value: any): string | undefined => {
      if (value === undefined) return undefined; // Optional
      if (typeof value !== 'string') return 'Must be a string';
      return undefined;
    },
    description: (value: any): string | undefined => {
      if (value !== undefined && typeof value !== 'string') return 'Must be a string';
      return undefined;
    },
    templateId: (value: any): string | undefined => {
      if (value !== undefined && typeof value !== 'string') return 'Must be a string';
      return undefined;
    },
    scheduleTime: futureDate(),
    recurrence: validateEnum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    audience: validateEnum(['ALL', 'PREV_YEAR_ACTIVE', 'MANUAL']),
    manualRecipientIds: arrayOfStrings(),
    status: (value: any): string | undefined => {
      if (value === undefined) return undefined; // Optional
      const validStatuses = ['DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(value)) return `Must be one of: ${validStatuses.join(', ')}`;
      return undefined;
    },
  },

  sendBulkMessage: {
    clientIds: arrayOfStrings(),
    content: (value: any): string | undefined => {
      if (!value) return 'Message content is required';
      if (typeof value !== 'string') return 'Must be a string';
      if (!value.trim()) return 'Message content is required';
      return undefined;
    },
    campaignId: (value: any): string | undefined => {
      if (value === undefined) return undefined; // Optional
      if (typeof value !== 'string') return 'Must be a string';
      return undefined;
    }
  },

  scheduleMessage: {
    clientId: rules.required,
    content: (value: any): string | undefined => {
      if (!value) return 'Message content is required';
      if (typeof value !== 'string') return 'Must be a string';
      if (!value.trim()) return 'Message content is required';
      return undefined;
    },
    campaignId: (value: any): string | undefined => {
      if (value === undefined) return undefined; // Optional
      if (typeof value !== 'string') return 'Must be a string';
      return undefined;
    },
    scheduledAt: futureDate()
  }
};
