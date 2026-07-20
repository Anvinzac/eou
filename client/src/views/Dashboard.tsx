import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { authApi, quizzesApi, invitationsApi, attemptsApi, coupleApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Plus, RefreshCw, Link2, ArrowLeft, BarChart3, LogOut, Eye, Globe, Lock, Pencil, Check, User, Settings, Minus, HeartHandshake, Swords } from 'lucide-react';
import { generateCloudName } from '@/lib/nameGenerator';
import PackManager from '@/components/dashboard/PackManager';

type QuizRow = any;
type CoupleSessionRow = any;

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizRow | null>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [coupleSessions, setCoupleSessions] = useState<CoupleSessionRow[]>([]);
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
      authApi.claimDraft(draftQuizId, draftToken)
        .then(() => {
          localStorage.removeItem('quiz_draft_token');
          localStorage.removeItem('quiz_draft_id');
          toast.success('Your draft quiz has been linked to your account!');
          fetchQuizzes();
        })
        .catch(() => fetchQuizzes());
    } else {
      fetchQuizzes();
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading]);

  const fetchQuizzes = async () => {
    try {
      const { quizzes: data } = await quizzesApi.listMine();
      setQuizzes(data || []);
      if (data && data.length > 0 && !selectedQuiz) {
        selectQuiz(data[0]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load quizzes');
    }
  };

  const selectQuiz = async (quiz: any) => {
    setSelectedQuiz(quiz);
    setNewTitle(quiz.title);
    try {
      const [{ invitations: inv }, { attempts: att }, { sessions }] = await Promise.all([
        invitationsApi.list(quiz.id),
        attemptsApi.listForQuiz(quiz.id),
        coupleApi.listForQuiz(quiz.id),
      ]);
      setInvitations(inv || []);
      setAttempts(att || []);
      setCoupleSessions(sessions || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load quiz details');
    }
  };

  const generateInvitations = async () => {
    if (!selectedQuiz) return;
    const labels = inviteLabels.slice(0, inviteCount).map(label => label.trim() || generateCloudName());
    try {
      await invitationsApi.create(selectedQuiz.id, labels);
      toast.success(`${inviteCount} invitation(s) created!`);
      selectQuiz(selectedQuiz);
      setInviteLabels(['']);
      setInviteCount(1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invitations');
    }
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

  const copyCoupleResultLink = (sessionCode: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/couple/${sessionCode}`);
    toast.success('Couple result link copied!');
  };

  const toggleOpenQuiz = async () => {
    if (!selectedQuiz) return;
    try {
      const { quiz } = await quizzesApi.patch(selectedQuiz.id, { is_open: !selectedQuiz.is_open });
      setSelectedQuiz(quiz);
      toast.success(selectedQuiz.is_open ? 'Quiz is now private' : 'Quiz is now open!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update quiz');
    }
  };

  const renameQuiz = async () => {
    if (!newTitle.trim() || !selectedQuiz) return;
    try {
      const { quiz } = await quizzesApi.patch(selectedQuiz.id, { title: newTitle.trim() });
      setSelectedQuiz(quiz);
      setEditingTitle(false);
      toast.success('Quiz renamed!');
      fetchQuizzes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename quiz');
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Home
          </Button>
          <h1 className="text-lg font-bold font-display">{t('dashboard.title', 'My Quizzes')}</h1>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><Settings className="h-4 w-4" /></Button>
            )}
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
                  const VN_NAMES = [
                    'An', 'Anh', 'Ân', 'Ánh',
                    'Bảo', 'Bình', 'Bạn',
                    'Chi', 'Châu', 'Cường',
                    'Duy', 'Dũng', 'Diệu', 'Đạt', 'Đức',
                    'Em',
                    'Gia', 'Giang',
                    'Hà', 'Hai', 'Hạnh', 'Hiền', 'Hoa', 'Hoàng', 'Hùng', 'Hương', 'Huy',
                    'Khánh', 'Khoa', 'Kiên',
                    'Lan', 'Linh', 'Long', 'Lộc',
                    'Mai', 'Minh', 'My',
                    'Nam', 'Ngân', 'Nghĩa', 'Ngọc', 'Nhi', 'Nhung', 'Nó',
                    'Phong', 'Phúc', 'Phương',
                    'Quân', 'Quang', 'Quỳnh',
                    'Sơn',
                    'Tâm', 'Thảo', 'Thành', 'Thanh', 'Thắng', 'Thiên', 'Thúy', 'Tiến', 'Trang', 'Trung', 'Tú', 'Tuấn',
                    'Uyên',
                    'Vân', 'Việt', 'Vy',
                    'Xuân',
                    'Yến',
                  ];

                  const getChips = (input: string) => {
                    const val = (input || '').trim().toLowerCase();
                    if (!val) return PRONOUNS;
                    return VN_NAMES.filter(n => n.toLowerCase().startsWith(val));
                  };

                  return (
                    <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                      {Array.from({ length: inviteCount }).map((_, idx) => {
                        const chips = getChips(inviteLabels[idx]);
                        return (
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
                                }}
                                placeholder="Type initials to filter names..."
                                className="rounded-xl text-sm"
                                maxLength={30}
                              />
                              <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => regenerateLabel(idx)} title="Regenerate name">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                            {activeInviteIdx === idx && chips.length > 0 && (
                              <div className="flex gap-1.5 flex-wrap">
                                {chips.map(p => (
                                  <button
                                    key={p}
                                    onClick={() => {
                                      setInviteLabels(prev => {
                                        const next = [...prev];
                                        next[idx] = p;
                                        return next;
                                      });
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
                        );
                      })}
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

            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-3 text-lg font-bold font-display flex items-center gap-2">
                <HeartHandshake className="h-5 w-5 text-primary" /> Couple Sessions
              </h3>
              {coupleSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No couple-mode sessions yet. Once two people compare answers, the shared result will appear here.</p>
              ) : (
                <div className="space-y-3">
                  {coupleSessions.map(session => (
                    <div key={session.id} className="rounded-xl bg-muted/50 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{session.first_name || 'Partner 1'} + {session.second_name || 'Waiting'}</span>
                            <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                              {session.status === 'completed' ? 'Completed' : 'Waiting'}
                            </Badge>
                          </div>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{session.session_code}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold font-display text-primary">
                            {session.match_percentage ?? 0}%
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {session.match_count ?? 0}/{session.total_compared ?? 0} exact matches
                        </span>
                        <span>
                          {session.completed_at ? new Date(session.completed_at).toLocaleDateString() : 'Still waiting for both submissions'}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/couple/${session.session_code}`)}>
                          <Eye className="mr-1 h-4 w-4" /> View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => copyCoupleResultLink(session.session_code)}>
                          <Copy className="mr-1 h-4 w-4" /> Copy Link
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Question Packs */}
            <PackManager userId={user.id} />
          </motion.div>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate('/create')} variant="outline" className="w-full">
            <Plus className="mr-2 h-4 w-4" /> {t('dashboard.create_first', 'Create New Quiz')}
          </Button>
          <Button onClick={() => navigate('/create-versus')} variant="outline" className="w-full border-red-500/30 hover:border-red-500 hover:text-red-500 transition-colors">
            <Swords className="mr-2 h-4 w-4" /> Create Versus Challenge
          </Button>
        </div>
      </div>
    </div>
  );
}
