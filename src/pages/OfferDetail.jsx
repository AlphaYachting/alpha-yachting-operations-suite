import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Send,
  FileText,
  AlertCircle,
  Loader2,
  Briefcase,
  Mail,
  Search,
  Heading,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import OfferTaskEditor from '@/components/offers/OfferTaskEditor';
import AIOfferGenerator from '@/components/offers/AIOfferGenerator';
import PaymentTermsSection from '@/components/offers/PaymentTermsSection';
import OfferGallery from '@/components/offers/OfferGallery';
import PDFExportButton from '@/components/pdf/PDFExportButton';
import PDFDocumentTemplate from '@/components/pdf/PDFDocumentTemplate';
import { computeOfferTotals } from '@/components/offers/offerTotals';
import FiraExportButton from '@/components/fira/FiraExportButton';
import OfferFollowUpDraft from '@/components/offers/OfferFollowUpDraft';

export default function OfferDetail() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const offerId = urlParams.get('id');
  const isNewOffer = !offerId;
  const debugMode = urlParams.get('debugOffer') === '1';

  // Check if customer is pre-selected via URL
  const preselectedCustomerId = urlParams.get('customer');

  const [formData, setFormData] = useState({
   customer_id: preselectedCustomerId || '',
   boat_id: '',
   job_id: '',
   location_id: '',
   title: '',
   description: '',
   language: 'German',
   status: 'Draft',
   valid_until: '',
   vat_rate: 0,
   notes: '',
   customer_notes: '',
   safety_compliance_clause: '',
   total_amount: 0,
   discount_mode: 'NONE',
   discount_percent: null,
   discount_amount: null,
   discount_target_total: null,
   payment_terms_type: 'Full',
   downpayment_percent: 0,
   downpayment_amount: 0,
   payment_schedule: '',
   retention_of_title_enabled: true,
   retention_of_title_text: '',
   show_marina_fees_notice: false,
  });
  const [tasks, setTasks] = useState([]);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [showFollowUpDraft, setShowFollowUpDraft] = useState(false);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [template, setTemplate] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const { data: offer } = useQuery({
    queryKey: ['offer', offerId],
    queryFn: () => base44.entities.Offer.list().then(offers => offers.find(o => o.id === offerId)),
    enabled: !!offerId,
  });

  const { data: offerTasks = [] } = useQuery({
    queryKey: ['offerTasks', offerId],
    queryFn: () => base44.entities.OfferTask.filter({ offer_id: offerId }, 'sequence_order'),
    enabled: !!offerId,
  });

  const { data: offerSections = [] } = useQuery({
    queryKey: ['offerSections', offerId],
    queryFn: () => base44.entities.OfferSection.filter({ offer_id: offerId }, 'display_order'),
    enabled: !!offerId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: boats = [] } = useQuery({
    queryKey: ['boats'],
    queryFn: () => base44.entities.Boat.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.Location.filter({ status: 'Active' }),
  });

  const { data: pdfTemplate } = useQuery({
    queryKey: ['pdfTemplate'],
    queryFn: async () => {
      const templates = await base44.entities.PDFTemplate.list();
      return templates.find(t => t.is_default) || templates[0];
    },
  });

  useEffect(() => {
    if (pdfTemplate) {
      setTemplate(pdfTemplate);
    }
  }, [pdfTemplate]);

  // Scroll to top whenever the offer page is opened
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [offerId]);

  useEffect(() => {
    if (offer) {
      setFormData({
        ...offer,
        title: offer.title || '',
        description: offer.description || '',
        notes: offer.notes || '',
        customer_notes: offer.customer_notes || '',
        safety_compliance_clause: offer.safety_compliance_clause || '',
        payment_schedule: offer.payment_schedule || '',
        retention_of_title_text: offer.retention_of_title_text || '',
        valid_until: offer.valid_until || '',
        customer_id: offer.customer_id || '',
        boat_id: offer.boat_id || '',
        job_id: offer.job_id || '',
        vat_rate: offer.vat_rate || 0,
        discount_mode: offer.discount_mode || 'NONE',
        discount_percent: offer.discount_percent || null,
        discount_amount: offer.discount_amount || null,
        discount_target_total: offer.discount_target_total || null,
      });
    }
  }, [offer]);

  useEffect(() => {
    if (offerTasks.length > 0) {
      setTasks(offerTasks);
    }
  }, [offerTasks]);

  // Calculate totals using the single source of truth
  const totals = computeOfferTotals(
    {
      vat_rate: formData.vat_rate,
      discount_mode: formData.discount_mode,
      discount_percent: formData.discount_percent,
      discount_target_total: formData.discount_target_total
    },
    tasks
  );

  // Load template data if coming from template selector
  useEffect(() => {
    if (!offerId) {
      const templateData = sessionStorage.getItem('offerTemplate');
      if (templateData) {
        try {
          const { template, lineItems } = JSON.parse(templateData);
          
          // Prefill form with template data
          setFormData(prev => ({
            ...prev,
            title: template.title || '',
            description: template.description || '',
            customer_notes: template.customer_notes || '',
            language: template.language || 'German',
            vat_rate: template.vat_rate || 0,
            payment_terms_type: template.payment_terms_type || 'Full',
            downpayment_percent: template.downpayment_percent || null,
            payment_schedule: template.payment_schedule || '',
          }));

          // Prefill tasks with template line items
          const prefillTasks = lineItems.map((item, index) => ({
            id: `temp-${Date.now()}-${index}`,
            sequence_order: item.sequence_order || index,
            title: item.title,
            description: item.description || '',
            unit_type: item.unit_type || 'Hour',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            total_amount: (item.quantity || 1) * (item.unit_price || 0),
            is_optional: item.is_optional || false,
            notes: item.notes || '',
          }));
          setTasks(prefillTasks);

          // Clear template data from session
          sessionStorage.removeItem('offerTemplate');
          
          toast.success('Template loaded successfully');
        } catch (error) {
          console.error('Error loading template:', error);
        }
      }
    }
  }, [offerId]);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerateProjectIntroduction = async () => {
    if (!formData.title) {
      toast.error('Please add an offer title first');
      return;
    }

    setSaving(true);
    try {
      const customer = customers.find(c => c.id === formData.customer_id);
      const boat = boats.find(b => b.id === formData.boat_id);
      const location = locations.find(l => l.id === formData.location_id);

      const boatInfo = boat ? `${boat.vessel_name}${boat.manufacturer ? ` (${boat.manufacturer}${boat.model ? ` ${boat.model}` : ''})` : ''}` : '';
      const locationInfo = location ? location.name : '';

      // Build salutation line from available data (no explicit salutation field)
      const lastName = customer?.last_name || '';
      const firstName = customer?.first_name || '';
      const isCompany = customer?.customer_type !== 'Private' || !!customer?.company_name;
      let salutationLine = '';
      if (isCompany) {
        salutationLine = `Sehr geehrte Damen und Herren,`;
      } else {
        salutationLine = `Sehr geehrte/r ${firstName} ${lastName},`.trim();
      }

      const langSalutationMap = {
        'English': isCompany ? `Dear Sir or Madam,` : `Dear ${firstName} ${lastName},`,
        'Italian': isCompany ? `Gentili Signore e Signori,` : `Gentile ${firstName} ${lastName},`,
        'Slovenian': isCompany ? `Spoštovane dame in gospodje,` : `Spoštovani/a ${lastName},`,
        'Croatian': isCompany ? `Poštovane dame i gospodo,` : `Poštovani/a ${lastName},`,
      };
      const finalSalutation = langSalutationMap[formData.language] || salutationLine;

      const tasksText = tasks.map(t =>
        `- ${t.title}${t.description ? `: ${t.description}` : ''} (${t.quantity} ${t.unit_type})`
      ).join('\n');

      const languageInstruction = {
        'German': 'Respond in German.',
        'English': 'Respond in English.',
        'Italian': 'Respond in Italian.',
        'Slovenian': 'Respond in Slovenian.',
        'Croatian': 'Respond in Croatian.'
      }[formData.language] || 'Respond in German.';

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are writing a project introduction for a yacht service offer.

${languageInstruction}

The text MUST start with this exact salutation line on its own line:
"${finalSalutation}"

Then write a short, professional project description (1-2 paragraphs max) that:
- Describes what work will be done clearly and concisely
- Mentions boat (${boatInfo || 'N/A'}) and location (${locationInfo || 'N/A'}) if relevant
- No prices or timelines
- Professional and direct tone

Services to describe:
${tasksText || 'N/A'}

Project title: ${formData.title}`,
      });

      updateField('description', response);
      toast.success('Projektbeschreibung generiert');
    } catch (error) {
      console.error('Error generating introduction:', error);
      toast.error('Failed to generate introduction');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSafetyClause = async () => {
    if (!formData.title) {
      toast.error('Please add an offer title first');
      return;
    }

    setSaving(true);
    try {
      const tasksText = tasks.map(t => `${t.title} (${t.quantity} ${t.unit_type})`).join(', ');
      
      const languageCode = formData.language === 'German' ? 'DE' : 'EN';
      const languageInstruction = languageCode === 'DE' 
        ? 'Respond in German.' 
        : 'Respond in English.';

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are generating a professional safety and environmental compliance clause for a yacht service offer.

${languageInstruction}

Offer title: ${formData.title}
Offer description: ${formData.description || 'N/A'}
Services: ${tasksText || 'N/A'}

Generate a 2-5 sentence compliance clause that mentions:
- Trained and qualified personnel
- Safety measures during work
- Environmental precautions
- Adherence to manufacturer instructions and technical guidelines

Requirements:
- Professional and calm tone
- No legal guarantees or warranties
- No specific timelines or deadlines
- Generic and applicable to yacht maintenance/service work`,
      });

      updateField('safety_compliance_clause', response);
      toast.success('Safety clause generated');
    } catch (error) {
      console.error('Error generating clause:', error);
      toast.error('Failed to generate clause');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMarinaCommission = () => {
    // Check if Marina Commission already exists
    const existingIndex = tasks.findIndex(t => 
      t.title && t.title.toLowerCase() === 'marina commission'
    );

    if (existingIndex !== -1) {
      toast.info('Marina Commission already exists in this offer');
      // Scroll to existing item (using DOM manipulation)
      const element = document.querySelector(`[data-task-index="${existingIndex}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-blue-500');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500');
        }, 2000);
      }
      return;
    }

    // Get selected marina/location name
    const selectedLocation = locations.find(l => l.id === formData.location_id);
    const marinaName = selectedLocation?.name;

    // Build description based on marina context
    let description = '';
    if (marinaName) {
      description = `Commission/fee charged by ${marinaName}. This position reflects marina-specific commission settings.`;
    } else {
      description = 'Commission/fee charged by the selected marina. This position reflects marina-specific commission settings.';
    }

    // Add new Marina Commission item
    const newTask = {
      title: 'Marina Commission',
      description,
      unit_type: 'Lump Sum',
      quantity: 1,
      unit_price: 0,
      total_amount: 0,
      is_optional: false,
      notes: '',
    };

    setTasks([...tasks, newTask]);
    toast.success('Marina Commission added');
  };

  const handleSaveAsTemplate = async () => {
    if (!formData.title) {
      toast.error('Please add an offer title before saving as template');
      return;
    }

    const templateName = prompt('Enter template name:');
    if (!templateName) return;

    try {
      setSaving(true);

      // Create template
      const newTemplate = await base44.entities.OfferTemplate.create({
        template_name: templateName,
        title: formData.title,
        description: formData.description || '',
        customer_notes: formData.customer_notes || '',
        language: formData.language || 'German',
        vat_rate: formData.vat_rate || 0,
        payment_terms_type: formData.payment_terms_type || 'Full',
        downpayment_percent: formData.downpayment_percent || null,
        payment_schedule: formData.payment_schedule || '',
      });

      // Create template line items from tasks
      const lineItemPromises = tasks.map((task, index) =>
        base44.entities.OfferTemplateLineItem.create({
          template_id: newTemplate.id,
          sequence_order: task.sequence_order ?? index,
          title: task.title,
          description: task.description || '',
          unit_type: task.unit_type || 'Hour',
          quantity: task.quantity || 1,
          unit_price: task.unit_price || 0,
          is_optional: task.is_optional || false,
          notes: task.notes || '',
        })
      );
      await Promise.all(lineItemPromises);

      toast.success(`Template "${templateName}" created successfully`);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (!formData.customer_id || !formData.title) {
        throw new Error('Customer and title are required');
      }

      let savedOfferId = offerId;

      if (isNewOffer) {
        // Generate offer number - find highest existing number
        const allOffers = await base44.entities.Offer.list();
        const existingNumbers = allOffers
          .map(o => o.offer_number)
          .filter(num => num && num.startsWith('OFF-2026-'))
          .map(num => parseInt(num.split('-')[2]) || 0);
        
        const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
        const offerNumber = `OFF-2026-${String(maxNumber + 1).padStart(4, '0')}`;
        
        const newOffer = await base44.entities.Offer.create({
          ...formData,
          offer_number: offerNumber,
          total_amount: totals.taxable_base_excl_tax,
          discount_amount: totals.discount_amount_excl_tax
        });
        savedOfferId = newOffer.id;

        // Create tasks
        if (tasks.length > 0) {
          await base44.entities.OfferTask.bulkCreate(
            tasks.map((task, idx) => ({
              ...task,
              offer_id: savedOfferId,
              sequence_order: idx,
              total_amount: task.quantity * task.unit_price,
            }))
          );
        }

        queryClient.invalidateQueries(['offers']);
        navigate(createPageUrl('OfferDetail') + `?id=${savedOfferId}`);
      } else {
        // Update existing offer with calculated totals
        await base44.entities.Offer.update(offerId, {
          ...formData,
          total_amount: totals.taxable_base_excl_tax,
          discount_amount: totals.discount_amount_excl_tax
        });

        // Delete existing tasks and recreate
        const existingTasks = await base44.entities.OfferTask.filter({ offer_id: offerId });
        for (const task of existingTasks) {
          await base44.entities.OfferTask.delete(task.id);
        }

        if (tasks.length > 0) {
          await base44.entities.OfferTask.bulkCreate(
            tasks.map((task, idx) => ({
              ...task,
              offer_id: offerId,
              sequence_order: idx,
              total_amount: task.quantity * task.unit_price,
            }))
          );
        }

        queryClient.invalidateQueries(['offer', offerId]);
        queryClient.invalidateQueries(['offerTasks', offerId]);
        queryClient.invalidateQueries(['offers']);
      }
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToWorkOrder = async () => {
    if (!offerId || formData.status !== 'Approved') return;

    setSaving(true);
    setError(null);

    try {
      // Use createWorkOrderWithNumber for canonical WO number
      const woResponse = await base44.functions.invoke('createWorkOrderWithNumber', {
        job_id: formData.job_id,
        offer_id: offerId,
        title: formData.title,
        description: formData.description,
        scheduled_date: new Date().toISOString().split('T')[0],
        status: 'Draft',
        billable: true,
      });
      if (!woResponse.data?.success) {
        throw new Error(woResponse.data?.message || 'Failed to create work order');
      }
      const workOrder = woResponse.data.work_order;

      // Create tasks from offer tasks
      if (tasks.length > 0) {
        await base44.entities.Task.bulkCreate(
          tasks.map((task, idx) => ({
            work_order_id: workOrder.id,
            title: task.title,
            description: `${task.description || ''}\n${task.quantity} ${task.unit_type} @ €${task.unit_price}`,
            sequence_order: idx,
            estimated_minutes: task.unit_type === 'Hour' ? task.quantity * 60 : 0,
            status: 'Not Started',
          }))
        );
      }

      // Update offer status
      await base44.entities.Offer.update(offerId, {
        status: 'Converted',
        converted_work_order_id: workOrder.id,
      });

      queryClient.invalidateQueries(['offer', offerId]);
      queryClient.invalidateQueries(['offers']);
      
      setShowConvertDialog(false);
      navigate(createPageUrl('WorkOrderDetail') + `?id=${workOrder.id}`);
    } catch (err) {
      console.error('Convert error:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    if (!offerId || formData.status !== 'Approved') return;

    setSaving(true);
    setError(null);

    try {
      // Pre-flight validation
      if (!formData.customer_id || !formData.title) {
        throw new Error('Invalid offer data');
      }
      if (formData.converted_job_id) {
        throw new Error('Already converted to project');
      }
      if (tasks.length === 0) {
        throw new Error('No tasks to convert');
      }

      // Allocate canonical job number (same logic as allocateJobNumber function)
      const allJobsForNum = await base44.entities.Job.list('-created_date', 100);
      const validJobNums = allJobsForNum
        .map(j => j.job_number)
        .filter(num => num && /^J\d{5}$/.test(num))
        .map(num => parseInt(num.substring(1), 10))
        .filter(num => !isNaN(num));
      const maxJobNum = validJobNums.length > 0 ? Math.max(...validJobNums) : 0;
      const jobNumber = `J${String(maxJobNum + 1).padStart(5, '0')}`;

      // Create Job (Project)
      const job = await base44.entities.Job.create({
        job_number: jobNumber,
        customer_id: formData.customer_id,
        boat_id: formData.boat_id || null,
        title: formData.title,
        description: formData.description || '',
        status: 'Approved',
        service_category: 'General Service',
        quote_amount: formData.total_amount,
        quote_approved: true,
        quote_approved_date: new Date().toISOString().split('T')[0],
        intake_source: 'Email',
        intake_date: new Date().toISOString(),
      });

      // Update Offer with job link
      await base44.entities.Offer.update(offerId, {
        status: 'Converted',
        converted_job_id: job.id,
      });

      // Use createWorkOrderWithNumber for canonical WO number
      const woResponse2 = await base44.functions.invoke('createWorkOrderWithNumber', {
        job_id: job.id,
        offer_id: offerId,
        title: formData.title,
        description: formData.description || '',
        scheduled_date: new Date().toISOString().split('T')[0],
        status: 'Draft',
        billable: true,
      });
      if (!woResponse2.data?.success) {
        throw new Error(woResponse2.data?.message || 'Failed to create work order');
      }
      const workOrder = woResponse2.data.work_order;

      // Create Tasks with EXACT text from OfferTasks
      if (tasks.length > 0) {
        await base44.entities.Task.bulkCreate(
          tasks
            .filter(task => !task.is_optional)
            .map((task, idx) => ({
              work_order_id: workOrder.id,
              title: task.title,
              description: task.description || '',
              sequence_order: task.sequence_order ?? idx,
              status: 'Not Started',
              estimated_minutes: task.unit_type === 'Hour' ? task.quantity * 60 : null,
              notes: task.notes || '',
            }))
        );
      }

      queryClient.invalidateQueries(['offer', offerId]);
      queryClient.invalidateQueries(['offers']);
      queryClient.invalidateQueries(['jobs']);
      
      setShowCreateProjectDialog(false);
      toast.success('Project created successfully');
      navigate(createPageUrl('JobDetail') + `?id=${job.id}`);
    } catch (err) {
      console.error('Create project error:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const filteredBoats = boats.filter(b => b.customer_id === formData.customer_id);
  const filteredJobs = jobs.filter(j => j.customer_id === formData.customer_id);

  // Searchable customer select state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setCustomerDropdownOpen(false);
        setCustomerSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = customers.filter(c => {
    const name = (c.company_name || `${c.first_name || ''} ${c.last_name || ''}`).toLowerCase();
    return name.includes(customerSearch.toLowerCase());
  });

  const selectedCustomerName = (() => {
    const c = customers.find(c => c.id === formData.customer_id);
    if (!c) return null;
    return c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim();
  })();

  // Auto-save status change without full form save
  const handleStatusChange = async (newStatus) => {
    updateField('status', newStatus);
    if (!offerId) return; // new offer: just update local state
    try {
      await base44.entities.Offer.update(offerId, { status: newStatus });
      queryClient.invalidateQueries(['offer', offerId]);
      queryClient.invalidateQueries(['offers']);
      toast.success(`Status: ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error('Status konnte nicht gespeichert werden');
    }
  };

  const handleSendEmail = () => {
    const customer = customers.find(c => c.id === formData.customer_id);
    if (!customer?.email) {
      toast.error('Kein E-Mail-Adresse für diesen Kunden gefunden.');
      return;
    }

    // Build salutation from available data
    const lastName = customer.last_name || '';
    const firstName = customer.first_name || '';
    const isCompany = customer.customer_type !== 'Private' || !!customer.company_name;
    const salutationLine = isCompany
      ? `Sehr geehrte Damen und Herren`
      : `Sehr geehrte/r ${firstName} ${lastName}`.trim();

    const offerNumber = formData.offer_number ? ` (${formData.offer_number})` : '';
    const subject = encodeURIComponent(`Angebot: ${formData.title || ''}${offerNumber}`);

    // Include the AI-generated description if available, otherwise generic text
    const descriptionPart = formData.description
      ? `${formData.description}\n\n`
      : `anbei erhalten Sie unser Angebot für die besprochenen Leistungen.\n\n`;

    const body = encodeURIComponent(
      `${salutationLine},\n\n${descriptionPart}Bitte prüfen Sie das Angebot in Ruhe und melden Sie sich bei Fragen.\n\nMit freundlichen Grüßen,\nIhr Team`
    );
    window.open(`mailto:${customer.email}?subject=${subject}&body=${body}`, '_self');
  };

  // Get selected location and check if marina fees apply
  const selectedLocation = locations.find(l => l.id === formData.location_id);
  const marinaFeesApply = selectedLocation?.marina_fee_enabled && selectedLocation?.location_type === 'Marina';

  // Prepare PDF document data
  const getPDFDocument = () => {
    const customer = customers.find(c => c.id === formData.customer_id);
    const boat = boats.find(b => b.id === formData.boat_id);
    
    return {
      id: offerId,
      document_type: 'Offer',
      document_number: formData.offer_number || 'DRAFT',
      status: formData.status,
      title: formData.title,
      description: formData.description,
      customer_name: customer ? (customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()) : '',
      customer_address: customer ? [
        customer.billing_address,
        customer.billing_city && customer.billing_postal_code ? `${customer.billing_postal_code} ${customer.billing_city}` : customer.billing_city,
        customer.billing_country
      ].filter(Boolean).join('\n') : '',
      customer_vat: customer?.vat_number,
      boat_name: boat?.vessel_name,
      boat_details: boat ? [boat.make, boat.model, boat.year].filter(Boolean).join(' ') : '',
      issue_date: offer?.created_date || new Date().toISOString().split('T')[0],
      valid_until: formData.valid_until,
      payment_terms: customer?.payment_terms || 'Net 14 days',
      payment_terms_type: formData.payment_terms_type,
      downpayment_percent: formData.downpayment_percent || 0,
      downpayment_amount: formData.downpayment_amount || 0,
      payment_schedule: formData.payment_schedule,
      retention_of_title_enabled: formData.retention_of_title_enabled,
      retention_of_title_text: formData.retention_of_title_text,
      show_marina_fees_notice: formData.show_marina_fees_notice,
      vat_rate: totals.vat_rate,
      subtotal: totals.subtotal_excl_tax,
      discount_mode: totals.discount_mode,
      discount_percent: totals.discount_percent,
      discount_target_total: formData.discount_target_total,
      discount_amount: totals.discount_amount_excl_tax,
      tax_amount: totals.vat_amount,
      total: totals.total_incl_tax,
      public_notes: formData.customer_notes,
      safety_compliance_clause: formData.safety_compliance_clause,
      currency: 'EUR',
      language: formData.language,
      attachments: formData.attachments || [],
      gallery_meta: formData.gallery_meta || {}
    };
  };

  const getPDFLineItems = () => {
    const vatRate = formData.vat_rate || 0;
    return tasks.map((task, index) => {
      const unit = task.unit_type || 'Hour';
      const totalNet = task.total_amount || 0;
      return {
        sort_order: task.sequence_order || index,
        title: task.title,
        description: task.description,
        quantity: task.quantity || 0,
        unit: unit,
        unit_price: task.unit_price || 0,
        tax_rate: vatRate,
        total_net: totalNet,
        total_tax: 0,
        total_gross: totalNet,
        is_optional: task.is_optional || false
      };
    });
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm 20mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
          .no-print {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          #pdf-print-template {
            display: block !important;
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
          }
          #pdf-print-template * {
            visibility: visible;
          }
          #pdf-content {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            transform: scale(1) !important;
            transform-origin: top left !important;
          }
        }
      `}</style>
    <div className="space-y-6 no-print">
      {/* Header */}
      <div className="space-y-4">
        {/* Row 1: Action Buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Offers'))}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-2 flex-wrap">
            {!isNewOffer && (
              <FiraExportButton
                offer={{ ...formData, id: offerId }}
                tasks={tasks}
                customer={customers.find(c => c.id === formData.customer_id) || null}
                userRole={currentUser?.role}
                onExported={() => queryClient.invalidateQueries(['offer', offerId])}
              />
            )}
            {formData.customer_id && formData.title && (
              <PDFExportButton 
                document={getPDFDocument()}
                lineItems={getPDFLineItems()}
                offerSections={offerSections}
              />
            )}
            {formData.customer_id && customers.find(c => c.id === formData.customer_id)?.email && (
              <Button
                onClick={handleSendEmail}
                variant="outline"
                className="border-sky-500 text-sky-600 hover:bg-sky-50"
              >
                <Mail className="h-4 w-4 mr-2" />
                E-Mail senden
              </Button>
            )}
            {!isNewOffer && formData.status === 'Sent' && formData.customer_id && (
              <Button
                onClick={() => setShowFollowUpDraft(true)}
                variant="outline"
                className="border-amber-500 text-amber-600 hover:bg-amber-50"
              >
                <Mail className="h-4 w-4 mr-2" />
                Follow-up E-Mail
              </Button>
            )}
            {formData.converted_job_id ? (
              <Button
                onClick={() => navigate(createPageUrl('JobDetail') + `?id=${formData.converted_job_id}`)}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                View Project
              </Button>
            ) : (
              formData.status === 'Approved' && !formData.converted_work_order_id && (
                <Button
                  onClick={() => setShowCreateProjectDialog(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              )
            )}
            {formData.status === 'Approved' && !formData.converted_work_order_id && formData.job_id && !formData.converted_job_id && (
              <Button
                onClick={() => setShowConvertDialog(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                Convert to Work Order
              </Button>
            )}
            {(offerId || tasks.length > 0) && (
              <Button
                onClick={handleSaveAsTemplate}
                disabled={saving}
                variant="outline"
                className="border-purple-600 text-purple-600 hover:bg-purple-50"
              >
                Save as Template
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Offer'}
            </Button>
          </div>
        </div>
        
        {/* Row 2: Title */}
        <h1 className="text-3xl font-bold text-slate-900">
          {isNewOffer ? 'New Offer' : formData.title}
        </h1>
        
        {/* Row 3: Meta Info */}
        {!isNewOffer && formData.offer_number && (
          <p className="text-slate-600">#{formData.offer_number}</p>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* RUNTIME VISIBILITY PROBE - Remove after diagnosis */}
      {debugMode && (
        <Alert className="bg-yellow-100 border-yellow-400">
          <AlertCircle className="h-4 w-4 text-yellow-700" />
          <AlertDescription>
            <div className="space-y-2 text-xs font-mono">
              <div className="font-bold text-yellow-900">🔍 PROBE ACTIVE - OfferDetail Component</div>
              
              <div className="border-t border-yellow-300 pt-2 mt-2">
                <div className="font-semibold text-yellow-900">A) SCREEN IDENTITY:</div>
                <div>• Route: /OfferDetail{offerId ? `?id=${offerId}` : ' (new)'}</div>
                <div>• Component: pages/OfferDetail.jsx</div>
                <div>• Mode: {isNewOffer ? 'NEW OFFER' : 'EDIT OFFER'}</div>
              </div>

              <div className="border-t border-yellow-300 pt-2 mt-2">
                <div className="font-semibold text-yellow-900">B) STATE KEYS:</div>
                <div>• formData keys: {Object.keys(formData).join(', ')}</div>
                <div>• hasLanguageKey: {formData.hasOwnProperty('language') ? '✅ YES' : '❌ NO'}</div>
                <div>• hasSafetyClauseKey: {formData.hasOwnProperty('safety_compliance_clause') ? '✅ YES' : '❌ NO'}</div>
                <div>• currentLanguageValue: {formData.language || 'undefined'}</div>
                <div>• safetyClauseLength: {(formData.safety_compliance_clause || '').length} chars</div>
                <div>• safetyClauseValue: {formData.safety_compliance_clause || '(empty)'}</div>
              </div>

              <div className="border-t border-yellow-300 pt-2 mt-2">
                <div className="font-semibold text-yellow-900">C) RENDER CONDITIONS:</div>
                <div>• No feature flags present: ✅</div>
                <div>• No permission checks present: ✅</div>
                <div>• No edit/view mode gating: ✅</div>
                <div>• No tab/accordion gating: ✅</div>
                <div>• Section should render at line 778-799: ✅</div>
              </div>

              <div className="border-t border-yellow-300 pt-2 mt-2">
                <div className="font-semibold text-yellow-900">D) UI PLACEMENT:</div>
                <div>• Location: Main Card, after Internal Notes</div>
                <div>• Line in code: 778-799</div>
                <div>• Expected position: Between "Internal Notes" and Tasks section</div>
                <div>• Tabs/Accordions: NONE - all visible by default</div>
              </div>

              <div className="border-t border-yellow-300 pt-2 mt-2">
                <div className="font-bold text-red-700">⚠️ SCROLL DOWN TO SEE SAFETY CLAUSE UI</div>
                <div>The UI should be visible below "Internal Notes" field.</div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* PDF Template for Print */}
      {template && formData.customer_id && formData.title && (
        <div id="pdf-print-template" key={`${formData.total_amount}-${tasks.length}-${formData.payment_terms_type}-${formData.downpayment_percent}`} style={{ display: 'none' }}>
          <PDFDocumentTemplate 
            document={getPDFDocument()}
            lineItems={getPDFLineItems()}
            template={template}
            offerSections={offerSections}
          />
        </div>
      )}

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Offer Details</CardTitle>
                {!isNewOffer && (
                  <Select value={formData.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className={`w-36 h-8 text-sm font-semibold border-0 focus:ring-0 ${
                      formData.status === 'Approved'  ? 'bg-green-100 text-green-700' :
                      formData.status === 'Sent'      ? 'bg-blue-100 text-blue-700' :
                      formData.status === 'Rejected'  ? 'bg-red-100 text-red-700' :
                      formData.status === 'Expired'   ? 'bg-orange-100 text-orange-700' :
                      formData.status === 'Converted' ? 'bg-purple-100 text-purple-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Sent">Sent</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2" ref={customerDropdownRef}>
                  <Label>Customer *</Label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setCustomerDropdownOpen(v => !v); setCustomerSearch(''); }}
                      className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <span className={selectedCustomerName ? 'text-foreground' : 'text-muted-foreground'}>
                        {selectedCustomerName || 'Select customer'}
                      </span>
                      <svg className="h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    {customerDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <input
                            autoFocus
                            className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                            placeholder="Search customer..."
                            value={customerSearch}
                            onChange={e => setCustomerSearch(e.target.value)}
                          />
                        </div>
                        <div className="max-h-52 overflow-y-auto p-1">
                          {filteredCustomers.length === 0 ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">No customer found.</div>
                          ) : filteredCustomers.map(c => (
                            <div
                              key={c.id}
                              className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${formData.customer_id === c.id ? 'bg-accent' : ''}`}
                              onClick={() => { updateField('customer_id', c.id); setCustomerDropdownOpen(false); setCustomerSearch(''); }}
                            >
                              {c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Boat</Label>
                  <Select value={formData.boat_id} onValueChange={(v) => updateField('boat_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select boat" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredBoats.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.vessel_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Related Job</Label>
                  <Select value={formData.job_id} onValueChange={(v) => updateField('job_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select job (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredJobs.map(j => (
                        <SelectItem key={j.id} value={j.id}>
                          {j.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Location</Label>
                  <Select value={formData.location_id} onValueChange={(v) => updateField('location_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} {l.marina_fee_enabled && '⚓'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {marinaFeesApply && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800">
                    <strong>Marina Fees Apply:</strong> {selectedLocation.name} charges {
                      selectedLocation.marina_fee_type === 'percent_commission' 
                        ? `${selectedLocation.marina_fee_amount}% commission` 
                        : selectedLocation.marina_fee_type === 'per_day'
                        ? `${selectedLocation.marina_fee_amount} ${selectedLocation.marina_fee_currency}/day`
                        : selectedLocation.marina_fee_type === 'per_person_per_day'
                        ? `${selectedLocation.marina_fee_amount} ${selectedLocation.marina_fee_currency}/person/day`
                        : `${selectedLocation.marina_fee_amount} ${selectedLocation.marina_fee_currency} (fixed)`
                    }. {selectedLocation.marina_fee_description}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Offer title"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Project Introduction</Label>
                  {offerId && tasks.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateProjectIntroduction}
                      disabled={saving}
                      className="text-purple-600 border-purple-300 hover:bg-purple-50"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      {saving ? 'Generating...' : 'Generate project description (AI)'}
                    </Button>
                  )}
                </div>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Project introduction and description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={formData.language} onValueChange={(v) => updateField('language', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="German">German</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Italian">Italian</SelectItem>
                      <SelectItem value="Slovenian">Slovenian</SelectItem>
                      <SelectItem value="Croatian">Croatian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={handleStatusChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Sent">Sent</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>VAT Rate (%)</Label>
                  <Select value={String(formData.vat_rate || 0)} onValueChange={(v) => updateField('vat_rate', parseFloat(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% (No VAT)</SelectItem>
                      <SelectItem value="5">5% (Reduced - Croatia)</SelectItem>
                      <SelectItem value="10">10% (Reduced - Austria)</SelectItem>
                      <SelectItem value="13">13% (Reduced - Austria/Croatia)</SelectItem>
                      <SelectItem value="19">19% (Standard - Germany)</SelectItem>
                      <SelectItem value="20">20% (Standard - Austria)</SelectItem>
                      <SelectItem value="25">25% (Standard - Croatia)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input
                    type="date"
                    value={formData.valid_until || ''}
                    onChange={(e) => updateField('valid_until', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Customer Notes</Label>
                <Textarea
                  value={formData.customer_notes || ''}
                  onChange={(e) => updateField('customer_notes', e.target.value)}
                  placeholder="Notes visible to customer"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Internal notes"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Safety & Environmental Compliance</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateSafetyClause}
                    disabled={saving}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Generate Clause
                  </Button>
                </div>
                <Textarea
                  value={formData.safety_compliance_clause || ''}
                  onChange={(e) => updateField('safety_compliance_clause', e.target.value)}
                  placeholder="Safety and environmental compliance statement"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tasks Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tasks</CardTitle>
                  <CardDescription>Define the work items for this offer</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddMarinaCommission}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Marina Commission
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAIDialog(true)}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Generate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <OfferTaskEditor tasks={tasks} setTasks={setTasks} />
            </CardContent>
          </Card>

          {/* Gallery Section */}
          {offerId && (
            <OfferGallery
              offerId={offerId}
              attachments={formData.attachments || []}
              galleryMeta={formData.gallery_meta || {}}
              onGalleryUpdated={() => {
                queryClient.invalidateQueries(['offer', offerId]);
              }}
            />
          )}

          {/* Discount Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Discount</CardTitle>
              <CardDescription>Apply percentage or target total discount</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Discount Mode</Label>
                <Select
                  value={formData.discount_mode || 'NONE'}
                  onValueChange={(val) => {
                    setFormData(prev => ({
                      ...prev,
                      discount_mode: val,
                      discount_percent: val === 'PERCENT' ? prev.discount_percent : null,
                      discount_target_total: val === 'TARGET_TOTAL' ? prev.discount_target_total : null,
                      discount_amount: null
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No Discount</SelectItem>
                    <SelectItem value="PERCENT">Percentage Discount</SelectItem>
                    <SelectItem value="TARGET_TOTAL">Target Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.discount_mode === 'PERCENT' && (
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <Label>Discount %</Label>
                   <Input
                     type="number"
                     min="0"
                     max="100"
                     step="0.01"
                     value={formData.discount_percent || ''}
                     onChange={(e) => {
                       const val = parseFloat(e.target.value);
                       if (isNaN(val) || val < 0 || val > 100) return;
                       updateField('discount_percent', val);
                     }}
                     placeholder="0.00"
                   />
                 </div>
                 <div>
                   <Label>Discount Amount (calculated)</Label>
                   <Input
                     type="text"
                     value={`€ ${totals.discount_amount_excl_tax.toFixed(2)}`}
                     disabled
                   />
                 </div>
               </div>
              )}

              {formData.discount_mode === 'TARGET_TOTAL' && (
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <Label>Target Total (excl. VAT)</Label>
                   <Input
                     type="number"
                     min="0"
                     step="0.01"
                     value={formData.discount_target_total || ''}
                     onChange={(e) => {
                       const val = parseFloat(e.target.value);
                       if (isNaN(val) || val < 0) return;
                       updateField('discount_target_total', val);
                     }}
                     placeholder="0.00"
                   />
                 </div>
                 <div>
                   <Label>Discount % (calculated)</Label>
                   <Input
                     type="text"
                     value={`${totals.discount_percent.toFixed(2)}%`}
                     disabled
                   />
                 </div>
               </div>
              )}

              {totals.discount_active && (
                <div className="pt-3 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal (excl. VAT):</span>
                    <span className="font-medium">
                      € {totals.subtotal_excl_tax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-red-600">
                    <span>
                      Discount{totals.discount_mode === 'PERCENT' && totals.discount_percent != null ? ` (${totals.discount_percent.toFixed(1)}%)` : ''}:
                    </span>
                    <span className="font-medium">- € {totals.discount_amount_excl_tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold mt-2 pt-2 border-t">
                    <span>Taxable Base (excl. VAT):</span>
                    <span>€ {totals.taxable_base_excl_tax.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Terms & Legal Section */}
          <PaymentTermsSection 
            formData={formData} 
            updateField={updateField}
            totalAmount={totals.total_incl_tax}
          />

          {/* Bottom Save Button */}
          <Card>
            <CardContent className="pt-6">
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Offer'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-slate-600">Tasks</span>
                <span className="font-semibold">{tasks.length}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-slate-600">Total Items</span>
                <span className="font-semibold">
                  {tasks.reduce((sum, t) => sum + (t.quantity || 0), 0).toFixed(1)}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-slate-600">Subtotal (excl. VAT)</span>
                  <span className="font-semibold">
                    €{totals.subtotal_excl_tax.toFixed(2)}
                  </span>
                </div>
                {totals.discount_active && (
                  <>
                    <div className="flex justify-between items-center py-2 text-red-600">
                      <span>
                        Discount{totals.discount_mode === 'PERCENT' && totals.discount_percent != null ? ` (${totals.discount_percent.toFixed(1)}%)` : ''}
                      </span>
                      <span className="font-semibold">-€{totals.discount_amount_excl_tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b">
                      <span className="text-slate-600">Taxable Base</span>
                      <span className="font-semibold">€{totals.taxable_base_excl_tax.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center py-3 border-b">
                  <span className="text-slate-600">VAT ({totals.vat_rate}%)</span>
                  <span className="font-semibold">€{totals.vat_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-4 bg-blue-50 px-4 rounded-lg">
                  <span className="text-lg font-semibold text-slate-900">Total (incl. VAT)</span>
                  <span className="text-2xl font-bold text-blue-600">
                    €{totals.total_incl_tax.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Follow-up Email Draft */}
      <OfferFollowUpDraft
        open={showFollowUpDraft}
        onOpenChange={setShowFollowUpDraft}
        offer={{ ...formData, id: offerId }}
        customer={customers.find(c => c.id === formData.customer_id) || null}
        boat={boats.find(b => b.id === formData.boat_id) || null}
      />

      {/* AI Generator Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Task Generator</DialogTitle>
            <DialogDescription>
              Describe the work needed and let AI generate task suggestions
            </DialogDescription>
          </DialogHeader>
          <AIOfferGenerator
            formData={formData}
            customers={customers}
            boats={boats}
            jobs={jobs}
            existingTasks={tasks}
            onTasksGenerated={(generatedTasks) => {
              setTasks(generatedTasks);
              setShowAIDialog(false);
            }}
            onDescriptionGenerated={(description) => {
              updateField('description', description);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Convert Confirmation Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to Work Order?</DialogTitle>
            <DialogDescription>
              This will create a new work order with all tasks from this offer.
              The offer status will be updated to "Converted".
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConvertToWorkOrder}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Convert to Work Order
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Project Confirmation Dialog */}
      <Dialog open={showCreateProjectDialog} onOpenChange={setShowCreateProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project from Offer?</DialogTitle>
            <DialogDescription>
              This will create a new project with a work order containing all tasks from this offer.
              Task text will be copied exactly as written. The offer status will be updated to "Converted".
            </DialogDescription>
          </DialogHeader>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 my-4">
            <p className="text-sm text-blue-800">
              <strong>Creating:</strong>
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1 ml-4 list-disc">
              <li>1 Project ({formData.title})</li>
              <li>1 Work Order with {tasks.filter(t => !t.is_optional).length} tasks</li>
              <li>Tasks copied with exact text from offer</li>
            </ul>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowCreateProjectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}