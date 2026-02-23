import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Shield, Users, FileText, Settings, Trash2, Save } from 'lucide-react';

type Tab = 'features' | 'questions' | 'users';

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>('features');
  const [flags, setFlags] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
    if (user) checkAdmin();
  }, [user, loading]);

  const checkAdmin = async () => {
    const { data } = await supabase.rpc('has_role', { _user_id: user!.id, _role: 'admin' });
    if (data) {
      setIsAdmin(true);
      loadData();
    } else {
      toast.error('Admin access required');
      navigate('/dashboard');
    }
  };

  const loadData = async () => {
    const { data: f } = await supabase.from('feature_flags').select('*').order('created_at');
    setFlags(f || []);
    const { data: p } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setProfiles(p || []);
  };

  const toggleFlag = async (flag: any) => {
    const { error } = await supabase.from('feature_flags').update({ is_enabled: !flag.is_enabled }).eq('id', flag.id);
    if (error) { toast.error(error.message); return; }
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, is_enabled: !f.is_enabled } : f));
    toast.success(`${flag.flag_label} ${!flag.is_enabled ? 'enabled' : 'disabled'}`);
  };

  if (loading || !user || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Dashboard
          </Button>
          <h1 className="text-lg font-bold font-display flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Admin</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {([
            { key: 'features', label: 'Feature Flags', icon: Settings },
            { key: 'questions', label: 'Questions', icon: FileText },
            { key: 'users', label: 'Users', icon: Users },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${tab === t.key ? 'gradient-coral text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'features' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-xl font-bold font-display">Experimental Features</h2>
            <p className="text-sm text-muted-foreground mb-4">Toggle features for the next release.</p>
            {flags.map(flag => (
              <div key={flag.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                <div>
                  <h3 className="font-semibold text-sm">{flag.flag_label}</h3>
                  <p className="text-xs text-muted-foreground">{flag.description}</p>
                </div>
                <Switch checked={flag.is_enabled} onCheckedChange={() => toggleFlag(flag)} />
              </div>
            ))}
          </motion.div>
        )}

        {tab === 'questions' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-xl font-bold font-display mb-4">Question Bank</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Questions are loaded from the data file. To update questions, modify the JSON source. 
              Vietnamese translations can be added per question.
            </p>
            <Badge variant="secondary">130 questions across 11 categories</Badge>
          </motion.div>
        )}

        {tab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className="text-xl font-bold font-display mb-4">Users</h2>
            <div className="space-y-2">
              {profiles.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                  <div>
                    <span className="font-medium text-sm">{p.display_name || 'No name'}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{p.user_id.slice(0, 8)}...</span>
                  </div>
                  <Badge variant="outline" className="text-xs">User</Badge>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
