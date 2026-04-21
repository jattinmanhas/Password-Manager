import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useVaultSession } from '../../../app/providers/VaultProvider';
import { auditService, AuditEvent } from '../services/audit.service';
import { DashboardStats } from '../components/DashboardStats';
import { QuickActions } from '../components/QuickActions';
import { RecentActivity } from '../components/RecentActivity';
import { authService } from '../../auth/services/auth.service';
import { sharingService } from '../../vault/services/sharing.service';
import { calculateSecurityHealth } from '../dashboard.utils';
import { Shield, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HealthRecommendation } from '../components/HealthRecommendation';

export function Dashboard() {
  const { session } = useAuth();
  const { items, kek, lockVault } = useVaultSession();
  const navigate = useNavigate();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [sharedExposureCount, setSharedExposureCount] = useState(0);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsEventsLoading(true);
        const response = await auditService.getLogs(10, 0);
        setEvents(response.events);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
      } finally {
        setIsEventsLoading(false);
      }
    };

    fetchEvents();
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchRecoveryStatus = async () => {
      try {
        const response = await authService.getRecoveryStatus();
        setRecoveryEnabled(response.is_enabled);
      } catch (err) {
        console.error('Failed to fetch recovery status:', err);
        setRecoveryEnabled(false);
      }
    };

    void fetchRecoveryStatus();
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const fetchSharedExposure = async () => {
      try {
        const response = await sharingService.listSentShares();
        const uniqueSharedItemIds = new Set(response.shares.map((share) => share.item_id));
        setSharedExposureCount(uniqueSharedItemIds.size);
      } catch (err) {
        console.error('Failed to fetch sent shares:', err);
        setSharedExposureCount(0);
      }
    };

    void fetchSharedExposure();
  }, [session]);

  // Calculate Dashboard Metrics
  const metrics = useMemo(() => {
    return calculateSecurityHealth({
      items: items ?? [],
      recentActivityCount: events.length,
      session: session
        ? {
            user_id: session.userId,
            expires_at: session.expiresAt,
            email: session.email,
            name: session.name,
            is_totp_enabled: session.isTotpEnabled,
          }
        : null,
      recoveryEnabled,
      sharedExposureCount,
    });
  }, [items, events, session, recoveryEnabled, sharedExposureCount]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = session?.name?.split(' ')[0] || 'there';
    if (hour < 12) return `Good morning, ${name}!`;
    if (hour < 18) return `Good afternoon, ${name}!`;
    return `Good evening, ${name}!`;
  };

  const isLocked = !kek;
  const handleUnlockVault = () => navigate('/vault');
  const handleLockVault = () => lockVault();

  return (
    <div className="dashboard-page dashboard-page-mobile" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', width: '100%', minWidth: 0 }}>
      {/* Header Section */}
      <div className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <LayoutDashboard size={24} color="var(--color-security-blue)" />
          <h1 className="dashboard-title">
            Dashboard
          </h1>
        </div>
        <p className="dashboard-greeting">
          {getGreeting()} Your vault health is currently <span style={{ fontWeight: '600', color: isLocked ? 'var(--color-text-subtle)' : (metrics.securityScore >= 80 ? 'var(--color-soft-green)' : 'var(--color-amber)') }}>
            {isLocked ? 'Locked' : `${metrics.securityScore}%`}
          </span>.
        </p>
      </div>
      
      {/* Stats Summary Grid */}
      <DashboardStats 
        totalItems={metrics.totalItems}
        securityScore={metrics.securityScore}
        weakPasswords={metrics.weakPasswords}
        reusedPasswords={metrics.reusedPasswords}
        recentActivityCount={metrics.recentActivityCount}
        sharedItems={metrics.sharedItems}
        sensitiveNotes={metrics.sensitiveNotes}
        corruptedItems={metrics.corruptedItems}
        breakdown={metrics.breakdown}
        isLocked={isLocked}
        onUnlockVault={handleUnlockVault}
        onLockVault={handleLockVault}
      />

      <div className="dashboard-main-grid grid-responsive" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', marginTop: '1rem' }}>
        {/* Left Column: Recent Activity */}
        <div className="dashboard-left">
          <RecentActivity events={events} isLoading={isEventsLoading} />
        </div>

        {/* Right Column: Quick Actions & Sidebar Info */}
        <div className="dashboard-sidebar">
          <QuickActions />
          
          {/* Health Recommendation Card */}
          <HealthRecommendation 
            weakPasswords={metrics.weakPasswords}
            reusedPasswords={metrics.reusedPasswords}
            sensitiveNotes={metrics.sensitiveNotes}
            corruptedItems={metrics.corruptedItems}
          />
        </div>
      </div>
    </div>
  );
}
