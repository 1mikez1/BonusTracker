'use client';

import React, { useMemo, useState, useRef, useCallback } from 'react';
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
  
  // App filter state for clients table
  const [appTableFilter, setAppTableFilter] = useState<string>('');
  const [appTableSearch, setAppTableSearch] = useState('');
  const [showAppTableDropdown, setShowAppTableDropdown] = useState(false);
  const appTableInputRef = useRef<HTMLInputElement>(null);
  const appTableDropdownRef = useRef<HTMLDivElement>(null);

  // Payments table sort state
  const [paymentSortColumn, setPaymentSortColumn] = useState<'date' | 'note' | 'amount'>('date');
  const [paymentSortDirection, setPaymentSortDirection] = useState<'asc' | 'desc'>('desc');

  // App-specific splits state
  const [showAppSplitsModal, setShowAppSplitsModal] = useState(false);
  const [editingAppSplit, setEditingAppSplit] = useState<{ appId: string; appName: string; splitPartner: number; splitOwner: number } | null>(null);
  const [appSplitPartner, setAppSplitPartner] = useState('');
  const [appSplitOwner, setAppSplitOwner] = useState('');
  const [isSubmittingAppSplit, setIsSubmittingAppSplit] = useState(false);

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

  const {
    data: appSplits,
    isLoading: appSplitsLoading,
    mutate: mutateAppSplits
  } = useSupabaseData({
    table: 'partner_app_splits' as any,
    match: partnerId ? { partner_id: partnerId } : undefined
  });

  const { data: allApps } = useSupabaseData({
    table: 'apps',
    select: 'id, name',
    order: { column: 'name', ascending: true }
  });

  // Convert allClients to array
  const allClientsArray = useMemo(() => Array.isArray(allClients) ? allClients : [], [allClients]);
  const allAppsArray = Array.isArray(allApps) ? allApps : [];

  const { insert: insertPayment, mutate: updatePayment, remove: deletePayment } = useSupabaseMutations('partner_payments', undefined, mutatePayments);
  const { insert: insertAppPayment, remove: deleteAppPayment } = useSupabaseMutations('partner_payments_by_client_app' as any, undefined, mutateAppPayments);
  const { insert: insertAssignment, remove: deleteAssignment } = useSupabaseMutations('client_partner_assignments', undefined, mutateAssignments);
  const { mutate: updatePartner } = useSupabaseMutations('client_partners', undefined, mutatePartners);
  const { insert: insertAppSplit, mutate: updateAppSplit, remove: deleteAppSplit } = useSupabaseMutations('partner_app_splits' as any, undefined, mutateAppSplits);

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
      clientApps: clientApps as ClientAppRow[],
      appSplits: appSplits as any
    });
  }, [partner, partnerAssignments, clientApps, appSplits]);

  // Get available apps from assigned clients
  const availableAppsForFilter = useMemo(() => {
    if (!clientApps || !Array.isArray(clientApps) || !partnerAssignments) return [];
    const assignedClientIds = new Set(partnerAssignments.map(a => a.client_id));
    const appsSet = new Set<string>();
    clientApps.forEach((app: any) => {
      if (assignedClientIds.has(app.client_id) && app.app_id) {
        appsSet.add(app.app_id);
      }
    });
    return Array.from(appsSet).map(appId => {
      const app = (clientApps as any[]).find((a: any) => a.app_id === appId);
      if (!app) return null;
      const appData = app.apps;
      const appName = (appData && typeof appData === 'object' && 'name' in appData) 
        ? appData.name 
        : (Array.isArray(appData) && appData.length > 0 && appData[0]?.name) 
          ? appData[0].name 
          : 'Unknown App';
      return { id: appId, name: appName };
    }).filter(Boolean) as { id: string; name: string }[];
  }, [clientApps, partnerAssignments]);

  // Filter apps for dropdown
  const filteredAppsForTable = useMemo(() => {
    if (!appTableSearch.trim()) return availableAppsForFilter;
    const searchLower = appTableSearch.toLowerCase().trim();
    return availableAppsForFilter.filter(app => 
      app.name.toLowerCase().includes(searchLower)
    );
  }, [availableAppsForFilter, appTableSearch]);

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

    // Filter by app
    if (appTableFilter) {
      filtered = filtered.filter((row) => {
        const clientAppsForRow = (clientApps as any[])?.filter((app: any) => 
          app.client_id === row.clientId && 
          app.status === 'completed'
        );
        return clientAppsForRow.some((app: any) => app.app_id === appTableFilter);
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
  }, [breakdown, partnerAssignments, allClients, clientTableSearch, clientTableSortColumn, clientTableSortDirection, appTableFilter, clientApps]);

  const handleClientTableSort = (column: 'client' | 'totalProfit' | 'partnerShare' | 'ownerShare' | 'split') => {
    if (clientTableSortColumn === column) {
      setClientTableSortDirection(clientTableSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setClientTableSortColumn(column);
      setClientTableSortDirection('asc');
    }
  };

  // Sort payments
  const sortedPayments = useMemo(() => {
    if (!payments || (payments as PartnerPayment[]).length === 0) return [];
    const paymentsArray = [...(payments as PartnerPayment[])];
    paymentsArray.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (paymentSortColumn === 'date') {
        aVal = new Date(a.paid_at).getTime();
        bVal = new Date(b.paid_at).getTime();
      } else if (paymentSortColumn === 'note') {
        aVal = (a.note || '').toLowerCase();
        bVal = (b.note || '').toLowerCase();
      } else if (paymentSortColumn === 'amount') {
        aVal = Number(a.amount);
        bVal = Number(b.amount);
      }

      if (aVal < bVal) return paymentSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return paymentSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return paymentsArray;
  }, [payments, paymentSortColumn, paymentSortDirection]);

  const handlePaymentSort = (column: 'date' | 'note' | 'amount') => {
    if (paymentSortColumn === column) {
      setPaymentSortDirection(paymentSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPaymentSortColumn(column);
      setPaymentSortDirection('asc');
    }
  };

  // Helper function to get split for an app
  const getAppSplit = useCallback((appId: string, assignment: ClientPartnerAssignment | undefined) => {
    // Priority: 1) app-specific split, 2) assignment override, 3) partner default
    const appSplit = (appSplits as any[])?.find((s: any) => s.app_id === appId);
    if (appSplit) {
      return {
        splitPartner: Number(appSplit.split_partner),
        splitOwner: Number(appSplit.split_owner)
      };
    }
    const splitPartner = assignment?.split_partner_override ?? partner?.default_split_partner ?? 0.25;
    const splitOwner = assignment?.split_owner_override ?? partner?.default_split_owner ?? 0.75;
    return { splitPartner, splitOwner };
  }, [appSplits, partner]);

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
      payments: payments as PartnerPayment[],
      appSplits: appSplits as any
    });
  }, [partner, partnerAssignments, clientApps, payments, appSplits, partnerId]);

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
    // Get all unpaid app IDs for this client (already filtered by appTableFilter if active)
    const unpaidAppIds = clientCompletedApps
      .filter((app: any) => {
        const appPayment = (appPayments && Array.isArray(appPayments)) 
          ? appPayments.find((p: any) => p.client_app_id === app.id)
          : null;
        return !appPayment;
      })
      .map((app: any) => app.id);
    
    if (unpaidAppIds.length === 0) return;
    
    // Check if all unpaid apps (for this client and filter) are already selected
    const allSelected = unpaidAppIds.every(id => selectedApps.has(id));
    
    setSelectedApps(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all apps for this client (respecting app filter)
        unpaidAppIds.forEach(id => next.delete(id));
      } else {
        // Select all unpaid apps for this client (respecting app filter)
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
        const { splitPartner } = getAppSplit(app.app_id, assignment);
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
      // Store client_app_ids in note for easier matching: "Payment for Client1, Client2 [id1,id2,id3]"
      const clientAppIds = selectedAppsData.map(d => d.clientAppId).join(',');
      const paymentNote = `Payment for ${clientNames.join(', ')} [${clientAppIds}]`;
      await insertPayment({
        partner_id: partnerId,
        amount: totalAmount,
        note: paymentNote,
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
      // Store client_app_id in note for easier matching: "Payment for AppName, ClientName [client_app_id]"
      const paymentNote = `Payment for ${appName}, ${clientName} [${clientAppId}]`;
      await insertPayment({
        partner_id: partnerId,
        amount: partnerAmount,
        note: paymentNote,
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
      // Find the app payment record
      const appPayment = Array.isArray(appPayments) 
        ? appPayments.find((p: any) => p.id === paymentId)
        : null;
      
      if (!appPayment) {
        setToast({ isOpen: true, message: 'App payment not found', type: 'error' });
        return;
      }

      const appPaymentAny = appPayment as any;
      const clientAppId = appPaymentAny.client_app_id;
      
      // Get client name
      const client = Array.isArray(allClients) 
        ? allClients.find((c: any) => c.id === appPaymentAny.client_id)
        : null;
      const clientName = client 
        ? `${client.name}${client.surname ? ' ' + client.surname : ''}`.trim()
        : 'Unknown Client';
      
      // Find the corresponding payment in partner_payments
      // First try to find by client_app_id in note (format: "Payment for ... [id1,id2,id3]")
      const partnerPayments = Array.isArray(payments) ? payments : [];
      let matchingPayment = partnerPayments.find((p: any) => {
        if (!p.note) return false;
        const idsMatch = p.note.match(/\[([^\]]+)\]/);
        if (idsMatch) {
          const clientAppIds = idsMatch[1].split(',').map((id: string) => id.trim());
          return clientAppIds.includes(clientAppId);
        }
        return false;
      });
      
      // Fallback: try to find by client name (for backward compatibility)
      if (!matchingPayment) {
        // Try exact match first (single payment)
        matchingPayment = partnerPayments.find((p: any) => 
          p.note && p.note === `Payment for ${appName}, ${clientName}`
        );
        
        // If not found, try group payment
        if (!matchingPayment) {
          matchingPayment = partnerPayments.find((p: any) => {
            if (!p.note || !p.note.startsWith('Payment for ')) return false;
            const noteClients = p.note.replace('Payment for ', '').split(',').map((n: string) => n.trim());
            return noteClients.includes(clientName);
          });
        }
      }
      
      if (matchingPayment) {
        const matchingPaymentAny = matchingPayment as any;
        const paymentNote = matchingPaymentAny.note || '';
        
        // Check if it's a group payment (contains multiple client_app_ids or client names)
        const idsMatch = paymentNote.match(/\[([^\]]+)\]/);
        let isGroupPayment = false;
        let remainingClientAppIds: string[] = [];
        let remainingClients: string[] = [];
        
        if (idsMatch) {
          // New format with client_app_ids
          const clientAppIds = idsMatch[1].split(',').map((id: string) => id.trim());
          isGroupPayment = clientAppIds.length > 1;
          remainingClientAppIds = clientAppIds.filter((id: string) => id !== clientAppId);
          
          // Get remaining client names
          if (remainingClientAppIds.length > 0 && Array.isArray(clientApps)) {
            for (const remainingId of remainingClientAppIds) {
              const app = clientApps.find((a: any) => a.id === remainingId);
              if (app) {
                const client = Array.isArray(allClients) 
                  ? allClients.find((c: any) => c.id === app.client_id)
                  : null;
                const name = client 
                  ? `${client.name}${client.surname ? ' ' + client.surname : ''}`.trim()
                  : null;
                if (name) remainingClients.push(name);
              }
            }
          }
        } else {
          // Old format - check by client names
          const noteClients = paymentNote.replace('Payment for ', '').split(',').map((n: string) => n.trim());
          isGroupPayment = noteClients.length > 1;
          remainingClients = noteClients.filter((name: string) => name !== clientName);
        }
        
        if (isGroupPayment && remainingClientAppIds.length > 0) {
          // Group payment - update it by removing this client_app_id
          const remainingAmount = Number(matchingPaymentAny.amount) - amount;
          const newNote = remainingClients.length > 0 
            ? `Payment for ${remainingClients.join(', ')} [${remainingClientAppIds.join(',')}]`
            : `Payment for ${remainingClients.join(', ')}`;
          
          await updatePayment(
            {
              amount: remainingAmount,
              note: newNote
            },
            matchingPaymentAny.id,
            {
              onSuccess: () => {},
              onError: () => {}
            }
          );
        } else if (isGroupPayment && remainingClients.length > 0) {
          // Old format group payment - update by client names
          const remainingAmount = Number(matchingPaymentAny.amount) - amount;
          const newNote = `Payment for ${remainingClients.join(', ')}`;
          await updatePayment(
            {
              amount: remainingAmount,
              note: newNote
            },
            matchingPaymentAny.id,
            {
              onSuccess: () => {},
              onError: () => {}
            }
          );
        } else {
          // Single payment or last client in group - delete it
          await deletePayment(matchingPaymentAny.id);
        }
      }
      
      // Delete the payment record from partner_payments_by_client_app
      await deleteAppPayment(paymentId);
      await mutateAppPayments();
      await mutatePayments();
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
    // Remove client_app_ids from note for display (format: "Payment for ... [id1,id2,id3]")
    const note = payment.note || '';
    const cleanedNote = note.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
    setEditPaymentNote(cleanedNote);
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
      // Extract client_app_ids from original note if present (for matching purposes)
      const originalNote = editingPayment.note || '';
      const idsMatch = originalNote.match(/\[([^\]]+)\]/);
      const clientAppIds = idsMatch ? idsMatch[1] : null;
      
      // Preserve client_app_ids in note if they exist (for bidirectional linking)
      // Only add IDs if the note starts with "Payment for" (auto-generated payments)
      const cleanedNote = editPaymentNote.trim();
      const finalNote = (clientAppIds && cleanedNote.startsWith('Payment for '))
        ? `${cleanedNote} [${clientAppIds}]`
        : cleanedNote;
      
      await updatePayment(
        {
          amount,
          note: finalNote || null,
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
    try {
      // Find the payment to get its note
      const paymentToDelete = Array.isArray(payments) 
        ? payments.find((p: any) => p.id === id)
        : null;
      
      if (!paymentToDelete) {
        setToast({ isOpen: true, message: 'Payment not found', type: 'error' });
        return;
      }

      const paymentNote = (paymentToDelete as any).note || '';
      
      // Extract client_app_ids from note (format: "Payment for ... [id1,id2,id3]" or "Payment for AppName, ClientName [id]")
      const idsMatch = paymentNote.match(/\[([^\]]+)\]/);
      if (idsMatch) {
        const clientAppIds = idsMatch[1].split(',').map((id: string) => id.trim());
        
        // Find and delete all app payments with matching client_app_ids
        if (Array.isArray(appPayments)) {
          for (const appPayment of appPayments) {
            const appPaymentAny = appPayment as any;
            if (clientAppIds.includes(appPaymentAny.client_app_id)) {
              await deleteAppPayment(appPaymentAny.id);
            }
          }
        }
      } else {
        // Fallback: try to match by client name (for backward compatibility with old records)
        // Format: "Payment for Client1, Client2" or "Payment for AppName, ClientName"
        const isGroupPayment = paymentNote.includes(',') && paymentNote.startsWith('Payment for ');
        
        if (isGroupPayment) {
          // Extract client names from note
          const noteParts = paymentNote.replace('Payment for ', '').split(',');
          const clientNames = noteParts.map((name: string) => name.trim());
          
          // Find all app payments that match these client names
          if (Array.isArray(appPayments)) {
            for (const appPayment of appPayments) {
              const appPaymentAny = appPayment as any;
              const client = Array.isArray(allClients) 
                ? allClients.find((c: any) => c.id === appPaymentAny.client_id)
                : null;
              const clientName = client 
                ? `${client.name}${client.surname ? ' ' + client.surname : ''}`.trim()
                : null;
              
              if (clientName && clientNames.includes(clientName)) {
                await deleteAppPayment(appPaymentAny.id);
              }
            }
          }
        } else {
          // Single payment - find matching app payment by client name
          const noteMatch = paymentNote.match(/Payment for (.+), (.+)/);
          if (noteMatch) {
            const clientName = noteMatch[2].trim();
            
            // Find app payment for this client
            if (Array.isArray(appPayments)) {
              for (const appPayment of appPayments) {
                const appPaymentAny = appPayment as any;
                const client = Array.isArray(allClients) 
                  ? allClients.find((c: any) => c.id === appPaymentAny.client_id)
                  : null;
                const appPaymentClientName = client 
                  ? `${client.name}${client.surname ? ' ' + client.surname : ''}`.trim()
                  : null;
                
                if (appPaymentClientName === clientName) {
                  await deleteAppPayment(appPaymentAny.id);
                  break;
                }
              }
            }
          }
        }
      }
      
      // Delete the payment from partner_payments
      await deletePayment(id, {
        onSuccess: async () => {
          await mutateAppPayments();
          await mutatePayments();
          setToast({ isOpen: true, message: 'Payment deleted successfully', type: 'success' });
        },
        onError: () => {
          setToast({ isOpen: true, message: 'Failed to delete payment', type: 'error' });
        }
      });
    } catch (error: any) {
      console.error('Failed to delete payment:', error);
      setToast({ isOpen: true, message: 'Failed to delete payment', type: 'error' });
    }
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
      lastEditedFieldRef.current = null; // Reset ref when modal opens
    }
  }, [partner, showEditPartnerModal]);

  // Track which field was last edited to prevent infinite loop
  const lastEditedFieldRef = React.useRef<'partner' | 'owner' | null>(null);

  // Auto-calculate owner share when partner share changes
  React.useEffect(() => {
    if (!showEditPartnerModal) return;
    if (lastEditedFieldRef.current === 'owner') {
      lastEditedFieldRef.current = null;
      return;
    }
    const partnerPct = Number(partnerSplitPartner) || 0;
    if (!isNaN(partnerPct) && partnerPct >= 0 && partnerPct <= 100) {
      const newOwnerPct = 100 - partnerPct;
      if (Number(partnerSplitOwner) !== newOwnerPct) {
        lastEditedFieldRef.current = 'partner';
        setPartnerSplitOwner(newOwnerPct.toString());
      }
    }
  }, [partnerSplitPartner, showEditPartnerModal, partnerSplitOwner]);

  // Auto-calculate partner share when owner share changes
  React.useEffect(() => {
    if (!showEditPartnerModal) return;
    if (lastEditedFieldRef.current === 'partner') {
      lastEditedFieldRef.current = null;
      return;
    }
    const ownerPct = Number(partnerSplitOwner) || 0;
    if (!isNaN(ownerPct) && ownerPct >= 0 && ownerPct <= 100) {
      const newPartnerPct = 100 - ownerPct;
      if (Number(partnerSplitPartner) !== newPartnerPct) {
        lastEditedFieldRef.current = 'owner';
        setPartnerSplitPartner(newPartnerPct.toString());
      }
    }
  }, [partnerSplitOwner, showEditPartnerModal, partnerSplitPartner]);

  // Handle click outside app table dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        appTableDropdownRef.current &&
        !appTableDropdownRef.current.contains(event.target as Node) &&
        appTableInputRef.current &&
        !appTableInputRef.current.contains(event.target as Node)
      ) {
        setShowAppTableDropdown(false);
      }
    };

    if (showAppTableDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAppTableDropdown]);

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
    lastEditedFieldRef.current = null; // Reset ref when modal closes
    if (partner) {
      setPartnerName(partner.name);
      setPartnerContactInfo(partner.contact_info || '');
      setPartnerSplitPartner((partner.default_split_partner * 100).toString());
      setPartnerSplitOwner((partner.default_split_owner * 100).toString());
      setPartnerNotes(partner.notes || '');
    }
  };

  // App-specific splits handlers
  const handleEditAppSplit = (appId: string, appName: string) => {
    const existingSplit = (appSplits as any[])?.find((s: any) => s.app_id === appId);
    if (existingSplit) {
      setEditingAppSplit({ appId, appName, splitPartner: Number(existingSplit.split_partner) * 100, splitOwner: Number(existingSplit.split_owner) * 100 });
      setAppSplitPartner((Number(existingSplit.split_partner) * 100).toString());
      setAppSplitOwner((Number(existingSplit.split_owner) * 100).toString());
    } else {
      setEditingAppSplit({ appId, appName, splitPartner: (partner?.default_split_partner ?? 0.25) * 100, splitOwner: (partner?.default_split_owner ?? 0.75) * 100 });
      setAppSplitPartner(((partner?.default_split_partner ?? 0.25) * 100).toString());
      setAppSplitOwner(((partner?.default_split_owner ?? 0.75) * 100).toString());
    }
    setShowAppSplitsModal(true);
  };

  const handleSaveAppSplit = async () => {
    if (!editingAppSplit || !partnerId) return;
    
    const partnerPct = Number(appSplitPartner) / 100;
    const ownerPct = Number(appSplitOwner) / 100;
    
    if (Number.isNaN(partnerPct) || Number.isNaN(ownerPct)) {
      setToast({ isOpen: true, message: 'Split percentages must be numbers', type: 'error' });
      return;
    }
    
    const totalSplit = (Number(appSplitPartner) || 0) + (Number(appSplitOwner) || 0);
    if (totalSplit !== 100) {
      setToast({ isOpen: true, message: `Total split must equal 100% (currently ${totalSplit}%)`, type: 'error' });
      return;
    }

    setIsSubmittingAppSplit(true);
    try {
      const existingSplit = (appSplits as any[])?.find((s: any) => s.app_id === editingAppSplit.appId);
      
      if (existingSplit) {
        await updateAppSplit(
          {
            split_partner: partnerPct,
            split_owner: ownerPct
          },
          existingSplit.id,
          {
            onSuccess: () => {
              mutateAppSplits();
              setShowAppSplitsModal(false);
              setEditingAppSplit(null);
              setToast({ isOpen: true, message: 'App split updated successfully', type: 'success' });
            },
            onError: () => {
              setToast({ isOpen: true, message: 'Failed to update app split', type: 'error' });
            }
          }
        );
      } else {
        await insertAppSplit(
          {
            partner_id: partnerId,
            app_id: editingAppSplit.appId,
            split_partner: partnerPct,
            split_owner: ownerPct
          } as any,
          {
            onSuccess: () => {
              mutateAppSplits();
              setShowAppSplitsModal(false);
              setEditingAppSplit(null);
              setToast({ isOpen: true, message: 'App split created successfully', type: 'success' });
            },
            onError: () => {
              setToast({ isOpen: true, message: 'Failed to create app split', type: 'error' });
            }
          }
        );
      }
    } catch (error) {
      setToast({ isOpen: true, message: 'Failed to save app split', type: 'error' });
    } finally {
      setIsSubmittingAppSplit(false);
    }
  };

  const handleDeleteAppSplit = async (appId: string) => {
    const existingSplit = (appSplits as any[])?.find((s: any) => s.app_id === appId);
    if (!existingSplit) return;
    
    await deleteAppSplit(existingSplit.id, {
      onSuccess: () => {
        mutateAppSplits();
        setToast({ isOpen: true, message: 'App split deleted successfully', type: 'success' });
      },
      onError: () => {
        setToast({ isOpen: true, message: 'Failed to delete app split', type: 'error' });
      }
    });
  };

  const handleCloseAppSplitsModal = () => {
    setShowAppSplitsModal(false);
    setEditingAppSplit(null);
    setAppSplitPartner('');
    setAppSplitOwner('');
  };

  // Auto-calculate owner share when partner share changes
  React.useEffect(() => {
    if (!showAppSplitsModal) return;
    const partnerPct = Number(appSplitPartner) || 0;
    if (!isNaN(partnerPct) && partnerPct >= 0 && partnerPct <= 100) {
      setAppSplitOwner((100 - partnerPct).toString());
    }
  }, [appSplitPartner, showAppSplitsModal]);

  // Auto-calculate partner share when owner share changes
  React.useEffect(() => {
    if (!showAppSplitsModal) return;
    const ownerPct = Number(appSplitOwner) || 0;
    if (!isNaN(ownerPct) && ownerPct >= 0 && ownerPct <= 100) {
      setAppSplitPartner((100 - ownerPct).toString());
    }
  }, [appSplitOwner, showAppSplitsModal]);

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
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
              onClick={() => setShowAppSplitsModal(true)}
            >
              App Splits
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
                      onClick={() => handlePaymentSort('date')}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                    >
                      Date {paymentSortColumn === 'date' && (paymentSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
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
                      onClick={() => handlePaymentSort('note')}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                    >
                      Note {paymentSortColumn === 'note' && (paymentSortDirection === 'asc' ? '↑' : '↓')}
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
                      onClick={() => handlePaymentSort('amount')}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#0f172a'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#475569'}
                    >
                      Amount {paymentSortColumn === 'amount' && (paymentSortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPayments.map((payment, idx) => (
                    <tr
                      key={payment.id}
                      style={{
                        borderBottom: idx < sortedPayments.length - 1 ? '1px solid #e2e8f0' : 'none',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#0f172a' }}>
                        {new Date(payment.paid_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b' }}>
                        {payment.note ? payment.note.replace(/\s*\[[^\]]+\]\s*$/, '') : '—'}
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
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {/* Client Search */}
            <div style={{ flex: 1, minWidth: '200px' }}>
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
            
            {/* App Filter */}
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                <input
                  ref={appTableInputRef}
                  type="text"
                  value={appTableFilter ? (availableAppsForFilter.find(a => a.id === appTableFilter)?.name || '') : appTableSearch}
                  onChange={(e) => {
                    setAppTableSearch(e.target.value);
                    setShowAppTableDropdown(true);
                    if (!e.target.value) {
                      setAppTableFilter('');
                    }
                  }}
                  placeholder="Filter by app..."
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.75rem',
                    paddingRight: appTableFilter ? '2rem' : '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    setShowAppTableDropdown(true);
                  }}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                />
                {appTableFilter && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAppTableFilter('');
                      setAppTableSearch('');
                      setShowAppTableDropdown(false);
                    }}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      fontSize: '1.25rem',
                      lineHeight: 1,
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                  >
                    ×
                  </button>
                )}
              </div>
              
              {showAppTableDropdown && (
                <div
                  ref={appTableDropdownRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'white',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000
                  }}
                >
                  {filteredAppsForTable.length === 0 ? (
                    <div style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#64748b', textAlign: 'center' }}>
                      {appTableSearch.trim() ? 'No apps found' : 'No apps available'}
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={() => {
                          setAppTableFilter('');
                          setAppTableSearch('');
                          setShowAppTableDropdown(false);
                        }}
                        style={{
                          padding: '0.625rem 0.75rem',
                          fontSize: '0.875rem',
                          color: '#475569',
                          cursor: 'pointer',
                          borderBottom: '1px solid #e2e8f0',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        All Apps
                      </div>
                      {filteredAppsForTable.map((app) => (
                        <div
                          key={app.id}
                          onClick={() => {
                            setAppTableFilter(app.id);
                            setAppTableSearch('');
                            setShowAppTableDropdown(false);
                          }}
                          style={{
                            padding: '0.625rem 0.75rem',
                            fontSize: '0.875rem',
                            color: appTableFilter === app.id ? '#3b82f6' : '#0f172a',
                            cursor: 'pointer',
                            backgroundColor: appTableFilter === app.id ? '#eff6ff' : 'transparent',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            if (appTableFilter !== app.id) {
                              e.currentTarget.style.backgroundColor = '#f8fafc';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (appTableFilter !== app.id) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          {app.name}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
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
                    
                    // Get completed apps for this client (filtered by appTableFilter if set)
                    // Note: Only 'completed' apps contribute to partner "due" calculation
                    // Apps with status 'paid' are not included in the breakdown
                    const clientCompletedApps = (clientApps && Array.isArray(clientApps)) 
                      ? clientApps.filter((app: any) => {
                          if (!app || app.client_id !== row.clientId) return false;
                          if (app.status !== 'completed') return false;
                          // If app filter is active, only show apps matching the filter
                          if (appTableFilter && app.app_id !== appTableFilter) return false;
                          return true;
                        })
                      : [];
                    
                    const isExpanded = expandedClients.has(row.clientId);
                    // Use default split for the row (will be calculated per app in the expanded section)
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
                                // Get unpaid apps for this client (already filtered by appTableFilter if active)
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
                                
                                // Show checkbox if there are completed apps (even if all are paid, to show state)
                                // But only enable it if there are unpaid apps
                                const hasUnpaidApps = unpaidAppIds.length > 0;
                                const appFilterName = appTableFilter ? availableAppsForFilter.find(a => a.id === appTableFilter)?.name : null;
                                const titleText = appFilterName 
                                  ? `Select all ${unpaidAppIds.length} unpaid ${appFilterName} app(s) for this client`
                                  : `Select all ${unpaidAppIds.length} unpaid app(s) for this client`;
                                
                                return clientCompletedApps.length > 0 ? (
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    disabled={!hasUnpaidApps}
                                    ref={(input) => {
                                      if (input) input.indeterminate = someSelected;
                                    }}
                                    onChange={() => toggleAllClientApps(row.clientId, clientCompletedApps)}
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      cursor: hasUnpaidApps ? 'pointer' : 'not-allowed',
                                      accentColor: '#059669',
                                      flexShrink: 0,
                                      opacity: hasUnpaidApps ? 1 : 0.5
                                    }}
                                    title={hasUnpaidApps ? titleText : appFilterName ? `All ${appFilterName} apps for this client are already paid` : 'All apps for this client are already paid'}
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
                                  {appTableFilter 
                                    ? `Completed Apps - ${availableAppsForFilter.find(a => a.id === appTableFilter)?.name || 'Filtered'} (${clientCompletedApps.length})`
                                    : `Completed Apps (${clientCompletedApps.length})`
                                  }
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
                                    // Get app-specific split for this app
                                    const { splitPartner: appSplitPartner } = getAppSplit(app.app_id, assignment);
                                    const partnerAmount = profitUs * appSplitPartner;
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
                                              onClick={() => handleMarkAppAsPaid(app.id, row.clientId, appName, profitUs, appSplitPartner)}
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
                            lastEditedFieldRef.current = 'partner';
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
                            lastEditedFieldRef.current = 'owner';
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

      {/* App Splits Modal */}
      {showAppSplitsModal && partner && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseAppSplitsModal();
            }
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                {editingAppSplit ? `Edit Split for ${editingAppSplit.appName}` : 'App-Specific Splits'}
              </h2>
              <button
                onClick={handleCloseAppSplitsModal}
                style={{
                  background: 'transparent',
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

            {editingAppSplit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Partner Share (%) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={appSplitPartner}
                    onChange={(e) => setAppSplitPartner(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    Owner Share (%) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={appSplitOwner}
                    onChange={(e) => setAppSplitOwner(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleCloseAppSplitsModal}
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
                    onClick={handleSaveAppSplit}
                    disabled={isSubmittingAppSplit}
                    style={{
                      flex: 1,
                      padding: '0.625rem',
                      borderRadius: '8px',
                      background: isSubmittingAppSplit ? '#94a3b8' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      cursor: isSubmittingAppSplit ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSubmittingAppSplit) {
                        e.currentTarget.style.background = '#2563eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSubmittingAppSplit) {
                        e.currentTarget.style.background = '#3b82f6';
                      }
                    }}
                  >
                    {isSubmittingAppSplit ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                  Configure different profit splits for each app. These will override the default partner split for that specific app.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {allAppsArray.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                      No apps available
                    </div>
                  ) : (
                    allAppsArray.map((app: any) => {
                      const existingSplit = (appSplits as any[])?.find((s: any) => s.app_id === app.id);
                      const splitPartner = existingSplit ? Number(existingSplit.split_partner) * 100 : (partner.default_split_partner * 100);
                      const splitOwner = existingSplit ? Number(existingSplit.split_owner) * 100 : (partner.default_split_owner * 100);
                      
                      return (
                        <div
                          key={app.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem',
                            background: existingSplit ? '#f0fdf4' : 'white',
                            borderRadius: '8px',
                            border: existingSplit ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                              {app.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {splitPartner.toFixed(1)}% / {splitOwner.toFixed(1)}%
                              {existingSplit && <span style={{ marginLeft: '0.5rem', color: '#059669', fontWeight: '500' }}>(Custom)</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleEditAppSplit(app.id, app.name)}
                              style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                color: '#3b82f6',
                                background: 'white',
                                border: '1px solid #3b82f6',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#eff6ff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'white';
                              }}
                            >
                              {existingSplit ? 'Edit' : 'Set'}
                            </button>
                            {existingSplit && (
                              <button
                                onClick={() => handleDeleteAppSplit(app.id)}
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
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
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
