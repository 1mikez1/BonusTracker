'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Toast } from '@/components/Toast';

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = Array.isArray(params?.id) ? params?.id[0] : (params?.id as string | undefined);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isEditingClientInfo, setIsEditingClientInfo] = useState(false);
  const [isSavingClientInfo, setIsSavingClientInfo] = useState(false);
  
  // Client info edit form fields
  const [clientName, setClientName] = useState('');
  const [clientSurname, setClientSurname] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTrusted, setClientTrusted] = useState(false);
  const [clientTierId, setClientTierId] = useState('');
  const [clientInvitedBy, setClientInvitedBy] = useState('');
  const [clientInvitedByPartner, setClientInvitedByPartner] = useState('');
  const [clientInvitedBySearch, setClientInvitedBySearch] = useState('');
  const [showInvitedByDropdown, setShowInvitedByDropdown] = useState(false);
  const invitedByInputRef = useRef<HTMLInputElement>(null);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [appNotesText, setAppNotesText] = useState('');
  const [isSavingAppNotes, setIsSavingAppNotes] = useState(false);
  const [editingAppDetailsId, setEditingAppDetailsId] = useState<string | null>(null);
  const [editingStartedAppId, setEditingStartedAppId] = useState<string | null>(null);
  const [startedDateText, setStartedDateText] = useState('');
  const [isSavingStartedDate, setIsSavingStartedDate] = useState(false);
  
  // App details edit form fields
  const [appStatus, setAppStatus] = useState('');
  const [appDepositAmount, setAppDepositAmount] = useState('');
  const [appClientProfit, setAppClientProfit] = useState('');
  const [appInternalProfit, setAppInternalProfit] = useState('');
  const [appDeposited, setAppDeposited] = useState(false);
  const [appFinished, setAppFinished] = useState(false);
  const [appIsOurDeposit, setAppIsOurDeposit] = useState(false);
  const [appDepositSource, setAppDepositSource] = useState('');
  const [appDepositPaidBack, setAppDepositPaidBack] = useState(false);
  const [isSavingAppDetails, setIsSavingAppDetails] = useState(false);
  
  // Forms state
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showPaymentLinkForm, setShowPaymentLinkForm] = useState(false);
  const [showErrorForm, setShowErrorForm] = useState(false);
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingPaymentLinkId, setEditingPaymentLinkId] = useState<string | null>(null);
  
  // Error flagging form fields
  const [errorType, setErrorType] = useState('');
  const [errorTypeInput, setErrorTypeInput] = useState(''); // For autocomplete input
  const [showErrorTypeDropdown, setShowErrorTypeDropdown] = useState(false);
  const [errorSeverity, setErrorSeverity] = useState<'critical' | 'warning' | 'info'>('warning');
  const [errorTitle, setErrorTitle] = useState('');
  const [errorDescription, setErrorDescription] = useState('');
  const [errorClientAppId, setErrorClientAppId] = useState('');
  const [isSavingError, setIsSavingError] = useState(false);
  
  // Error editing state
  const [editingErrorId, setEditingErrorId] = useState<string | null>(null);
  const [editingErrorType, setEditingErrorType] = useState('');
  const [editingErrorTypeInput, setEditingErrorTypeInput] = useState(''); // For autocomplete input
  const [showEditingErrorTypeDropdown, setShowEditingErrorTypeDropdown] = useState(false);
  const [editingErrorSeverity, setEditingErrorSeverity] = useState<'critical' | 'warning' | 'info'>('warning');
  const [editingErrorTitle, setEditingErrorTitle] = useState('');
  const [editingErrorDescription, setEditingErrorDescription] = useState('');
  const [editingErrorClientAppId, setEditingErrorClientAppId] = useState('');
  const [isSavingErrorEdit, setIsSavingErrorEdit] = useState(false);
  
  // Predefined error types for autocomplete
  const predefinedErrorTypes = useMemo(() => [
    { value: 'document_rejected', label: '📄 Document Rejected' },
    { value: 'deadline_missed', label: '⏰ Deadline Missed' },
    { value: 'referral_incoherent', label: '🔗 Referral Incoherent' },
    { value: 'missing_steps', label: '📋 Missing Steps' },
    { value: 'note_error', label: '📝 Note Error' },
    { value: 'csv_import_incoherent', label: '📊 CSV Import Incoherent' },
    { value: 'missing_deposit', label: '💰 Missing Deposit' },
    { value: 'stale_update', label: '🕐 Stale Update' },
    { value: 'status_mismatch', label: '🔄 Status Mismatch' },
  ], []);
  
  // Filtered error types for flagging form
  const filteredErrorTypes = useMemo(() => {
    if (!errorTypeInput) return predefinedErrorTypes;
    return predefinedErrorTypes.filter(type =>
      type.label.toLowerCase().includes(errorTypeInput.toLowerCase())
    );
  }, [errorTypeInput, predefinedErrorTypes]);
  
  // Filtered error types for editing form
  const filteredEditingErrorTypes = useMemo(() => {
    if (!editingErrorTypeInput) return predefinedErrorTypes;
    return predefinedErrorTypes.filter(type =>
      type.label.toLowerCase().includes(editingErrorTypeInput.toLowerCase())
    );
  }, [editingErrorTypeInput, predefinedErrorTypes]);
  
  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'credential' | 'debt' | 'paymentLink' | 'clientApp' | 'markAsPaid' | 'client' | null;
    id: string | null;
    name?: string;
  }>({
    isOpen: false,
    type: null,
    id: null
  });

  // Clear all errors confirmation modal state
  const [clearAllModal, setClearAllModal] = useState<{
    isOpen: boolean;
  }>({
    isOpen: false
  });
  
  // Credential form fields
  const [credentialAppId, setCredentialAppId] = useState('');
  const [credentialEmail, setCredentialEmail] = useState('');
  const [credentialUsername, setCredentialUsername] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const [credentialNotes, setCredentialNotes] = useState('');
  const [isSavingCredential, setIsSavingCredential] = useState(false);
  
  // Debt form fields
  const [debtReferralLinkId, setDebtReferralLinkId] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtStatus, setDebtStatus] = useState('open');
  const [debtDescription, setDebtDescription] = useState('');
  const [debtDebtorClientId, setDebtDebtorClientId] = useState('');
  const [isSavingDebt, setIsSavingDebt] = useState(false);
  
  // Payment link form fields
  const [paymentProvider, setPaymentProvider] = useState('');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentPurpose, setPaymentPurpose] = useState('');
  const [paymentAppId, setPaymentAppId] = useState('');
  const [isSavingPaymentLink, setIsSavingPaymentLink] = useState(false);
  
  // Start app process form state
  const [showStartAppForm, setShowStartAppForm] = useState(false);
  const [startAppAppId, setStartAppAppId] = useState('');
  const [startAppAppSearch, setStartAppAppSearch] = useState('');
  const [showStartAppDropdown, setShowStartAppDropdown] = useState(false);
  const [startAppPromotionId, setStartAppPromotionId] = useState('');
  const [startAppReferralLinkId, setStartAppReferralLinkId] = useState('');
  const [startAppCustomReferralLink, setStartAppCustomReferralLink] = useState('');
  const [startAppNotes, setStartAppNotes] = useState('');
  const [isSavingStartApp, setIsSavingStartApp] = useState(false);
  const startAppInputRef = useRef<HTMLInputElement>(null);
  
  // Toast notification state
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'success'
  });
  
  // Track which app processes are in edit mode for steps
  const [editingSteps, setEditingSteps] = useState<Set<string>>(new Set());

  const {
    data: clients,
    isLoading: clientsLoading,
    error: clientsError,
    mutate: mutateClients
  } = useSupabaseData({
    table: 'clients',
    select: '*, tiers(*), clients!invited_by_client_id(*)'
  });
  
  const {
    data: clientApps,
    isLoading: appsLoading,
    error: appsError,
    mutate: mutateClientApps
  } = useSupabaseData({
    table: 'client_apps',
    select: '*, apps(*), promotions(*), referral_links(*), clients!client_id(*)',
    match: clientId ? { client_id: clientId } : undefined
  });
  
  const { mutate: updateClient, remove: removeClient } = useSupabaseMutations('clients', undefined, mutateClients);
  const { mutate: updateClientApp } = useSupabaseMutations('client_apps', undefined, mutateClientApps);
  
  const {
    data: credentials,
    isLoading: credentialsLoading,
    error: credentialsError,
    mutate: mutateCredentials
  } = useSupabaseData({
    table: 'credentials',
    select: '*, apps(*)',
    match: clientId ? { client_id: clientId } : undefined
  });
  
  const {
    data: referralDebts,
    isLoading: referralDebtsLoading,
    error: referralDebtsError,
    mutate: mutateReferralDebts
  } = useSupabaseData({
    table: 'referral_link_debts',
    select: '*, referral_links(*)'
  });
  
  const {
    data: depositDebts,
    isLoading: depositDebtsLoading,
    error: depositDebtsError,
    mutate: mutateDepositDebts
  } = useSupabaseData({
    table: 'deposit_debts' as any,
    select: '*, client_apps(*, apps(*), clients!client_id(*))'
  });
  
  const {
    data: paymentLinks,
    isLoading: paymentLinksLoading,
    error: paymentLinksError,
    mutate: mutatePaymentLinks
  } = useSupabaseData({
    table: 'payment_links',
    select: '*, apps(*)',
    match: clientId ? { client_id: clientId } : undefined
  });
  
  const { data: allClients } = useSupabaseData({ table: 'clients' });
  
  // Load all partners to include in Invited By dropdown
  const { data: allPartners, mutate: mutatePartners } = useSupabaseData({ 
    table: 'client_partners',
    select: 'id, name',
    order: { column: 'name', ascending: true }
  });
  
  // Convert allClients to array for use in effects and components
  const allClientsArray = Array.isArray(allClients) ? allClients : [];
  const allPartnersArray = Array.isArray(allPartners) ? allPartners : [];
  
  // Filter partners for Invited By dropdown (must be before any conditional returns)
  // Show only partners, with option to add new partner if search doesn't match
  const filteredInvitedByPartners = useMemo(() => {
    const results: Array<{ id: string; name: string; type: 'partner' | 'new_partner'; displayName: string }> = [];
    
    // Filter partners by search term if provided
    if (clientInvitedBySearch.trim()) {
      const searchLower = clientInvitedBySearch.toLowerCase().trim();
      const matchingPartners = (allPartnersArray || [])
        .filter((partner: any) => partner.name.toLowerCase().includes(searchLower))
        .map((partner: any) => ({
          id: `partner_${partner.id}`,
          name: partner.name,
          type: 'partner' as const,
          displayName: partner.name
        }));
      
      results.push(...matchingPartners);
      
      // If no match, add option to create new partner
      if (matchingPartners.length === 0) {
        results.push({
          id: 'new_partner',
          name: clientInvitedBySearch.trim(),
          type: 'new_partner' as const,
          displayName: `+ Create "${clientInvitedBySearch.trim()}"`
        });
      }
    } else {
      // If no search, return all partners
      const allPartners = (allPartnersArray || []).map((partner: any) => ({
        id: `partner_${partner.id}`,
        name: partner.name,
        type: 'partner' as const,
        displayName: partner.name
      }));
      results.push(...allPartners);
    }
    
    return results;
  }, [allPartnersArray, clientInvitedBySearch]);
  
  // Load partner assignment for this client
  const { data: partnerAssignments, mutate: mutatePartnerAssignments } = useSupabaseData({
    table: 'client_partner_assignments',
    select: '*, client_partners(*)',
    match: clientId ? { client_id: clientId } : undefined
  });
  
  const { insert: insertCredential, mutate: updateCredential, remove: removeCredential } = useSupabaseMutations('credentials', undefined, mutateCredentials);
  const { insert: insertDebt, mutate: updateDebt, remove: removeDebt } = useSupabaseMutations('referral_link_debts', undefined, mutateReferralDebts);
  const { mutate: updateDepositDebt } = useSupabaseMutations('deposit_debts' as any, undefined, mutateDepositDebts);
  const { insert: insertPaymentLink, mutate: updatePaymentLink, remove: removePaymentLink } = useSupabaseMutations('payment_links', undefined, mutatePaymentLinks);
  const { insert: insertClientApp, remove: removeClientApp } = useSupabaseMutations('client_apps', undefined, mutateClientApps);
  const { insert: insertPartner } = useSupabaseMutations('client_partners', undefined, mutatePartners);
  
  // Client errors mutations - using direct Supabase client since client_errors might not be in types
  const insertClientError = async (errorData: any, options?: { onSuccess?: () => void; onError?: (error: any) => void }) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const err = new Error('Supabase client not initialized');
      console.error('insertClientError: Supabase client not initialized');
      options?.onError?.(err);
      throw err;
    }
    
    try {
      console.log('insertClientError: Inserting error data:', errorData);
      const { data, error } = await (supabase as any)
        .from('client_errors')
        .insert(errorData)
        .select()
        .single();
      
      if (error) {
        console.error('insertClientError: Database error:', error);
        throw error;
      }
      
      console.log('insertClientError: Success, data:', data);
      options?.onSuccess?.();
      return data;
    } catch (error: any) {
      console.error('insertClientError: Exception caught:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      options?.onError?.(error);
      throw new Error(`Failed to insert error: ${errorMessage}`);
    }
  };

  const updateClientError = async (errorId: string, errorData: any, options?: { onSuccess?: () => void; onError?: (error: any) => void }) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const err = new Error('Supabase client not initialized');
      options?.onError?.(err);
      throw err;
    }
    
    try {
      const { data, error } = await (supabase as any)
        .from('client_errors')
        .update(errorData)
        .eq('id', errorId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      options?.onSuccess?.();
      return data;
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      options?.onError?.(error);
      throw new Error(`Failed to update error: ${errorMessage}`);
    }
  };

  const resolveClientError = async (errorId: string, resolved: boolean, options?: { onSuccess?: () => void; onError?: (error: any) => void }) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const err = new Error('Supabase client not initialized');
      options?.onError?.(err);
      throw err;
    }
    
    try {
      const updateData = resolved 
        ? { resolved_at: new Date().toISOString() }
        : { resolved_at: null };
      
      const { data, error } = await (supabase as any)
        .from('client_errors')
        .update(updateData)
        .eq('id', errorId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      options?.onSuccess?.();
      return data;
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      options?.onError?.(error);
      throw new Error(`Failed to ${resolved ? 'resolve' : 'reopen'} error: ${errorMessage}`);
    }
  };

  const clearClientError = async (errorId: string, cleared: boolean, options?: { onSuccess?: () => void; onError?: (error: any) => void }) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const err = new Error('Supabase client not initialized');
      options?.onError?.(err);
      throw err;
    }
    
    try {
      const updateData = cleared 
        ? { cleared_at: new Date().toISOString() }
        : { cleared_at: null };
      
      const { data, error } = await (supabase as any)
        .from('client_errors')
        .update(updateData)
        .eq('id', errorId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      options?.onSuccess?.();
      return data;
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      options?.onError?.(error);
      throw new Error(`Failed to ${cleared ? 'clear' : 'unclear'} error: ${errorMessage}`);
    }
  };

  const deleteClientError = async (errorId: string, options?: { onSuccess?: () => void; onError?: (error: any) => void }) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const err = new Error('Supabase client not initialized');
      options?.onError?.(err);
      throw err;
    }
    
    try {
      const { error } = await (supabase as any)
        .from('client_errors')
        .delete()
        .eq('id', errorId);
      
      if (error) {
        throw error;
      }
      
      options?.onSuccess?.();
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      options?.onError?.(error);
      throw new Error(`Failed to delete error: ${errorMessage}`);
    }
  };

  const {
    data: allApps,
    isLoading: allAppsLoading
  } = useSupabaseData({
    table: 'apps',
    order: { column: 'name', ascending: true }
  });
  
  const { data: tiers } = useSupabaseData({
    table: 'tiers',
    order: { column: 'priority', ascending: true }
  });
  
  const { data: referralLinks } = useSupabaseData({
    table: 'referral_links',
    select: '*, apps(*)'
  });

  const {
    data: allPromotions,
    isLoading: promotionsLoading
  } = useSupabaseData({
    table: 'promotions',
    select: '*',
    order: { column: 'end_date', ascending: true }
  });

  // All message templates for all apps (for showing incomplete steps)
  const {
    data: allMessageTemplates,
    isLoading: allMessageTemplatesLoading
  } = useSupabaseData({
    table: 'message_templates',
    select: '*',
    order: { column: 'step_order', ascending: true }
  });

  // Fetch client errors for this client
  const {
    data: clientErrors,
    isLoading: errorsLoading,
    error: errorsError,
    mutate: mutateErrors
  } = useSupabaseData({
    table: 'client_errors' as any,
    select: 'id, error_type, severity, title, description, detected_at, resolved_at, cleared_at, client_id, client_app_id, client_apps(id, apps(name))',
    match: clientId ? { client_id: clientId } : undefined,
    order: { column: 'detected_at' as any, ascending: false }
  }) as { data: any[] | undefined; isLoading: boolean; error: any; mutate: () => void };

  const isLoading = clientsLoading || appsLoading || referralDebtsLoading || depositDebtsLoading || credentialsLoading || paymentLinksLoading || allAppsLoading || promotionsLoading || allMessageTemplatesLoading;
  const error = clientsError || appsError || referralDebtsError || depositDebtsError || credentialsError || paymentLinksError;

  // Auto-select first available promotion when app is selected
  useEffect(() => {
    if (startAppAppId && !startAppPromotionId && Array.isArray(allPromotions)) {
      const availablePromotions = allPromotions.filter((promo: any) => {
        if (promo.app_id !== startAppAppId) return false;
        if (promo.is_active === false) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (promo.start_date) {
          const startDate = new Date(promo.start_date);
          startDate.setHours(0, 0, 0, 0);
          if (today < startDate) return false;
        }
        if (promo.end_date) {
          const endDate = new Date(promo.end_date);
          endDate.setHours(23, 59, 59, 999);
          if (today > endDate) return false;
        }
        return true;
      });
      
      if (availablePromotions.length > 0) {
        // Select the first available promotion
        setStartAppPromotionId(availablePromotions[0].id);
      }
    }
  }, [startAppAppId, allPromotions, startAppPromotionId]);

  const client = clients.find((item: any) => item.id === clientId);
  
  // Initialize notes text when client loads
  // Check for success message from signup creation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const successMessage = sessionStorage.getItem('signupSuccessMessage');
      if (successMessage) {
        setToast({
          isOpen: true,
          message: successMessage,
          type: 'success'
        });
        // Clear the message from sessionStorage
        sessionStorage.removeItem('signupSuccessMessage');
      }
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (client && !isEditingNotes) {
      setNotesText(client.notes || '');
    }
  }, [client, isEditingNotes]);
  
  // Initialize client info form fields when client loads
  useEffect(() => {
    if (client && !isEditingClientInfo) {
      setClientName(client.name || '');
      setClientSurname(client.surname || '');
      setClientContact(client.contact || '');
      setClientEmail(client.email || '');
      setClientTrusted(client.trusted || false);
      setClientTierId(client.tier_id || '');
      // Handle invited_by_client_id
      const invitedById = client.invited_by_client_id ? String(client.invited_by_client_id) : '';
      setClientInvitedBy(invitedById);
      // Handle invited_by_partner_id
      const invitedByPartnerId = (client as any).invited_by_partner_id ? String((client as any).invited_by_partner_id) : '';
      setClientInvitedByPartner(invitedByPartnerId);
      
      // Set search text based on whether it's a client or partner
      if (invitedByPartnerId && allPartnersArray.length > 0) {
        const partner = allPartnersArray.find((p: any) => p.id === invitedByPartnerId);
        if (partner) {
          setClientInvitedBySearch(partner.name);
        } else {
          setClientInvitedBySearch('');
        }
      } else if (invitedById && allClientsArray.length > 0) {
        const invitedByClient = allClientsArray.find((c: any) => c.id === invitedById);
        if (invitedByClient) {
          setClientInvitedBySearch(`${invitedByClient.name} ${invitedByClient.surname || ''}`.trim());
        } else {
          setClientInvitedBySearch('');
        }
      } else {
        setClientInvitedBySearch('');
      }
    }
  }, [client, isEditingClientInfo, allClientsArray, allPartnersArray]);
  
  const handleSaveNotes = async () => {
    if (!clientId || !client) return;
    
    setIsSavingNotes(true);
    try {
      await updateClient(
        { notes: notesText.trim() || null },
        clientId,
        {
          onSuccess: () => {
            setIsEditingNotes(false);
            setIsSavingNotes(false);
          },
          onError: (error) => {
            console.error('Error saving notes:', error);
            alert('Failed to save notes. Please try again.');
            setIsSavingNotes(false);
          }
        }
      );
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes. Please try again.');
      setIsSavingNotes(false);
    }
  };
  
  const handleCancelEdit = () => {
    setNotesText(client?.notes || '');
    setIsEditingNotes(false);
  };
  
  const handleEditClientInfo = () => {
    if (client) {
      setClientName(client.name || '');
      setClientSurname(client.surname || '');
      setClientContact(client.contact || '');
      setClientEmail(client.email || '');
      setClientTrusted(client.trusted || false);
      setClientTierId(client.tier_id || '');
      // Handle invited_by_client_id
      const invitedById = client.invited_by_client_id ? String(client.invited_by_client_id) : '';
      setClientInvitedBy(invitedById);
      // Handle invited_by_partner_id
      const invitedByPartnerId = (client as any).invited_by_partner_id ? String((client as any).invited_by_partner_id) : '';
      setClientInvitedByPartner(invitedByPartnerId);
      
      // Set search text based on whether it's a client or partner
      if (invitedByPartnerId && allPartnersArray.length > 0) {
        const partner = allPartnersArray.find((p: any) => p.id === invitedByPartnerId);
        if (partner) {
          setClientInvitedBySearch(partner.name);
        } else {
          setClientInvitedBySearch('');
        }
      } else if (invitedById && allClientsArray.length > 0) {
        const invitedByClient = allClientsArray.find((c: any) => c.id === invitedById);
        if (invitedByClient) {
          setClientInvitedBySearch(`${invitedByClient.name} ${invitedByClient.surname || ''}`.trim());
        } else {
          setClientInvitedBySearch('');
        }
      } else {
        setClientInvitedBySearch('');
      }
      setIsEditingClientInfo(true);
    }
  };
  
  const handleSaveClientInfo = async () => {
    if (!clientId || !client) return;
    
    setIsSavingClientInfo(true);
    try {
      const updateData: any = {
        name: clientName.trim(),
        surname: clientSurname.trim() || null,
        contact: clientContact.trim() || null,
        email: clientEmail.trim() || null,
        trusted: clientTrusted,
        tier_id: clientTierId || null,
        // Set invited_by_client_id or invited_by_partner_id based on selection
        // Only one can be set at a time - if partner is set, clear client, and vice versa
        invited_by_client_id: clientInvitedByPartner ? null : (clientInvitedBy && clientInvitedBy.trim() !== '' ? clientInvitedBy.trim() : null),
        invited_by_partner_id: clientInvitedBy ? null : (clientInvitedByPartner && clientInvitedByPartner.trim() !== '' ? clientInvitedByPartner.trim() : null)
      };
      
      console.log('Saving client info:', {
        clientInvitedBy,
        clientInvitedByPartner,
        invited_by_client_id: updateData.invited_by_client_id,
        invited_by_partner_id: updateData.invited_by_partner_id
      });
      
      await updateClient(updateData, clientId, {
        onSuccess: () => {
          setIsEditingClientInfo(false);
          setIsSavingClientInfo(false);
          mutateClients();
          // Refresh partner assignments since they may have been auto-created by the trigger
          mutatePartnerAssignments();
        },
        onError: (error) => {
          console.error('Error updating client info:', error);
          alert('Failed to update client information. Please try again.');
          setIsSavingClientInfo(false);
        }
      });
    } catch (error) {
      console.error('Error updating client info:', error);
      alert('Failed to update client information. Please try again.');
      setIsSavingClientInfo(false);
    }
  };
  
  const handleCancelClientInfoEdit = () => {
    if (client) {
      setClientName(client.name || '');
      setClientSurname(client.surname || '');
      setClientContact(client.contact || '');
      setClientEmail(client.email || '');
      setClientTrusted(client.trusted || false);
      setClientTierId(client.tier_id || '');
      // Handle invited_by_client_id
      const invitedById = client.invited_by_client_id ? String(client.invited_by_client_id) : '';
      setClientInvitedBy(invitedById);
      // Handle invited_by_partner_id
      const invitedByPartnerId = (client as any).invited_by_partner_id ? String((client as any).invited_by_partner_id) : '';
      setClientInvitedByPartner(invitedByPartnerId);
      
      // Set search text based on whether it's a client or partner
      if (invitedByPartnerId && allPartnersArray.length > 0) {
        const partner = allPartnersArray.find((p: any) => p.id === invitedByPartnerId);
        if (partner) {
          setClientInvitedBySearch(partner.name);
        } else {
          setClientInvitedBySearch('');
        }
      } else if (invitedById && allClientsArray.length > 0) {
        const invitedByClient = allClientsArray.find((c: any) => c.id === invitedById);
        if (invitedByClient) {
          setClientInvitedBySearch(`${invitedByClient.name} ${invitedByClient.surname || ''}`.trim());
        } else {
          setClientInvitedBySearch('');
        }
      } else {
        setClientInvitedBySearch('');
      }
      setShowInvitedByDropdown(false);
      setIsEditingClientInfo(false);
    }
  };
  
  const handleSelectInvitedByClient = async (selectedId: string, displayName: string) => {
    // Check if this is a new partner to create
    if (selectedId === 'new_partner') {
      // Extract partner name from displayName (could be "Create \"name\"" or "+ Create \"name\"")
      let partnerName = displayName.replace(/^\+?\s*Create\s*"/, '').replace(/"$/, '').trim();
      // If that didn't work, use the search text directly
      if (!partnerName || partnerName === displayName) {
        partnerName = clientInvitedBySearch.trim();
      }
      if (!partnerName) {
        setShowInvitedByDropdown(false);
        return;
      }
      
      try {
        // Create new partner
        await insertPartner(
          {
            name: partnerName,
            default_split_partner: 0.5, // Default 50/50 split
            default_split_owner: 0.5,
            contact_info: null,
            notes: null
          },
          {
            onSuccess: (newPartner: any) => {
              // Set the newly created partner
              setClientInvitedByPartner(newPartner.id);
              setClientInvitedBy('');
              setClientInvitedBySearch(partnerName);
              setShowInvitedByDropdown(false);
              // Refresh partners list
              mutatePartners();
            },
            onError: (error) => {
              console.error('Error creating partner:', error);
              alert(`Failed to create partner "${partnerName}". Please try again.`);
              setShowInvitedByDropdown(false);
            }
          }
        );
      } catch (error: any) {
        console.error('Error creating partner:', error);
        alert(`Failed to create partner "${partnerName}". Please try again.`);
        setShowInvitedByDropdown(false);
      }
    } else if (selectedId.startsWith('partner_')) {
      // Existing partner selection
      const partnerId = selectedId.replace('partner_', '');
      setClientInvitedByPartner(partnerId);
      setClientInvitedBy('');
      setClientInvitedBySearch(displayName);
      setShowInvitedByDropdown(false);
    } else {
      // This shouldn't happen now, but handle it just in case
      setClientInvitedBy(selectedId);
      setClientInvitedByPartner('');
      setClientInvitedBySearch(displayName);
      setShowInvitedByDropdown(false);
    }
  };
  
  const handleEditAppNotes = (appId: string, currentNotes: string | null) => {
    setEditingAppId(appId);
    // Remove completedSteps JSON from notes when editing
    let cleanedNotes = currentNotes || '';
    cleanedNotes = cleanedNotes.replace(/\s*\{.*"completedSteps".*?\}\s*/g, '').trim();
    setAppNotesText(cleanedNotes);
  };
  
  const handleSaveAppNotes = async (appId: string) => {
    setIsSavingAppNotes(true);
    try {
      // Remove completedSteps JSON from notes if present
      let cleanedNotes = appNotesText.trim();
      cleanedNotes = cleanedNotes.replace(/\s*\{.*"completedSteps".*?\}\s*/g, '').trim();
      
      await updateClientApp(
        { notes: cleanedNotes || null },
        appId,
        {
          onSuccess: () => {
            setEditingAppId(null);
            setAppNotesText('');
            setIsSavingAppNotes(false);
          },
          onError: (error) => {
            console.error('Error saving app notes:', error);
            alert('Failed to save notes. Please try again.');
            setIsSavingAppNotes(false);
          }
        }
      );
    } catch (error) {
      console.error('Error saving app notes:', error);
      alert('Failed to save notes. Please try again.');
      setIsSavingAppNotes(false);
    }
  };

  const handleEditStartedDate = (appId: string, currentStartedAt: string | null) => {
    setEditingStartedAppId(appId);
    // Format date for input (YYYY-MM-DD)
    if (currentStartedAt) {
      const date = new Date(currentStartedAt);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setStartedDateText(`${year}-${month}-${day}`);
    } else {
      setStartedDateText('');
    }
  };

  const handleSaveStartedDate = async (appId: string) => {
    setIsSavingStartedDate(true);
    try {
      let startedAt: string | null = null;
      if (startedDateText.trim()) {
        // Parse date and convert to ISO string
        const date = new Date(startedDateText);
        if (isNaN(date.getTime())) {
          alert('Invalid date format. Please use YYYY-MM-DD.');
          setIsSavingStartedDate(false);
          return;
        }
        // Set to start of day in local timezone, then convert to ISO
        date.setHours(0, 0, 0, 0);
        startedAt = date.toISOString();
      }

      await updateClientApp(
        { started_at: startedAt },
        appId,
        {
          onSuccess: () => {
            setEditingStartedAppId(null);
            setStartedDateText('');
            setIsSavingStartedDate(false);
            // Recalculate deadline after updating started_at
            mutateClientApps();
          },
          onError: (error) => {
            console.error('Error saving started date:', error);
            alert('Failed to save started date. Please try again.');
            setIsSavingStartedDate(false);
          }
        }
      );
    } catch (error) {
      console.error('Error saving started date:', error);
      alert('Failed to save started date. Please try again.');
      setIsSavingStartedDate(false);
    }
  };
  
  const handleCancelAppEdit = () => {
    setEditingAppId(null);
    setAppNotesText('');
  };
  
  // Helper function to automatically determine status based on deposited/finished flags
  const getAutoStatus = (deposited: boolean, finished: boolean, currentStatus: string): string => {
    if (finished) {
      // If finished, status should be completed (unless already paid or cancelled)
      if (currentStatus === 'paid' || currentStatus === 'cancelled') {
        return currentStatus;
      }
      return 'completed';
    } else if (deposited) {
      // If deposited but not finished, status should be deposited or waiting_bonus
      if (currentStatus === 'waiting_bonus' || currentStatus === 'completed' || currentStatus === 'paid') {
        return currentStatus;
      }
      return 'deposited';
    } else {
      // If neither, keep current status or default to requested/registered
      if (['requested', 'registered', 'deposited', 'waiting_bonus', 'completed', 'paid', 'cancelled'].includes(currentStatus)) {
        return currentStatus;
      }
      return 'requested';
    }
  };
  
  const handleEditAppDetails = (app: any) => {
    setEditingAppDetailsId(app.id);
    setAppStatus(app.status);
    setAppDepositAmount(app.deposit_amount?.toString() || '');
    
    // Pre-fill profits: use saved values if available, otherwise use promotion values
    let clientProfit = app.profit_client?.toString() || '';
    let internalProfit = app.profit_us?.toString() || '';
    
    // Get promotion from app data (it's already joined in the query)
    const promotion = app.promotions;
    const promotionId = app.promotion_id;
    
    // If profits are not set (or are 0), get them from promotion
    const hasNoClientProfit = !clientProfit || clientProfit === '0' || clientProfit === '0.00' || parseFloat(clientProfit) === 0;
    const hasNoInternalProfit = !internalProfit || internalProfit === '0' || internalProfit === '0.00' || parseFloat(internalProfit) === 0;
    
    if ((hasNoClientProfit || hasNoInternalProfit) && promotion) {
      // Use promotion from joined data
      if (hasNoClientProfit && promotion.client_reward) {
        clientProfit = promotion.client_reward.toString();
      }
      if (hasNoInternalProfit && promotion.our_reward) {
        internalProfit = promotion.our_reward.toString();
      }
    } else if ((hasNoClientProfit || hasNoInternalProfit) && promotionId) {
      // Fallback: search in allPromotions array
      const promotionsArray = Array.isArray(allPromotions) ? allPromotions : [];
      const foundPromotion = promotionsArray.find((p: any) => p.id === promotionId);
      if (foundPromotion) {
        if (hasNoClientProfit && foundPromotion.client_reward) {
          clientProfit = foundPromotion.client_reward.toString();
        }
        if (hasNoInternalProfit && foundPromotion.our_reward) {
          internalProfit = foundPromotion.our_reward.toString();
        }
      }
    }
    
    setAppClientProfit(clientProfit);
    setAppInternalProfit(internalProfit);
    setAppDeposited(app.deposited || false);
    setAppFinished(app.finished || false);
    setAppIsOurDeposit(app.is_our_deposit || false);
    setAppDepositSource(app.deposit_source || '');
    setAppDepositPaidBack(app.deposit_paid_back || false);
  };
  
  const handleSaveAppDetails = async (appId: string) => {
    setIsSavingAppDetails(true);
    try {
      // Find the client app to get promotion_id
      const clientApp = relatedApps.find((app: any) => app.id === appId);
      const promotionId = clientApp?.promotion_id;
      const promotionFromApp = clientApp?.promotions; // Promotion already joined in query
      
      // Get profits from form inputs (pre-filled from promotion or manually edited)
      let clientReward: number | null = null;
      let ourReward: number | null = null;
      
      // If profits are set in form, use them; otherwise try to get from promotion
      if (appClientProfit && appClientProfit.trim() !== '') {
        const parsed = parseFloat(appClientProfit);
        if (!isNaN(parsed)) {
          clientReward = parsed;
        }
      }
      
      if (appInternalProfit && appInternalProfit.trim() !== '') {
        const parsed = parseFloat(appInternalProfit);
        if (!isNaN(parsed)) {
          ourReward = parsed;
        }
      }
      
      // If profits are still not set, get from promotion
      if (clientReward === null) {
        if (promotionFromApp?.client_reward) {
          clientReward = Number(promotionFromApp.client_reward);
        } else if (promotionId) {
          const promotionsArray = Array.isArray(allPromotions) ? allPromotions : [];
          const promotion = promotionsArray.find((p: any) => p.id === promotionId);
          if (promotion?.client_reward) {
            clientReward = Number(promotion.client_reward);
          }
        }
      }
      
      if (ourReward === null) {
        if (promotionFromApp?.our_reward) {
          ourReward = Number(promotionFromApp.our_reward);
        } else if (promotionId) {
          const promotionsArray = Array.isArray(allPromotions) ? allPromotions : [];
          const promotion = promotionsArray.find((p: any) => p.id === promotionId);
          if (promotion?.our_reward) {
            ourReward = Number(promotion.our_reward);
          }
        }
      }
      
      const updateData: any = {
        status: appStatus,
        deposited: appDeposited,
        finished: appFinished,
        is_our_deposit: appIsOurDeposit,
        deposit_paid_back: appDepositPaidBack
      };
      
      if (appDepositAmount) {
        updateData.deposit_amount = parseFloat(appDepositAmount);
      }
      
      if (appIsOurDeposit) {
        // If our deposit is checked, set deposit_source (even if empty, set to null)
        updateData.deposit_source = appDepositSource && appDepositSource.trim() ? appDepositSource.trim() : null;
      } else {
        // If our deposit is not checked, clear deposit_source
        updateData.deposit_source = null;
      }
      
      // If deposit is paid back, set the paid_back_at timestamp
      const currentDepositPaidBack = clientApp?.deposit_paid_back || false;
      if (appDepositPaidBack && !currentDepositPaidBack) {
        updateData.deposit_paid_back_at = new Date().toISOString();
      } else if (!appDepositPaidBack) {
        updateData.deposit_paid_back_at = null;
      }
      
      // Set profits (from form or promotion)
      if (clientReward !== null) {
        updateData.profit_client = clientReward;
      }
      if (ourReward !== null) {
        updateData.profit_us = ourReward;
      }
      
      console.log('Updating app details:', { appId, updateData });
      
      await updateClientApp(updateData, appId, {
        onSuccess: () => {
          setEditingAppDetailsId(null);
          setAppStatus('');
          setAppDepositAmount('');
          setAppClientProfit('');
          setAppInternalProfit('');
          setAppDeposited(false);
          setAppFinished(false);
          setAppIsOurDeposit(false);
          setAppDepositSource('');
          setAppDepositPaidBack(false);
          setIsSavingAppDetails(false);
          mutateClientApps();
        },
        onError: (error) => {
          console.error('Error updating app details:', error);
          console.error('Update data that failed:', updateData);
          const errorMessage = error?.message || error?.toString() || 'Unknown error';
          alert(`Failed to update app details: ${errorMessage}`);
          setIsSavingAppDetails(false);
        }
      });
    } catch (error) {
      console.error('Error updating app details:', error);
      alert('Failed to update app details. Please try again.');
      setIsSavingAppDetails(false);
    }
  };
  
  const handleCancelAppDetailsEdit = () => {
    setEditingAppDetailsId(null);
    setAppStatus('');
    setAppDepositAmount('');
    setAppClientProfit('');
    setAppInternalProfit('');
    setAppDeposited(false);
    setAppFinished(false);
    setAppIsOurDeposit(false);
    setAppDepositSource('');
    setAppDepositPaidBack(false);
  };
  
  // Simple password encryption (base64 for MVP)
  const encryptPassword = (password: string): string => {
    if (typeof window !== 'undefined') {
      return btoa(password);
    }
    return Buffer.from(password).toString('base64');
  };
  
  const handleEditCredential = (credential: any) => {
    setEditingCredentialId(credential.id);
    setCredentialAppId(credential.app_id);
    setCredentialEmail(credential.email);
    setCredentialUsername(credential.username || '');
    setCredentialPassword(''); // Don't pre-fill password for security
    setCredentialNotes(credential.notes || '');
    setShowCredentialForm(true);
  };
  
  const handleDeleteCredential = (credential: any) => {
    const app = credential.apps;
    setDeleteModal({
      isOpen: true,
      type: 'credential',
      id: credential.id,
      name: `${app?.name ?? 'Unknown'} - ${credential.email}`
    });
  };
  
  const confirmDeleteCredential = async () => {
    if (!deleteModal.id) return;
    
    try {
      await removeCredential(deleteModal.id, {
        onSuccess: () => {
          mutateCredentials();
          setDeleteModal({ isOpen: false, type: null, id: null });
        },
        onError: (error) => {
          console.error('Error deleting credential:', error);
          alert('Failed to delete credential. Please try again.');
          setDeleteModal({ isOpen: false, type: null, id: null });
        }
      });
    } catch (error) {
      console.error('Error deleting credential:', error);
      alert('Failed to delete credential. Please try again.');
      setDeleteModal({ isOpen: false, type: null, id: null });
    }
  };
  
  const handleSaveCredential = async () => {
    if (!clientId || !credentialAppId || !credentialEmail) {
      alert('Please fill in all required fields (App, Email)');
      return;
    }
    
    // Password is only required for new credentials
    if (!editingCredentialId && !credentialPassword) {
      alert('Please fill in the password for new credentials');
      return;
    }
    
    setIsSavingCredential(true);
    try {
      const credentialData: any = {
        client_id: clientId,
        app_id: credentialAppId,
        email: credentialEmail,
        username: credentialUsername || null,
        notes: credentialNotes || null
      };
      
      // Only update password if provided (for editing) or required (for new)
      if (editingCredentialId) {
        if (credentialPassword) {
          credentialData.password_encrypted = encryptPassword(credentialPassword);
        }
        await updateCredential(credentialData, editingCredentialId, {
          onSuccess: () => {
            setShowCredentialForm(false);
            setEditingCredentialId(null);
            setCredentialAppId('');
            setCredentialEmail('');
            setCredentialUsername('');
            setCredentialPassword('');
            setCredentialNotes('');
            setIsSavingCredential(false);
            mutateCredentials();
          },
          onError: (error) => {
            console.error('Error updating credential:', error);
            alert('Failed to update credential. Please try again.');
            setIsSavingCredential(false);
          }
        });
      } else {
        credentialData.password_encrypted = encryptPassword(credentialPassword);
        await insertCredential(credentialData, {
          onSuccess: () => {
            setShowCredentialForm(false);
            setCredentialAppId('');
            setCredentialEmail('');
            setCredentialUsername('');
            setCredentialPassword('');
            setCredentialNotes('');
            setIsSavingCredential(false);
            mutateCredentials();
          },
          onError: (error) => {
            console.error('Error saving credential:', error);
            alert('Failed to save credential. Please try again.');
            setIsSavingCredential(false);
          }
        });
      }
    } catch (error) {
      console.error('Error saving credential:', error);
      alert('Failed to save credential. Please try again.');
      setIsSavingCredential(false);
    }
  };
  
  const handleEditDebt = (debt: any) => {
    setEditingDebtId(debt.id);
    setDebtReferralLinkId(debt.referral_link_id);
    setDebtAmount(debt.amount);
    setDebtStatus(debt.status);
    setDebtDescription(debt.description || '');
    setDebtDebtorClientId(debt.debtor_client_id || '');
    setShowDebtForm(true);
  };
  
  const handleDeleteDebt = (debt: any) => {
    setDeleteModal({
      isOpen: true,
      type: 'debt',
      id: debt.id,
      name: `€${Number(debt.amount).toFixed(2)}`
    });
  };
  
  const confirmDeleteDebt = async () => {
    if (!deleteModal.id) return;
    
    try {
      await removeDebt(deleteModal.id, {
        onSuccess: () => {
          mutateReferralDebts();
          mutateDepositDebts();
          setDeleteModal({ isOpen: false, type: null, id: null });
        },
        onError: (error) => {
          console.error('Error deleting debt:', error);
          alert('Failed to delete debt. Please try again.');
          setDeleteModal({ isOpen: false, type: null, id: null });
        }
      });
    } catch (error) {
      console.error('Error deleting debt:', error);
      alert('Failed to delete debt. Please try again.');
      setDeleteModal({ isOpen: false, type: null, id: null });
    }
  };
  
  const handleSaveDebt = async () => {
    if (!clientId || !debtReferralLinkId || !debtAmount) {
      alert('Please fill in all required fields (Referral Link, Amount)');
      return;
    }
    
    setIsSavingDebt(true);
    try {
      const debtData = {
        referral_link_id: debtReferralLinkId,
        creditor_client_id: clientId,
        debtor_client_id: debtDebtorClientId || null,
        amount: parseFloat(debtAmount),
        status: debtStatus as "open" | "partial" | "settled",
        description: debtDescription || null
      };
      
      if (editingDebtId) {
        await updateDebt(debtData, editingDebtId, {
          onSuccess: () => {
            setShowDebtForm(false);
            setEditingDebtId(null);
            setDebtReferralLinkId('');
            setDebtAmount('');
            setDebtStatus('open');
            setDebtDescription('');
            setDebtDebtorClientId('');
            setIsSavingDebt(false);
            mutateReferralDebts();
            mutateDepositDebts();
          },
          onError: (error) => {
            console.error('Error updating debt:', error);
            alert('Failed to update debt. Please try again.');
            setIsSavingDebt(false);
          }
        });
      } else {
        await insertDebt(debtData, {
          onSuccess: () => {
            setShowDebtForm(false);
            setDebtReferralLinkId('');
            setDebtAmount('');
            setDebtStatus('open');
            setDebtDescription('');
            setDebtDebtorClientId('');
            setIsSavingDebt(false);
            mutateReferralDebts();
            mutateDepositDebts();
          },
          onError: (error) => {
            console.error('Error saving debt:', error);
            alert('Failed to save debt. Please try again.');
            setIsSavingDebt(false);
          }
        });
      }
    } catch (error) {
      console.error('Error saving debt:', error);
      alert('Failed to save debt. Please try again.');
      setIsSavingDebt(false);
    }
  };
  
  const handleEditPaymentLink = (link: any) => {
    setEditingPaymentLinkId(link.id);
    setPaymentProvider(link.provider);
    setPaymentUrl(link.url);
    setPaymentAmount(link.amount || '');
    setPaymentPurpose(link.purpose || '');
    setPaymentAppId(link.app_id || '');
    setShowPaymentLinkForm(true);
  };
  
  const handleDeletePaymentLink = (link: any) => {
    setDeleteModal({
      isOpen: true,
      type: 'paymentLink',
      id: link.id,
      name: `${link.provider} - ${link.url.substring(0, 50)}${link.url.length > 50 ? '...' : ''}`
    });
  };
  
  const confirmDeletePaymentLink = async () => {
    if (!deleteModal.id) return;
    
    try {
      await removePaymentLink(deleteModal.id, {
        onSuccess: () => {
          mutatePaymentLinks();
          setDeleteModal({ isOpen: false, type: null, id: null });
        },
        onError: (error) => {
          console.error('Error deleting payment link:', error);
          alert('Failed to delete payment link. Please try again.');
          setDeleteModal({ isOpen: false, type: null, id: null });
        }
      });
    } catch (error) {
      console.error('Error deleting payment link:', error);
      alert('Failed to delete payment link. Please try again.');
      setDeleteModal({ isOpen: false, type: null, id: null });
    }
  };
  
  const handleConfirmDelete = async () => {
    if (deleteModal.type === 'credential') {
      confirmDeleteCredential();
    } else if (deleteModal.type === 'debt') {
      confirmDeleteDebt();
    } else if (deleteModal.type === 'paymentLink') {
      confirmDeletePaymentLink();
    } else if (deleteModal.type === 'clientApp' && deleteModal.id) {
      try {
        await removeClientApp(deleteModal.id, {
          onSuccess: () => {
            mutateClientApps();
            setDeleteModal({ isOpen: false, type: null, id: null });
            // If we were editing this app, cancel the edit
            if (editingAppDetailsId === deleteModal.id) {
              setEditingAppDetailsId(null);
            }
          },
          onError: (error) => {
            console.error('Error deleting app process:', error);
            setToast({
              isOpen: true,
              message: 'Failed to delete app process. Please try again.',
              type: 'error'
            });
            setDeleteModal({ isOpen: false, type: null, id: null });
          }
        });
      } catch (error) {
        console.error('Error deleting app process:', error);
        setToast({
          isOpen: true,
          message: 'Failed to delete app process. Please try again.',
          type: 'error'
        });
        setDeleteModal({ isOpen: false, type: null, id: null });
      }
    } else if (deleteModal.type === 'markAsPaid' && deleteModal.id) {
      try {
        await updateClientApp(
          { status: 'paid' },
          deleteModal.id,
          {
            onSuccess: () => {
              mutateClientApps();
              setDeleteModal({ isOpen: false, type: null, id: null });
              setToast({
                isOpen: true,
                message: 'App process marked as paid successfully.',
                type: 'success'
              });
            },
            onError: (error) => {
              console.error('Error marking as paid:', error);
              setToast({
                isOpen: true,
                message: 'Failed to mark as paid. Please try again.',
                type: 'error'
              });
              setDeleteModal({ isOpen: false, type: null, id: null });
            }
          }
        );
      } catch (error) {
        console.error('Error marking as paid:', error);
        setToast({
          isOpen: true,
          message: 'Failed to mark as paid. Please try again.',
          type: 'error'
        });
        setDeleteModal({ isOpen: false, type: null, id: null });
      }
    } else if (deleteModal.type === 'client' && deleteModal.id) {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          setToast({
            isOpen: true,
            message: 'Unable to delete client. Please try again.',
            type: 'error'
          });
          setDeleteModal({ isOpen: false, type: null, id: null });
          return;
        }

        // First, set all invited_by_client_id references to NULL for clients that reference this client
        const { error: invitedByClientError } = await supabase
          .from('clients')
          .update({ invited_by_client_id: null })
          .eq('invited_by_client_id', deleteModal.id);
        
        if (invitedByClientError) {
          console.warn('Error updating invited_by_client_id references (non-fatal):', invitedByClientError);
          // Continue anyway - might be permission issue
        }
        
        // Also set all invited_by_partner_id references to NULL (though this shouldn't be necessary for client deletion)
        // This is just for safety
        const { error: invitedByPartnerError } = await supabase
          .from('clients')
          .update({ invited_by_partner_id: null } as any)
          .eq('invited_by_partner_id', deleteModal.id);
        
        if (invitedByPartnerError) {
          console.warn('Error updating invited_by_partner_id references (non-fatal):', invitedByPartnerError);
          // Continue anyway - might be permission issue
        }

        // Delete requests associated with this client (they don't have CASCADE)
          const { error: requestsError } = await supabase
            .from('requests')
            .delete()
            .eq('client_id', deleteModal.id);
          
          if (requestsError) {
            console.warn('Error deleting requests (non-fatal):', requestsError);
            // Continue anyway - might be permission issue or requests might not exist
        }
        
        // Delete client - this will cascade delete all related records (client_apps, credentials, etc.)
        // due to ON DELETE CASCADE in the database schema
        await removeClient(deleteModal.id, {
          onSuccess: () => {
            setToast({
              isOpen: true,
              message: 'Client profile and all associated data have been removed from the database.',
              type: 'success'
            });
            setDeleteModal({ isOpen: false, type: null, id: null });
            // Redirect to clients page after a short delay
            setTimeout(() => {
              window.location.href = '/clients';
            }, 1500);
          },
          onError: (error) => {
            console.error('Error deleting client:', error);
            const errorMessage = error?.message || 'Unknown error';
            setToast({
              isOpen: true,
              message: `Failed to delete client profile: ${errorMessage}. Please check the browser console for details.`,
              type: 'error'
            });
            setDeleteModal({ isOpen: false, type: null, id: null });
          }
        });
      } catch (error: any) {
        console.error('Error deleting client:', error);
        const errorMessage = error?.message || 'Unknown error';
        setToast({
          isOpen: true,
          message: `Failed to delete client profile: ${errorMessage}. Please check the browser console for details.`,
          type: 'error'
        });
        setDeleteModal({ isOpen: false, type: null, id: null });
      }
    }
  };
  
  const getDeleteModalContent = () => {
    if (deleteModal.type === 'credential') {
      return {
        title: 'Delete Credential',
        message: `Are you sure you want to delete the credential for "${deleteModal.name}"? This action cannot be undone.`,
        confirmLabel: 'Delete Credential'
      };
    } else if (deleteModal.type === 'debt') {
      return {
        title: 'Delete Debt Record',
        message: `Are you sure you want to delete the debt record of ${deleteModal.name}? This action cannot be undone.`,
        confirmLabel: 'Delete Debt'
      };
    } else if (deleteModal.type === 'paymentLink') {
      return {
        title: 'Delete Payment Link',
        message: `Are you sure you want to delete the payment link "${deleteModal.name}"? This action cannot be undone.`,
        confirmLabel: 'Delete Payment Link'
      };
    } else if (deleteModal.type === 'clientApp') {
      return {
        title: 'Delete App Process',
        message: `Are you sure you want to delete the app process for "${deleteModal.name}"? This action cannot be undone and all associated data will be lost.`,
        confirmLabel: 'Delete App Process'
      };
    } else if (deleteModal.type === 'markAsPaid') {
      return {
        title: 'Mark as Paid',
        message: `Are you sure you want to mark this app process as paid? This will change the status to "paid".`,
        confirmLabel: 'Mark as Paid'
      };
    } else if (deleteModal.type === 'client') {
      return {
        title: 'Remove Client Profile',
        message: `Are you sure you want to permanently remove "${deleteModal.name}" and all associated data from the database? This includes all app processes, credentials, debts, and payment links. This action cannot be undone.`,
        confirmLabel: 'Remove from Database'
      };
    }
    return {
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this item?',
      confirmLabel: 'Delete'
    };
  };
  
  const handleSavePaymentLink = async () => {
    if (!paymentProvider || !paymentUrl) {
      alert('Please fill in all required fields (Provider, URL)');
      return;
    }
    
    setIsSavingPaymentLink(true);
    try {
      const paymentData = {
        provider: paymentProvider,
        url: paymentUrl,
        amount: paymentAmount ? parseFloat(paymentAmount) : null,
        purpose: paymentPurpose || null,
        client_id: clientId,
        app_id: paymentAppId || null,
        used: false
      };
      
      if (editingPaymentLinkId) {
        await updatePaymentLink(paymentData, editingPaymentLinkId, {
          onSuccess: () => {
            setShowPaymentLinkForm(false);
            setEditingPaymentLinkId(null);
            setPaymentProvider('');
            setPaymentUrl('');
            setPaymentAmount('');
            setPaymentPurpose('');
            setPaymentAppId('');
            setIsSavingPaymentLink(false);
            mutatePaymentLinks();
          },
          onError: (error) => {
            console.error('Error updating payment link:', error);
            alert('Failed to update payment link. Please try again.');
            setIsSavingPaymentLink(false);
          }
        });
      } else {
        await insertPaymentLink(paymentData, {
          onSuccess: () => {
            setShowPaymentLinkForm(false);
            setPaymentProvider('');
            setPaymentUrl('');
            setPaymentAmount('');
            setPaymentPurpose('');
            setPaymentAppId('');
            setIsSavingPaymentLink(false);
            mutatePaymentLinks();
          },
          onError: (error) => {
            console.error('Error saving payment link:', error);
            alert('Failed to save payment link. Please try again.');
            setIsSavingPaymentLink(false);
          }
        });
      }
    } catch (error) {
      console.error('Error saving payment link:', error);
      alert('Failed to save payment link. Please try again.');
      setIsSavingPaymentLink(false);
    }
  };
  
  // Handle flag error
  const handleFlagError = async () => {
    if (!clientId || !errorType || !errorTitle.trim()) {
      alert('Please fill in Error Type and Title');
      return;
    }
    
    setIsSavingError(true);
    try {
      const errorData: any = {
        client_id: clientId,
        client_app_id: errorClientAppId || null,
        error_type: errorType,
        severity: errorSeverity,
        title: errorTitle.trim(),
        description: errorDescription.trim() || null
      };
      
      console.log('handleFlagError: Starting error flagging with data:', errorData);
      
      await insertClientError(errorData, {
        onSuccess: () => {
          console.log('handleFlagError: Success callback called');
          setShowErrorForm(false);
          setErrorType('');
          setErrorTypeInput('');
          setErrorSeverity('warning');
          setErrorTitle('');
          setErrorDescription('');
          setErrorClientAppId('');
          setIsSavingError(false);
          mutateErrors();
          setToast({
            isOpen: true,
            message: 'Error flagged successfully!',
            type: 'success'
          });
        },
        onError: (error: any) => {
          console.error('handleFlagError: Error callback called:', error);
          const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
          alert(`Failed to flag error: ${errorMessage}`);
          setIsSavingError(false);
        }
      });
    } catch (error: any) {
      console.error('handleFlagError: Exception caught:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      alert(`Failed to flag error: ${errorMessage}`);
      setIsSavingError(false);
    }
  };

  // Handle error type change (for flagging form)
  const handleErrorTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setErrorTypeInput(value);
    // Check if the input matches a predefined type
    const matchedType = predefinedErrorTypes.find(t => 
      t.label.toLowerCase() === value.toLowerCase() || 
      t.value.toLowerCase() === value.toLowerCase()
    );
    if (matchedType) {
      setErrorType(matchedType.value);
    } else {
      // If no match, set errorType to the normalized input value
      setErrorType(value.trim().toLowerCase().replace(/\s/g, '_'));
    }
    setShowErrorTypeDropdown(true);
  };

  const handleAddCustomErrorType = () => {
    if (errorTypeInput.trim()) {
      const newErrorType = errorTypeInput.trim().toLowerCase().replace(/\s/g, '_');
      setErrorType(newErrorType);
      setShowErrorTypeDropdown(false);
    }
  };

  // Handle editing error type change
  const handleEditingErrorTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditingErrorTypeInput(value);
    // Check if the input matches a predefined type
    const matchedType = predefinedErrorTypes.find(t => 
      t.label.toLowerCase() === value.toLowerCase() || 
      t.value.toLowerCase() === value.toLowerCase()
    );
    if (matchedType) {
      setEditingErrorType(matchedType.value);
    } else {
      // If no match, set editingErrorType to the normalized input value
      setEditingErrorType(value.trim().toLowerCase().replace(/\s/g, '_'));
    }
    setShowEditingErrorTypeDropdown(true);
  };

  const handleAddCustomEditingErrorType = () => {
    if (editingErrorTypeInput.trim()) {
      const newErrorType = editingErrorTypeInput.trim().toLowerCase().replace(/\s/g, '_');
      setEditingErrorType(newErrorType);
      setShowEditingErrorTypeDropdown(false);
    }
  };

  // Handle edit error
  const handleEditError = (error: any) => {
    setEditingErrorId(error.id);
    setEditingErrorType(error.error_type);
    // Find the label for the error_type to display in the input
    const foundType = predefinedErrorTypes.find(t => t.value === error.error_type);
    setEditingErrorTypeInput(foundType ? foundType.label : error.error_type);
    setEditingErrorSeverity(error.severity);
    setEditingErrorTitle(error.title);
    setEditingErrorDescription(error.description || '');
    setEditingErrorClientAppId(error.client_app_id || '');
  };

  const handleCancelErrorEdit = () => {
    setEditingErrorId(null);
    setEditingErrorType('');
    setEditingErrorTypeInput('');
    setEditingErrorSeverity('warning');
    setEditingErrorTitle('');
    setEditingErrorDescription('');
    setEditingErrorClientAppId('');
  };

  const handleSaveErrorEdit = async () => {
    if (!editingErrorId || !editingErrorType || !editingErrorTitle.trim()) {
      alert('Please fill in Error Type and Title');
      return;
    }
    
    setIsSavingErrorEdit(true);
    try {
      const errorData: any = {
        error_type: editingErrorType,
        severity: editingErrorSeverity,
        title: editingErrorTitle.trim(),
        description: editingErrorDescription.trim() || null,
        client_app_id: editingErrorClientAppId || null
      };
      
      await updateClientError(editingErrorId, errorData, {
        onSuccess: () => {
          handleCancelErrorEdit();
          setIsSavingErrorEdit(false);
          mutateErrors();
          setToast({
            isOpen: true,
            message: 'Error updated successfully!',
            type: 'success'
          });
        },
        onError: (error: any) => {
          const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
          alert(`Failed to update error: ${errorMessage}`);
          setIsSavingErrorEdit(false);
        }
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      alert(`Failed to update error: ${errorMessage}`);
      setIsSavingErrorEdit(false);
    }
  };

  const handleResolveError = async (errorId: string, resolved: boolean) => {
    try {
      await resolveClientError(errorId, resolved, {
        onSuccess: () => {
          mutateErrors();
          setToast({
            isOpen: true,
            message: resolved ? 'Error resolved successfully!' : 'Error reopened successfully!',
            type: 'success'
          });
        },
        onError: (error: any) => {
          const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
          alert(`Failed to ${resolved ? 'resolve' : 'reopen'} error: ${errorMessage}`);
        }
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      alert(`Failed to ${resolved ? 'resolve' : 'reopen'} error: ${errorMessage}`);
    }
  };

  const handleClearError = async (errorId: string, cleared: boolean) => {
    try {
      await clearClientError(errorId, cleared, {
        onSuccess: () => {
          mutateErrors();
          setToast({
            isOpen: true,
            message: cleared ? 'Error cleared successfully!' : 'Error uncleared successfully!',
            type: 'success'
          });
        },
        onError: (error: any) => {
          const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
          setToast({
            isOpen: true,
            message: `Failed to ${cleared ? 'clear' : 'unclear'} error: ${errorMessage}`,
            type: 'error'
          });
        }
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      setToast({
        isOpen: true,
        message: `Failed to ${cleared ? 'clear' : 'unclear'} error: ${errorMessage}`,
        type: 'error'
      });
    }
  };

  const handleDeleteError = async (errorId: string) => {
    if (!confirm('Are you sure you want to delete this error? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteClientError(errorId, {
        onSuccess: () => {
          mutateErrors();
          setToast({
            isOpen: true,
            message: 'Error deleted successfully!',
            type: 'success'
          });
        },
        onError: (error: any) => {
          const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
          alert(`Failed to delete error: ${errorMessage}`);
        }
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      alert(`Failed to delete error: ${errorMessage}`);
    }
  };

  const handleClearAllErrorsClick = () => {
    setClearAllModal({ isOpen: true });
  };

  const clearAllErrors = async () => {
    if (!clientId) return;
    
    setClearAllModal({ isOpen: false });
    
    const supabase = getSupabaseClient();
    if (!supabase) {
      setToast({
        isOpen: true,
        message: 'Supabase client not initialized',
        type: 'error'
      });
      return;
    }
    
    try {
      // Get all unresolved, uncleared errors for this client
      const { data: errorsToClear, error: fetchError } = await (supabase as any)
        .from('client_errors')
        .select('id')
        .eq('client_id', clientId)
        .is('resolved_at', null)
        .is('cleared_at', null);
      
      if (fetchError) {
        throw fetchError;
      }
      
      if (!errorsToClear || errorsToClear.length === 0) {
        setToast({
          isOpen: true,
          message: 'No errors to clear.',
          type: 'info'
        });
        return;
      }
      
      // Update all errors to set cleared_at
      const { error: updateError } = await (supabase as any)
        .from('client_errors')
        .update({ cleared_at: new Date().toISOString() })
        .in('id', errorsToClear.map((e: any) => e.id));
      
      if (updateError) {
        throw updateError;
      }
      
      mutateErrors();
      setToast({
        isOpen: true,
        message: `Successfully cleared ${errorsToClear.length} error(s). They will not reappear when "Detect Errors" is run.`,
        type: 'success'
      });
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      setToast({
        isOpen: true,
        message: `Failed to clear errors: ${errorMessage}`,
        type: 'error'
      });
    }
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Client Details" description="Loading client data..." />
        <LoadingSpinner message="Loading client details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Client Details" description="Error loading client data" />
        <ErrorMessage
          error={error}
          onRetry={() => {
            mutateClients();
            mutateClientApps();
          }}
        />
      </div>
    );
  }

  if (!client) {
    return (
      <div>
        <SectionHeader title="Client not found" actions={<Link href="/clients">Back to clients</Link>} />
        <EmptyState
          title="Client not found"
          message="The requested client does not exist in the current dataset."
          action={{ label: 'Back to clients', onClick: () => window.location.href = '/clients' }}
        />
      </div>
    );
  }

  const clientTier = (client as any).tiers;
  // Handle invited_by relationship - check both partner and client separately
  const invitedByClientId = client?.invited_by_client_id;
  const invitedByPartnerId = (client as any)?.invited_by_partner_id;
  
  // Get invited by client if client_id is set
  const invitedByClient = invitedByClientId 
    ? (Array.isArray(allClients) ? allClients.find((c: any) => c.id === invitedByClientId) : null)
    : null;
  
  // Get invited by partner if partner_id is set (directly from partner table, not through client)
  const invitedByPartner = invitedByPartnerId
    ? (allPartnersArray.find((p: any) => p.id === invitedByPartnerId) || null)
    : null;
  
  // Use partner if set, otherwise use client
  const invitedBy = invitedByPartner
    ? { name: invitedByPartner.name, surname: '', isPartner: true }
    : invitedByClient 
      ? { ...invitedByClient, isPartner: false }
      : null;

  // Ensure all data arrays are actually arrays
  const clientAppsArray = Array.isArray(clientApps) ? clientApps : [];
  const referralDebtsArray = Array.isArray(referralDebts) ? referralDebts : [];
  const depositDebtsArray = Array.isArray(depositDebts) ? depositDebts : [];
  const credentialsArray = Array.isArray(credentials) ? credentials : [];
  const paymentLinksArray = Array.isArray(paymentLinks) ? paymentLinks : [];

  const relatedApps = clientAppsArray
    .filter((item: any) => item?.client_id === client.id)
    .map((entry: any) => {
      const app = entry?.apps;
      const promotion = entry?.promotions;
      const link = entry?.referral_links;
      return {
        ...entry,
        app,
        promotion,
        link
      };
    });

  // Process referral_link_debts
  const referralClientDebts = referralDebtsArray
    .filter((debt: any) => debt?.creditor_client_id === client.id || debt?.debtor_client_id === client.id)
    .map((debt: any) => {
      // Resolve creditor and debtor from allClients array
      const creditor = allClientsArray.find((c: any) => c?.id === debt?.creditor_client_id);
      const debtor = debt?.debtor_client_id 
        ? allClientsArray.find((c: any) => c?.id === debt?.debtor_client_id)
        : null;
      return {
        ...debt,
        type: 'referral' as const,
        creditor_client: creditor,
        debtor_client: debtor
      };
    });
  
  // Process deposit_debts (these are linked to client_apps, which have client_id)
  const depositClientDebts = depositDebtsArray
    .filter((debt: any) => {
      // Check if the debt's client_app belongs to this client
      const clientApp = debt?.client_apps;
      return clientApp && clientApp.client_id === client.id;
    })
    .map((debt: any) => {
      const clientApp = debt?.client_apps;
      const app = clientApp?.apps;
      return {
        ...debt,
        type: 'deposit' as const,
        client_app: clientApp,
        app: app,
        // For deposit debts, the client is the debtor (they owe us)
        debtor_client_id: client.id,
        creditor_client_id: null, // "Us" - no specific creditor client
        amount: debt.amount || 0,
        status: debt.status || 'open'
      };
    });
  
  // Combine both types of debts
  const clientDebts = [...referralClientDebts, ...depositClientDebts];
  const clientCredentials = credentialsArray;
  const clientPaymentLinks = paymentLinksArray;

  // Calculate totals - only count apps with status "paid"
  const totalClientProfit = relatedApps
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + Number(item.profit_client ?? 0), 0);
  const totalInternalProfit = relatedApps
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + Number(item.profit_us ?? 0), 0);
  const totalDeposited = relatedApps
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + Number(item.deposit_amount ?? 0), 0);
  
  // Calculate debt totals
  const totalOwedToClient = clientDebts
    .filter((debt: any) => debt.creditor_client_id === client.id && debt.status !== 'settled')
    .reduce((sum: number, debt: any) => sum + Number(debt.amount ?? 0), 0);
  const totalOwedByClient = clientDebts
    .filter((debt: any) => debt.debtor_client_id === client.id && debt.status !== 'settled')
    .reduce((sum: number, debt: any) => sum + Number(debt.amount ?? 0), 0);
  
  // Helper function to check if a promotion is currently active
  const isPromotionActive = (promo: any): boolean => {
    if (!promo) return false;
    
    // First check the explicit is_active flag from CSV
    if (promo.is_active === false) return false;
    if (promo.is_active === true) {
      // If explicitly active, still check dates
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check start date
      if (promo.start_date) {
        const startDate = new Date(promo.start_date);
        startDate.setHours(0, 0, 0, 0);
        if (today < startDate) return false;
      }
      
      // Check end date
      if (promo.end_date) {
        const endDate = new Date(promo.end_date);
        endDate.setHours(23, 59, 59, 999);
        if (today > endDate) return false;
      }
      
      return true;
    }
    
    // Fallback to date-based logic if is_active is not set
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // If no dates specified, consider it active
    if (!promo.start_date && !promo.end_date) return true;
    
    // Check start date
    if (promo.start_date) {
      const startDate = new Date(promo.start_date);
      startDate.setHours(0, 0, 0, 0);
      if (today < startDate) return false;
    }
    
    // Check end date
    if (promo.end_date) {
      const endDate = new Date(promo.end_date);
      endDate.setHours(23, 59, 59, 999);
      if (today > endDate) return false;
    }
    
    return true;
  };

  // Apps done vs available
  const allAppsArray = Array.isArray(allApps) ? allApps : [];
  const activeAppsArray = allAppsArray.filter((app: any) => app.is_active);
  const clientAppIds = new Set(relatedApps.map((item: any) => item.app_id));
  const appsDone = relatedApps.filter((item: any) => 
    item.status === 'completed' || item.status === 'paid'
  ).length;
  const appsInProgress = relatedApps.filter((item: any) => 
    item.status !== 'completed' && item.status !== 'paid' && item.status !== 'cancelled'
  ).length;
  
  // Filter apps to only show those with active promotions
  const promotionsArray = Array.isArray(allPromotions) ? allPromotions : [];
  const appsWithActivePromotions = new Set(
    promotionsArray
      .filter((promo: any) => isPromotionActive(promo))
      .map((promo: any) => promo.app_id)
  );
  
  const appsMissing = activeAppsArray.filter((app: any) => 
    !clientAppIds.has(app.id) && appsWithActivePromotions.has(app.id)
  );

  return (
    <div>
      <SectionHeader
        title={`${client.name} ${client.surname ?? ''}`.trim()}
        description={`Tier ${clientTier?.name ?? '—'} • Joined ${new Date(client.created_at).toLocaleDateString()}`}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const newValue = !showErrorForm;
                console.log('Flag Error button clicked, setting showErrorForm to:', newValue);
                setShowErrorForm(newValue);
                // Scroll to form after state update
                if (newValue) {
                  setTimeout(() => {
                    const formElement = document.getElementById('flag-error-form');
                    if (formElement) {
                      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }, 100);
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: showErrorForm ? '#10b981' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              {showErrorForm ? '✕ Close Form' : '🚩 Flag Error'}
            </button>
            <button
              onClick={() => {
                setDeleteModal({
                  isOpen: true,
                  type: 'client',
                  id: clientId!,
                  name: `${client.name} ${client.surname ?? ''}`.trim()
                });
              }}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Remove from database
            </button>
            <Link href="/clients" style={{ fontSize: '0.875rem', color: '#3b82f6', textDecoration: 'none' }}>
              Back to clients
            </Link>
          </div>
        }
      />

      {/* Client Errors Section - Prominently displayed at the top */}
      {Array.isArray(clientErrors) && clientErrors.length > 0 && (() => {
        const activeErrors = clientErrors.filter((e: any) => !e.resolved_at && !e.cleared_at);
        return activeErrors.length > 0 ? (
          <section style={{ 
            marginTop: '1.5rem', 
            marginBottom: '2rem',
            backgroundColor: '#fef2f2',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '2px solid #ef4444',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, color: '#991b1b' }}>
                ⚠️ Errors & Issues ({activeErrors.length} Active)
              </h2>
              <button
                onClick={handleClearAllErrorsClick}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#64748b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'background-color 0.2s, transform 0.1s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#475569';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#64748b';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                🗑️ Clear All
              </button>
            </div>
          
          {errorsLoading ? (
            <LoadingSpinner message="Loading errors..." />
          ) : errorsError ? (
            <ErrorMessage error={errorsError} onRetry={mutateErrors} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeErrors.map((error: any) => {
                const severityColor = error.severity === 'critical' ? '#ef4444' : 
                                     error.severity === 'warning' ? '#f59e0b' : '#3b82f6';
                const appName = error.client_apps?.apps?.name || 'N/A';
                const isEditing = editingErrorId === error.id;

                return (
                  <div
                    key={error.id}
                    style={{
                      backgroundColor: '#fff',
                      padding: '1.5rem',
                      borderRadius: '8px',
                      border: `3px solid ${severityColor}`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}
                  >
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '2px solid #3b82f6' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              marginBottom: '0.75rem', 
                              fontWeight: '600', 
                              fontSize: '0.95rem',
                              color: '#1e293b'
                            }}>
                              Error Type <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type="text"
                                value={editingErrorTypeInput}
                                onChange={handleEditingErrorTypeChange}
                                onFocus={() => setShowEditingErrorTypeDropdown(true)}
                                onBlur={() => setTimeout(() => setShowEditingErrorTypeDropdown(false), 100)}
                                style={{ 
                                  width: '100%', 
                                  padding: '0.75rem', 
                                  border: editingErrorType ? '2px solid #10b981' : '2px solid #cbd5e1', 
                                  borderRadius: '8px',
                                  fontSize: '0.95rem',
                                  backgroundColor: '#fff',
                                  transition: 'border-color 0.2s',
                                  outline: 'none'
                                }}
                                disabled={isSavingErrorEdit}
                                placeholder="Select or type error type"
                              />
                              {showEditingErrorTypeDropdown && (filteredEditingErrorTypes.length > 0 || editingErrorTypeInput.trim()) && (
                                <ul style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  right: 0,
                                  backgroundColor: '#fff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  zIndex: 20,
                                  maxHeight: '200px',
                                  overflowY: 'auto',
                                  listStyle: 'none',
                                  padding: 0,
                                  margin: '0.5rem 0 0 0'
                                }}>
                                  {filteredEditingErrorTypes.map((type) => (
                                    <li
                                      key={type.value}
                                      onMouseDown={() => {
                                        setEditingErrorType(type.value);
                                        setEditingErrorTypeInput(type.label);
                                        setShowEditingErrorTypeDropdown(false);
                                      }}
                                      style={{
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                        fontSize: '0.95rem',
                                        color: '#334155',
                                        borderBottom: '1px solid #f1f5f9'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                      {type.label}
                                    </li>
                                  ))}
                                  {editingErrorTypeInput.trim() && (
                                    <li
                                      onMouseDown={handleAddCustomEditingErrorType}
                                      style={{
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                        fontSize: '0.95rem',
                                        color: '#3b82f6',
                                        fontWeight: '600',
                                        borderTop: filteredEditingErrorTypes.length > 0 ? '1px solid #e2e8f0' : 'none'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                      + Add custom type: "{editingErrorTypeInput}"
                                    </li>
                                  )}
                                </ul>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <label style={{ 
                              display: 'block', 
                              marginBottom: '0.75rem', 
                              fontWeight: '600', 
                              fontSize: '0.95rem',
                              color: '#1e293b'
                            }}>
                              Severity <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <select
                              value={editingErrorSeverity}
                              onChange={(e) => setEditingErrorSeverity(e.target.value as 'critical' | 'warning' | 'info')}
                              style={{ 
                                width: '100%', 
                                padding: '0.75rem', 
                                border: '2px solid #cbd5e1', 
                                borderRadius: '8px',
                                fontSize: '0.95rem',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                transition: 'border-color 0.2s',
                                outline: 'none'
                              }}
                              disabled={isSavingErrorEdit}
                              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                            >
                              <option value="critical">🔴 Critical</option>
                              <option value="warning">🟠 Warning</option>
                              <option value="info">🔵 Info</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '0.75rem', 
                            fontWeight: '600', 
                            fontSize: '0.95rem',
                            color: '#1e293b'
                          }}>
                            Title <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="text"
                            value={editingErrorTitle}
                            onChange={(e) => setEditingErrorTitle(e.target.value)}
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              border: editingErrorTitle.trim() ? '2px solid #10b981' : '2px solid #cbd5e1', 
                              borderRadius: '8px',
                              fontSize: '0.95rem',
                              transition: 'border-color 0.2s',
                              outline: 'none'
                            }}
                            disabled={isSavingErrorEdit}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.currentTarget.style.borderColor = editingErrorTitle.trim() ? '#10b981' : '#cbd5e1'}
                          />
                        </div>
                        
                        <div>
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '0.75rem', 
                            fontWeight: '600', 
                            fontSize: '0.95rem',
                            color: '#1e293b'
                          }}>
                            Description
                          </label>
                          <textarea
                            value={editingErrorDescription}
                            onChange={(e) => setEditingErrorDescription(e.target.value)}
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              border: '2px solid #cbd5e1', 
                              borderRadius: '8px', 
                              minHeight: '120px',
                              fontSize: '0.95rem',
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              transition: 'border-color 0.2s',
                              outline: 'none'
                            }}
                            disabled={isSavingErrorEdit}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                          />
                        </div>
                        
                        <div>
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '0.75rem', 
                            fontWeight: '600', 
                            fontSize: '0.95rem',
                            color: '#1e293b'
                          }}>
                            Related App Process <span style={{ fontWeight: '400', color: '#64748b', fontSize: '0.85rem' }}>(Optional)</span>
                          </label>
                          <select
                            value={editingErrorClientAppId}
                            onChange={(e) => setEditingErrorClientAppId(e.target.value)}
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              border: '2px solid #cbd5e1', 
                              borderRadius: '8px',
                              fontSize: '0.95rem',
                              backgroundColor: '#fff',
                              cursor: 'pointer',
                              transition: 'border-color 0.2s',
                              outline: 'none'
                            }}
                            disabled={isSavingErrorEdit}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                          >
                            <option value="">None (general client error)</option>
                            {relatedApps.map((app: any) => (
                              <option key={app.id} value={app.id}>
                                {app.app?.name ?? 'Unknown'} - {app.status}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '2px solid #e2e8f0' }}>
                          <button
                            onClick={handleCancelErrorEdit}
                            disabled={isSavingErrorEdit}
                            style={{
                              padding: '0.75rem 1.5rem',
                              backgroundColor: '#e2e8f0',
                              color: '#475569',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: isSavingErrorEdit ? 'not-allowed' : 'pointer',
                              fontSize: '0.95rem',
                              fontWeight: '600',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => !isSavingErrorEdit && (e.currentTarget.style.backgroundColor = '#cbd5e1')}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveErrorEdit}
                            disabled={isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()}
                            style={{
                              padding: '0.75rem 1.5rem',
                              backgroundColor: (isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()) ? '#cbd5e1' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: (isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()) ? 'not-allowed' : 'pointer',
                              fontSize: '0.95rem',
                              fontWeight: '600',
                              transition: 'background-color 0.2s, transform 0.1s',
                              boxShadow: (isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()) ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSavingErrorEdit && editingErrorType && editingErrorTitle.trim()) {
                                e.currentTarget.style.backgroundColor = '#059669';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = (isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()) ? '#cbd5e1' : '#10b981';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            {isSavingErrorEdit ? '⏳ Saving...' : '💾 Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                              <div
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  backgroundColor: severityColor,
                                  flexShrink: 0
                                }}
                              />
                              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>
                                {error.title}
                              </h3>
                            </div>
                            <div style={{ fontSize: '1rem', color: '#64748b', marginLeft: '2rem', marginBottom: '0.5rem' }}>
                              {error.description || 'No description provided'}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginLeft: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                              <span>
                                <strong>Type:</strong> {error.error_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </span>
                              <span>
                                <strong>Severity:</strong> {error.severity.toUpperCase()}
                              </span>
                              <span>
                                <strong>App:</strong> {appName}
                              </span>
                              <span>
                                <strong>Detected:</strong> {new Date(error.detected_at).toLocaleString('it-IT')}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            <button
                              onClick={() => handleResolveError(error.id, true)}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                              }}
                            >
                              ✓ Resolve
                            </button>
                            <button
                              onClick={() => handleEditError(error)}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                              }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteError(error.id)}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '600'
                              }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        ) : null;
      })()}

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="detail-section" style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Personal Information</h2>
            {!isEditingClientInfo && (
              <button
                onClick={handleEditClientInfo}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                Edit
              </button>
            )}
          </div>
          
          {isEditingClientInfo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '2px solid #3b82f6' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.75rem', 
                    fontWeight: '600', 
                    fontSize: '0.95rem',
                    color: '#1e293b'
                  }}>
                    Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      border: clientName.trim() ? '2px solid #10b981' : '2px solid #cbd5e1', 
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    disabled={isSavingClientInfo}
                    required
                    onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.currentTarget.style.borderColor = clientName.trim() ? '#10b981' : '#cbd5e1'}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.75rem', 
                    fontWeight: '600', 
                    fontSize: '0.95rem',
                    color: '#1e293b'
                  }}>
                    Surname
                  </label>
                  <input
                    type="text"
                    value={clientSurname}
                    onChange={(e) => setClientSurname(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      border: '2px solid #cbd5e1', 
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    disabled={isSavingClientInfo}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.75rem', 
                    fontWeight: '600', 
                    fontSize: '0.95rem',
                    color: '#1e293b'
                  }}>
                    Contact
                  </label>
                  <input
                    type="text"
                    value={clientContact}
                    onChange={(e) => setClientContact(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      border: '2px solid #cbd5e1', 
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    disabled={isSavingClientInfo}
                    placeholder="Telegram/WhatsApp/Phone"
                    onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.75rem', 
                    fontWeight: '600', 
                    fontSize: '0.95rem',
                    color: '#1e293b'
                  }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      border: clientEmail.trim() && clientEmail.includes('@') ? '2px solid #10b981' : '2px solid #cbd5e1', 
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    disabled={isSavingClientInfo}
                    placeholder="email@example.com"
                    onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.currentTarget.style.borderColor = (clientEmail.trim() && clientEmail.includes('@')) ? '#10b981' : '#cbd5e1'}
                  />
                </div>
              </div>
              <div>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer',
                  padding: '0.75rem',
                  backgroundColor: clientTrusted ? '#f0fdf4' : '#fff',
                  border: `2px solid ${clientTrusted ? '#10b981' : '#cbd5e1'}`,
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}>
                  <input
                    type="checkbox"
                    checked={clientTrusted}
                    onChange={(e) => setClientTrusted(e.target.checked)}
                    disabled={isSavingClientInfo}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#1e293b' }}>✓ Trusted Client</span>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.75rem', 
                    fontWeight: '600', 
                    fontSize: '0.95rem',
                    color: '#1e293b'
                  }}>
                    Tier
                  </label>
                  <select
                    value={clientTierId}
                    onChange={(e) => setClientTierId(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      border: '2px solid #cbd5e1', 
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      backgroundColor: '#fff',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                      outline: 'none'
                    }}
                    disabled={isSavingClientInfo}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                  >
                    <option value="">None</option>
                    {Array.isArray(tiers) && tiers.map((tier: any) => (
                      <option key={tier.id} value={tier.id}>{tier.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.75rem', 
                    fontWeight: '600', 
                    fontSize: '0.95rem',
                    color: '#1e293b'
                  }}>
                    Invited By
                  </label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input
                      ref={invitedByInputRef}
                      type="text"
                      value={clientInvitedBySearch}
                      onChange={(e) => {
                        setClientInvitedBySearch(e.target.value);
                        setShowInvitedByDropdown(true);
                        // Clear selected client/partner if search doesn't match
                        if (clientInvitedBy) {
                          const selectedClient = allClientsArray.find((c: any) => c.id === clientInvitedBy);
                          if (selectedClient) {
                            const selectedName = `${selectedClient.name} ${selectedClient.surname || ''}`.trim();
                            if (selectedName.toLowerCase() !== e.target.value.toLowerCase()) {
                              setClientInvitedBy('');
                            }
                          }
                        }
                        if (clientInvitedByPartner) {
                          const selectedPartner = allPartnersArray.find((p: any) => p.id === clientInvitedByPartner);
                          if (selectedPartner) {
                            if (selectedPartner.name.toLowerCase() !== e.target.value.toLowerCase()) {
                              setClientInvitedByPartner('');
                            }
                          }
                        }
                      }}
                      onFocus={() => setShowInvitedByDropdown(true)}
                      placeholder="Search client or partner..."
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                        border: `2px solid ${(clientInvitedBy || clientInvitedByPartner) ? '#10b981' : '#cbd5e1'}`, 
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      backgroundColor: '#fff',
                        cursor: isSavingClientInfo ? 'not-allowed' : 'text',
                      transition: 'border-color 0.2s',
                        outline: 'none',
                        fontWeight: (clientInvitedBy || clientInvitedByPartner) ? '500' : '400',
                        boxSizing: 'border-box'
                    }}
                    disabled={isSavingClientInfo}
                      onBlur={(e) => {
                        // Delay to allow click on dropdown item
                        setTimeout(() => setShowInvitedByDropdown(false), 200);
                      }}
                    />
                    {(clientInvitedBy || clientInvitedByPartner) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setClientInvitedBy('');
                          setClientInvitedByPartner('');
                          setClientInvitedBySearch('');
                          setShowInvitedByDropdown(false);
                        }}
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          fontSize: '1.25rem',
                          cursor: 'pointer',
                          color: '#64748b',
                          padding: '0.25rem',
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        disabled={isSavingClientInfo}
                      >
                        ×
                      </button>
                    )}
                    {showInvitedByDropdown && filteredInvitedByPartners.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '0.25rem',
                          backgroundColor: 'white',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 1000
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {filteredInvitedByPartners.map((item: any) => {
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelectInvitedByClient(item.id, item.displayName)}
                              style={{
                                padding: '0.75rem',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background-color 0.15s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backgroundColor: item.type === 'new_partner' ? '#f0fdf4' : 'white'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = item.type === 'new_partner' ? '#dcfce7' : '#f8fafc';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = item.type === 'new_partner' ? '#f0fdf4' : 'white';
                              }}
                            >
                              {item.type === 'new_partner' && (
                                <span style={{ fontSize: '1rem', color: '#059669' }}>+</span>
                              )}
                              <span style={{ 
                                fontWeight: item.type === 'new_partner' ? '600' : '400',
                                color: item.type === 'new_partner' ? '#059669' : '#0f172a'
                              }}>
                                {item.displayName}
                              </span>
                              {item.type === 'partner' && (
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: '#059669',
                                  fontWeight: '600',
                                  padding: '0.125rem 0.5rem',
                                  background: '#ecfdf5',
                                  borderRadius: '12px'
                                }}>
                                  Partner
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '2px solid #e2e8f0' }}>
                <button
                  onClick={handleCancelClientInfoEdit}
                  disabled={isSavingClientInfo}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isSavingClientInfo ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => !isSavingClientInfo && (e.currentTarget.style.backgroundColor = '#cbd5e1')}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveClientInfo}
                  disabled={isSavingClientInfo || !clientName.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: (isSavingClientInfo || !clientName.trim()) ? '#cbd5e1' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (isSavingClientInfo || !clientName.trim()) ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    transition: 'background-color 0.2s, transform 0.1s',
                    boxShadow: (isSavingClientInfo || !clientName.trim()) ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSavingClientInfo && clientName.trim()) {
                      e.currentTarget.style.backgroundColor = '#059669';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = (isSavingClientInfo || !clientName.trim()) ? '#cbd5e1' : '#10b981';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {isSavingClientInfo ? '⏳ Saving...' : '💾 Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <strong>Full Name</strong>
                <span>{`${client.name} ${client.surname ?? ''}`.trim()}</span>
              </div>
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <strong>Contact</strong>
                <span>{client.contact ?? '—'}</span>
              </div>
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <strong>Email</strong>
                <span>{client.email ?? '—'}</span>
              </div>
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <strong>Trusted</strong>
                <span style={{ color: client.trusted ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                  {client.trusted ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <strong>Tier</strong>
                <span>{clientTier?.name ?? '—'}</span>
              </div>
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <strong>Invited by</strong>
                <span>
                  {invitedBy 
                    ? `${invitedBy.name} ${invitedBy.surname ?? ''}`.trim() + (invitedBy.isPartner ? ' (Partner)' : '')
                    : '—'}
                </span>
              </div>
              {partnerAssignments && Array.isArray(partnerAssignments) && partnerAssignments.length > 0 && (
                <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
                  <strong>Partner</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                    {partnerAssignments.map((assignment: any) => {
                      const partner = assignment.client_partners;
                      if (!partner) return null;
                      return (
                        <Link
                          key={assignment.id}
                          href={`/partners/${partner.id}`}
                          style={{ color: '#059669', fontWeight: '600', textDecoration: 'none' }}
                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {partner.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
                <strong>Joined</strong>
                <span>{new Date(client.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="detail-section" style={{ backgroundColor: '#f0fdf4', padding: '1.5rem', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>Financial Summary</h2>
          <div className="detail-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <strong>Money Redeemed</strong>
              <span style={{ color: '#10b981', fontWeight: '700', fontSize: '1.1rem' }}>€{totalClientProfit.toFixed(2)}</span>
            </div>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <strong>Total Deposited</strong>
              <span style={{ fontWeight: '600', color: totalDeposited > 0 ? '#3b82f6' : '#64748b' }}>
                €{totalDeposited.toFixed(2)}
              </span>
            </div>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <strong>Our Profit</strong>
              <span style={{ color: '#3b82f6', fontWeight: '600' }}>€{totalInternalProfit.toFixed(2)}</span>
            </div>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <strong>Owed to Client</strong>
              <span style={{ color: totalOwedToClient > 0 ? '#10b981' : '#64748b' }}>
                €{totalOwedToClient.toFixed(2)}
              </span>
            </div>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
              <strong>Owed by Client</strong>
              <span style={{ color: totalOwedByClient > 0 ? '#ef4444' : '#64748b' }}>
                €{totalOwedByClient.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        
        <div className="detail-section" style={{ backgroundColor: '#fef3c7', padding: '1.5rem', borderRadius: '8px' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>Apps Progress</h2>
          <div className="detail-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <strong>Apps Completed</strong>
              <span style={{ color: '#10b981', fontWeight: '600' }}>{appsDone}</span>
            </div>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <strong>Apps In Progress</strong>
              <span style={{ color: '#f59e0b', fontWeight: '600' }}>{appsInProgress}</span>
            </div>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <strong>Total Apps Started</strong>
              <span>{relatedApps.length}</span>
            </div>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <strong>Available Apps</strong>
              <span>{activeAppsArray.length}</span>
            </div>
            <div className="detail-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
              <strong>Apps Not Started</strong>
              <span style={{ color: appsMissing.length > 0 ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                {appsMissing.length}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <strong style={{ fontSize: '1.1rem' }}>Internal Notes</strong>
          {!isEditingNotes && (
            <button
              onClick={() => setIsEditingNotes(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              {client?.notes ? 'Edit Notes' : 'Add Notes'}
            </button>
          )}
        </div>
        
        {isEditingNotes ? (
          <div>
            <textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Add notes about this client..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '0.75rem'
              }}
              disabled={isSavingNotes}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCancelEdit}
                disabled={isSavingNotes}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSavingNotes ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  opacity: isSavingNotes ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSavingNotes ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  opacity: isSavingNotes ? 0.6 : 1
                }}
              >
                {isSavingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: client?.notes ? '#64748b' : '#94a3b8', fontStyle: client?.notes ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
            {client?.notes || 'No notes added yet. Click "Add Notes" to add notes about this client.'}
          </p>
        )}
      </div>

      <section style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>Apps Started</h2>
          {!showStartAppForm && (
            <button
              onClick={() => setShowStartAppForm(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              + Start an app process
            </button>
          )}
        </div>
        
        {showStartAppForm && (
          <div style={{ 
            backgroundColor: '#fff', 
            padding: '2rem', 
            borderRadius: '12px', 
            marginBottom: '1.5rem', 
            border: '2px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>Start New App Process</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>Create a new app signup for this client</p>
              </div>
              <button
                onClick={() => {
                  setShowStartAppForm(false);
                  setStartAppAppId('');
                  setStartAppAppSearch('');
                  setShowStartAppDropdown(false);
                  setStartAppPromotionId('');
                  setStartAppReferralLinkId('');
                  setStartAppCustomReferralLink('');
                  setStartAppNotes('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem 0.5rem',
                  lineHeight: 1,
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* App Selection */}
              <div style={{ 
                padding: '1.5rem', 
                backgroundColor: startAppAppId ? '#f0fdf4' : '#f8fafc', 
                borderRadius: '10px',
                border: `2px solid ${startAppAppId ? '#10b981' : '#e2e8f0'}`,
                transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>📱</span>
                  <label style={{ 
                    display: 'block', 
                    fontWeight: '600',
                    fontSize: '1rem',
                    color: '#334155',
                    flex: 1
                  }}>
                    App <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {startAppAppId && (
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: '#10b981',
                      color: 'white'
                    }}>
                      ✓ Selected
                    </span>
                  )}
                </div>
                {!startAppAppId && (
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Choose the app you want to start for this client
                  </p>
                )}
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    ref={startAppInputRef}
                    type="text"
                    value={startAppAppSearch}
                  onChange={(e) => {
                      setStartAppAppSearch(e.target.value);
                      setShowStartAppDropdown(true);
                    }}
                    onFocus={() => setShowStartAppDropdown(true)}
                    placeholder="Search app..."
                    style={{ 
                      width: '100%', 
                      padding: '0.875rem', 
                      border: `2px solid ${startAppAppId ? '#10b981' : '#cbd5e1'}`, 
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      backgroundColor: '#fff',
                      cursor: isSavingStartApp ? 'not-allowed' : 'text',
                      transition: 'border-color 0.2s',
                      fontWeight: startAppAppId ? '500' : '400',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    disabled={isSavingStartApp}
                    onBlur={(e) => {
                      setTimeout(() => setShowStartAppDropdown(false), 200);
                    }}
                  />
                  {startAppAppId && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartAppAppId('');
                        setStartAppAppSearch('');
                        setStartAppPromotionId('');
                        setStartAppReferralLinkId('');
                      }}
                      style={{
                        position: 'absolute',
                        right: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: '#64748b',
                        padding: '0.25rem',
                        lineHeight: 1
                      }}
                  disabled={isSavingStartApp}
                >
                      ×
                    </button>
                  )}
                  {showStartAppDropdown && (() => {
                    const availableApps = Array.isArray(allApps) ? allApps.filter((app: any) => {
                      return !clientApps.some((ca: any) => ca.app_id === app.id && ca.client_id === clientId);
                    }) : [];
                    
                    const filteredApps = !startAppAppSearch.trim() 
                      ? availableApps 
                      : availableApps.filter((app: any) => 
                          app.name.toLowerCase().includes(startAppAppSearch.toLowerCase().trim())
                        );
                    
                    return filteredApps.length > 0 ? (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: '#fff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          maxHeight: '250px',
                          overflowY: 'auto',
                          zIndex: 1000,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          marginTop: '0.25rem'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {filteredApps.map((app: any) => {
                          const isSelected = startAppAppId === app.id;
                          return (
                            <div
                              key={app.id}
                              onClick={() => {
                                setStartAppAppId(app.id);
                                setStartAppAppSearch(app.name);
                                setShowStartAppDropdown(false);
                                // Don't reset promotion - useEffect will auto-select if needed
                                setStartAppReferralLinkId('');
                              }}
                              style={{
                                padding: '0.875rem',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? '#eff6ff' : '#fff',
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background-color 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = '#f8fafc';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = '#fff';
                                }
                              }}
                            >
                              <div style={{ fontWeight: isSelected ? '600' : '400', fontSize: '0.95rem' }}>
                                {app.name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : showStartAppDropdown && startAppAppSearch.trim() && filteredApps.length === 0 ? (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          backgroundColor: '#fff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '0.875rem',
                          zIndex: 1000,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          marginTop: '0.25rem',
                          fontSize: '0.95rem',
                          color: '#64748b'
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        No apps found
                      </div>
                    ) : null;
                  })()}
                </div>
                {Array.isArray(allApps) && allApps.filter((app: any) => !clientApps.some((ca: any) => ca.app_id === app.id && ca.client_id === clientId)).length === 0 && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#f59e0b', fontStyle: 'italic' }}>
                    ⚠️ All available apps have already been started for this client
                  </p>
                )}
              </div>
              
              {startAppAppId && (
                <>
                  {/* Promotion Selection */}
                  <div style={{ 
                    padding: '1.5rem', 
                    backgroundColor: startAppPromotionId ? '#fef3c7' : '#f8fafc', 
                    borderRadius: '10px',
                    border: `2px solid ${startAppPromotionId ? '#f59e0b' : '#e2e8f0'}`,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>🎁</span>
                      <label style={{ 
                        display: 'block', 
                        fontWeight: '600',
                        fontSize: '1rem',
                        color: '#334155',
                        flex: 1
                      }}>
                        Promotion <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#64748b' }}>(Optional)</span>
                      </label>
                      {startAppPromotionId && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: '#f59e0b',
                          color: 'white'
                        }}>
                          ✓ Selected
                        </span>
                      )}
                    </div>
                    {!startAppPromotionId && (
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                        Select a promotion to automatically set rewards (optional)
                      </p>
                    )}
                    {startAppPromotionId && (() => {
                      const selectedPromo = Array.isArray(allPromotions) ? allPromotions.find((p: any) => p.id === startAppPromotionId) : null;
                      return selectedPromo ? (
                        <div style={{ 
                          marginBottom: '0.75rem', 
                          padding: '0.75rem', 
                          backgroundColor: '#fff', 
                          borderRadius: '6px',
                          border: '1px solid #fde68a'
                        }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e', marginBottom: '0.25rem' }}>
                            {selectedPromo.name}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '1rem' }}>
                            <span>Client: <strong style={{ color: '#059669' }}>€{Number(selectedPromo.client_reward || 0).toFixed(2)}</strong></span>
                            <span>Us: <strong style={{ color: '#3b82f6' }}>€{Number(selectedPromo.our_reward || 0).toFixed(2)}</strong></span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                    <select
                      value={startAppPromotionId}
                      onChange={(e) => setStartAppPromotionId(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '0.875rem', 
                        border: `2px solid ${startAppPromotionId ? '#f59e0b' : '#cbd5e1'}`, 
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        backgroundColor: '#fff',
                        cursor: isSavingStartApp ? 'not-allowed' : 'pointer',
                        transition: 'border-color 0.2s',
                        fontWeight: startAppPromotionId ? '500' : '400'
                      }}
                      disabled={isSavingStartApp}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = startAppPromotionId ? '#f59e0b' : '#cbd5e1';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <option value="">No promotion</option>
                      {Array.isArray(allPromotions) && allPromotions
                        .filter((promo: any) => {
                          // Only show active promotions for the selected app
                          if (promo.app_id !== startAppAppId) return false;
                          if (promo.is_active === false) return false;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          if (promo.start_date) {
                            const startDate = new Date(promo.start_date);
                            startDate.setHours(0, 0, 0, 0);
                            if (today < startDate) return false;
                          }
                          if (promo.end_date) {
                            const endDate = new Date(promo.end_date);
                            endDate.setHours(23, 59, 59, 999);
                            if (today > endDate) return false;
                          }
                          return true;
                        })
                        .map((promo: any) => (
                          <option key={promo.id} value={promo.id}>
                            {promo.name} - Client: €{Number(promo.client_reward || 0).toFixed(2)}, Us: €{Number(promo.our_reward || 0).toFixed(2)}
                          </option>
                        ))}
                    </select>
                    {Array.isArray(allPromotions) && allPromotions.filter((p: any) => p.app_id === startAppAppId).length === 0 && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                        ℹ️ No active promotions available for this app
                      </p>
                    )}
                  </div>
                  
                  {/* Referral Link Selection */}
                  <div style={{ 
                    padding: '1.5rem', 
                    backgroundColor: (startAppReferralLinkId || startAppCustomReferralLink) ? '#eff6ff' : '#f8fafc', 
                    borderRadius: '10px',
                    border: `2px solid ${(startAppReferralLinkId || startAppCustomReferralLink) ? '#3b82f6' : '#e2e8f0'}`,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>🔗</span>
                      <label style={{ 
                        display: 'block', 
                        fontWeight: '600',
                        fontSize: '1rem',
                        color: '#334155',
                        flex: 1
                      }}>
                        Referral Link <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#64748b' }}>(Optional)</span>
                      </label>
                      {(startAppReferralLinkId || startAppCustomReferralLink) && (
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          backgroundColor: '#3b82f6',
                          color: 'white'
                        }}>
                          ✓ Set
                        </span>
                      )}
                    </div>
                    {!startAppReferralLinkId && !startAppCustomReferralLink && (
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                        Choose a referral link from the list or enter a custom one
                      </p>
                    )}
                    <select
                      value={startAppReferralLinkId}
                      onChange={(e) => {
                        setStartAppReferralLinkId(e.target.value);
                        // Clear custom referral link if a predefined one is selected
                        if (e.target.value) {
                          setStartAppCustomReferralLink('');
                        }
                      }}
                      style={{ 
                        width: '100%', 
                        padding: '0.875rem', 
                        border: `2px solid ${startAppReferralLinkId ? '#3b82f6' : '#cbd5e1'}`, 
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        backgroundColor: '#fff',
                        cursor: isSavingStartApp ? 'not-allowed' : 'pointer',
                        marginBottom: '0.75rem',
                        transition: 'border-color 0.2s',
                        fontWeight: startAppReferralLinkId ? '500' : '400'
                      }}
                      disabled={isSavingStartApp}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = startAppReferralLinkId ? '#3b82f6' : '#cbd5e1';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <option value="">No referral link</option>
                      {Array.isArray(referralLinks) && referralLinks
                        .filter((link: any) => {
                          // Only show active referral links for the selected app with remaining uses
                          if (link.app_id !== startAppAppId || !link.is_active) return false;
                          // Filter out links with 0 remaining uses
                          if (link.max_uses !== null) {
                            const remaining = link.max_uses - (link.current_uses || 0);
                            if (remaining <= 0) return false;
                          }
                          return true;
                        })
                        .map((link: any) => {
                          const accountName = link.account_name || '';
                          const code = link.code || '';
                          const url = link.normalized_url || link.url || '';
                          const remaining = link.max_uses ? `${link.max_uses - link.current_uses} remaining` : 'unlimited';
                          
                          let displayText = '';
                          if (accountName) {
                            displayText = code 
                              ? `${accountName} - ${code} - ${url} (${remaining})`
                              : `${accountName} - ${url} (${remaining})`;
                          } else {
                            displayText = code 
                              ? `${code} - ${url} (${remaining})`
                              : `${url} (${remaining})`;
                          }
                          
                          return (
                          <option key={link.id} value={link.id}>
                              {displayText}
                          </option>
                          );
                        })}
                    </select>
                    {Array.isArray(referralLinks) && referralLinks.filter((link: any) => link.app_id === startAppAppId && link.is_active).length === 0 && (
                      <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                        ℹ️ No active referral links available for this app
                      </p>
                    )}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem', 
                      margin: '0.75rem 0',
                      fontSize: '0.85rem', 
                      color: '#64748b'
                    }}>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
                      <span style={{ fontWeight: '600', padding: '0 0.5rem' }}>OR</span>
                      <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
                    </div>
                    <div>
                      <label style={{ 
                        display: 'block', 
                        marginBottom: '0.5rem', 
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        color: '#64748b'
                      }}>
                        Enter custom referral link or code
                      </label>
                    <input
                      type="text"
                      value={startAppCustomReferralLink}
                      onChange={(e) => {
                        setStartAppCustomReferralLink(e.target.value);
                        // Clear predefined referral link if custom one is entered
                        if (e.target.value) {
                          setStartAppReferralLinkId('');
                        }
                      }}
                        placeholder="e.g., https://invite.kraken.com/JDNW/abc123 or abc123"
                        style={{ 
                          width: '100%', 
                          padding: '0.875rem', 
                          border: `2px solid ${startAppCustomReferralLink ? '#3b82f6' : '#cbd5e1'}`, 
                          borderRadius: '8px',
                          fontSize: '0.95rem',
                          backgroundColor: '#fff',
                          transition: 'border-color 0.2s',
                          fontWeight: startAppCustomReferralLink ? '500' : '400'
                        }}
                      disabled={isSavingStartApp}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = startAppCustomReferralLink ? '#3b82f6' : '#cbd5e1';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
              
              {/* Initial Notes */}
              <div style={{ 
                padding: '1.5rem', 
                backgroundColor: startAppNotes ? '#fef3c7' : '#f8fafc', 
                borderRadius: '10px',
                border: `2px solid ${startAppNotes ? '#f59e0b' : '#e2e8f0'}`,
                transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>📝</span>
                  <label style={{ 
                    display: 'block', 
                    fontWeight: '600',
                    fontSize: '1rem',
                    color: '#334155',
                    flex: 1
                  }}>
                    Initial Notes <span style={{ fontSize: '0.85rem', fontWeight: '400', color: '#64748b' }}>(Optional)</span>
                  </label>
                  {startAppNotes && (
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: '#f59e0b',
                      color: 'white'
                    }}>
                      {startAppNotes.length} chars
                    </span>
                  )}
                </div>
                {!startAppNotes && (
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Add any relevant notes about this app signup (e.g., special instructions, client preferences)
                  </p>
                )}
                <textarea
                  value={startAppNotes}
                  onChange={(e) => setStartAppNotes(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '0.875rem', 
                    border: `2px solid ${startAppNotes ? '#f59e0b' : '#cbd5e1'}`, 
                    borderRadius: '8px', 
                    minHeight: '100px',
                    fontSize: '0.95rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    backgroundColor: '#fff',
                    transition: 'border-color 0.2s',
                    lineHeight: '1.5'
                  }}
                  disabled={isSavingStartApp}
                  placeholder="Add any initial notes for this app process..."
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = startAppNotes ? '#f59e0b' : '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              
              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={() => {
                    setShowStartAppForm(false);
                    setStartAppAppId('');
                    setStartAppAppSearch('');
                    setShowStartAppDropdown(false);
                    setStartAppPromotionId('');
                    setStartAppReferralLinkId('');
                    setStartAppCustomReferralLink('');
                    setStartAppNotes('');
                  }}
                  disabled={isSavingStartApp}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: isSavingStartApp ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSavingStartApp) {
                      e.currentTarget.style.backgroundColor = '#cbd5e1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#e2e8f0';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!clientId || !startAppAppId) {
                      alert('Please select an app.');
                      return;
                    }
                    
                    setIsSavingStartApp(true);
                    try {
                      // Combine notes with custom referral link if provided
                      let combinedNotes = startAppNotes.trim();
                      if (startAppCustomReferralLink.trim()) {
                        const customRefText = `Custom Referral Link/Code: ${startAppCustomReferralLink.trim()}`;
                        combinedNotes = combinedNotes 
                          ? `${combinedNotes}\n\n${customRefText}`
                          : customRefText;
                      }
                      
                      await insertClientApp({
                        client_id: clientId,
                        app_id: startAppAppId,
                        promotion_id: startAppPromotionId || null,
                        referral_link_id: startAppReferralLinkId || null,
                        status: 'requested',
                        deposited: false,
                        finished: false,
                        started_at: new Date().toISOString(), // Set started_at for deadline calculation
                        notes: combinedNotes || null
                      });
                      
                      setShowStartAppForm(false);
                      setStartAppAppId('');
                      setStartAppPromotionId('');
                      setStartAppReferralLinkId('');
                      setStartAppCustomReferralLink('');
                      setStartAppNotes('');
                      await mutateClientApps();
                      setToast({
                        isOpen: true,
                        message: 'App process started successfully!',
                        type: 'success'
                      });
                    } catch (error) {
                      console.error('Error starting app process:', error);
                      setToast({
                        isOpen: true,
                        message: 'Failed to start app process. Please try again.',
                        type: 'error'
                      });
                    } finally {
                      setIsSavingStartApp(false);
                    }
                  }}
                  disabled={isSavingStartApp || !startAppAppId}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: (isSavingStartApp || !startAppAppId) ? '#94a3b8' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (isSavingStartApp || !startAppAppId) ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    transition: 'background-color 0.2s, transform 0.1s',
                    boxShadow: (isSavingStartApp || !startAppAppId) ? 'none' : '0 2px 4px rgba(16, 185, 129, 0.2)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSavingStartApp && startAppAppId) {
                      e.currentTarget.style.backgroundColor = '#059669';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSavingStartApp && startAppAppId) {
                      e.currentTarget.style.backgroundColor = '#10b981';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {isSavingStartApp ? 'Starting...' : 'Start App Process'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {relatedApps.length > 0 ? (
          <div className="status-columns" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {relatedApps.map((item) => (
              <div key={item.id} className="status-card" style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <strong style={{ fontSize: '1.1rem' }}>{item.app?.name ?? 'Unknown app'}</strong>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <StatusBadge status={item.status} />
                    {editingAppDetailsId !== item.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                        <button
                          onClick={() => handleEditAppDetails(item)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            width: '100%',
                            minWidth: '80px'
                          }}
                          title="Edit app details"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/message-templates?appId=${item.app_id}&returnTo=/clients/${clientId}`}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#10b981',
                            color: 'white',
                            textDecoration: 'none',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            display: 'inline-block',
                            width: '100%',
                            minWidth: '80px',
                            textAlign: 'center'
                          }}
                          title="View message templates for this app"
                        >
                          View Messages
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
                
                {editingAppDetailsId === item.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>Status *</label>
                      <select
                        value={appStatus}
                        onChange={(e) => setAppStatus(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                        disabled={isSavingAppDetails}
                      >
                        <option value="requested">Requested</option>
                        <option value="registered">Registered</option>
                        <option value="deposited">Deposited</option>
                        <option value="waiting_bonus">Waiting Bonus</option>
                        <option value="completed">Completed</option>
                        <option value="paid">Paid</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>Deposit Amount (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={appDepositAmount}
                        onChange={(e) => setAppDepositAmount(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                        disabled={isSavingAppDetails}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
                        Client Profit (€)
                        {(() => {
                          const clientApp = relatedApps.find((a: any) => a.id === item.id);
                          const promotionId = clientApp?.promotion_id;
                          const promotionsArray = Array.isArray(allPromotions) ? allPromotions : [];
                          const promotion = promotionId ? promotionsArray.find((p: any) => p.id === promotionId) : null;
                          if (promotion?.client_reward) {
                            return <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '400', marginLeft: '0.5rem' }}>(from promotion: €{Number(promotion.client_reward).toFixed(2)})</span>;
                          }
                          return null;
                        })()}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={appClientProfit}
                        onChange={(e) => setAppClientProfit(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                        disabled={isSavingAppDetails}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
                        Internal Profit (€)
                        {(() => {
                          const clientApp = relatedApps.find((a: any) => a.id === item.id);
                          const promotionId = clientApp?.promotion_id;
                          const promotionsArray = Array.isArray(allPromotions) ? allPromotions : [];
                          const promotion = promotionId ? promotionsArray.find((p: any) => p.id === promotionId) : null;
                          if (promotion?.our_reward) {
                            return <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '400', marginLeft: '0.5rem' }}>(from promotion: €{Number(promotion.our_reward).toFixed(2)})</span>;
                          }
                          return null;
                        })()}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={appInternalProfit}
                        onChange={(e) => setAppInternalProfit(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                        disabled={isSavingAppDetails}
                        placeholder="0.00"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={appDeposited}
                          onChange={(e) => {
                            const newDeposited = e.target.checked;
                            setAppDeposited(newDeposited);
                            // Auto-update status based on deposited/finished flags
                            const newStatus = getAutoStatus(newDeposited, appFinished, appStatus);
                            setAppStatus(newStatus);
                          }}
                          disabled={isSavingAppDetails}
                        />
                        <span>Deposited</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={appFinished}
                          onChange={(e) => {
                            const newFinished = e.target.checked;
                            setAppFinished(newFinished);
                            // Auto-update status based on deposited/finished flags
                            const newStatus = getAutoStatus(appDeposited, newFinished, appStatus);
                            setAppStatus(newStatus);
                          }}
                          disabled={isSavingAppDetails}
                        />
                        <span>Finished</span>
                      </label>
                    </div>
                    <div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={appIsOurDeposit}
                          onChange={(e) => {
                            setAppIsOurDeposit(e.target.checked);
                            if (!e.target.checked) {
                              // If unchecking, also uncheck paid back and clear source
                              setAppDepositPaidBack(false);
                              setAppDepositSource('');
                            }
                          }}
                          disabled={isSavingAppDetails || !appDeposited}
                        />
                        <span style={{ fontWeight: '500' }}>Our Deposit</span>
                        {!appDeposited && (
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                            (requires "Deposited" to be checked)
                          </span>
                        )}
                      </label>
                    </div>
                    {appIsOurDeposit && (
                      <>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: '500' }}>
                            Deposit Source
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '400', marginLeft: '0.25rem' }}>
                              (e.g., "Luna account", "Main wallet", "Revolut card")
                            </span>
                          </label>
                          <input
                            type="text"
                            value={appDepositSource}
                            onChange={(e) => setAppDepositSource(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                            disabled={isSavingAppDetails}
                            placeholder="Where did the deposit come from?"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={appDepositPaidBack}
                              onChange={(e) => setAppDepositPaidBack(e.target.checked)}
                              disabled={isSavingAppDetails}
                            />
                            <span>Paid Back</span>
                          </label>
                        </div>
                      </>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => {
                          setDeleteModal({
                            isOpen: true,
                            type: 'clientApp',
                            id: item.id,
                            name: item.app?.name ?? 'this app'
                          });
                        }}
                        disabled={isSavingAppDetails}
                        style={{
                          padding: '0.4rem 0.75rem',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isSavingAppDetails ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          opacity: isSavingAppDetails ? 0.6 : 1
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={handleCancelAppDetailsEdit}
                        disabled={isSavingAppDetails}
                        style={{
                          padding: '0.4rem 0.75rem',
                          backgroundColor: '#e2e8f0',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isSavingAppDetails ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          opacity: isSavingAppDetails ? 0.6 : 1
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveAppDetails(item.id)}
                        disabled={isSavingAppDetails}
                        style={{
                          padding: '0.4rem 0.75rem',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: isSavingAppDetails ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          opacity: isSavingAppDetails ? 0.6 : 1
                        }}
                      >
                        {isSavingAppDetails ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#64748b' }}>
                    {item.promotion?.name && <span><strong>Promotion:</strong> {item.promotion.name}</span>}
                    {item.link && (item.link.account_name || item.link.code || item.link.url) && (
                      <span>
                        <strong>Referral link:</strong> {item.link.account_name || item.link.code || item.link.url}
                      </span>
                    )}
                    <span><strong>Deposit:</strong> €{Number(
                      item.deposit_amount ?? 
                      (item.promotion?.deposit_required ?? 0)
                    ).toFixed(2)}</span>
                    <span><strong>Client profit:</strong> €{Number(
                      item.profit_client ?? 
                      (item.promotion?.client_reward ?? 0)
                    ).toFixed(2)}</span>
                    <span><strong>Internal profit:</strong> €{Number(
                      item.profit_us ?? 
                      (item.promotion?.our_reward ?? 0)
                    ).toFixed(2)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong>Started:</strong>
                      {editingStartedAppId === item.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                          <input
                            type="date"
                            value={startedDateText}
                            onChange={(e) => setStartedDateText(e.target.value)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              fontFamily: 'inherit'
                            }}
                            disabled={isSavingStartedDate}
                          />
                          <button
                            onClick={() => handleSaveStartedDate(item.id)}
                            disabled={isSavingStartedDate}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isSavingStartedDate ? 'not-allowed' : 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              opacity: isSavingStartedDate ? 0.6 : 1
                            }}
                          >
                            {isSavingStartedDate ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingStartedAppId(null);
                              setStartedDateText('');
                            }}
                            disabled={isSavingStartedDate}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#64748b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isSavingStartedDate ? 'not-allowed' : 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              opacity: isSavingStartedDate ? 0.6 : 1
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{new Date(item.started_at || item.created_at).toLocaleDateString()}</span>
                          <button
                            onClick={() => handleEditStartedDate(item.id, item.started_at)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: '500'
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {item.deposited && <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '500' }}>✓ Deposited</span>}
                      {item.finished && <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '500' }}>✓ Finished</span>}
                    </div>
                    
                    {/* Action buttons */}
                    {item.status === 'completed' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                        <button
                          onClick={() => {
                            setDeleteModal({
                              isOpen: true,
                              type: 'markAsPaid',
                              id: item.id,
                              name: item.apps?.name || 'this app process'
                            });
                          }}
                          style={{
                            padding: '0.4rem 0.75rem',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: '500',
                            width: '100%'
                          }}
                        >
                          Mark as Paid
                        </button>
                      </div>
                    )}
                    
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <strong>Notes:</strong>
                        {editingAppId !== item.id && (
                          <button
                            onClick={() => handleEditAppNotes(item.id, item.notes)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: '500'
                            }}
                          >
                            {item.notes ? 'Edit' : 'Add'}
                          </button>
                        )}
                      </div>
                    
                    {editingAppId === item.id ? (
                      <div>
                        <textarea
                          value={appNotesText}
                          onChange={(e) => setAppNotesText(e.target.value)}
                          placeholder="Add notes about this app..."
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '0.5rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            marginBottom: '0.5rem'
                          }}
                          disabled={isSavingAppNotes}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={handleCancelAppEdit}
                            disabled={isSavingAppNotes}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#e2e8f0',
                              color: '#475569',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isSavingAppNotes ? 'not-allowed' : 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              opacity: isSavingAppNotes ? 0.6 : 1
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveAppNotes(item.id)}
                            disabled={isSavingAppNotes}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isSavingAppNotes ? 'not-allowed' : 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              opacity: isSavingAppNotes ? 0.6 : 1
                            }}
                          >
                            {isSavingAppNotes ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: item.notes ? '#64748b' : '#94a3b8', fontStyle: item.notes ? 'normal' : 'italic', whiteSpace: 'pre-wrap' }}>
                        {(() => {
                          // Remove completedSteps JSON from displayed notes
                          let displayNotes = item.notes || '';
                          displayNotes = displayNotes.replace(/\s*\{.*"completedSteps".*?\}\s*/g, '').trim();
                          return displayNotes || 'No notes added yet.';
                        })()}
                      </span>
                    )}
                  </div>
                  
                  {/* Incomplete Steps UI */}
                  {(() => {
                    // Get message templates for this app
                    const appTemplates = Array.isArray(allMessageTemplates) 
                      ? allMessageTemplates.filter((t: any) => t.app_id === item.app_id)
                      : [];
                    
                    if (appTemplates.length === 0) return null;
                    
                    // Group templates by step
                    const grouped: { [key: string]: any[] } = {};
                    const stepOrder: string[] = [];
                    
                    appTemplates.forEach((template: any) => {
                      const step = template.step || 'Other';
                      if (!grouped[step]) {
                        grouped[step] = [];
                        stepOrder.push(step);
                      }
                      grouped[step].push(template);
                    });
                    
                    // Get completed steps from completed_steps JSONB column
                    let completedSteps: Set<string> = new Set();
                    try {
                      if (item.completed_steps && Array.isArray(item.completed_steps)) {
                        completedSteps = new Set(item.completed_steps);
                      }
                    } catch (e) {
                      // Ignore parse errors
                    }
                    
                    // Filter to show only incomplete steps (when not editing)
                    const incompleteSteps = stepOrder.filter(step => !completedSteps.has(step));
                    const isEditingSteps = editingSteps.has(item.id);
                    
                    // Helper function to update step completion
                    const updateStepCompletion = async (newCompletedSteps: Set<string>) => {
                      const completedStepsArray = Array.from(newCompletedSteps);
                      
                      // Determine new status based on completed steps
                      const totalSteps = stepOrder.length;
                      const completedCount = completedStepsArray.length;
                      let newStatus = item.status;
                      
                      if (completedCount === totalSteps) {
                        // All steps completed
                        newStatus = 'completed';
                      } else if (completedCount > 0) {
                        // Some steps completed
                        if (newStatus === 'requested' || newStatus === 'registered') {
                          newStatus = 'registered';
                        } else if (newStatus === 'deposited' && completedCount >= totalSteps * 0.5) {
                          newStatus = 'waiting_bonus';
                        }
                      } else {
                        // No steps completed, revert to requested if was completed
                        if (newStatus === 'completed' && !item.finished) {
                          newStatus = 'requested';
                        }
                      }
                      
                      try {
                        await updateClientApp(
                          { 
                            completed_steps: completedStepsArray as any,
                            status: newStatus
                          } as any,
                          item.id,
                          {
                            onSuccess: () => {
                              mutateClientApps();
                            },
                            onError: (error) => {
                              console.error('Error updating step completion:', error);
                              setToast({
                                isOpen: true,
                                message: 'Failed to update step completion. Please try again.',
                                type: 'error'
                              });
                            }
                          }
                        );
                      } catch (error) {
                        console.error('Error updating step completion:', error);
                        setToast({
                          isOpen: true,
                          message: 'Failed to update step completion. Please try again.',
                          type: 'error'
                        });
                      }
                    };
                    
                    if (stepOrder.length === 0) return null;
                    
                    return (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: '600', fontSize: '0.9rem', color: isEditingSteps ? '#3b82f6' : '#dc2626' }}>
                            {isEditingSteps ? 'All Steps' : `Incomplete Steps (${incompleteSteps.length}/${stepOrder.length})`}
                          </div>
                          <button
                            onClick={() => {
                              const newEditing = new Set(editingSteps);
                              if (isEditingSteps) {
                                newEditing.delete(item.id);
                              } else {
                                newEditing.add(item.id);
                              }
                              setEditingSteps(newEditing);
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: isEditingSteps ? '#e2e8f0' : '#3b82f6',
                              color: isEditingSteps ? '#475569' : 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}
                          >
                            {isEditingSteps ? 'Done' : 'Edit Steps'}
                          </button>
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '0.5rem', 
                          maxHeight: '200px', 
                          overflowY: 'auto',
                          transition: 'all 0.2s ease-in-out'
                        }}>
                          {(isEditingSteps ? stepOrder : incompleteSteps).map((step) => {
                            const actualStepIndex = stepOrder.indexOf(step);
                            const isStepCompleted = completedSteps.has(step);
                            return (
                              <label
                                key={step}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '0.5rem',
                                  padding: '0.5rem',
                                  backgroundColor: isStepCompleted ? '#f0fdf4' : '#fef2f2',
                                  borderRadius: '4px',
                                  border: `1px solid ${isStepCompleted ? '#10b981' : '#fecaca'}`,
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  minHeight: '3rem',
                                  transition: 'all 0.2s ease-in-out',
                                  position: 'relative'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isStepCompleted}
                                  onChange={async (e) => {
                                    const newCompletedSteps = new Set(completedSteps);
                                    if (e.target.checked) {
                                      newCompletedSteps.add(step);
                                    } else {
                                      newCompletedSteps.delete(step);
                                    }
                                    await updateStepCompletion(newCompletedSteps);
                                  }}
                                  style={{ marginTop: '0.125rem', cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '500', color: isStepCompleted ? '#059669' : '#991b1b', marginBottom: '0.25rem' }}>
                                    Step {actualStepIndex + 1}: {step}
                                  </div>
                                  {grouped[step].map((template: any) => (
                                    <div key={template.id} style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
                                      {template.name}
                                    </div>
                                  ))}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No apps started"
            message="This client hasn't started any apps yet."
          />
        )}
      </section>

      {appsMissing.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>Available Apps Not Started</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {appsMissing.map((app: any) => (
              <div 
                key={app.id} 
                style={{ 
                  backgroundColor: '#fef2f2', 
                  padding: '0.75rem', 
                  borderRadius: '6px', 
                  border: '1px solid #fecaca',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <strong style={{ color: '#991b1b' }}>{app.name}</strong>
                {app.app_type && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {app.app_type}
                  </div>
                )}
                <Link
                  href={`/message-templates?appId=${app.id}&returnTo=/clients/${clientId}`}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'inline-block',
                    marginTop: '0.5rem'
                  }}
                >
                  View Messages
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>Credentials</h2>
          {!showCredentialForm && (
            <button
              onClick={() => setShowCredentialForm(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              + Add Credential
            </button>
          )}
        </div>
        
        {showCredentialForm && (
          <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{editingCredentialId ? 'Edit Credential' : 'Add New Credential'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>App *</label>
                <select
                  value={credentialAppId}
                  onChange={(e) => setCredentialAppId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingCredential}
                >
                  <option value="">Select an app</option>
                  {Array.isArray(allApps) && allApps.map((app: any) => (
                    <option key={app.id} value={app.id}>{app.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email *</label>
                <input
                  type="email"
                  value={credentialEmail}
                  onChange={(e) => setCredentialEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingCredential}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Username</label>
                <input
                  type="text"
                  value={credentialUsername}
                  onChange={(e) => setCredentialUsername(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingCredential}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Password {editingCredentialId ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  value={credentialPassword}
                  onChange={(e) => setCredentialPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingCredential}
                  placeholder={editingCredentialId ? 'Leave blank to keep current password' : ''}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Notes</label>
                <textarea
                  value={credentialNotes}
                  onChange={(e) => setCredentialNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', minHeight: '60px' }}
                  disabled={isSavingCredential}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowCredentialForm(false);
                    setEditingCredentialId(null);
                    setCredentialAppId('');
                    setCredentialEmail('');
                    setCredentialUsername('');
                    setCredentialPassword('');
                    setCredentialNotes('');
                  }}
                  disabled={isSavingCredential}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingCredential ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCredential}
                  disabled={isSavingCredential}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingCredential ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  {isSavingCredential ? 'Saving...' : editingCredentialId ? 'Update Credential' : 'Save Credential'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {clientCredentials.length ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>App</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Notes</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clientCredentials.map((credential: any) => {
                  const app = credential.apps;
                  return (
                    <tr key={credential.id}>
                      <td>{app?.name ?? '—'}</td>
                      <td>{credential.email}</td>
                      <td>{credential.username ?? '—'}</td>
                      <td>{credential.notes ?? '—'}</td>
                      <td>{new Date(credential.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => handleEditCredential(credential)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCredential(credential)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No stored credentials.</div>
        )}
      </section>

      <section style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>Debts</h2>
          {!showDebtForm && (
            <button
              onClick={() => setShowDebtForm(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              + Add Debt
            </button>
          )}
        </div>
        
        {showDebtForm && (
          <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{editingDebtId ? 'Edit Debt' : 'Add New Debt'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Referral Link *</label>
                <select
                  value={debtReferralLinkId}
                  onChange={(e) => setDebtReferralLinkId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingDebt}
                >
                  <option value="">Select a referral link</option>
                  {Array.isArray(referralLinks) && referralLinks.map((link: any) => (
                    <option key={link.id} value={link.id}>
                      {link.apps?.name ?? 'Unknown'} - {link.url}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Amount (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingDebt}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Status</label>
                <select
                  value={debtStatus}
                  onChange={(e) => setDebtStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingDebt}
                >
                  <option value="open">Open</option>
                  <option value="partial">Partial</option>
                  <option value="settled">Settled</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Debtor (Optional)</label>
                <select
                  value={debtDebtorClientId}
                  onChange={(e) => setDebtDebtorClientId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingDebt}
                >
                  <option value="">None (general debt)</option>
                  {Array.isArray(allClients) && allClients.filter((c: any) => c.id !== clientId).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.surname ?? ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Description</label>
                <textarea
                  value={debtDescription}
                  onChange={(e) => setDebtDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', minHeight: '60px' }}
                  disabled={isSavingDebt}
                  placeholder="Description of the debt..."
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowDebtForm(false);
                    setEditingDebtId(null);
                    setDebtReferralLinkId('');
                    setDebtAmount('');
                    setDebtStatus('open');
                    setDebtDescription('');
                    setDebtDebtorClientId('');
                  }}
                  disabled={isSavingDebt}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingDebt ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDebt}
                  disabled={isSavingDebt}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingDebt ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  {isSavingDebt ? 'Saving...' : editingDebtId ? 'Update Debt' : 'Save Debt'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {clientDebts.length ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Referral link</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clientDebts.map((debt: any) => {
                  const link = debt.referral_links;
                  const isDepositDebt = debt.type === 'deposit';
                  const isCreditor = debt.creditor_client_id === client.id;
                  const otherParty = isCreditor ? debt.debtor_client : debt.creditor_client;
                  return (
                    <tr key={debt.id}>
                      <td>
                        {isDepositDebt ? (
                          <>
                            <span>Debtor (Deposit)</span>
                            {debt.app && (
                              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                                App: {debt.app.name}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                        {isCreditor ? 'Creditor' : 'Debtor'}
                        {otherParty && (
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                            with {otherParty.name} {otherParty.surname ?? ''}
                          </div>
                            )}
                          </>
                        )}
                      </td>
                      <td>€{Number(debt.amount).toFixed(2)}</td>
                      <td>
                        <StatusBadge status={debt.status} />
                      </td>
                      <td>{debt.description || debt.deposit_source || '—'}</td>
                      <td>{isDepositDebt ? '—' : (link?.url ?? '—')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {!isDepositDebt && (
                            <>
                          <button
                            onClick={() => handleEditDebt(debt)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDebt(debt)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            Delete
                          </button>
                            </>
                          )}
                          {isDepositDebt && debt.status !== 'settled' && (
                            <button
                              onClick={async () => {
                                const supabase = getSupabaseClient();
                                if (supabase && debt.client_app_id) {
                                  try {
                                    await supabase
                                      .from('client_apps')
                                      .update({ 
                                        deposit_paid_back: true,
                                        deposit_paid_back_at: new Date().toISOString()
                                      } as any)
                                      .eq('id', debt.client_app_id);
                                    await mutateDepositDebts();
                                    setToast({
                                      isOpen: true,
                                      message: 'Deposit marked as paid back.',
                                      type: 'success'
                                    });
                                  } catch (error) {
                                    console.error('Error marking deposit as paid:', error);
                                    setToast({
                                      isOpen: true,
                                      message: 'Failed to mark deposit as paid.',
                                      type: 'error'
                                    });
                                  }
                                }
                              }}
                              style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.8rem'
                              }}
                            >
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No debts tracked for this client.</div>
        )}
      </section>

      <section style={{ marginTop: '2rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>Payment Links</h2>
          {!showPaymentLinkForm && (
            <button
              onClick={() => setShowPaymentLinkForm(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              + Add Payment Link
            </button>
          )}
        </div>
        
        {showPaymentLinkForm && (
          <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{editingPaymentLinkId ? 'Edit Payment Link' : 'Add New Payment Link'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Provider *</label>
                <input
                  type="text"
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingPaymentLink}
                  placeholder="e.g., SumUp, Amazon"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>URL *</label>
                <input
                  type="url"
                  value={paymentUrl}
                  onChange={(e) => setPaymentUrl(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingPaymentLink}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Amount (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingPaymentLink}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Purpose</label>
                <input
                  type="text"
                  value={paymentPurpose}
                  onChange={(e) => setPaymentPurpose(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingPaymentLink}
                  placeholder="e.g., Deposit for Revolut"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>App (Optional)</label>
                <select
                  value={paymentAppId}
                  onChange={(e) => setPaymentAppId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingPaymentLink}
                >
                  <option value="">None</option>
                  {Array.isArray(allApps) && allApps.map((app: any) => (
                    <option key={app.id} value={app.id}>{app.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowPaymentLinkForm(false);
                    setEditingPaymentLinkId(null);
                    setPaymentProvider('');
                    setPaymentUrl('');
                    setPaymentAmount('');
                    setPaymentPurpose('');
                    setPaymentAppId('');
                  }}
                  disabled={isSavingPaymentLink}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingPaymentLink ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePaymentLink}
                  disabled={isSavingPaymentLink}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingPaymentLink ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  {isSavingPaymentLink ? 'Saving...' : editingPaymentLinkId ? 'Update Payment Link' : 'Save Payment Link'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {clientPaymentLinks.length ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>URL</th>
                  <th>Amount</th>
                  <th>Purpose</th>
                  <th>Used</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clientPaymentLinks.map((link) => (
                  <tr key={link.id}>
                    <td>{link.provider}</td>
                    <td>{link.url}</td>
                    <td>€{Number(link.amount ?? 0).toFixed(2)}</td>
                    <td>{link.purpose ?? '—'}</td>
                    <td>{link.used ? 'Yes' : 'No'}</td>
                    <td>{new Date(link.created_at).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleEditPaymentLink(link)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePaymentLink(link)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">No payment link history.</div>
        )}
      </section>
      
      {/* Flag Error Form */}
      {showErrorForm ? (
        <section 
          id="flag-error-form"
          style={{ 
            marginTop: '2rem', 
            marginBottom: '2rem',
            backgroundColor: '#fff', 
            padding: '2rem', 
            borderRadius: '12px', 
            border: '3px solid #f59e0b', 
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)', 
            zIndex: 10, 
            position: 'relative'
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #fef3c7' }}>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🚩</span>
              Flag Error
            </h2>
            <button
              type="button"
              onClick={() => {
                console.log('Closing error form');
                setShowErrorForm(false);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: '#64748b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#475569'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#64748b'}
            >
              ✕ Close
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.75rem', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                color: '#1e293b'
              }}>
                Error Type <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={errorTypeInput}
                  onChange={handleErrorTypeChange}
                  onFocus={() => setShowErrorTypeDropdown(true)}
                  onBlur={() => setTimeout(() => setShowErrorTypeDropdown(false), 100)}
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem', 
                    border: errorType ? '2px solid #10b981' : '2px solid #cbd5e1', 
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    backgroundColor: '#fff',
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  disabled={isSavingError}
                  placeholder="Select or type error type"
                />
                {showErrorTypeDropdown && (filteredErrorTypes.length > 0 || errorTypeInput.trim()) && (
                  <ul style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 20,
                    maxHeight: '200px',
                    overflowY: 'auto',
                    listStyle: 'none',
                    padding: 0,
                    margin: '0.5rem 0 0 0'
                  }}>
                    {filteredErrorTypes.map((type) => (
                      <li
                        key={type.value}
                        onMouseDown={() => {
                          setErrorType(type.value);
                          setErrorTypeInput(type.label);
                          setShowErrorTypeDropdown(false);
                        }}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                          color: '#334155',
                          borderBottom: '1px solid #f1f5f9'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                      >
                        {type.label}
                      </li>
                    ))}
                    {errorTypeInput.trim() && (
                      <li
                        onMouseDown={handleAddCustomErrorType}
                        style={{
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                          color: '#3b82f6',
                          fontWeight: '600',
                          borderTop: filteredErrorTypes.length > 0 ? '1px solid #e2e8f0' : 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                      >
                        + Add custom type: "{errorTypeInput}"
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.75rem', 
                fontWeight: '600', 
                fontSize: '0.95rem',
                color: '#1e293b'
              }}>
                Severity <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={errorSeverity}
                onChange={(e) => setErrorSeverity(e.target.value as 'critical' | 'warning' | 'info')}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  border: '2px solid #cbd5e1', 
                  borderRadius: '8px',
                  fontSize: '0.95rem',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                disabled={isSavingError}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
              >
                <option value="critical">🔴 Critical</option>
                <option value="warning">🟠 Warning</option>
                <option value="info">🔵 Info</option>
              </select>
            </div>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.75rem', 
              fontWeight: '600', 
              fontSize: '0.95rem',
              color: '#1e293b'
            }}>
              Title <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={errorTitle}
              onChange={(e) => setErrorTitle(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                border: errorTitle.trim() ? '2px solid #10b981' : '2px solid #cbd5e1', 
                borderRadius: '8px',
                fontSize: '0.95rem',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              disabled={isSavingError}
              placeholder="e.g., Client failed to complete deposit"
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = errorTitle.trim() ? '#10b981' : '#cbd5e1'}
            />
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.75rem', 
              fontWeight: '600', 
              fontSize: '0.95rem',
              color: '#1e293b'
            }}>
              Description
            </label>
            <textarea
              value={errorDescription}
              onChange={(e) => setErrorDescription(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                border: '2px solid #cbd5e1', 
                borderRadius: '8px', 
                minHeight: '120px',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              disabled={isSavingError}
              placeholder="Add details about the error..."
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>
          
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.75rem', 
              fontWeight: '600', 
              fontSize: '0.95rem',
              color: '#1e293b'
            }}>
              Related App Process <span style={{ fontWeight: '400', color: '#64748b', fontSize: '0.85rem' }}>(Optional)</span>
            </label>
            <select
              value={errorClientAppId}
              onChange={(e) => setErrorClientAppId(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                border: '2px solid #cbd5e1', 
                borderRadius: '8px',
                fontSize: '0.95rem',
                backgroundColor: '#fff',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              disabled={isSavingError}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            >
              <option value="">None (general client error)</option>
              {relatedApps.map((app: any) => (
                <option key={app.id} value={app.id}>
                  {app.app?.name ?? 'Unknown'} - {app.status}
                </option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '2px solid #fef3c7' }}>
            <button
              onClick={() => {
                setShowErrorForm(false);
                setErrorType('');
                setErrorTypeInput('');
                setErrorSeverity('warning');
                setErrorTitle('');
                setErrorDescription('');
                setErrorClientAppId('');
              }}
              disabled={isSavingError}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#e2e8f0',
                color: '#475569',
                border: 'none',
                borderRadius: '8px',
                cursor: isSavingError ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => !isSavingError && (e.currentTarget.style.backgroundColor = '#cbd5e1')}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
            >
              Cancel
            </button>
            <button
              onClick={handleFlagError}
              disabled={isSavingError || !errorType || !errorTitle.trim()}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: (isSavingError || !errorType || !errorTitle.trim()) ? '#cbd5e1' : '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (isSavingError || !errorType || !errorTitle.trim()) ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600',
                transition: 'background-color 0.2s, transform 0.1s',
                boxShadow: (isSavingError || !errorType || !errorTitle.trim()) ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}
              onMouseEnter={(e) => {
                if (!isSavingError && errorType && errorTitle.trim()) {
                  e.currentTarget.style.backgroundColor = '#d97706';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = (isSavingError || !errorType || !errorTitle.trim()) ? '#cbd5e1' : '#f59e0b';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {isSavingError ? '⏳ Flagging...' : '🚩 Flag Error'}
            </button>
          </div>
        </section>
      ) : null}

      {/* All Errors Section (including resolved and cleared) - at the end for reference */}
      {Array.isArray(clientErrors) && clientErrors.length > 0 && (() => {
        // Group errors by app
        const errorsByApp: { [key: string]: any[] } = {};
        const generalErrors: any[] = [];
        
        clientErrors.forEach((error: any) => {
          const appId = error.client_app_id;
          const appName = error.client_apps?.apps?.name || 'General';
          
          if (appId) {
            const key = `${appId}_${appName}`;
            if (!errorsByApp[key]) {
              errorsByApp[key] = [];
            }
            errorsByApp[key].push(error);
          } else {
            generalErrors.push(error);
          }
        });
        
        // Add general errors as a separate group if they exist
        if (generalErrors.length > 0) {
          errorsByApp['general_General'] = generalErrors;
        }
        
        return (
          <section style={{ marginTop: '2rem', marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
                All Errors ({clientErrors.length} total, {clientErrors.filter((e: any) => !e.resolved_at && !e.cleared_at).length} active)
              </h2>
            </div>
          
          {errorsLoading ? (
            <LoadingSpinner message="Loading errors..." />
          ) : errorsError ? (
            <ErrorMessage error={errorsError} onRetry={mutateErrors} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {Object.entries(errorsByApp).map(([appKey, appErrors]) => {
                const appName = appErrors[0]?.client_apps?.apps?.name || 'General';
                const appId = appErrors[0]?.client_app_id || null;
                const activeErrors = appErrors.filter((e: any) => !e.resolved_at && !e.cleared_at);
                const hasActiveErrors = activeErrors.length > 0;
                
                return (
                  <div key={appKey} style={{ 
                    backgroundColor: '#f8fafc', 
                    padding: '1.5rem', 
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                        {appName} ({appErrors.length} total, {activeErrors.length} active)
                      </h3>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {appErrors.map((error: any) => {
                const isResolved = !!error.resolved_at;
                const isCleared = !!error.cleared_at;
                const severityColor = error.severity === 'critical' ? '#ef4444' : 
                                     error.severity === 'warning' ? '#f59e0b' : '#3b82f6';
                const appName = error.client_apps?.apps?.name || 'N/A';
                const isEditing = editingErrorId === error.id;

                return (
                  <div
                    key={error.id}
                    style={{
                      backgroundColor: isResolved || isCleared ? '#f8fafc' : '#fff',
                      padding: '1.5rem',
                      borderRadius: '8px',
                      border: `2px solid ${isResolved ? '#cbd5e1' : isCleared ? '#94a3b8' : severityColor}`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ 
                      position: 'absolute', 
                      top: '0.5rem', 
                      right: '0.5rem', 
                      zIndex: 20,
                      visibility: isCleared ? 'visible' : 'hidden',
                      opacity: isCleared ? 1 : 0,
                      transition: 'opacity 0.2s ease, visibility 0.2s ease'
                    }}>
                      <button
                        onClick={() => handleClearError(error.id, false)}
                        style={{
                          padding: '0.625rem 1.25rem',
                          backgroundColor: '#60a5fa',
                          color: 'white',
                          border: '2px solid #3b82f6',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
                          transition: 'all 0.2s ease',
                          transform: 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#3b82f6';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#60a5fa';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                        }}
                      >
                        ↻ Unclear
                      </button>
                    </div>
                    <div style={{ opacity: isResolved || isCleared ? 0.7 : 1 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '2px solid #3b82f6' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              marginBottom: '0.75rem', 
                              fontWeight: '600', 
                              fontSize: '0.95rem',
                              color: '#1e293b'
                            }}>
                              Error Type <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                              <input
                                type="text"
                                value={editingErrorTypeInput}
                                onChange={handleEditingErrorTypeChange}
                                onFocus={() => setShowEditingErrorTypeDropdown(true)}
                                onBlur={() => setTimeout(() => setShowEditingErrorTypeDropdown(false), 100)}
                                style={{ 
                                  width: '100%', 
                                  padding: '0.75rem', 
                                  border: editingErrorType ? '2px solid #10b981' : '2px solid #cbd5e1', 
                                  borderRadius: '8px',
                                  fontSize: '0.95rem',
                                  backgroundColor: '#fff',
                                  transition: 'border-color 0.2s',
                                  outline: 'none'
                                }}
                                disabled={isSavingErrorEdit}
                                placeholder="Select or type error type"
                              />
                              {showEditingErrorTypeDropdown && (filteredEditingErrorTypes.length > 0 || editingErrorTypeInput.trim()) && (
                                <ul style={{
                                  position: 'absolute',
                                  top: '100%',
                                  left: 0,
                                  right: 0,
                                  backgroundColor: '#fff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  zIndex: 20,
                                  maxHeight: '200px',
                                  overflowY: 'auto',
                                  listStyle: 'none',
                                  padding: 0,
                                  margin: '0.5rem 0 0 0'
                                }}>
                                  {filteredEditingErrorTypes.map((type) => (
                                    <li
                                      key={type.value}
                                      onMouseDown={() => {
                                        setEditingErrorType(type.value);
                                        setEditingErrorTypeInput(type.label);
                                        setShowEditingErrorTypeDropdown(false);
                                      }}
                                      style={{
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                        fontSize: '0.95rem',
                                        color: '#334155',
                                        borderBottom: '1px solid #f1f5f9'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                      {type.label}
                                    </li>
                                  ))}
                                  {editingErrorTypeInput.trim() && (
                                    <li
                                      onMouseDown={handleAddCustomEditingErrorType}
                                      style={{
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                        fontSize: '0.95rem',
                                        color: '#3b82f6',
                                        fontWeight: '600',
                                        borderTop: filteredEditingErrorTypes.length > 0 ? '1px solid #e2e8f0' : 'none'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0f2fe'}
                                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                      + Add custom type: "{editingErrorTypeInput}"
                                    </li>
                                  )}
                                </ul>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <label style={{ 
                              display: 'block', 
                              marginBottom: '0.75rem', 
                              fontWeight: '600', 
                              fontSize: '0.95rem',
                              color: '#1e293b'
                            }}>
                              Severity <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <select
                              value={editingErrorSeverity}
                              onChange={(e) => setEditingErrorSeverity(e.target.value as 'critical' | 'warning' | 'info')}
                              style={{ 
                                width: '100%', 
                                padding: '0.75rem', 
                                border: '2px solid #cbd5e1', 
                                borderRadius: '8px',
                                fontSize: '0.95rem',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                transition: 'border-color 0.2s',
                                outline: 'none'
                              }}
                              disabled={isSavingErrorEdit}
                              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                            >
                              <option value="critical">🔴 Critical</option>
                              <option value="warning">🟠 Warning</option>
                              <option value="info">🔵 Info</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '0.75rem', 
                            fontWeight: '600', 
                            fontSize: '0.95rem',
                            color: '#1e293b'
                          }}>
                            Title <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="text"
                            value={editingErrorTitle}
                            onChange={(e) => setEditingErrorTitle(e.target.value)}
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              border: editingErrorTitle.trim() ? '2px solid #10b981' : '2px solid #cbd5e1', 
                              borderRadius: '8px',
                              fontSize: '0.95rem',
                              transition: 'border-color 0.2s',
                              outline: 'none'
                            }}
                            disabled={isSavingErrorEdit}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.currentTarget.style.borderColor = editingErrorTitle.trim() ? '#10b981' : '#cbd5e1'}
                          />
                        </div>
                        
                        <div>
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '0.75rem', 
                            fontWeight: '600', 
                            fontSize: '0.95rem',
                            color: '#1e293b'
                          }}>
                            Description
                          </label>
                          <textarea
                            value={editingErrorDescription}
                            onChange={(e) => setEditingErrorDescription(e.target.value)}
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              border: '2px solid #cbd5e1', 
                              borderRadius: '8px', 
                              minHeight: '120px',
                              fontSize: '0.95rem',
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              transition: 'border-color 0.2s',
                              outline: 'none'
                            }}
                            disabled={isSavingErrorEdit}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                          />
                        </div>
                        
                        <div>
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '0.75rem', 
                            fontWeight: '600', 
                            fontSize: '0.95rem',
                            color: '#1e293b'
                          }}>
                            Related App Process <span style={{ fontWeight: '400', color: '#64748b', fontSize: '0.85rem' }}>(Optional)</span>
                          </label>
                          <select
                            value={editingErrorClientAppId}
                            onChange={(e) => setEditingErrorClientAppId(e.target.value)}
                            style={{ 
                              width: '100%', 
                              padding: '0.75rem', 
                              border: '2px solid #cbd5e1', 
                              borderRadius: '8px',
                              fontSize: '0.95rem',
                              backgroundColor: '#fff',
                              cursor: 'pointer',
                              transition: 'border-color 0.2s',
                              outline: 'none'
                            }}
                            disabled={isSavingErrorEdit}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                            onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                          >
                            <option value="">None (general client error)</option>
                            {relatedApps.map((app: any) => (
                              <option key={app.id} value={app.id}>
                                {app.app?.name ?? 'Unknown'} - {app.status}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1.5rem', borderTop: '2px solid #e2e8f0' }}>
                          <button
                            onClick={handleCancelErrorEdit}
                            disabled={isSavingErrorEdit}
                            style={{
                              padding: '0.75rem 1.5rem',
                              backgroundColor: '#e2e8f0',
                              color: '#475569',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: isSavingErrorEdit ? 'not-allowed' : 'pointer',
                              fontSize: '0.95rem',
                              fontWeight: '600',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => !isSavingErrorEdit && (e.currentTarget.style.backgroundColor = '#cbd5e1')}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveErrorEdit}
                            disabled={isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()}
                            style={{
                              padding: '0.75rem 1.5rem',
                              backgroundColor: (isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()) ? '#cbd5e1' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: (isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()) ? 'not-allowed' : 'pointer',
                              fontSize: '0.95rem',
                              fontWeight: '600',
                              transition: 'background-color 0.2s, transform 0.1s',
                              boxShadow: (isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()) ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSavingErrorEdit && editingErrorType && editingErrorTitle.trim()) {
                                e.currentTarget.style.backgroundColor = '#059669';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = (isSavingErrorEdit || !editingErrorType || !editingErrorTitle.trim()) ? '#cbd5e1' : '#10b981';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            {isSavingErrorEdit ? '⏳ Saving...' : '💾 Save Changes'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', paddingRight: '5rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                              <div
                                style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  backgroundColor: severityColor,
                                  flexShrink: 0
                                }}
                              />
                              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', textDecoration: isResolved || isCleared ? 'line-through' : 'none' }}>
                                {error.title}
                              </h3>
                              {isResolved && (
                                <span style={{
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}>
                                  ✓ Resolved
                                </span>
                              )}
                              {isCleared && !isResolved && (
                                <span style={{
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: '#64748b',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}>
                                  🗑️ Cleared
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#64748b', marginLeft: '1.75rem', marginBottom: '0.5rem' }}>
                              {error.description || 'No description provided'}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginLeft: '1.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                              <span>
                                <strong>Type:</strong> {error.error_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </span>
                              <span>
                                <strong>Severity:</strong> {error.severity.toUpperCase()}
                              </span>
                              <span>
                                <strong>App:</strong> {appName}
                              </span>
                              <span>
                                <strong>Detected:</strong> {new Date(error.detected_at).toLocaleString('it-IT')}
                              </span>
                              {isResolved && error.resolved_at && (
                                <span style={{ color: '#10b981', fontWeight: '600' }}>
                                  <strong>Resolved:</strong> {new Date(error.resolved_at).toLocaleString('it-IT')}
                                </span>
                              )}
                              {isCleared && error.cleared_at && (
                                <span style={{ color: '#64748b', fontWeight: '600' }}>
                                  <strong>Cleared:</strong> {new Date(error.cleared_at).toLocaleString('it-IT')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            {!isResolved ? (
                              <button
                                onClick={() => handleResolveError(error.id, true)}
                                style={{
                                  padding: '0.5rem 1rem',
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  fontWeight: '500'
                                }}
                              >
                                ✓ Resolve
                              </button>
                            ) : (
                              <button
                                onClick={() => handleResolveError(error.id, false)}
                                style={{
                                  padding: '0.5rem 1rem',
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  fontWeight: '500'
                                }}
                              >
                                ↻ Reopen
                              </button>
                            )}
                            {!isCleared && (
                              <button
                                onClick={() => handleClearError(error.id, true)}
                                style={{
                                  padding: '0.5rem 1rem',
                                  backgroundColor: '#64748b',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  fontWeight: '500'
                                }}
                              >
                                🗑️ Clear
                              </button>
                            )}
                            <button
                              onClick={() => handleEditError(error)}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                              }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteError(error.id)}
                              style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '500'
                              }}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    </div>
                      </div>
                    );
                  })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        );
      })()}
      
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title={getDeleteModalContent().title}
        message={getDeleteModalContent().message}
        confirmLabel={getDeleteModalContent().confirmLabel}
        cancelLabel="Cancel"
        variant={deleteModal.type === 'markAsPaid' ? 'info' : 'danger'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, type: null, id: null })}
      />
      
      <ConfirmationModal
        isOpen={clearAllModal.isOpen}
        title="Clear All Errors"
        message="Are you sure you want to clear all errors? They will be hidden from the dashboard but can still be viewed here. They will not reappear when 'Detect Errors' is run again."
        confirmLabel="Clear All"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={clearAllErrors}
        onCancel={() => setClearAllModal({ isOpen: false })}
      />
      
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ isOpen: false, message: '', type: 'success' })}
        duration={3000}
      />
    </div>
  );
}

