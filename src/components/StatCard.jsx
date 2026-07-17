import React from 'react';
import * as Icons from 'lucide-react';

export default function StatCard({ title, value, iconName, color }) {
  const IconComponent = Icons[iconName] || Icons.FileText;

  return (
    <div className="glass-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: '600', margin: 0 }}>{title}</h3>
        <div style={{ 
          backgroundColor: `${color}20`, 
          color: color, 
          padding: '0.5rem', 
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <IconComponent size={20} />
        </div>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-main)' }}>
        {value}
      </div>
    </div>
  );
}
