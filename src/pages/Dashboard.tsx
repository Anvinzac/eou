import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Plus, RefreshCw, Link2, ArrowLeft, BarChart3, LogOut, Eye, Globe, Lock, Pencil, Check, User, Settings, Minus } from 'lucide-react';
import { generateCloudName, generateInviteCode } from '@/lib/nameGenerator';

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [inviteCount, setInviteCount] = useState(1);
  const [inviteLabels, setInviteLabels] = useState<string[]>(['']);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [activeInviteIdx, setActiveInviteIdx] = useState(0);
  // Link any draft quiz to user after login
  useEffect(() => {
    if (!user) return;
    const draftToken = localStorage.getItem('quiz_draft_token');
    const draftQuizId = localStorage.getItem('quiz_draft_id');
    if (draftToken && draftQuizId) {
      supabase
        .from('quizzes')
        .update({ user_id: user.id, draft_token: null })
        .eq('id', draftQuizId)
        .eq('draft_token', draftToken)
        .then(({ error }) => {
          if (!error) {
            localStorage.removeItem('quiz_draft_token');
            localStorage.removeItem('quiz_draft_id');
            toast.success('Your draft quiz has been linked to your account!');
            fetchQuizzes();
          }
        });
    } else {
      fetchQuizzes();
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading]);

  const fetchQuizzes = async () => {
    const { data } = await supabase.from('quizzes').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
    setQuizzes(data || []);
    if (data && data.length > 0 && !selectedQuiz) {
      selectQuiz(data[0]);
    }
  };

  const selectQuiz = async (quiz: any) => {
    setSelectedQuiz(quiz);
    setNewTitle(quiz.title);
    const { data: inv } = await supabase.from('invitations').select('*').eq('quiz_id', quiz.id).order('created_at', { ascending: false });
    setInvitations(inv || []);
    const { data: att } = await supabase.from('quiz_attempts').select('*').eq('quiz_id', quiz.id).order('created_at', { ascending: false });
    setAttempts(att || []);
  };

  const generateInvitations = async () => {
    if (!selectedQuiz) return;
    const newInvites = inviteLabels.slice(0, inviteCount).map(label => ({
      quiz_id: selectedQuiz.id,
      code: generateInviteCode(),
      label: label.trim() || generateCloudName(),
    }));
    const { error } = await supabase.from('invitations').insert(newInvites);
    if (error) { toast.error(error.message); return; }
    toast.success(`${inviteCount} invitation(s) created!`);
    selectQuiz(selectedQuiz);
    setInviteLabels(['']);
    setInviteCount(1);
  };

  const regenerateLabel = (idx: number) => {
    setInviteLabels(prev => {
      const next = [...prev];
      next[idx] = generateCloudName(next[idx]);
      return next;
    });
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/quiz/${selectedQuiz.id}?code=${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied!');
  };

  const copyOpenLink = () => {
    const link = `${window.location.origin}/quiz/${selectedQuiz.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Open link copied!');
  };

  const toggleOpenQuiz = async () => {
    if (!selectedQuiz) return;
    const { error } = await supabase.from('quizzes').update({ is_open: !selectedQuiz.is_open }).eq('id', selectedQuiz.id);
    if (error) { toast.error(error.message); return; }
    setSelectedQuiz({ ...selectedQuiz, is_open: !selectedQuiz.is_open });
    toast.success(selectedQuiz.is_open ? 'Quiz is now private' : 'Quiz is now open!');
  };

  const renameQuiz = async () => {
    if (!newTitle.trim()) return;
    const { error } = await supabase.from('quizzes').update({ title: newTitle.trim() }).eq('id', selectedQuiz.id);
    if (error) { toast.error(error.message); return; }
    setSelectedQuiz({ ...selectedQuiz, title: newTitle.trim() });
    setEditingTitle(false);
    toast.success('Quiz renamed!');
    fetchQuizzes();
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Home
          </Button>
          <h1 className="text-lg font-bold font-display">Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><Settings className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Quiz selector */}
        {quizzes.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            {quizzes.map(q => (
              <button key={q.id} onClick={() => selectQuiz(q)} className={`flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all ${selectedQuiz?.id === q.id ? 'gradient-coral text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {q.title}
              </button>
            ))}
          </div>
        )}

        {selectedQuiz && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Quiz Info */}
            <div className="rounded-2xl gradient-card border border-border p-6 shadow-soft">
              <div className="flex items-start justify-between mb-4">
                {editingTitle ? (
                  <div className="flex gap-2 items-center flex-1 mr-2">
                    <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} className="rounded-xl" maxLength={50} />
                    <Button size="icon" onClick={renameQuiz}><Check className="h-4 w-4" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold font-display">{selectedQuiz.title}</h2>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingTitle(true)}><Pencil className="h-3 w-3" /></Button>
                  </div>
                )}
                <Badge variant={selectedQuiz.is_open ? 'default' : 'secondary'} className="flex-shrink-0">
                  {selectedQuiz.is_open ? <><Globe className="mr-1 h-3 w-3" /> Open</> : <><Lock className="mr-1 h-3 w-3" /> Private</>}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={toggleOpenQuiz}>
                  {selectedQuiz.is_open ? 'Make Private' : 'Make Open'}
                </Button>
                {selectedQuiz.is_open && (
                  <Button variant="outline" size="sm" onClick={copyOpenLink}>
                    <Copy className="mr-1 h-3 w-3" /> Copy Open Link
                  </Button>
                )}
              </div>
            </div>

            {/* Create invitations */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-3 text-lg font-bold font-display flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /> Invitations</h3>
              
              <div className="mb-4">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Number of invitations</label>
                <div className="flex gap-2 mb-3 items-center">
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => { setInviteCount(n); setInviteLabels(Array(n).fill('')); }} className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${inviteCount === n ? 'gradient-coral text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {n}
                    </button>
                  ))}
                  <div className={`flex items-center gap-1 rounded-xl border transition-all ${inviteCount >= 4 ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-l-xl"
                      onClick={() => {
                        const next = Math.max(4, inviteCount - 1);
                        setInviteCount(next);
                        setInviteLabels(prev => {
                          const labels = [...prev];
                          labels.length = next;
                          return labels.map(l => l || '');
                        });
                      }}
                      disabled={inviteCount < 5}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <button
                      onClick={() => { if (inviteCount < 4) { setInviteCount(4); setInviteLabels(Array(4).fill('')); } }}
                      className={`min-w-[2rem] text-center text-sm font-medium ${inviteCount >= 4 ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {inviteCount >= 4 ? inviteCount : '4+'}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-r-xl"
                      onClick={() => {
                        const next = Math.max(4, inviteCount + 1);
                        setInviteCount(next);
                        setInviteLabels(prev => {
                          const labels = [...prev];
                          while (labels.length < next) labels.push('');
                          return labels;
                        });
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {(() => {
                  const PRONOUNS = ['Anh', 'Em', 'Bạn', 'Nó', 'Cô ấy', 'Hai'];
                  return (
                    <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                      {Array.from({ length: inviteCount }).map((_, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex gap-2 items-center">
                            <Input
                              value={inviteLabels[idx] || ''}
                              onFocus={() => setActiveInviteIdx(idx)}
                              onChange={e => {
                                const val = e.target.value;
                                setInviteLabels(prev => {
                                  const next = [...prev];
                                  next[idx] = val;
                                  return next;
                                });
                                if (val.length === 1) regenerateLabel(idx);
                              }}
                              placeholder="Type initials for cloud name..."
                              className="rounded-xl text-sm"
                              maxLength={30}
                            />
                            <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => regenerateLabel(idx)} title="Regenerate name">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                          {activeInviteIdx === idx && (
                            <div className="flex gap-1.5 flex-wrap">
                              {PRONOUNS.map(p => (
                                <button
                                  key={p}
                                  onClick={() => {
                                    setInviteLabels(prev => {
                                      const next = [...prev];
                                      next[idx] = p;
                                      return next;
                                    });
                                    regenerateLabel(idx);
                                    // Advance to next field
                                    if (idx < inviteCount - 1) {
                                      setActiveInviteIdx(idx + 1);
                                    }
                                  }}
                                  className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <Button onClick={generateInvitations} className="gradient-teal text-secondary-foreground">
                <Plus className="mr-1 h-4 w-4" /> Generate {inviteCount} Invitation{inviteCount > 1 ? 's' : ''}
              </Button>
            </div>

            {/* Existing invitations */}
            {invitations.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-3 font-bold font-display">Active Invitations</h3>
                <div className="space-y-2">
                  {invitations.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                      <div>
                        <span className="font-medium text-sm">{inv.label}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{inv.code}</span>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant={inv.is_used ? 'secondary' : 'outline'} className="text-xs">
                          {inv.is_used ? 'Used' : 'Active'}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(inv.code)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-3 text-lg font-bold font-display flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-secondary" /> Results
              </h3>
              {attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one has taken your quiz yet. Share your invitation links!</p>
              ) : (
                <div className="space-y-3">
                  {attempts.map(att => {
                    const pct = att.total_questions > 0 ? Math.round((att.score / att.total_questions) * 100) : 0;
                    const inv = invitations.find(i => i.id === att.invitation_id);
                    return (
                      <div key={att.id} className="rounded-xl bg-muted/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{inv?.label || att.respondent_name || 'Anonymous'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold font-display text-primary">{pct}%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{att.score}/{att.total_questions} correct</span>
                          <span>{att.completed_at ? new Date(att.completed_at).toLocaleDateString() : 'In progress'}</span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div className="h-full rounded-full gradient-coral transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        <div className="mt-6">
          <Button onClick={() => navigate('/create')} variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Create New Quiz
          </Button>
        </div>
      </div>
    </div>
  );
}
