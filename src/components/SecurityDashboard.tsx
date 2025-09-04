/**
 * Security Monitoring Dashboard Component
 */
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Clock, Activity, Eye, EyeOff } from 'lucide-react';
import { useSecurityContext } from './SecurityProvider';

interface SecurityEvent {
  id: string;
  event_type: string;
  table_name?: string;
  details: any; // Using any to handle Json type from Supabase
  created_at: string;
  user_id?: string;
}

export function SecurityDashboard() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
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

      setEvents(data || []);
    } catch (error) {
      console.error('Error loading security events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (eventType: string): 'destructive' | 'secondary' | 'outline' | 'default' => {
    if (eventType.includes('malicious') || eventType.includes('blocked')) return 'destructive';
    if (eventType.includes('suspicious') || eventType.includes('rate_limit')) return 'secondary';
    if (eventType.includes('credential') || eventType.includes('access')) return 'outline';
    return 'default';
  };

  const getSeverityIcon = (eventType: string) => {
    if (eventType.includes('malicious') || eventType.includes('blocked')) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (eventType.includes('credential')) {
      return <Shield className="h-4 w-4 text-blue-500" />;
    }
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  const eventCounts = events.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
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
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Badge variant={securityStatus.isSecure ? 'default' : 'destructive'}>
                {securityStatus.isSecure ? 'Secure' : 'Issues Detected'}
              </Badge>
              <span className="text-sm text-muted-foreground">Overall Status</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {securityStatus.threats.length}
              </Badge>
              <span className="text-sm text-muted-foreground">Active Threats</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={securityStatus.rateLimit.blocked ? 'destructive' : 'default'}>
                {securityStatus.rateLimit.blocked ? 'Rate Limited' : 'Normal'}
              </Badge>
              <span className="text-sm text-muted-foreground">Rate Limiting</span>
            </div>
          </div>

          {securityStatus.threats.length > 0 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {securityStatus.threats.length} security threat(s) detected. Recent threats include:{' '}
                {securityStatus.threats.slice(0, 2).map(t => t.type).join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Event Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Security Event Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(eventCounts).slice(0, 8).map(([type, count]) => (
              <div key={type} className="text-center">
                <div className="text-2xl font-bold text-primary">{count}</div>
                <div className="text-xs text-muted-foreground truncate" title={type}>
                  {type.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Security Events</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearSecurityHistory();
                  loadSecurityEvents();
                }}
              >
                Clear History
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No security events recorded
            </div>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 20).map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="mt-0.5">
                    {getSeverityIcon(event.event_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getSeverityColor(event.event_type)}>
                        {event.event_type.replace(/_/g, ' ')}
                      </Badge>
                      {event.table_name && (
                        <Badge variant="outline" className="text-xs">
                          {event.table_name}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(event.created_at).toLocaleString()}
                      </div>
                    </div>
                    
                    {showDetails && event.details && (
                      <div className="mt-2 text-xs bg-muted p-2 rounded font-mono">
                        {JSON.stringify(event.details, null, 2)}
                      </div>
                    )}
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