/**
 * Security monitoring dashboard component
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSecurityContext } from './SecurityProvider';
import { Shield, AlertTriangle, Eye, Activity, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface SecurityEvent {
  id: string;
  event_type: string;
  table_name?: string;
  details: any;
  created_at: string;
  user_id?: string;
}

export function SecurityDashboard() {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { securityStatus, clearSecurityHistory } = useSecurityContext();

  useEffect(() => {
    loadSecurityEvents();
  }, []);

  const loadSecurityEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('security_events_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load security events:', error);
        return;
      }

      setSecurityEvents(data || []);
    } catch (error) {
      console.error('Error loading security events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (eventType: string) => {
    if (eventType.includes('malicious') || eventType.includes('blocked')) {
      return <Badge variant="destructive">Critical</Badge>;
    }
    if (eventType.includes('suspicious') || eventType.includes('failed')) {
      return <Badge variant="secondary">Warning</Badge>;
    }
    return <Badge variant="outline">Info</Badge>;
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('access')) return <Eye className="h-4 w-4" />;
    if (eventType.includes('credential')) return <Shield className="h-4 w-4" />;
    if (eventType.includes('malicious') || eventType.includes('blocked')) return <AlertTriangle className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const formatEventDetails = (details: any) => {
    if (!details) return 'No details available';
    
    const formatted = Object.entries(details)
      .filter(([key, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    return formatted || 'No details available';
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear the security event history?')) {
      clearSecurityHistory();
      await loadSecurityEvents();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <div className="text-muted-foreground">Loading security events...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
          <CardDescription>
            Current security monitoring status and recent threats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${securityStatus.isSecure ? 'text-green-600' : 'text-red-600'}`}>
                {securityStatus.isSecure ? 'Secure' : 'Alert'}
              </div>
              <div className="text-sm text-muted-foreground">System Status</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {securityStatus.threats.length}
              </div>
              <div className="text-sm text-muted-foreground">Active Threats</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${securityStatus.rateLimit.blocked ? 'text-red-600' : 'text-green-600'}`}>
                {securityStatus.rateLimit.blocked ? 'Blocked' : 'Normal'}
              </div>
              <div className="text-sm text-muted-foreground">Rate Limiting</div>
            </div>
          </div>

          {securityStatus.threats.length > 0 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {securityStatus.threats.length} security threat(s) detected. Review the events below.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Security Events Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Security Events</CardTitle>
            <CardDescription>
              Recent security events and monitoring data
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSecurityEvents}>
              Refresh
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearHistory}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear History
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {securityEvents.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              No security events recorded
            </div>
          ) : (
            <div className="space-y-3">
              {securityEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="mt-0.5">
                    {getEventIcon(event.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{event.event_type.replace(/_/g, ' ')}</span>
                      {getSeverityBadge(event.event_type)}
                      {event.table_name && (
                        <Badge variant="outline" className="text-xs">
                          {event.table_name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-1">
                      {formatEventDetails(event.details)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(event.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}