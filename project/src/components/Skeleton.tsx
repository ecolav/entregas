import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`motion-safe:animate-pulse bg-gray-200 rounded ${className}`} />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="motion-safe:animate-pulse h-3 bg-gray-200 rounded" />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`border rounded-lg p-4 ${className}`}>
    <div className="animate-pulse h-4 w-1/3 bg-gray-200 rounded mb-3" />
    <div className="space-y-2">
      <div className="animate-pulse h-3 bg-gray-200 rounded" />
      <div className="animate-pulse h-3 bg-gray-200 rounded" />
      <div className="animate-pulse h-3 bg-gray-200 rounded w-2/3" />
    </div>
  </div>
);


