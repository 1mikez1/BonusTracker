'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
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
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [appNotesText, setAppNotesText] = useState('');
  const [isSavingAppNotes, setIsSavingAppNotes] = useState(false);
  const [editingAppDetailsId, setEditingAppDetailsId] = useState<string | null>(null);
  
  // App details edit form fields
  const [appStatus, setAppStatus] = useState('');
  const [appDepositAmount, setAppDepositAmount] = useState('');
  const [appClientProfit, setAppClientProfit] = useState('');
  const [appInternalProfit, setAppInternalProfit] = useState('');
  const [appDeposited, setAppDeposited] = useState(false);
  const [appFinished, setAppFinished] = useState(false);
  const [isSavingAppDetails, setIsSavingAppDetails] = useState(false);
  
  // Forms state
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [showPaymentLinkForm, setShowPaymentLinkForm] = useState(false);
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingPaymentLinkId, setEditingPaymentLinkId] = useState<string | null>(null);
  
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
  const [startAppPromotionId, setStartAppPromotionId] = useState('');
  const [startAppReferralLinkId, setStartAppReferralLinkId] = useState('');
  const [startAppCustomReferralLink, setStartAppCustomReferralLink] = useState('');
  const [startAppNotes, setStartAppNotes] = useState('');
  const [isSavingStartApp, setIsSavingStartApp] = useState(false);
  
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
    data: debts,
    isLoading: debtsLoading,
    error: debtsError,
    mutate: mutateDebts
  } = useSupabaseData({
    table: 'referral_link_debts',
    select: '*, referral_links(*)'
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
  
  const { insert: insertCredential, mutate: updateCredential, remove: removeCredential } = useSupabaseMutations('credentials', undefined, mutateCredentials);
  const { insert: insertDebt, mutate: updateDebt, remove: removeDebt } = useSupabaseMutations('referral_link_debts', undefined, mutateDebts);
  const { insert: insertPaymentLink, mutate: updatePaymentLink, remove: removePaymentLink } = useSupabaseMutations('payment_links', undefined, mutatePaymentLinks);
  const { insert: insertClientApp, remove: removeClientApp } = useSupabaseMutations('client_apps', undefined, mutateClientApps);

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

  const isLoading = clientsLoading || appsLoading || debtsLoading || credentialsLoading || paymentLinksLoading || allAppsLoading || promotionsLoading || allMessageTemplatesLoading;
  const error = clientsError || appsError || debtsError || credentialsError || paymentLinksError;

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
      setClientInvitedBy(client.invited_by_client_id || '');
    }
  }, [client, isEditingClientInfo]);
  
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
      setClientInvitedBy(client.invited_by_client_id || '');
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
        invited_by_client_id: clientInvitedBy || null
      };
      
      await updateClient(updateData, clientId, {
        onSuccess: () => {
          setIsEditingClientInfo(false);
          setIsSavingClientInfo(false);
          mutateClients();
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
      setClientInvitedBy(client.invited_by_client_id || '');
      setIsEditingClientInfo(false);
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
        finished: appFinished
      };
      
      if (appDepositAmount) {
        updateData.deposit_amount = parseFloat(appDepositAmount);
      }
      
      // Set profits (from form or promotion)
      if (clientReward !== null) {
        updateData.profit_client = clientReward;
      }
      if (ourReward !== null) {
        updateData.profit_us = ourReward;
      }
      
      await updateClientApp(updateData, appId, {
        onSuccess: () => {
          setEditingAppDetailsId(null);
          setAppStatus('');
          setAppDepositAmount('');
          setAppClientProfit('');
          setAppInternalProfit('');
          setAppDeposited(false);
          setAppFinished(false);
          setIsSavingAppDetails(false);
          mutateClientApps();
        },
        onError: (error) => {
          console.error('Error updating app details:', error);
          alert('Failed to update app details. Please try again.');
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
          mutateDebts();
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
        status: debtStatus,
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
            mutateDebts();
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
            mutateDebts();
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
            setToast({
              isOpen: true,
              message: 'Failed to delete client profile. Please try again.',
              type: 'error'
            });
            setDeleteModal({ isOpen: false, type: null, id: null });
          }
        });
      } catch (error) {
        console.error('Error deleting client:', error);
        setToast({
          isOpen: true,
          message: 'Failed to delete client profile. Please try again.',
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
        amount: paymentAmount || null,
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
  const invitedBy = (client as any).clients;

  // Ensure all data arrays are actually arrays
  const clientAppsArray = Array.isArray(clientApps) ? clientApps : [];
  const debtsArray = Array.isArray(debts) ? debts : [];
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

  const allClientsArray = Array.isArray(allClients) ? allClients : [];
  const clientDebts = debtsArray
    .filter((debt: any) => debt?.creditor_client_id === client.id || debt?.debtor_client_id === client.id)
    .map((debt: any) => {
      // Resolve creditor and debtor from allClients array
      const creditor = allClientsArray.find((c: any) => c?.id === debt?.creditor_client_id);
      const debtor = debt?.debtor_client_id 
        ? allClientsArray.find((c: any) => c?.id === debt?.debtor_client_id)
        : null;
      return {
        ...debt,
        creditor_client: creditor,
        debtor_client: debtor
      };
    });
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Name *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingClientInfo}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Surname</label>
                <input
                  type="text"
                  value={clientSurname}
                  onChange={(e) => setClientSurname(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingClientInfo}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Contact</label>
                <input
                  type="text"
                  value={clientContact}
                  onChange={(e) => setClientContact(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingClientInfo}
                  placeholder="Telegram/WhatsApp/Phone"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingClientInfo}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clientTrusted}
                    onChange={(e) => setClientTrusted(e.target.checked)}
                    disabled={isSavingClientInfo}
                  />
                  <span style={{ fontWeight: '500' }}>Trusted Client</span>
                </label>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Tier</label>
                <select
                  value={clientTierId}
                  onChange={(e) => setClientTierId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingClientInfo}
                >
                  <option value="">None</option>
                  {Array.isArray(tiers) && tiers.map((tier: any) => (
                    <option key={tier.id} value={tier.id}>{tier.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Invited By</label>
                <select
                  value={clientInvitedBy}
                  onChange={(e) => setClientInvitedBy(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingClientInfo}
                >
                  <option value="">None</option>
                  {Array.isArray(allClients) && allClients
                    .filter((c: any) => c.id !== clientId)
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {`${c.name} ${c.surname ?? ''}`.trim()}
                      </option>
                    ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  onClick={handleCancelClientInfoEdit}
                  disabled={isSavingClientInfo}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingClientInfo ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    opacity: isSavingClientInfo ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveClientInfo}
                  disabled={isSavingClientInfo || !clientName.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (isSavingClientInfo || !clientName.trim()) ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    opacity: (isSavingClientInfo || !clientName.trim()) ? 0.6 : 1
                  }}
                >
                  {isSavingClientInfo ? 'Saving...' : 'Save'}
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
                <span>{invitedBy ? `${invitedBy.name} ${invitedBy.surname ?? ''}`.trim() : '—'}</span>
              </div>
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
          <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Start New App Process</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>App *</label>
                <select
                  value={startAppAppId}
                  onChange={(e) => {
                    setStartAppAppId(e.target.value);
                    setStartAppPromotionId(''); // Reset promotion when app changes
                    setStartAppReferralLinkId(''); // Reset referral link when app changes
                  }}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                  disabled={isSavingStartApp}
                >
                  <option value="">Select an app</option>
                  {Array.isArray(allApps) && allApps
                    .filter((app: any) => {
                      // Only show apps that don't have an existing client_app for this client
                      return !clientApps.some((ca: any) => ca.app_id === app.id && ca.client_id === clientId);
                    })
                    .map((app: any) => (
                      <option key={app.id} value={app.id}>{app.name}</option>
                    ))}
                </select>
              </div>
              
              {startAppAppId && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Promotion (Optional)</label>
                    <select
                      value={startAppPromotionId}
                      onChange={(e) => setStartAppPromotionId(e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      disabled={isSavingStartApp}
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
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Referral Link (Optional)</label>
                    <select
                      value={startAppReferralLinkId}
                      onChange={(e) => {
                        setStartAppReferralLinkId(e.target.value);
                        // Clear custom referral link if a predefined one is selected
                        if (e.target.value) {
                          setStartAppCustomReferralLink('');
                        }
                      }}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '0.5rem' }}
                      disabled={isSavingStartApp}
                    >
                      <option value="">No referral link</option>
                      {Array.isArray(referralLinks) && referralLinks
                        .filter((link: any) => {
                          // Only show active referral links for the selected app
                          return link.app_id === startAppAppId && link.is_active;
                        })
                        .map((link: any) => (
                          <option key={link.id} value={link.id}>
                            {link.url} {link.max_uses ? `(${link.max_uses - link.current_uses} remaining)` : '(unlimited)'}
                          </option>
                        ))}
                    </select>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem', textAlign: 'center' }}>OR</div>
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
                      placeholder="Enter custom referral link or code"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      disabled={isSavingStartApp}
                    />
                  </div>
                </>
              )}
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Initial Notes (Optional)</label>
                <textarea
                  value={startAppNotes}
                  onChange={(e) => setStartAppNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', minHeight: '60px' }}
                  disabled={isSavingStartApp}
                  placeholder="Add any initial notes for this app process..."
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowStartAppForm(false);
                    setStartAppAppId('');
                    setStartAppPromotionId('');
                    setStartAppReferralLinkId('');
                    setStartAppCustomReferralLink('');
                    setStartAppNotes('');
                  }}
                  disabled={isSavingStartApp}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#e2e8f0',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isSavingStartApp ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
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
                    padding: '0.5rem 1rem',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: (isSavingStartApp || !startAppAppId) ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    opacity: (isSavingStartApp || !startAppAppId) ? 0.6 : 1
                  }}
                >
                  {isSavingStartApp ? 'Starting...' : 'Start Process'}
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
                    {item.link?.url && <span><strong>Referral link:</strong> {item.link.url}</span>}
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
                    <span><strong>Started:</strong> {new Date(item.created_at).toLocaleDateString()}</span>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
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
                                  fontSize: '0.85rem'
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
                  const isCreditor = debt.creditor_client_id === client.id;
                  const otherParty = isCreditor ? debt.debtor_client : debt.creditor_client;
                  return (
                    <tr key={debt.id}>
                      <td>
                        {isCreditor ? 'Creditor' : 'Debtor'}
                        {otherParty && (
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                            with {otherParty.name} {otherParty.surname ?? ''}
                          </div>
                        )}
                      </td>
                      <td>€{Number(debt.amount).toFixed(2)}</td>
                      <td>
                        <StatusBadge status={debt.status} />
                      </td>
                      <td>{debt.description ?? '—'}</td>
                      <td>{link?.url ?? '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
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

