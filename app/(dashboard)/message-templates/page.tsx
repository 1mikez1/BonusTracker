'use client';

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SectionHeader } from '@/components/SectionHeader';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';

export default function MessageTemplatesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    data: templates,
    isLoading: templatesLoading,
    error: templatesError,
    mutate: mutateTemplates
  } = useSupabaseData({
    table: 'message_templates',
    order: { column: 'step_order', ascending: true },
    select: '*, apps(*)'
  });
  
  const {
    data: apps,
    isLoading: appsLoading
  } = useSupabaseData({
    table: 'apps',
    order: { column: 'name', ascending: true }
  });

  const {
    data: promotions,
    isLoading: promotionsLoading
  } = useSupabaseData({
    table: 'promotions',
    select: '*',
    order: { column: 'end_date', ascending: true, nullsFirst: false }
  });

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  // Check for appId and returnTo in URL query params (from client profile page)
  useEffect(() => {
    const appIdFromQuery = searchParams.get('appId');
    const returnToFromQuery = searchParams.get('returnTo');
    if (appIdFromQuery) {
      setSelectedAppId(appIdFromQuery);
      setShowOnboard(false); // Ensure we're not showing Onboard when app is selected
    }
    if (returnToFromQuery) {
      setReturnTo(returnToFromQuery);
    }
  }, [searchParams]);

  const isLoading = templatesLoading || appsLoading || promotionsLoading;
  const error = templatesError;

  // Helper function to check if a promotion is currently active
  const isPromotionActive = (promo: any): boolean => {
    if (!promo) return false;
    
    if (promo.is_active === false) return false;
    if (promo.is_active === true) {
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
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!promo.start_date && !promo.end_date) return true;
    
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
  };

  // Group apps by active/expired status
  const appsWithStatus = useMemo(() => {
    const appsArray = Array.isArray(apps) ? apps : [];
    const promotionsArray = Array.isArray(promotions) ? promotions : [];
    
    // Get apps with active promotions
    const appsWithActivePromotions = new Set(
      promotionsArray
        .filter((promo: any) => isPromotionActive(promo))
        .map((promo: any) => promo.app_id)
    );
    
    // Get apps with expired promotions only
    const appsWithExpiredPromotions = new Set(
      promotionsArray
        .filter((promo: any) => {
          if (!promo.app_id) return false;
          return !isPromotionActive(promo);
        })
        .map((promo: any) => promo.app_id)
    );
    
    const activeApps: any[] = [];
    const expiredApps: any[] = [];
    
    appsArray.forEach((app: any) => {
      if (appsWithActivePromotions.has(app.id)) {
        activeApps.push({ ...app, status: 'active' });
      } else if (appsWithExpiredPromotions.has(app.id)) {
        expiredApps.push({ ...app, status: 'expired' });
      } else {
        // Apps without promotions - consider as expired
        expiredApps.push({ ...app, status: 'expired' });
      }
    });
    
    // Sort: active first, then expired
    return [...activeApps, ...expiredApps];
  }, [apps, promotions]);

  // Get Onboard templates (generic templates with app_id = null)
  // Only include templates with specific Onboard steps
  const onboardTemplates = useMemo(() => {
    const templatesArray = Array.isArray(templates) ? templates : [];
    const onboardSteps = [
      'spiegazione + registrazione modulo',
      'spiegazione + registrazione modulo light',
      'prenotazione fup'
    ];
    
    const onboardList = templatesArray.filter((t: any) => {
      // Must have app_id = null
      if (t.app_id) return false;
      
      // Must have one of the specific Onboard steps
      const stepLower = (t.step || '').toLowerCase();
      return onboardSteps.some(onboardStep => stepLower.includes(onboardStep));
    });
    
    // Sort by step_order, then by step name
    onboardList.sort((a: any, b: any) => {
      const orderA = a.step_order ?? 999;
      const orderB = b.step_order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      const stepA = (a.step || 'Other').toLowerCase();
      const stepB = (b.step || 'Other').toLowerCase();
      return stepA.localeCompare(stepB);
    });
    
    // Group by step
    const grouped: { [key: string]: any[] } = {};
    onboardList.forEach((template: any) => {
      const step = template.step || 'Other';
      if (!grouped[step]) {
        grouped[step] = [];
      }
      grouped[step].push(template);
    });
    
    return grouped;
  }, [templates]);

  // Get templates for selected app, grouped by step
  const appTemplates = useMemo(() => {
    if (!selectedAppId) return [];
    
    const templatesArray = Array.isArray(templates) ? templates : [];
    const appTemplatesList = templatesArray.filter((t: any) => t.app_id === selectedAppId);
    
    // Sort templates by step_order (from database), then by step name as fallback
    appTemplatesList.sort((a: any, b: any) => {
      const orderA = a.step_order ?? 999;
      const orderB = b.step_order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      // Fallback to step name if step_order is not set
      const stepA = (a.step || 'Other').toLowerCase();
      const stepB = (b.step || 'Other').toLowerCase();
      return stepA.localeCompare(stepB);
    });
    
    // Group by step, maintaining order
    const grouped: { [key: string]: any[] } = {};
    const stepOrderArray: string[] = []; // Track order of steps as they appear
    
    appTemplatesList.forEach((template: any) => {
      const step = template.step || 'Other';
      if (!grouped[step]) {
        grouped[step] = [];
        stepOrderArray.push(step); // Track first occurrence order
      }
      grouped[step].push(template);
    });
    
    // Return grouped object with ordered steps
    const orderedGrouped: { [key: string]: any[] } = {};
    stepOrderArray.forEach(step => {
      orderedGrouped[step] = grouped[step];
    });
    
    return orderedGrouped;
  }, [selectedAppId, templates]);

  const selectedApp = appsWithStatus.find((app: any) => app.id === selectedAppId);

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Message Templates" description="Loading templates..." />
        <LoadingSpinner message="Loading message templates..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionHeader title="Message Templates" description="Error loading templates" />
        <ErrorMessage error={error} onRetry={mutateTemplates} />
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Message Templates"
        description="Copy/paste guides covering registration, KYC and deposit steps."
      />
      
      {!selectedAppId && !showOnboard ? (
        <>
          {/* Onboard Section */}
          {Object.keys(onboardTemplates).length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', marginTop: '1.5rem' }}>
                Onboard Templates
              </h2>
              <div
                onClick={() => setShowOnboard(true)}
                style={{
                  backgroundColor: '#f0fdf4',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: '2px solid #10b981',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                }}
              >
                <strong style={{ 
                  color: '#065f46', 
                  fontSize: '1rem',
                  display: 'block',
                  marginBottom: '0.5rem'
                }}>
                  Onboard
                </strong>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: '#10b981',
                  fontWeight: '600',
                  textTransform: 'uppercase'
                }}>
                  ● Generic Templates
                </span>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                  {Object.keys(onboardTemplates).length} template{Object.keys(onboardTemplates).length !== 1 ? 's' : ''}
                </div>
              </div>
            </section>
          )}

          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', marginTop: '1.5rem' }}>
            Available Apps
          </h2>
          {appsWithStatus.length === 0 ? (
            <EmptyState
              title="No apps found"
              message="No apps with message templates available."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {appsWithStatus.map((app: any) => {
                const isActive = app.status === 'active';
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    style={{
                      backgroundColor: isActive ? '#f0fdf4' : '#fef2f2',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: `2px solid ${isActive ? '#10b981' : '#ef4444'}`,
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    <strong style={{ 
                      color: isActive ? '#065f46' : '#991b1b', 
                      fontSize: '1rem',
                      display: 'block',
                      marginBottom: '0.5rem'
                    }}>
                      {app.name}
                    </strong>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: isActive ? '#10b981' : '#ef4444',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
                      {isActive ? '● Active' : '○ Expired'}
                    </span>
                    {app.app_type && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                        {app.app_type}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : showOnboard ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            {returnTo ? (
              <Link
                href={returnTo}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#64748b',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'inline-block'
                }}
              >
                ← Back to Profile
              </Link>
            ) : (
              <button
                onClick={() => setShowOnboard(false)}
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
                ← Back to Apps
              </button>
            )}
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
              Onboard - Message Templates
            </h2>
            <span style={{ 
              padding: '0.25rem 0.75rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '600',
              backgroundColor: '#d1fae5',
              color: '#065f46'
            }}>
              ● Generic Templates
            </span>
          </div>

          {Object.keys(onboardTemplates).length === 0 ? (
            <EmptyState
              title="No templates found"
              message="No Onboard message templates available."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {Object.entries(onboardTemplates).map(([step, stepTemplates]) => (
                <div key={step} style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#1e293b' }}>
                    {step}
                  </h3>
                  {stepTemplates.map((template: any) => (
                    <div
                      key={template.id}
                      style={{
                        backgroundColor: 'white',
                        padding: '1.25rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#334155' }}>
                          {template.name}
                        </h4>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(template.content);
                              alert('Copied to clipboard!');
                            } catch (err) {
                              console.error('Failed to copy:', err);
                              alert('Failed to copy to clipboard');
                            }
                          }}
                          style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.875rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Copy
                        </button>
                      </div>
                      <pre style={{
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                        color: '#475569',
                        fontFamily: 'inherit',
                        backgroundColor: '#f8fafc',
                        padding: '1rem',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}>
                        {template.content}
                      </pre>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            {returnTo ? (
              <Link
                href={returnTo}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#64748b',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  display: 'inline-block'
                }}
              >
                ← Back to Profile
              </Link>
            ) : (
              <button
                onClick={() => setSelectedAppId(null)}
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
                ← Back to Apps
              </button>
            )}
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
              {selectedApp?.name} - Message Templates
            </h2>
            {selectedApp && (
              <span style={{ 
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: '600',
                backgroundColor: selectedApp.status === 'active' ? '#d1fae5' : '#fee2e2',
                color: selectedApp.status === 'active' ? '#065f46' : '#991b1b'
              }}>
                {selectedApp.status === 'active' ? '● Active' : '○ Expired'}
              </span>
            )}
          </div>

          {Object.keys(appTemplates).length === 0 ? (
            <EmptyState
              title="No templates found"
              message={`No message templates available for ${selectedApp?.name}.`}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {Object.entries(appTemplates).map(([step, stepTemplates]) => (
                <div key={step} style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#1e293b' }}>
                    {step}
                  </h3>
                  {stepTemplates.map((template: any) => (
                    <div
                      key={template.id}
                      style={{
                        backgroundColor: 'white',
                        padding: '1.25rem',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#334155' }}>
                          {template.name}
                        </h4>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(template.content);
                              alert('Copied to clipboard!');
                            } catch (err) {
                              console.error('Failed to copy:', err);
                              alert('Failed to copy to clipboard');
                            }
                          }}
                          style={{
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.875rem',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Copy
                        </button>
                      </div>
                      <pre style={{
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                        color: '#475569',
                        fontFamily: 'inherit',
                        backgroundColor: '#f8fafc',
                        padding: '1rem',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}>
                        {template.content}
                      </pre>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
