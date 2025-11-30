'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
  onPageSizeChange?: (size: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  totalItems,
  onPageSizeChange
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        borderTop: '1px solid #e2e8f0',
        marginTop: '1rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Showing {startItem}-{endItem} of {totalItems}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            style={{
              padding: '0.35rem 0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.875rem'
            }}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          disabled={currentPage === 1}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            background: currentPage === 1 ? '#f1f5f9' : 'white',
            color: currentPage === 1 ? '#94a3b8' : '#475569',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem'
          }}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </button>
        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} style={{ padding: '0 0.5rem', color: '#94a3b8' }}>
                ...
              </span>
            );
          }
          const pageNum = page as number;
          const isActive = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: isActive ? '#2563eb' : 'white',
                color: isActive ? 'white' : '#475569',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400
              }}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          disabled={currentPage === totalPages}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            background: currentPage === totalPages ? '#f1f5f9' : 'white',
            color: currentPage === totalPages ? '#94a3b8' : '#475569',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem'
          }}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

