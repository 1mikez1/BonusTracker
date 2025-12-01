'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { LoadingSpinner } from './LoadingSpinner';
import { Toast } from '@/components/Toast';

interface NewSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialAppId?: string;
  initialClientId?: string;
  initialRequestId?: string;
  initialClientData?: {
    name?: string;
    contact?: string;
    email?: string;
  };
}

interface Client {
  id: string;
  name: string;
  surname: string | null;
  contact: string | null;
  email: string | null;
}

export function NewSignupModal({
  isOpen,
  onClose,
  onSuccess,
  initialAppId,
  initialClientId,
  initialRequestId,
  initialClientData
}: NewSignupModalProps) {
  const [step, setStep] = useState<'client' | 'app-selection'>('client');
  
  // Step 1 - Client identification fields
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [invitedByPartnerId, setInvitedByPartnerId] = useState('');
  const [invitedByPartnerSearch, setInvitedByPartnerSearch] = useState('');
  const [showInvitedByPartnerDropdown, setShowInvitedByPartnerDropdown] = useState(false);
  const [invitedByPartnerDropdownPosition, setInvitedByPartnerDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const invitedByPartnerInputRef = useRef<HTMLInputElement>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [foundExistingClient, setFoundExistingClient] = useState<Client | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Step 2 - App selection fields
  const [selectedAppId, setSelectedAppId] = useState(initialAppId || '');
  const [selectedPromotionId, setSelectedPromotionId] = useState('');
  const [selectedReferralLinkId, setSelectedReferralLinkId] = useState('');
  const [customReferralLink, setCustomReferralLink] = useState('');
  const [signupNotes, setSignupNotes] = useState('');
  const [appInvitedByClientId, setAppInvitedByClientId] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
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

  // Load all clients for search
  const {
    data: allClients,
    isLoading: clientsLoading
  } = useSupabaseData({
    table: 'clients',
    select: 'id, name, surname, contact, email'
  });

  // Load all partners for Invited By dropdown
  const {
    data: allPartners,
    mutate: mutatePartners
  } = useSupabaseData({
    table: 'client_partners',
    select: 'id, name',
    order: { column: 'name', ascending: true }
  });

  const { insert: insertPartner } = useSupabaseMutations('client_partners', undefined, mutatePartners);

  // Load apps
  const {
    data: apps,
    isLoading: appsLoading
  } = useSupabaseData({
    table: 'apps',
    filters: {
      is_active: { eq: true }
    },
    order: { column: 'name', ascending: true }
  });

  // Load promotions for selected app
  const {
    data: promotions,
    isLoading: promotionsLoading
  } = useSupabaseData({
    table: 'promotions',
    select: '*, apps(*)',
    filters: selectedAppId ? {
      app_id: { eq: selectedAppId },
      is_active: { eq: true }
    } : undefined,
    order: { column: 'name', ascending: true }
  });

  // Load referral links for selected app
  const {
    data: referralLinks,
    isLoading: referralLinksLoading
  } = useSupabaseData({
    table: 'referral_links',
    filters: selectedAppId ? {
      app_id: { eq: selectedAppId },
      is_active: { eq: true }
    } : undefined
  });

  // Convert allPartners to array
  const allPartnersArray = Array.isArray(allPartners) ? allPartners : [];

  // Filter partners for Invited By dropdown
  const filteredInvitedByPartners = useMemo(() => {
    const results: Array<{ id: string; name: string; type: 'partner' | 'new_partner'; displayName: string }> = [];
    
    // Filter partners by search term if provided
    if (invitedByPartnerSearch.trim()) {
      const searchLower = invitedByPartnerSearch.toLowerCase().trim();
      const matchingPartners = allPartnersArray
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
          name: invitedByPartnerSearch.trim(),
          type: 'new_partner' as const,
          displayName: `+ Create "${invitedByPartnerSearch.trim()}"`
        });
      }
    } else {
      // If no search, return all partners
      const allPartnersList = allPartnersArray.map((partner: any) => ({
        id: `partner_${partner.id}`,
        name: partner.name,
        type: 'partner' as const,
        displayName: partner.name
      }));
      results.push(...allPartnersList);
    }
    
    return results;
  }, [allPartnersArray, invitedByPartnerSearch]);

  // Update dropdown position when it opens
  useEffect(() => {
    if (showInvitedByPartnerDropdown && invitedByPartnerInputRef.current) {
      const rect = invitedByPartnerInputRef.current.getBoundingClientRect();
      setInvitedByPartnerDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [showInvitedByPartnerDropdown]);

  const handleSelectInvitedByPartner = async (selectedId: string, displayName: string) => {
    // Check if this is a new partner to create
    if (selectedId === 'new_partner') {
      const partnerName = displayName.replace('+ Create "', '').replace('"', '').trim();
      if (!partnerName) {
        setShowInvitedByPartnerDropdown(false);
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
              setInvitedByPartnerId(newPartner.id);
              setInvitedByPartnerSearch(partnerName);
              setShowInvitedByPartnerDropdown(false);
              // Refresh partners list
              mutatePartners();
            },
            onError: (error) => {
              console.error('Error creating partner:', error);
              setToast({
                isOpen: true,
                message: `Failed to create partner "${partnerName}". Please try again.`,
                type: 'error'
              });
              setShowInvitedByPartnerDropdown(false);
            }
          }
        );
      } catch (error: any) {
        console.error('Error creating partner:', error);
        setToast({
          isOpen: true,
          message: `Failed to create partner "${partnerName}". Please try again.`,
          type: 'error'
        });
        setShowInvitedByPartnerDropdown(false);
      }
    } else if (selectedId.startsWith('partner_')) {
      // Existing partner selection
      const partnerId = selectedId.replace('partner_', '');
      setInvitedByPartnerId(partnerId);
      setInvitedByPartnerSearch(displayName);
      setShowInvitedByPartnerDropdown(false);
    }
  };

  // Check if client_app already exists for selected client and app
  // Use match instead of filters for simple equality checks
  const {
    data: existingClientApp,
    isLoading: checkingExisting
  } = useSupabaseData({
    table: 'client_apps',
    match: selectedClient && selectedAppId ? {
      client_id: selectedClient.id,
      app_id: selectedAppId
    } : undefined,
    select: '*, apps(*), promotions(*)'
  });

  // Auto-select first promotion when app changes and promotions are loaded
  useEffect(() => {
    if (selectedAppId && promotions && Array.isArray(promotions) && promotions.length > 0) {
      // Only auto-select if no promotion is currently selected
      if (!selectedPromotionId) {
        // Select the first active promotion
        const firstActivePromotion = promotions.find((p: any) => p.is_active !== false) || promotions[0];
        if (firstActivePromotion) {
          setSelectedPromotionId(firstActivePromotion.id);
        }
      }
    } else if (selectedAppId && promotions && Array.isArray(promotions) && promotions.length === 0) {
      // Clear promotion selection if no promotions available for this app
      setSelectedPromotionId('');
    }
  }, [selectedAppId, promotions, selectedPromotionId]);

  // Mutations
  const { mutate: mutateClients } = useSupabaseData({ table: 'clients' });
  const { mutate: mutateClientApps } = useSupabaseData({ table: 'client_apps' });
  const { insert: insertClient } = useSupabaseMutations('clients', undefined, mutateClients);
  const { insert: insertClientApp } = useSupabaseMutations('client_apps', undefined, mutateClientApps);
  const { insert: insertPartnerAssignment } = useSupabaseMutations('client_partner_assignments');

  // Search for existing client by contact (exact match) or name (similar)
  const searchExistingClient = async () => {
    if ((!contact.trim() && !fullName.trim()) || !allClients) {
      setFoundExistingClient(null);
      setHasSearched(true);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    const contactValue = contact.trim();
    const clientsArray = Array.isArray(allClients) ? allClients : [];

    // Primary search: exact contact match
    let found = clientsArray.find((client: Client) => 
      client.contact && client.contact.trim() === contactValue
    );

    // Fallback: name + surname similar (if fullName is provided)
    if (!found && fullName.trim()) {
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0]?.toLowerCase() || '';
      const lastName = nameParts.slice(1).join(' ').toLowerCase() || '';

      found = clientsArray.find((client: Client) => {
        const clientName = (client.name || '').toLowerCase();
        const clientSurname = (client.surname || '').toLowerCase();
        
        // Check if first name matches and (if last name provided) surname matches
        if (clientName === firstName) {
          if (!lastName || !clientSurname) return true; // First name match, no surname to check
          return clientSurname === lastName || clientSurname.includes(lastName) || lastName.includes(clientSurname);
        }
        return false;
      });
    }

    setFoundExistingClient(found || null);
    setIsSearching(false);
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep('client');
      setFullName('');
      setContact('');
      setEmail('');
      setInvitedByPartnerId('');
      setInvitedByPartnerSearch('');
      setShowInvitedByPartnerDropdown(false);
      setSelectedClient(null);
      setFoundExistingClient(null);
      setHasSearched(false);
      setSelectedAppId(initialAppId || '');
      setSelectedPromotionId('');
      setSelectedReferralLinkId('');
      setCustomReferralLink('');
      setSignupNotes('');
      setAppInvitedByClientId('');
      setError(null);
    } else {
      // Pre-fill client data if provided
      if (initialClientData) {
        setFullName(initialClientData.name || '');
        setContact(initialClientData.contact || '');
        setEmail(initialClientData.email || '');
        // Auto-search if we have contact
        if (initialClientData.contact) {
          setTimeout(() => searchExistingClient(), 100);
        }
      }
      
      if (initialClientId && allClients) {
        // If initialClientId is provided, find and select it
        const client = (allClients as Client[]).find(c => c.id === initialClientId);
        if (client) {
          setSelectedClient(client);
          setStep('app-selection');
        }
      }
    }
  }, [isOpen, initialClientId, initialAppId, initialClientData]);

  const handleUseExistingClient = () => {
    if (foundExistingClient) {
      setSelectedClient(foundExistingClient);
      setStep('app-selection');
    }
  };

  const handleCreateOrSelectClient = async () => {
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let clientToUse: Client;

      if (foundExistingClient) {
        // Use existing client - redirect to profile
        clientToUse = foundExistingClient;
      } else {
        // Create new client
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || fullName.trim();
        const lastName = nameParts.slice(1).join(' ') || null;

        const newClient = await insertClient({
          name: firstName,
          surname: lastName,
          contact: contact.trim() || null,
          email: email.trim() || null,
          invited_by_partner_id: invitedByPartnerId.trim() || null,
          invited_by_client_id: null,
          trusted: false,
          tier_id: null
        } as any);

        clientToUse = newClient as Client;
      }

      // Redirect to client profile instead of going to step 2
      onClose();
      router.push(`/clients/${clientToUse.id}`);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create/select client');
    } finally {
      setIsSaving(false);
    }
  };


  const handleSubmit = async () => {
    if (!selectedClient) {
      setError('Please select or create a client first');
      return;
    }

    if (!selectedAppId) {
      setError('Please select an app');
      return;
    }

    // Check if client_app already exists
    const existingApp = Array.isArray(existingClientApp) && existingClientApp.length > 0 
      ? existingClientApp[0] 
      : null;

    if (existingApp) {
      const appName = (existingApp as any)?.apps?.name || 'this app';
      const currentStatus = (existingApp as any)?.status || 'unknown';
      setError(
        `This client already has a signup for ${appName} with status "${currentStatus}". ` +
        `Please edit the existing signup from the client profile page instead.`
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build notes with custom referral link if provided
      let notes = signupNotes.trim();
      if (customReferralLink.trim()) {
        notes = notes 
          ? `${notes}\n\nCustom Referral Link: ${customReferralLink.trim()}`
          : `Custom Referral Link: ${customReferralLink.trim()}`;
      }

      // If this is from a request, add that info
      if (initialRequestId) {
        notes = notes
          ? `${notes}\n\nConverted from request: ${initialRequestId}`
          : `Converted from request: ${initialRequestId}`;
      }

      // Use appInvitedByClientId if provided, otherwise fall back to invitedByPartnerId from step 1
      // Note: appInvitedByClientId is for backward compatibility, but we now use invitedByPartnerId
      const finalInvitedByPartnerId = invitedByPartnerId.trim() || null;

      // Get promotion data if a promotion is selected
      let selectedPromotion = selectedPromotionId 
        ? (promotions || []).find((p: any) => p.id === selectedPromotionId)
        : null;

      // If no promotion selected but promotions are available, use the first active one
      if (!selectedPromotion && (promotions || []).length > 0) {
        selectedPromotion = promotions[0];
        // Update the promotion_id to match
        if (selectedPromotion) {
          // Note: We don't update selectedPromotionId state here to avoid re-renders,
          // but we'll use the promotion data for financial fields
        }
      }

      // Debug: Log promotion selection
      console.log('Creating signup with:', {
        selectedPromotionId,
        selectedPromotion: selectedPromotion ? {
          id: selectedPromotion.id,
          name: selectedPromotion.name,
          deposit_required: selectedPromotion.deposit_required,
          client_reward: selectedPromotion.client_reward,
          our_reward: selectedPromotion.our_reward,
          type: typeof selectedPromotion.deposit_required
        } : null,
        allPromotions: (promotions || []).map((p: any) => ({ 
          id: p.id, 
          name: p.name,
          deposit_required: p.deposit_required,
          client_reward: p.client_reward,
          our_reward: p.our_reward
        }))
      });

      // Prepare client_app data
      const clientAppData: any = {
        client_id: selectedClient.id,
        app_id: selectedAppId,
        promotion_id: selectedPromotion ? selectedPromotion.id : (selectedPromotionId || null),
        referral_link_id: selectedReferralLinkId || null,
        invited_by_client_id: null,
        invited_by_partner_id: invitedByPartnerId || null,
        status: 'requested',
        deposited: false,
        finished: false,
        started_at: new Date().toISOString(), // Set started_at for deadline calculation
        notes: notes || null
      };

      // Auto-populate financial fields from promotion if available
      if (selectedPromotion) {
        // Convert to number and ensure proper format for numeric fields
        // Handle both string and number types from database
        const depositRequired = selectedPromotion.deposit_required 
          ? (typeof selectedPromotion.deposit_required === 'string' 
              ? parseFloat(selectedPromotion.deposit_required) 
              : Number(selectedPromotion.deposit_required))
          : 0;
        const clientReward = selectedPromotion.client_reward 
          ? (typeof selectedPromotion.client_reward === 'string' 
              ? parseFloat(selectedPromotion.client_reward) 
              : Number(selectedPromotion.client_reward))
          : 0;
        const ourReward = selectedPromotion.our_reward 
          ? (typeof selectedPromotion.our_reward === 'string' 
              ? parseFloat(selectedPromotion.our_reward) 
              : Number(selectedPromotion.our_reward))
          : 0;
        
        // Only set if values are valid numbers
        if (!isNaN(depositRequired)) {
          clientAppData.deposit_amount = depositRequired;
        }
        if (!isNaN(clientReward)) {
          clientAppData.profit_client = clientReward;
        }
        if (!isNaN(ourReward)) {
          clientAppData.profit_us = ourReward;
        }
        
        // Debug log
        console.log('Populating financial fields from promotion:', {
          promotion: selectedPromotion.name,
          deposit_required_raw: selectedPromotion.deposit_required,
          client_reward_raw: selectedPromotion.client_reward,
          our_reward_raw: selectedPromotion.our_reward,
          deposit_amount: clientAppData.deposit_amount,
          profit_client: clientAppData.profit_client,
          profit_us: clientAppData.profit_us
        });
      } else {
        console.log('No promotion available, financial fields will be null/0');
      }

      // Debug: Log final data being sent
      console.log('Final clientAppData being sent:', clientAppData);

      await insertClientApp(clientAppData);
      setIsSaving(false);
      mutateClientApps();

      const appName = (apps || []).find((a: any) => a.id === selectedAppId)?.name || 'the app';
      const clientName = `${selectedClient.name}${selectedClient.surname ? ' ' + selectedClient.surname : ''}`;
      const successMessage = `Signup created successfully for ${clientName} - ${appName}!`;

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('signupSuccessMessage', successMessage);
      }

      setToast({
        isOpen: true,
        message: successMessage,
        type: 'success'
      });

      if (onSuccess) onSuccess();

      setTimeout(() => {
        onClose();
        router.push(`/clients/${selectedClient.id}`);
      }, 1500);
    } catch (err: any) {
      setIsSaving(false);
      // Handle duplicate key error specifically
      if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
        const appName = (apps || []).find((a: any) => a.id === selectedAppId)?.name || 'this app';
        setError(
          `This client already has a signup for ${appName}. ` +
          `Please edit the existing signup from the client profile page instead.`
        );
      } else {
        setError(err.message || 'Failed to create signup');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          overflowX: 'visible',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>
            {step === 'client' ? 'Step 1: Identify Client' : 'Step 2: Select App & Details'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#64748b',
              padding: '0.25rem 0.5rem'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {step === 'client' && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Full Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Mario Rossi"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Contact <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                  (Optional - Phone, Telegram, Instagram, etc.)
                </span>
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  setHasSearched(false);
                  setFoundExistingClient(null);
                }}
                onBlur={() => {
                  if (contact.trim()) {
                    searchExistingClient();
                  }
                }}
                placeholder="+39 123 456 7890 or @telegram"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Email <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: email.trim() && email.includes('@') ? '2px solid #10b981' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Invited By <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  ref={invitedByPartnerInputRef}
                  type="text"
                  value={invitedByPartnerSearch}
                  onChange={(e) => {
                    setInvitedByPartnerSearch(e.target.value);
                    setShowInvitedByPartnerDropdown(true);
                    // Clear selected partner if search doesn't match
                    if (invitedByPartnerId) {
                      const selectedPartner = allPartnersArray.find((p: any) => p.id === invitedByPartnerId);
                      if (selectedPartner) {
                        if (selectedPartner.name.toLowerCase() !== e.target.value.toLowerCase()) {
                          setInvitedByPartnerId('');
                        }
                      }
                    }
                  }}
                  onFocus={() => setShowInvitedByPartnerDropdown(true)}
                  placeholder="Search partner..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: `2px solid ${invitedByPartnerId ? '#10b981' : '#cbd5e1'}`,
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    backgroundColor: '#fff',
                    cursor: 'text',
                    transition: 'border-color 0.2s',
                    outline: 'none',
                    fontWeight: invitedByPartnerId ? '500' : '400',
                    boxSizing: 'border-box'
                  }}
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => setShowInvitedByPartnerDropdown(false), 200);
                  }}
                />
                {invitedByPartnerId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInvitedByPartnerId('');
                      setInvitedByPartnerSearch('');
                      setShowInvitedByPartnerDropdown(false);
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
                  >
                    ×
                  </button>
                )}
                {showInvitedByPartnerDropdown && filteredInvitedByPartners.length > 0 && (
                  <div
                    style={{
                      position: 'fixed',
                      top: `${invitedByPartnerDropdownPosition.top}px`,
                      left: `${invitedByPartnerDropdownPosition.left}px`,
                      width: `${invitedByPartnerDropdownPosition.width}px`,
                      backgroundColor: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 10001
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {filteredInvitedByPartners.map((item: any) => {
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectInvitedByPartner(item.id, item.displayName)}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
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

            {/* Show search results */}
            {isSearching && (
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '6px', textAlign: 'center' }}>
                <LoadingSpinner />
                <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>Searching for existing client...</div>
              </div>
            )}

            {hasSearched && !isSearching && foundExistingClient && (
              <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                borderRadius: '6px',
                border: '1px solid #10b981'
              }}>
                <div style={{ fontWeight: 600, color: '#059669', marginBottom: '0.5rem' }}>
                  ✓ Cliente esistente trovato
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 500 }}>
                    {foundExistingClient.name} {foundExistingClient.surname || ''}
                  </div>
                  {foundExistingClient.contact && (
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
                      📞 {foundExistingClient.contact}
                    </div>
                  )}
                  {foundExistingClient.email && (
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      ✉️ {foundExistingClient.email}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleUseExistingClient}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  Usa questo cliente
                </button>
              </div>
            )}

            {hasSearched && !isSearching && !foundExistingClient && contact.trim() && (
              <div style={{
                marginBottom: '1rem',
                padding: '1rem',
                backgroundColor: '#fef3c7',
                borderRadius: '6px',
                border: '1px solid #fbbf24',
                fontSize: '0.875rem',
                color: '#92400e'
              }}>
                Nessun cliente trovato, verrà creato un nuovo profilo cliente.
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={onClose}
                disabled={isSaving}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#475569',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrSelectClient}
                disabled={isSaving || !fullName.trim()}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isSaving || !fullName.trim() || !contact.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  opacity: isSaving || !fullName.trim() || !contact.trim() ? 0.6 : 1
                }}
              >
                {isSaving ? 'Processing...' : 'Avanti'}
              </button>
            </div>
          </div>
        )}

        {step === 'app-selection' && selectedClient && (
          <div>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', color: '#059669', marginBottom: '0.25rem' }}>Selected Client:</div>
              <div style={{ fontWeight: 500 }}>
                {selectedClient.name} {selectedClient.surname || ''}
              </div>
              {selectedClient.contact && (
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📞 {selectedClient.contact}</div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                App <span style={{ color: '#ef4444' }}>*</span>
              </label>
              {appsLoading ? (
                <LoadingSpinner />
              ) : (
                <select
                  value={selectedAppId}
                  onChange={(e) => {
                    setSelectedAppId(e.target.value);
                    // Clear promotion and referral link when app changes
                    // They will be auto-selected by useEffect if available
                    setSelectedPromotionId('');
                    setSelectedReferralLinkId('');
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">Select an app...</option>
                  {(apps || []).map((app: any) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedAppId && (
              <>
                {/* Show warning if client_app already exists */}
                {checkingExisting ? (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', textAlign: 'center' }}>
                    <LoadingSpinner />
                    <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>Checking for existing signup...</div>
                  </div>
                ) : (() => {
                  // Only show warning if existingClientApp matches the currently selected app
                  const existingApp = Array.isArray(existingClientApp) && existingClientApp.length > 0 
                    ? existingClientApp[0] 
                    : null;
                  const existingAppId = existingApp ? (existingApp as any)?.app_id : null;
                  
                  // Only show if the existing app matches the selected app
                  if (existingApp && existingAppId === selectedAppId) {
                    return (
                      <div style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        backgroundColor: '#fef3c7',
                        borderRadius: '6px',
                        border: '1px solid #fbbf24',
                        fontSize: '0.875rem',
                        color: '#92400e'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                          ⚠️ Existing Signup Found
                        </div>
                        <div>
                          This client already has a signup for {(existingApp as any)?.apps?.name || 'this app'} 
                          {' '}with status "{(existingApp as any)?.status || 'unknown'}".
                        </div>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                          Please edit the existing signup from the client profile page instead of creating a new one.
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Promotion (Optional but recommended)
                  </label>
                  {promotionsLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <select
                      value={selectedPromotionId}
                      onChange={(e) => setSelectedPromotionId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="">No promotion</option>
                      {promotions && Array.isArray(promotions) && promotions.length > 0 ? (
                        promotions.map((promo: any) => (
                          <option key={promo.id} value={promo.id}>
                            {promo.name} (Client: €{Number(promo.client_reward || 0).toFixed(2)}, Us: €{Number(promo.our_reward || 0).toFixed(2)})
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          {selectedAppId ? 'No active promotions available for this app' : 'Select an app first'}
                        </option>
                      )}
                    </select>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Referral Link (Optional)
                  </label>
                  {referralLinksLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <select
                        value={selectedReferralLinkId}
                        onChange={(e) => {
                          setSelectedReferralLinkId(e.target.value);
                          if (e.target.value) setCustomReferralLink('');
                        }}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          marginBottom: '0.5rem'
                        }}
                      >
                        <option value="">No referral link</option>
                        {(referralLinks || [])
                          .filter((link: any) => {
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
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', textAlign: 'center' }}>OR</div>
                      <input
                        type="text"
                        value={customReferralLink}
                        onChange={(e) => {
                          setCustomReferralLink(e.target.value);
                          if (e.target.value) setSelectedReferralLinkId('');
                        }}
                        placeholder="Custom referral link or code"
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '0.875rem'
                        }}
                      />
                    </>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Invited By (Client ID) <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'normal' }}>(Optional - overrides Step 1)</span>
                  </label>
                  <input
                    type="text"
                    value={appInvitedByClientId}
                    onChange={(e) => setAppInvitedByClientId(e.target.value)}
                    placeholder="UUID of the client who invited this person"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Notes (Optional)
                  </label>
                  <textarea
                    value={signupNotes}
                    onChange={(e) => setSignupNotes(e.target.value)}
                    placeholder="Additional notes about this signup..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setStep('client')}
                disabled={isSaving}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#475569',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  opacity: isSaving ? 0.6 : 1
                }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                  disabled={Boolean(
                    isSaving || 
                    !selectedAppId || 
                    checkingExisting ||
                    (() => {
                      // Only disable if existingClientApp matches the currently selected app
                      const existingApp = Array.isArray(existingClientApp) && existingClientApp.length > 0 
                        ? existingClientApp[0] 
                        : null;
                      const existingAppId = existingApp ? (existingApp as any)?.app_id : null;
                      return !!(existingApp && existingAppId === selectedAppId);
                    })()
                  )}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (() => {
                    const existingApp = Array.isArray(existingClientApp) && existingClientApp.length > 0 
                      ? existingClientApp[0] 
                      : null;
                    const existingAppId = existingApp ? (existingApp as any)?.app_id : null;
                    return (
                      isSaving || 
                      !selectedAppId || 
                      checkingExisting ||
                      (existingApp && existingAppId === selectedAppId)
                    ) ? 'not-allowed' : 'pointer';
                  })(),
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  opacity: (() => {
                    const existingApp = Array.isArray(existingClientApp) && existingClientApp.length > 0 
                      ? existingClientApp[0] 
                      : null;
                    const existingAppId = existingApp ? (existingApp as any)?.app_id : null;
                    return (
                      isSaving || 
                      !selectedAppId || 
                      checkingExisting ||
                      (existingApp && existingAppId === selectedAppId)
                    ) ? 0.6 : 1;
                  })()
                }}
              >
                {isSaving ? 'Creating...' : 
                 checkingExisting ? 'Checking...' :
                 (() => {
                   const existingApp = Array.isArray(existingClientApp) && existingClientApp.length > 0 
                     ? existingClientApp[0] 
                     : null;
                   const existingAppId = existingApp ? (existingApp as any)?.app_id : null;
                   return (existingApp && existingAppId === selectedAppId) 
                     ? 'Signup Already Exists' 
                     : 'Create Signup';
                 })()}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Toast notification */}
      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
        duration={toast.type === 'success' ? 3000 : 5000}
      />
    </div>
  );
}
