'use client';

import React, { type ReactNode } from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Array<Column<T>>;
  emptyLabel?: string;
  renderRow?: (row: T, rowIndex: number) => ReactNode | null;
  sortColumn?: keyof T | string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: keyof T | string) => void;
  onRowClick?: (row: T) => void;
  rowStyle?: React.CSSProperties;
}

export function DataTable<T>({ 
  data, 
  columns, 
  emptyLabel = 'No records yet', 
  renderRow,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
  rowStyle
}: DataTableProps<T>) {
  if (!data.length) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  const handleSort = (column: Column<T>) => {
    if (column.sortable !== false && onSort) {
      onSort(column.key);
    }
  };

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSortable = column.sortable !== false && onSort;
              const isSorted = sortColumn === column.key;
              const isAsc = sortDirection === 'asc';
              
              return (
                <th 
                  key={column.header}
                  onClick={() => handleSort(column)}
                  className={isSortable ? 'sortable-header' : ''}
                  style={{
                    cursor: isSortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    position: 'relative',
                    paddingRight: isSortable ? '1.5rem' : undefined
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{column.header}</span>
                    {isSortable && (
                      <span style={{ 
                        fontSize: '0.75rem',
                        color: isSorted ? '#3b82f6' : '#94a3b8',
                        display: 'inline-flex',
                        flexDirection: 'column',
                        lineHeight: '0.8'
                      }}>
                        {isSorted ? (
                          isAsc ? '▲' : '▼'
                        ) : (
                          <span style={{ opacity: 0.3 }}>⇅</span>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const customRow = renderRow ? renderRow(row, rowIndex) : null;
            if (customRow) {
              return <React.Fragment key={rowIndex}>{customRow}</React.Fragment>;
            }
            return (
              <tr 
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                style={{
                  ...rowStyle,
                  cursor: onRowClick ? 'pointer' : 'default'
                }}
              >
                {columns.map((column) => {
                  if (column.render) {
                    return (
                      <td 
                        key={column.header}
                        onClick={(e) => {
                          // Prevent row click if clicking on buttons or interactive elements
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'BUTTON' || target.closest('button') || target.closest('a')) {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {column.render(row)}
                      </td>
                    );
                  }
                  const key = column.key as keyof T;
                  const value = row[key];
                  return (
                    <td 
                      key={column.header}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.tagName === 'BUTTON' || target.closest('button') || target.closest('a')) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {value as ReactNode}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
