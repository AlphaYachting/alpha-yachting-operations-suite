import React, { createContext, useContext, useState } from 'react';

export const WizardContext = createContext();

export function WizardProvider({ children }) {
  const [wizardData, setWizardData] = useState({
    source: null, // 'lead' | 'customer' | 'new'
    sourceId: null, // ID if lead/customer selected
    sourceData: {
      lead: null,
      customer: null,
      newContact: { first_name: '', last_name: '', email: '', phone: '' }
    },
    vessel: { existing: null, new: null }, // boat_id OR new boatData
    location: { existing: null, new: null }, // location_id OR new locationData OR 'unknown'
    intent: null, // 'offer' | 'job' | 'offer+job' | 'inspection' | 'boat_only'
    offer: {
      title: '',
      description: '',
      language: 'German',
      validUntil: null,
      paymentTermsType: 'Full',
      downpaymentPercent: 0,
      lineItems: []
    },
    job: {
      title: '',
      description: '',
      jobType: 'Mobile Service',
      serviceCategory: 'General Service',
      priority: 'Normal',
      targetDate: null
    },
    workOrder: {
      title: '',
      description: '',
      scheduled_date: null,
      scheduled_start_time: null,
      estimated_duration_hours: null,
      createFirst: true,
      aiGenerateTasks: false
    },
    technicians: [], // array of technician IDs
    externalPartner: {
      enabled: false,
      partner_id: null,
      partner_name: '',
      partner_contact: '',
      budget: {
        total: 0,
        labor: 0,
        travel: 0,
        accommodation: 0,
        per_diem: 0
      }
    },
    currentStep: 1,
    errors: {}
  });

  const updateWizardData = (path, value) => {
    setWizardData(prev => {
      const keys = path.split('.');
      let obj = { ...prev };
      let current = obj;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        current[key] = { ...current[key] };
        current = current[key];
      }
      
      current[keys[keys.length - 1]] = value;
      return obj;
    });
  };

  const setStep = (step) => {
    setWizardData(prev => ({ ...prev, currentStep: step }));
  };

  const addError = (field, message) => {
    setWizardData(prev => ({
      ...prev,
      errors: { ...prev.errors, [field]: message }
    }));
  };

  const clearError = (field) => {
    setWizardData(prev => {
      const newErrors = { ...prev.errors };
      delete newErrors[field];
      return { ...prev, errors: newErrors };
    });
  };

  const reset = () => {
    setWizardData({
      source: null,
      sourceId: null,
      sourceData: {
        lead: null,
        customer: null,
        newContact: { first_name: '', last_name: '', email: '', phone: '' }
      },
      vessel: { existing: null, new: null },
      location: { existing: null, new: null },
      intent: null,
      offer: {
        title: '',
        description: '',
        language: 'German',
        validUntil: null,
        paymentTermsType: 'Full',
        downpaymentPercent: 0,
        lineItems: []
      },
      job: {
        title: '',
        description: '',
        jobType: 'Mobile Service',
        serviceCategory: 'General Service',
        priority: 'Normal',
        targetDate: null
      },
      workOrder: {
        title: '',
        description: '',
        scheduled_date: null,
        scheduled_start_time: null,
        estimated_duration_hours: null,
        createFirst: true,
        aiGenerateTasks: false
      },
      technicians: [],
      externalPartner: {
        enabled: false,
        partner_id: null,
        partner_name: '',
        partner_contact: '',
        budget: { total: 0, labor: 0, travel: 0, accommodation: 0, per_diem: 0 }
      },
      currentStep: 1,
      errors: {}
    });
  };

  return (
    <WizardContext.Provider value={{
      wizardData,
      updateWizardData,
      setStep,
      addError,
      clearError,
      reset
    }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within WizardProvider');
  }
  return context;
}