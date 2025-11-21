'use client';

import React, { type ReactNode } from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Array<Column<T>>;
  emptyLabel?: string;
  renderRow?: (row: T, rowIndex: number) => ReactNode | null;
}

export function DataTable<T>({ data, columns, emptyLabel = 'No records yet', renderRow }: DataTableProps<T>) {
  if (!data.length) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.header}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => {
            const customRow = renderRow ? renderRow(row, rowIndex) : null;
            if (customRow) {
              return <React.Fragment key={rowIndex}>{customRow}</React.Fragment>;
            }
            return (
              <tr key={rowIndex}>
                {columns.map((column) => {
                  if (column.render) {
                    return <td key={column.header}>{column.render(row)}</td>;
                  }
                  const key = column.key as keyof T;
                  const value = row[key];
                  return <td key={column.header}>{value as ReactNode}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
