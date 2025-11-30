'use client';

import { useEffect } from 'react';

interface ToastProps {
  isOpen: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export function Toast({ isOpen, message, type = 'success', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const typeStyles = {
    success: {
      bg: '#10b981',
      border: '#059669',
      icon: '✓'
    },
    error: {
      bg: '#ef4444',
      border: '#dc2626',
      icon: '✕'
    },
    info: {
      bg: '#3b82f6',
      border: '#2563eb',
      icon: 'ℹ'
    }
  };

  const styles = typeStyles[type];

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        minWidth: '300px',
        maxWidth: '500px',
        backgroundColor: styles.bg,
        color: 'white',
        padding: '1rem 1.25rem',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        animation: 'slideIn 0.3s ease-out',
        border: `1px solid ${styles.border}`
      }}
    >
      <div
        style={{
          fontSize: '1.25rem',
          fontWeight: 'bold',
          flexShrink: 0
        }}
      >
        {styles.icon}
      </div>
      <div
        style={{
          flex: 1,
          fontSize: '0.95rem',
          lineHeight: '1.5',
          fontWeight: '500'
        }}
      >
        {message}
      </div>
      <button
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          fontSize: '1.25rem',
          fontWeight: 'bold',
          padding: '0',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          flexShrink: 0,
          opacity: 0.8
        }}
        title="Close"
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.8';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onClick={onClose}
      >
        ×
      </button>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

