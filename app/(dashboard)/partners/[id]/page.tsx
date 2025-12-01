'use client';

import React, { useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SectionHeader } from '@/components/SectionHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { useSupabaseMutations } from '@/lib/useSupabaseMutations';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Toast } from '@/components/Toast';
import {
  buildPartnerBreakdown,
  buildMonthlySeries,
  calculatePartnerBalance,
  filterAssignmentsByPartner
} from '@/lib/partners';
import type { ClientPartner, ClientPartnerAssignment, PartnerPayment } from '@/types/partners';
import type { ClientAppRow } from '@/lib/partners';

export default function PartnerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const partnerId = params?.id;
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showAssignClientModal, setShowAssignClientModal] = useState(false);
  const [showEditPartnerModal, setShowEditPartnerModal] = useState(false);
  const [showRemoveClientModal, setShowRemoveClientModal] = useState<{ isOpen: boolean; clientId: string | null; clientName: string }>({
    isOpen: false,
    clientId: null,
    clientName: ''
  });
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  
  // Edit payment state
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PartnerPayment | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentNote, setEditPaymentNote] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [isSubmittingEditPayment, setIsSubmittingEditPayment] = useState(false);

  // Edit partner form state
  const [partnerName, setPartnerName] = useState('');
  const [partnerContactInfo, setPartnerContactInfo] = useState('');
  const [partnerSplitPartner, setPartnerSplitPartner] = useState('');
  const [partnerSplitOwner, setPartnerSplitOwner] = useState('');
  const [partnerNotes, setPartnerNotes] = useState('');
  const [isSubmittingPartner, setIsSubmittingPartner] = useState(false);

  // Assign client form state
  const [assignClientSearch, setAssignClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showAssignClientDropdown, setShowAssignClientDropdown] = useState(false);
  const assignClientInputRef = useRef<HTMLInputElement>(null);

  // Clients table filter/sort state
  const [clientTableSearch, setClientTableSearch] = useState('');
  const [clientTableSortColumn, setClientTableSortColumn] = useState<'client' | 'totalProfit' | 'partnerShare' | 'ownerShare' | 'split'>('client');
  const [clientTableSortDirection, setClientTableSortDirection] = useState<'asc' | 'desc'>('asc');

  const {
    data: partners,
    isLoading: partnerLoading,
    error: partnerError,
    mutate: mutatePartners
  } = useSupabaseData({
    table: 'client_partners',
    match: { id: partnerId }
  });

  const {
    data: assignments,
    isLoading: assignmentsLoading,
    mutate: mutateAssignments
  } = useSupabaseData({
    table: 'client_partner_assignments',
    select: '*, clients(*)'
  });

  const {
    data: clientApps,
    isLoading: appsLoading,
    mutate: mutateClientApps
  } = useSupabaseData({
    table: 'client_apps',
    select: 'id, client_id, app_id, profit_us, status, completed_at, created_at, apps(*)'
  });

  const {
    data: appPayments,
    isLoading: appPaymentsLoading,
    mutate: mutateAppPayments
  } = useSupabaseData({
    table: 'partner_payments_by_client_app',
    match: partnerId ? { partner_id: partnerId } : undefined
  } as any);

  const {
    data: payments,
    isLoading: paymentsLoading,
    mutate: mutatePayments
  } = useSupabaseData({
    table: 'partner_payments',
    match: { partner_id: partnerId }
  });

  const { data: allClients } = useSupabaseData({
    table: 'clients',
    select: 'id, name, surname',
    order: { column: 'name', ascending: true }
  });

  // Convert allClients to array
  const allClientsArray = Array.isArray(allClients) ? allClients : [];

  const { insert: insertPayment, mutate: updatePayment, remove: deletePayment } = useSupabaseMutations('partner_payments', undefined, mutatePayments);
  const { insert: insertAppPayment, remove: deleteAppPayment } = useSupabaseMutations('partner_payments_by_client_app' as any, undefined, mutateAppPayments);
  const { insert: insertAssignment, remove: deleteAssignment } = useSupabaseMutations('client_partner_assignments', undefined, mutateAssignments);
  const { mutate: updatePartner } = useSupabaseMutations('client_partners', undefined, mutatePartners);

  const isLoading = partnerLoading || assignmentsLoading || appsLoading || paymentsLoading || appPaymentsLoading;

  const partner = (partners as ClientPartner[] | undefined)?.[0];

  const partnerAssignments = useMemo(
    () => filterAssignmentsByPartner(assignments as ClientPartnerAssignment[] | undefined, partnerId ?? ''),
    [assignments, partnerId]
  );

  // Filter clients for Assign Client dropdown (exclude already assigned)
  // Must be defined after partnerAssignments
  const filteredAssignClients = useMemo(() => {
    const availableClients = allClientsArray.filter((client: any) => 
      !partnerAssignments.some((a: any) => a.client_id === client.id)
    );

    if (!assignClientSearch.trim()) {
      return availableClients.map((client: any) => ({
        id: client.id,
        name: client.name,
        surname: client.surname || '',
        displayName: `${client.name} ${client.surname || ''}`.trim()
      }));
    }

    const searchLower = assignClientSearch.toLowerCase().trim();
    return availableClients
      .filter((client: any) => {
        const fullName = `${client.name} ${client.surname || ''}`.trim().toLowerCase();
        return fullName.includes(searchLower) || client.name.toLowerCase().includes(searchLower);
      })
      .map((client: any) => ({
        id: client.id,
        name: client.name,
        surname: client.surname || '',
        displayName: `${client.name} ${client.surname || ''}`.trim()
      }));
  }, [allClientsArray, partnerAssignments, assignClientSearch]);

  const breakdown = useMemo(() => {
    if (!partner || !partnerAssignments || !clientApps) return [];
    return buildPartnerBreakdown({
      partner,
      assignments: partnerAssignments,
      clientApps: clientApps as ClientAppRow[]
    });
  }, [partner, partnerAssignments, clientApps]);

  // Filter and sort breakdown for clients table
  const filteredAndSortedBreakdown = useMemo(() => {
    if (!breakdown || breakdown.length === 0) return [];
    
    // Filter by search
    let filtered = breakdown;
    if (clientTableSearch.trim()) {
      const searchLower = clientTableSearch.toLowerCase().trim();
      filtered = breakdown.filter((row) => {
        const assignment = partnerAssignments.find(a => a.client_id === row.clientId);
        const clientFromAssignment = assignment?.client;
        const clientFromList = Array.isArray(allClients) ? allClients.find((c: any) => c.id === row.clientId) : null;
        const clientName = clientFromAssignment?.name || clientFromList?.name || row.clientName;
        const clientSurname = clientFromAssignment?.surname || clientFromList?.surname || '';
        const fullClientName = `${clientName}${clientSurname ? ' ' + clientSurname : ''}`.trim().toLowerCase();
        return fullClientName.includes(searchLower);
      });
    }

    // Sort
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (clientTableSortColumn === 'client') {
        const assignmentA = partnerAssignments.find(pa => pa.client_id === a.clientId);
        const assignmentB = partnerAssignments.find(pa => pa.client_id === b.clientId);
        const clientA = assignmentA?.client || (Array.isArray(allClients) ? allClients.find((c: any) => c.id === a.clientId) : null);
        const clientB = assignmentB?.client || (Array.isArray(allClients) ? allClients.find((c: any) => c.id === b.clientId) : null);
        const nameA = `${clientA?.name || a.clientName} ${clientA?.surname || ''}`.trim().toLowerCase();
        const nameB = `${clientB?.name || b.clientName} ${clientB?.surname || ''}`.trim().toLowerCase();
        aVal = nameA;
        bVal = nameB;
      } else {
        aVal = (a as any)[clientTableSortColumn];
        bVal = (b as any)[clientTableSortColumn];
      }

      if (aVal < bVal) return clientTableSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return clientTableSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [breakdown, partnerAssignments, allClients, clientTableSearch, clientTableSortColumn, clientTableSortDirection]);

  const handleClientTableSort = (column: 'client' | 'totalProfit' | 'partnerShare' | 'ownerShare' | 'split') => {
    if (clientTableSortColumn === column) {
      setClientTableSortDirection(clientTableSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setClientTableSortColumn(column);
      setClientTableSortDirection('asc');
    }
  };

  const balance = useMemo(() => {
    if (!partner || !partnerAssignments || !clientApps || !payments) {
      return {
        partnerId: partnerId ?? '',
        totalProfit: 0,
        partnerShare: 0,
        ownerShare: 0,
        totalPaid: 0,
        balance: 0
      };
    }
    return calculatePartnerBalance({
      partner,
      assignments: partnerAssignments,
      clientApps: clientApps as ClientAppRow[],
      payments: payments as PartnerPayment[]
    });
  }, [partner, partnerAssignments, clientApps, payments, partnerId]);

  const monthlySeries = useMemo(() => {
    if (!clientApps) return [];
    return buildMonthlySeries(breakdown, clientApps as ClientAppRow[]);
  }, [breakdown, clientApps]);

  const handleAddPayment = async () => {
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setToast({ isOpen: true, message: 'Please enter a valid amount', type: 'error' });
      return;
    }
    if (!partnerId) return;

    setIsSubmittingPayment(true);
    try {
      await insertPayment(
        {
          partner_id: partnerId,
          amount,
          note: paymentNote || null,
          paid_at: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString()
        },
        {
          onSuccess: () => {
            mutatePayments();
            setPaymentAmount('');
            setPaymentNote('');
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setShowPaymentForm(false);
            setToast({ isOpen: true, message: 'Payment recorded successfully', type: 'success' });
          },
          onError: () => {
            setToast({ isOpen: true, message: 'Failed to record payment', type: 'error' });
          }
        }
      );
    } catch (error) {
      setToast({ isOpen: true, message: 'Failed to record payment', type: 'error' });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const toggleClientExpanded = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const toggleAppSelection = (clientAppId: string) => {
    setSelectedApps(prev => {
      const next = new Set(prev);
      if (next.has(clientAppId)) {
        next.delete(clientAppId);
      } else {
        next.add(clientAppId);
      }
      return next;
    });
  };

  const toggleAllClientApps = (clientId: string, clientCompletedApps: any[]) => {
    // Get all unpaid app IDs for this client
    const unpaidAppIds = clientCompletedApps
      .filter((app: any) => {
        const appPayment = (appPayments && Array.isArray(appPayments)) 
          ? appPayments.find((p: any) => p.client_app_id === app.id)
          : null;
        return !appPayment;
      })
      .map((app: any) => app.id);
    
    if (unpaidAppIds.length === 0) return;
    
    // Check if all unpaid apps are already selected
    const allSelected = unpaidAppIds.every(id => selectedApps.has(id));
    
    setSelectedApps(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all apps for this client
        unpaidAppIds.forEach(id => next.delete(id));
      } else {
        // Select all unpaid apps for this client
        unpaidAppIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleMarkSelectedAppsAsPaid = async () => {
    if (!partnerId || selectedApps.size === 0) return;
    
    try {
      // Collect all selected apps data
      const selectedAppsData: Array<{
        clientAppId: string;
        clientId: string;
        appName: string;
        profitUs: number;
        partnerAmount: number;
        clientName: string;
      }> = [];
      
      let totalAmount = 0;
      const clientNames: string[] = [];
      
      for (const clientAppId of selectedApps) {
        // Find the app in clientApps
        const app = Array.isArray(clientApps) 
          ? clientApps.find((a: any) => a.id === clientAppId)
          : null;
        
        if (!app) continue;
        
        const appAny = app as any;
        const appName = (appAny.apps && typeof appAny.apps === 'object' && 'name' in appAny.apps) 
          ? appAny.apps.name 
          : (Array.isArray(appAny.apps) && appAny.apps.length > 0 && appAny.apps[0]?.name) 
            ? appAny.apps[0].name 
            : 'Unknown App';
        
        const profitUs = Number(app.profit_us || 0);
        
        // Find the assignment to get split
        const assignment = partnerAssignments.find(a => a.client_id === app.client_id);
        const splitPartner = assignment?.split_partner_override ?? partner?.default_split_partner ?? 0.25;
        const partnerAmount = profitUs * splitPartner;
        
        // Get client name
        const client = Array.isArray(allClients) 
          ? allClients.find((c: any) => c.id === app.client_id)
          : null;
        const clientName = client 
          ? `${client.name}${client.surname ? ' ' + client.surname : ''}`.trim()
          : 'Unknown Client';
        
        if (!clientNames.includes(clientName)) {
          clientNames.push(clientName);
        }
        
        selectedAppsData.push({
          clientAppId,
          clientId: app.client_id,
          appName,
          profitUs,
          partnerAmount,
          clientName
        });
        
        totalAmount += partnerAmount;
      }
      
      if (selectedAppsData.length === 0) {
        setToast({ isOpen: true, message: 'No valid apps selected', type: 'error' });
        return;
      }
      
      // Create payment records in partner_payments_by_client_app for each app
      for (const appData of selectedAppsData) {
        await insertAppPayment({
          partner_id: partnerId,
          client_id: appData.clientId,
          client_app_id: appData.clientAppId,
          amount: appData.partnerAmount,
          note: `Payment for ${appData.appName}`,
          paid_at: new Date().toISOString()
        } as any);
      }
      
      // Create a single payment in partner_payments with total amount and client names
      await insertPayment({
        partner_id: partnerId,
        amount: totalAmount,
        note: `Payment for ${clientNames.join(', ')}`,
        paid_at: new Date().toISOString()
      } as any);
      
      await mutateAppPayments();
      await mutatePayments();
      setSelectedApps(new Set());
      setToast({ 
        isOpen: true, 
        message: `Marked ${selectedAppsData.length} app(s) as paid (€${totalAmount.toFixed(2)})`, 
        type: 'success' 
      });
    } catch (error: any) {
      console.error('Failed to mark apps as paid:', error);
      setToast({ isOpen: true, message: 'Failed to mark apps as paid', type: 'error' });
    }
  };

  const handleMarkAppAsPaid = async (clientAppId: string, clientId: string, appName: string, profitUs: number, splitPartner: number) => {
    if (!partnerId) return;
    
    const partnerAmount = profitUs * splitPartner;
    
    // Get client name
    const client = Array.isArray(allClients) 
      ? allClients.find((c: any) => c.id === clientId)
      : null;
    const clientName = client 
      ? `${client.name}${client.surname ? ' ' + client.surname : ''}`.trim()
      : 'Unknown Client';
    
    try {
      // Create payment record in partner_payments_by_client_app for tracking
      await insertAppPayment({
        partner_id: partnerId,
        client_id: clientId,
        client_app_id: clientAppId,
        amount: partnerAmount,
        note: `Payment for ${appName}`,
        paid_at: new Date().toISOString()
      } as any);
      
      // Also create a payment in partner_payments to update the balance
      await insertPayment({
        partner_id: partnerId,
        amount: partnerAmount,
        note: `Payment for ${appName}, ${clientName}`,
        paid_at: new Date().toISOString()
      } as any);
      
      await mutateAppPayments();
      await mutatePayments();
      setToast({ isOpen: true, message: `Marked ${appName} as paid (€${partnerAmount.toFixed(2)})`, type: 'success' });
    } catch (error: any) {
      console.error('Failed to mark app as paid:', error);
      setToast({ isOpen: true, message: 'Failed to mark app as paid', type: 'error' });
    }
  };

  const handleUnmarkAppAsPaid = async (paymentId: string, appName: string, amount: number) => {
    try {
      // Find the corresponding payment in partner_payments by matching note
      const appPayment = Array.isArray(appPayments) 
        ? appPayments.find((p: any) => p.id === paymentId)
        : null;
      
      if (appPayment) {
        // Get client name for matching
        const appPaymentAny = appPayment as any;
        const client = Array.isArray(allClients) 
          ? allClients.find((c: any) => c.id === appPaymentAny.client_id)
          : null;
        const clientName = client 
          ? `${client.name}${client.surname ? ' ' + client.surname : ''}`.trim()
          : 'Unknown Client';
        
        // Find the corresponding payment in partner_payments
        const partnerPayments = Array.isArray(payments) ? payments : [];
        const matchingPayment = partnerPayments.find((p: any) => 
          p.note && p.note === `Payment for ${appName}, ${clientName}`
        );
        
        if (matchingPayment) {
          // Delete the payment from partner_payments to restore the balance
          await deletePayment(matchingPayment.id);
          await mutatePayments();
        }
      }
      
      // Delete the payment record from partner_payments_by_client_app
      await deleteAppPayment(paymentId);
      await mutateAppPayments();
      setToast({ isOpen: true, message: `Unmarked ${appName} as paid`, type: 'success' });
    } catch (error: any) {
      console.error('Failed to unmark app as paid:', error);
      setToast({ isOpen: true, message: 'Failed to unmark app as paid', type: 'error' });
    }
  };

  const handleClosePaymentModal = () => {
    setShowPaymentForm(false);
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  };

  const handleEditPayment = (payment: PartnerPayment) => {
    setEditingPayment(payment);
    setEditPaymentAmount(Number(payment.amount).toString());
    setEditPaymentNote(payment.note || '');
    setEditPaymentDate(new Date(payment.paid_at).toISOString().split('T')[0]);
    setShowEditPaymentModal(true);
  };

  const handleCloseEditPaymentModal = () => {
    setShowEditPaymentModal(false);
    setEditingPayment(null);
    setEditPaymentAmount('');
    setEditPaymentNote('');
    setEditPaymentDate('');
  };

  const handleSaveEditPayment = async () => {
    if (!editingPayment) return;
    
    const amount = Number(editPaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setToast({ isOpen: true, message: 'Please enter a valid amount', type: 'error' });
      return;
    }

    setIsSubmittingEditPayment(true);
    try {
      await updatePayment(
        {
          amount,
          note: editPaymentNote || null,
          paid_at: editPaymentDate ? new Date(editPaymentDate).toISOString() : editingPayment.paid_at
        },
        editingPayment.id,
        {
          onSuccess: () => {
            mutatePayments();
            setToast({ isOpen: true, message: 'Payment updated successfully', type: 'success' });
            handleCloseEditPaymentModal();
          },
          onError: () => {
            setToast({ isOpen: true, message: 'Failed to update payment', type: 'error' });
          }
        }
      );
    } catch (error: any) {
      console.error('Failed to update payment:', error);
      setToast({ isOpen: true, message: 'Failed to update payment', type: 'error' });
    } finally {
      setIsSubmittingEditPayment(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    await deletePayment(id, {
      onSuccess: () => {
        mutatePayments();
        setToast({ isOpen: true, message: 'Payment deleted successfully', type: 'success' });
      },
      onError: () => {
        setToast({ isOpen: true, message: 'Failed to delete payment', type: 'error' });
      }
    });
  };

  const handleSelectAssignClient = (clientId: string, displayName: string) => {
    setSelectedClientId(clientId);
    setAssignClientSearch(displayName);
    setShowAssignClientDropdown(false);
  };

  const handleAssignClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClientId || !partnerId) {
      setToast({ isOpen: true, message: 'Please select a client', type: 'error' });
      return;
    }

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const splitPartner = formData.get('splitPartner') as string;
    const splitOwner = formData.get('splitOwner') as string;
    const notes = formData.get('notes') as string;
    
    await insertAssignment(
      {
        client_id: selectedClientId,
        partner_id: partnerId,
        split_partner_override: splitPartner ? parseFloat(splitPartner) / 100 : null,
        split_owner_override: splitOwner ? parseFloat(splitOwner) / 100 : null,
        notes: notes || null
      },
      {
        onSuccess: () => {
          mutateAssignments();
          setToast({ isOpen: true, message: 'Client assigned successfully', type: 'success' });
          setShowAssignClientModal(false);
          setSelectedClientId('');
          setAssignClientSearch('');
          // Reset form
          const form = document.getElementById('assign-client-form') as HTMLFormElement;
          if (form) form.reset();
        },
        onError: () => {
          setToast({ isOpen: true, message: 'Failed to assign client', type: 'error' });
        }
      }
    );
  };

  const handleCloseAssignClientModal = () => {
    setShowAssignClientModal(false);
    setSelectedClientId('');
    setAssignClientSearch('');
    setShowAssignClientDropdown(false);
    const form = document.getElementById('assign-client-form') as HTMLFormElement;
    if (form) form.reset();
  };

  const handleRemoveClientClick = (clientId: string, clientName: string) => {
    setShowRemoveClientModal({ isOpen: true, clientId, clientName });
  };

  const handleRemoveClientConfirm = async () => {
    if (!showRemoveClientModal.clientId) return;
    const assignment = partnerAssignments.find(a => a.client_id === showRemoveClientModal.clientId);
    if (!assignment) return;

    await deleteAssignment(assignment.id, {
      onSuccess: () => {
        mutateAssignments();
        setShowRemoveClientModal({ isOpen: false, clientId: null, clientName: '' });
        setToast({ isOpen: true, message: 'Client removed successfully', type: 'success' });
      },
      onError: () => {
        setToast({ isOpen: true, message: 'Failed to remove client', type: 'error' });
      }
    });
  };

  // Initialize edit partner form when partner is loaded
  React.useEffect(() => {
    if (partner && showEditPartnerModal) {
      setPartnerName(partner.name);
      setPartnerContactInfo(partner.contact_info || '');
      setPartnerSplitPartner((partner.default_split_partner * 100).toString());
      setPartnerSplitOwner((partner.default_split_owner * 100).toString());
      setPartnerNotes(partner.notes || '');
    }
  }, [partner, showEditPartnerModal]);

  // Auto-calculate owner share when partner share changes
  React.useEffect(() => {
    if (!showEditPartnerModal) return;
    const partnerPct = Number(partnerSplitPartner) || 0;
    if (!isNaN(partnerPct) && partnerPct >= 0 && partnerPct <= 100) {
      setPartnerSplitOwner((100 - partnerPct).toString());
    }
  }, [partnerSplitPartner, showEditPartnerModal]);

  // Auto-calculate partner share when owner share changes
  React.useEffect(() => {
    if (!showEditPartnerModal) return;
    const ownerPct = Number(partnerSplitOwner) || 0;
    if (!isNaN(ownerPct) && ownerPct >= 0 && ownerPct <= 100) {
      setPartnerSplitPartner((100 - ownerPct).toString());
    }
  }, [partnerSplitOwner, showEditPartnerModal]);

  const handleEditPartner = async () => {
    if (!partnerName.trim()) {
      setToast({ isOpen: true, message: 'Partner name is required', type: 'error' });
      return;
    }
    const partnerPct = Number(partnerSplitPartner) / 100;
    const ownerPct = Number(partnerSplitOwner) / 100;
    if (Number.isNaN(partnerPct) || Number.isNaN(ownerPct)) {
      setToast({ isOpen: true, message: 'Split percentages must be numbers', type: 'error' });
      return;
    }
    const totalSplit = (Number(partnerSplitPartner) || 0) + (Number(partnerSplitOwner) || 0);
    if (totalSplit !== 100) {
      setToast({ isOpen: true, message: `Total split must equal 100% (currently ${totalSplit}%)`, type: 'error' });
      return;
    }
    if (!partnerId) return;

    setIsSubmittingPartner(true);
    try {
      await updatePartner(
        {
          name: partnerName,
          contact_info: partnerContactInfo || null,
          notes: partnerNotes || null,
          default_split_partner: partnerPct,
          default_split_owner: ownerPct
        },
        partnerId,
        {
          onSuccess: () => {
            mutatePartners();
            setShowEditPartnerModal(false);
            setToast({ isOpen: true, message: 'Partner updated successfully', type: 'success' });
          },
          onError: () => {
            setToast({ isOpen: true, message: 'Failed to update partner', type: 'error' });
          }
        }
      );
    } catch (error) {
      setToast({ isOpen: true, message: 'Failed to update partner', type: 'error' });
    } finally {
      setIsSubmittingPartner(false);
    }
  };

  const handleCloseEditPartnerModal = () => {
    setShowEditPartnerModal(false);
    if (partner) {
      setPartnerName(partner.name);
      setPartnerContactInfo(partner.contact_info || '');
      setPartnerSplitPartner((partner.default_split_partner * 100).toString());
      setPartnerSplitOwner((partner.default_split_owner * 100).toString());
      setPartnerNotes(partner.notes || '');
    }
  };

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Partner details" description="Loading partner..." />
        <LoadingSpinner message="Loading partner..." />
      </div>
    );
  }

  if (partnerError || !partner) {
    return (
      <div>
        <SectionHeader title="Partner details" description="Unable to load partner" />
        <ErrorMessage
          error={partnerError || new Error('Partner not found')}
          onRetry={() => {
            mutatePartners();
            mutateAssignments();
            mutateClientApps();
            mutatePayments();
          }}
        />
      </div>
    );
  }

  const balanceColor = balance.balance > 0 ? '#dc2626' : balance.balance < 0 ? '#16a34a' : '#64748b';
  const balanceBg = balance.balance > 0 ? '#fef2f2' : balance.balance < 0 ? '#f0fdf4' : '#f8fafc';
  const balanceIcon = balance.balance > 0 ? '↑' : balance.balance < 0 ? '↓' : '✓';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <SectionHeader
        title={partner.name}
        description="Partner profit split details and management."
        actions={
          <button
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: 'white',
              color: '#475569',
              fontWeight: '500',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onClick={() => router.push('/partners')}
          >
            ← Back to Partners
          </button>
        }
      />

      {/* Partner Header Card */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>Partner</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.5rem 0' }}>{partner.name}</h1>
            {partner.contact_info && (
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>{partner.contact_info}</div>
            )}
            {partner.notes && (
              <div style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '6px' }}>{partner.notes}</div>
            )}
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.75rem' }}>
              Default split: <strong style={{ color: '#0f172a' }}>{Math.round(partner.default_split_partner * 100)}%</strong> partner / <strong style={{ color: '#0f172a' }}>{Math.round(partner.default_split_owner * 100)}%</strong> owner
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'white',
                color: '#475569',
                fontWeight: '500',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Opening edit partner modal');
                setShowEditPartnerModal(true);
              }}
            >
              Edit Partner
            </button>
            <button
              type="button"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'white',
                color: '#475569',
                fontWeight: '500',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onClick={() => setShowAssignClientModal(true)}
            >
              + Assign Client
            </button>
            <button
              type="button"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: '#059669',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#047857')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#059669')}
              onClick={() => setShowPaymentForm(true)}
            >
              + Add Payment
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>Total Profit</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' }}>€{balance.totalProfit.toFixed(2)}</div>
          </div>
          <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>Partner Share</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#059669' }}>€{balance.partnerShare.toFixed(2)}</div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>Owner Share</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' }}>€{balance.ownerShare.toFixed(2)}</div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>Total Paid</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' }}>€{balance.totalPaid.toFixed(2)}</div>
          </div>
          <div style={{ padding: '1rem', background: balanceBg, borderRadius: '8px', border: `1px solid ${balanceColor}40` }}>
            <div style={{ fontSize: '0.7rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '0.5rem' }}>Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: balanceColor }}>
              {balanceIcon} €{Math.abs(balance.balance).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {/* Payments Section */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Payments</h2>
          </div>

          {/* Payments Table */}
          {(!payments || (payments as PartnerPayment[]).length === 0) ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              No payments recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Date</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Note</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Amount</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(payments as PartnerPayment[]).map((payment, idx) => (
                    <tr
                      key={payment.id}
                      style={{
                        borderBottom: idx < (payments as PartnerPayment[]).length - 1 ? '1px solid #e2e8f0' : 'none',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#0f172a' }}>
                        {new Date(payment.paid_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
                        {payment.note || '—'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <span style={{ fontWeight: '600', color: '#0f172a' }}>€{Number(payment.amount).toFixed(2)}</span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEditPayment(payment)}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              color: '#059669',
                              background: 'transparent',
                              border: '1px solid #059669',
                              cursor: 'pointer',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#f0fdf4';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePayment(payment.id)}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              color: '#dc2626',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fef2f2';
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.textDecoration = 'none';
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
          )}
        </div>

        {/* Left Column - Clients Table */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Assigned Clients</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {selectedApps.size > 0 && (
                <button
                  onClick={handleMarkSelectedAppsAsPaid}
                  style={{
                    padding: '0.625rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: 'white',
                    background: '#059669',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#047857';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#059669';
                  }}
                >
                  Mark {selectedApps.size} Selected as Paid
                </button>
              )}
              <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500' }}>
                {filteredAndSortedBreakdown.length} of {partnerAssignments.length} client{partnerAssignments.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          {/* Search Bar */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              value={clientTableSearch}
              onChange={(e) => setClientTableSearch(e.target.value)}
              placeholder="Search clients..."
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.875rem',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>

          {breakdown.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              No clients assigned yet. Use the form on the right to assign clients.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <tr>
                    <th 
                      style={{ 
                        padding: '0.75rem', 
                        textAlign: 'left', 
                        fontSize: '0.75rem', 
                        fontWeight: '700', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em', 
                        color: '#475569',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => handleClientTableSort('client')}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                    >
                      Client {clientTableSortColumn === 'client' && (clientTableSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ 
                        padding: '0.75rem', 
                        textAlign: 'right', 
                        fontSize: '0.75rem', 
                        fontWeight: '700', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em', 
                        color: '#475569',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => handleClientTableSort('totalProfit')}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                    >
                      Total Profit {clientTableSortColumn === 'totalProfit' && (clientTableSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ 
                        padding: '0.75rem', 
                        textAlign: 'right', 
                        fontSize: '0.75rem', 
                        fontWeight: '700', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em', 
                        color: '#475569',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => handleClientTableSort('partnerShare')}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                    >
                      Partner Share {clientTableSortColumn === 'partnerShare' && (clientTableSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ 
                        padding: '0.75rem', 
                        textAlign: 'right', 
                        fontSize: '0.75rem', 
                        fontWeight: '700', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em', 
                        color: '#475569',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => handleClientTableSort('ownerShare')}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                    >
                      Owner Share {clientTableSortColumn === 'ownerShare' && (clientTableSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      style={{ 
                        padding: '0.75rem', 
                        textAlign: 'right', 
                        fontSize: '0.75rem', 
                        fontWeight: '700', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em', 
                        color: '#475569',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                      onClick={() => handleClientTableSort('split')}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                    >
                      Split {clientTableSortColumn === 'split' && (clientTableSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedBreakdown.map((row, idx) => {
                    const assignment = partnerAssignments.find(a => a.client_id === row.clientId);
                    // Try to get client name from assignment first, then from clients array
                    const clientFromAssignment = assignment?.client;
                    const clientFromList = Array.isArray(allClients) ? allClients.find((c: any) => c.id === row.clientId) : null;
                    const clientName = clientFromAssignment?.name || clientFromList?.name || row.clientName;
                    const clientSurname = clientFromAssignment?.surname || clientFromList?.surname || '';
                    const fullClientName = `${clientName}${clientSurname ? ' ' + clientSurname : ''}`.trim();
                    
                    // Get completed apps for this client
                    const clientCompletedApps = (clientApps && Array.isArray(clientApps)) 
                      ? clientApps.filter((app: any) => 
                          app && 
                          app.client_id === row.clientId && 
                          (app.status === 'completed' || app.status === 'paid')
                        )
                      : [];
                    
                    const isExpanded = expandedClients.has(row.clientId);
                    const splitPartner = assignment?.split_partner_override ?? partner?.default_split_partner ?? 0.25;
                    
                    return (
                      <React.Fragment key={row.clientId}>
                        <tr
                          style={{
                            borderBottom: idx < filteredAndSortedBreakdown.length - 1 ? '1px solid #e2e8f0' : 'none',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <button
                                onClick={() => toggleClientExpanded(row.clientId)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '0.25rem',
                                  fontSize: '0.875rem',
                                  color: '#64748b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  minWidth: '20px'
                                }}
                                title={clientCompletedApps.length > 0 ? `${clientCompletedApps.length} completed app(s)` : 'No completed apps'}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                              {(() => {
                                // Get unpaid apps for this client
                                const unpaidApps = clientCompletedApps.filter((app: any) => {
                                  const appPayment = (appPayments && Array.isArray(appPayments)) 
                                    ? appPayments.find((p: any) => p.client_app_id === app.id)
                                    : null;
                                  return !appPayment;
                                });
                                const unpaidAppIds = unpaidApps.map((app: any) => app.id);
                                const selectedCount = unpaidAppIds.filter((id: string) => selectedApps.has(id)).length;
                                const allSelected = unpaidAppIds.length > 0 && selectedCount === unpaidAppIds.length;
                                const someSelected = selectedCount > 0 && selectedCount < unpaidAppIds.length;
                                
                                return unpaidAppIds.length > 0 ? (
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(input) => {
                                      if (input) input.indeterminate = someSelected;
                                    }}
                                    onChange={() => toggleAllClientApps(row.clientId, clientCompletedApps)}
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      cursor: 'pointer',
                                      accentColor: '#059669',
                                      flexShrink: 0
                                    }}
                                    title={`Select all ${unpaidAppIds.length} unpaid app(s) for this client`}
                                  />
                                ) : null;
                              })()}
                              <div>
                                <Link
                                  href={`/clients/${row.clientId}`}
                                  style={{
                                    fontWeight: '600',
                                    color: '#0f172a',
                                    textDecoration: 'none',
                                    fontSize: '0.95rem'
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = '#059669')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = '#0f172a')}
                                >
                                  {fullClientName || row.clientName}
                                </Link>
                                {row.override && (
                                  <span style={{
                                    display: 'inline-block',
                                    marginLeft: '0.5rem',
                                    padding: '0.125rem 0.5rem',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    borderRadius: '12px',
                                    fontSize: '0.7rem',
                                    fontWeight: '600'
                                  }}>
                                    Custom Split
                                  </span>
                                )}
                                {assignment?.notes && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{assignment.notes}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>€{row.totalProfit.toFixed(2)}</span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <span style={{ fontWeight: '600', color: '#059669' }}>€{row.partnerShare.toFixed(2)}</span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <span style={{ fontWeight: '600', color: '#475569' }}>€{row.ownerShare.toFixed(2)}</span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                              {Math.round(row.splitPartner * 100)}% / {Math.round(row.splitOwner * 100)}%
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <button
                              onClick={() => handleRemoveClientClick(row.clientId, fullClientName || row.clientName)}
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                color: '#dc2626',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#fef2f2';
                                e.currentTarget.style.textDecoration = 'underline';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.textDecoration = 'none';
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} style={{ padding: '0', backgroundColor: '#f8fafc' }}>
                              <div style={{ padding: '1rem' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569', marginBottom: '0.75rem' }}>
                                  Completed Apps ({clientCompletedApps.length})
                                </h4>
                                {clientCompletedApps.length === 0 ? (
                                  <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                                    No completed apps for this client yet.
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {clientCompletedApps.map((app: any) => {
                                    const appPayment = (appPayments && Array.isArray(appPayments)) 
                                      ? appPayments.find((p: any) => p.client_app_id === app.id)
                                      : null;
                                    const appName = (app.apps && typeof app.apps === 'object' && 'name' in app.apps) 
                                      ? app.apps.name 
                                      : (Array.isArray(app.apps) && app.apps.length > 0 && app.apps[0]?.name) 
                                        ? app.apps[0].name 
                                        : 'Unknown App';
                                    const profitUs = Number(app.profit_us || 0);
                                    const partnerAmount = profitUs * splitPartner;
                                    const isPaid = !!appPayment;
                                    const isSelected = selectedApps.has(app.id);
                                    
                                    return (
                                      <div
                                        key={app.id}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '0.75rem',
                                          background: isSelected && !isPaid ? '#f0fdf4' : 'white',
                                          borderRadius: '6px',
                                          border: isSelected && !isPaid ? '2px solid #059669' : '1px solid #e2e8f0',
                                          transition: 'all 0.2s'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                          {!isPaid && (
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => toggleAppSelection(app.id)}
                                              style={{
                                                width: '18px',
                                                height: '18px',
                                                cursor: 'pointer',
                                                accentColor: '#059669'
                                              }}
                                            />
                                          )}
                                          <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                                              {appName}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                              Profit: €{profitUs.toFixed(2)} • Partner Share: €{partnerAmount.toFixed(2)}
                                            </div>
                                            {isPaid && appPayment && (
                                              <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '0.25rem' }}>
                                                Paid on {new Date((appPayment as any).paid_at).toLocaleDateString()}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div>
                                          {isPaid && appPayment ? (
                                            <button
                                              onClick={() => handleUnmarkAppAsPaid(appPayment.id, appName, partnerAmount)}
                                              style={{
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '500',
                                                color: '#dc2626',
                                                background: 'white',
                                                border: '1px solid #dc2626',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#fef2f2';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'white';
                                              }}
                                            >
                                              Unmark as Paid
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => handleMarkAppAsPaid(app.id, row.clientId, appName, profitUs, splitPartner)}
                                              style={{
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '500',
                                                color: 'white',
                                                background: '#059669',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#047857';
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.background = '#059669';
                                              }}
                                            >
                                              Mark as Paid
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      {monthlySeries.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', marginBottom: '1rem' }}>Monthly Partner Revenue</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {monthlySeries.map((point) => {
              const maxAmount = Math.max(...monthlySeries.map(p => p.amount), 1);
              const height = (point.amount / maxAmount) * 200 || 4;
              return (
                <div key={point.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', height: '200px', width: '40px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${height}px`,
                        background: 'linear-gradient(to top, #059669, #10b981)',
                        borderRadius: '6px',
                        transition: 'height 0.3s'
                      }}
                      title={`€${point.amount.toFixed(2)}`}
                    />
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', fontWeight: '600', color: '#475569', textAlign: 'center' }}>
                    {point.month}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                    €{point.amount.toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assign Client Modal */}
      {showAssignClientModal && partner && (
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
            zIndex: 10000
          }}
          onClick={handleCloseAssignClientModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>Assign Client</h3>
              <button
                onClick={handleCloseAssignClientModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem 0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <form id="assign-client-form" onSubmit={handleAssignClient} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Client <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    ref={assignClientInputRef}
                    type="text"
                    value={assignClientSearch}
                    onChange={(e) => {
                      setAssignClientSearch(e.target.value);
                      setShowAssignClientDropdown(true);
                      // Clear selected client if search doesn't match
                      if (selectedClientId) {
                        const selectedClient = allClientsArray.find((c: any) => c.id === selectedClientId);
                        if (selectedClient) {
                          const selectedName = `${selectedClient.name} ${selectedClient.surname || ''}`.trim();
                          if (selectedName.toLowerCase() !== e.target.value.toLowerCase()) {
                            setSelectedClientId('');
                          }
                        }
                      }
                    }}
                    onFocus={() => setShowAssignClientDropdown(true)}
                    placeholder="Search client..."
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem',
                      border: `2px solid ${selectedClientId ? '#10b981' : '#cbd5e1'}`,
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      background: 'white',
                      cursor: 'text',
                      transition: 'border-color 0.2s',
                      outline: 'none',
                      fontWeight: selectedClientId ? '500' : '400',
                      boxSizing: 'border-box'
                    }}
                    onBlur={() => {
                      // Delay to allow click on dropdown item
                      setTimeout(() => setShowAssignClientDropdown(false), 200);
                    }}
                  />
                  {selectedClientId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedClientId('');
                        setAssignClientSearch('');
                        setShowAssignClientDropdown(false);
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
                  {showAssignClientDropdown && filteredAssignClients.length > 0 && (
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
                        zIndex: 10001
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {filteredAssignClients.map((client: any) => (
                        <div
                          key={client.id}
                          onClick={() => handleSelectAssignClient(client.id, client.displayName)}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                          }}
                        >
                          {client.displayName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {partnerAssignments.length > 0 && (
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                    {partnerAssignments.length} client{partnerAssignments.length !== 1 ? 's' : ''} already assigned
                  </p>
                )}
              </div>
              <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Custom Split (Optional)</p>
                <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  Leave empty to use default: {Math.round(partner.default_split_partner * 100)}% / {Math.round(partner.default_split_owner * 100)}%
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#64748b', marginBottom: '0.25rem' }}>Partner %</label>
                    <input
                      type="number"
                      name="splitPartner"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder={`${Math.round(partner.default_split_partner * 100)}`}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.875rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '600', color: '#64748b', marginBottom: '0.25rem' }}>Owner %</label>
                    <input
                      type="number"
                      name="splitOwner"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder={`${Math.round(partner.default_split_owner * 100)}`}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.875rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Notes</label>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Optional notes about this assignment..."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCloseAssignClientModal}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    borderRadius: '8px',
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#047857')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#059669')}
                >
                  Assign Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Partner Modal */}
      {showEditPartnerModal && partner && (
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
            zIndex: 10000
          }}
          onClick={handleCloseEditPartnerModal}
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
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>Edit Partner</h3>
              <button
                onClick={handleCloseEditPartnerModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem 0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Basic Information */}
              <div>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: '1rem' }}>Basic Information</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                      Partner Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder="e.g., Bob, Marketing Agency"
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.875rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Contact Information</label>
                    <input
                      type="text"
                      value={partnerContactInfo}
                      onChange={(e) => setPartnerContactInfo(e.target.value)}
                      placeholder="Email, Telegram, Phone, etc."
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.875rem',
                        boxSizing: 'border-box'
                      }}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>How to reach this partner for payments and communication</p>
                  </div>
                </div>
              </div>

              {/* Default Profit Split */}
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: '0.5rem' }}>Default Profit Split</h4>
                  <p style={{ fontSize: '0.75rem', color: '#64748b' }}>This split will be applied to all clients assigned to this partner unless overridden per client.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Partner Share (%)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={partnerSplitPartner}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100)) {
                            setPartnerSplitPartner(val);
                          }
                        }}
                        placeholder="25"
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          paddingRight: '2.5rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.875rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: '#94a3b8' }}>%</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Owner Share (%)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={partnerSplitOwner}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || (!isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100)) {
                            setPartnerSplitOwner(val);
                          }
                        }}
                        placeholder="75"
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.75rem',
                          paddingRight: '2.5rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.875rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: '#94a3b8' }}>%</span>
                    </div>
                  </div>
                </div>
                {(() => {
                  const totalSplit = (Number(partnerSplitPartner) || 0) + (Number(partnerSplitOwner) || 0);
                  const splitError = totalSplit !== 100;
                  return (
                    <>
                      {splitError && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px' }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#92400e', margin: 0 }}>
                            Total must equal 100% (currently {totalSplit}%)
                          </p>
                        </div>
                      )}
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                          <span style={{ color: '#64748b' }}>Total Split:</span>
                          <span style={{ fontWeight: '600', color: totalSplit === 100 ? '#059669' : '#dc2626' }}>
                            {totalSplit}%
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Notes */}
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Notes</label>
                <textarea
                  value={partnerNotes}
                  onChange={(e) => setPartnerNotes(e.target.value)}
                  rows={4}
                  placeholder="Additional information about this partner..."
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={handleCloseEditPartnerModal}
                  disabled={isSubmittingPartner}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    color: '#475569',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: isSubmittingPartner ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => !isSubmittingPartner && (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => !isSubmittingPartner && (e.currentTarget.style.background = 'white')}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEditPartner}
                  disabled={isSubmittingPartner || (Number(partnerSplitPartner) || 0) + (Number(partnerSplitOwner) || 0) !== 100}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: isSubmittingPartner || (Number(partnerSplitPartner) || 0) + (Number(partnerSplitOwner) || 0) !== 100 ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingPartner || (Number(partnerSplitPartner) || 0) + (Number(partnerSplitOwner) || 0) !== 100 ? 0.6 : 1,
                    transition: 'background-color 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => !isSubmittingPartner && (Number(partnerSplitPartner) || 0) + (Number(partnerSplitOwner) || 0) === 100 && (e.currentTarget.style.background = '#047857')}
                  onMouseLeave={(e) => !isSubmittingPartner && (e.currentTarget.style.background = '#059669')}
                >
                  {isSubmittingPartner ? 'Saving...' : 'Update Partner'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showPaymentForm && (
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
          onClick={handleClosePaymentModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>Add Payment</h3>
              <button
                onClick={handleClosePaymentModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem 0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Amount <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Note (optional)</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={3}
                  placeholder="Payment reference, method, etc."
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleClosePaymentModal}
                  disabled={isSubmittingPayment}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    color: '#475569',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: isSubmittingPayment ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => !isSubmittingPayment && (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={(e) => !isSubmittingPayment && (e.currentTarget.style.background = 'white')}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddPayment}
                  disabled={isSubmittingPayment}
                  style={{
                    padding: '0.625rem 1.25rem',
                    borderRadius: '8px',
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: isSubmittingPayment ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingPayment ? 0.6 : 1,
                    transition: 'background-color 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => !isSubmittingPayment && (e.currentTarget.style.background = '#047857')}
                  onMouseLeave={(e) => !isSubmittingPayment && (e.currentTarget.style.background = '#059669')}
                >
                  {isSubmittingPayment ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showRemoveClientModal.isOpen}
        onCancel={() => setShowRemoveClientModal({ isOpen: false, clientId: null, clientName: '' })}
        onConfirm={handleRemoveClientConfirm}
        title="Remove Client"
        message={`Remove "${showRemoveClientModal.clientName}" from ${partner.name}? This will stop tracking profit splits for this client.`}
        variant="danger"
      />

      {/* Edit Payment Modal */}
      {showEditPaymentModal && editingPayment && (
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
            zIndex: 10000
          }}
          onClick={handleCloseEditPaymentModal}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#0f172a' }}>Edit Payment</h3>
              <button
                onClick={handleCloseEditPaymentModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '0.25rem 0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Amount <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPaymentAmount}
                  onChange={(e) => setEditPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Date</label>
                <input
                  type="date"
                  value={editPaymentDate}
                  onChange={(e) => setEditPaymentDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>Note</label>
                <textarea
                  value={editPaymentNote}
                  onChange={(e) => setEditPaymentNote(e.target.value)}
                  placeholder="Optional note about this payment..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    resize: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleCloseEditPaymentModal}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditPayment}
                  disabled={isSubmittingEditPayment}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    borderRadius: '8px',
                    background: isSubmittingEditPayment ? '#94a3b8' : '#059669',
                    color: 'white',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    cursor: isSubmittingEditPayment ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmittingEditPayment) {
                      e.currentTarget.style.background = '#047857';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmittingEditPayment) {
                      e.currentTarget.style.background = '#059669';
                    }
                  }}
                >
                  {isSubmittingEditPayment ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  );
}
