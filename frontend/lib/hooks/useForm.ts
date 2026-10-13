import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for form state management with validation.
 * Encapsulates common logic used in ClientForm, TemplateForm, and CampaignForm.
 */
export interface FormState<T> {
  values: T;
  errors: Record<string, string>;
  isValid: boolean;
}

export interface FormHandlers<T> {
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSubmit: (onSubmit: (data: T) => void) => (e: React.FormEvent) => void;
  reset: () => void;
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
  clearError: (field: keyof T) => void;
}

export function useForm<T extends Record<string, any>>(
  initialValues: T,
  validateFn: (values: T) => Partial<Record<keyof T, string>>,
  resetOnChange?: (newValues: T) => void
): [FormState<T>, FormHandlers<T>] {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate validity
  const isValid = Object.keys(errors).length === 0;

  // Handle external reset (e.g., when props change)
  useEffect(() => {
    if (resetOnChange) {
      resetOnChange(initialValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, resetOnChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setValues(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target;
    // Validate on blur for better UX
    const fieldErrors = validateFn(values);
    if (fieldErrors[name]) {
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }));
    }
  }, [values, validateFn]);

  const handleSubmit = useCallback((onSubmit: (data: T) => void) => {
    return (e: React.FormEvent) => {
      e.preventDefault();
      const fieldErrors = validateFn(values);
      setErrors(fieldErrors);

      if (Object.keys(fieldErrors).length === 0) {
        onSubmit(values);
      }
    };
  }, [values, validateFn]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const setFieldValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValues(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field when programmatically setting value
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const setErrorsHandler = useCallback((newErrors: Partial<Record<keyof T, string>>) => {
    setErrors(prev => ({ ...prev, ...newErrors }));
  }, []);

  const clearError = useCallback((field: keyof T) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const formState: FormState<T> = {
    values,
    errors,
    isValid
  };

  const formHandlers: FormHandlers<T> = {
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldValue,
    setErrors: setErrorsHandler,
    clearError
  };

  return [formState, formHandlers];
}