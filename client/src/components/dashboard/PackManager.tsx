import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, Check, X, Save } from 'lucide-react';
import { packsApi } from '@/api';

interface PackQuestion {
  text: string;
  category: string;
  options: string[];
}

interface QuestionPack {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  emoji: string;
  questions: PackQuestion[];
  is_system: boolean;
}

interface PackManagerProps {
  userId: string;
}

const EMOJI_OPTIONS = ['📦', '🎯', '💡', '🔥', '⭐', '🎲', '🧩', '🎭', '💬', '🌟', '🎪', '🏆'];

export default function PackManager({ userId }: PackManagerProps) {
  const [packs, setPacks] = useState<QuestionPack[]>([]);
  const [editingPack, setEditingPack] = useState<QuestionPack | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchPacks = async () => {
    try {
      const { packs: data } = await packsApi.listMine();
      setPacks((data || []).map((p: any) => ({
        ...p,
        questions: (p.questions as PackQuestion[]) || [],
      })));
    } catch {
      setPacks([]);
    }
  };

  useEffect(() => { fetchPacks(); }, [userId]);

  const startCreate = () => {
    setEditingPack({
      id: '',
      user_id: userId,
      title: '',
      description: '',
      emoji: '📦',
      questions: [
        { text: '', category: 'Custom', options: [] },
        { text: '', category: 'Custom', options: [] },
        { text: '', category: 'Custom', options: [] },
        { text: '', category: 'Custom', options: [] },
        { text: '', category: 'Custom', options: [] },
      ],
      is_system: false,
    });
    setIsCreating(true);
  };

  const startEdit = (pack: QuestionPack) => {
    setEditingPack({ ...pack, questions: [...pack.questions] });
    setIsCreating(false);
  };

  const updateQuestion = (idx: number, text: string) => {
    if (!editingPack) return;
    const questions = [...editingPack.questions];
    questions[idx] = { ...questions[idx], text };
    setEditingPack({ ...editingPack, questions });
  };

  const updateOptions = (idx: number, optionsStr: string) => {
    if (!editingPack) return;
    const questions = [...editingPack.questions];
    questions[idx] = { ...questions[idx], options: optionsStr.split(',').map(o => o.trim()).filter(Boolean) };
    setEditingPack({ ...editingPack, questions });
  };

  const addQuestion = () => {
    if (!editingPack) return;
    setEditingPack({
      ...editingPack,
      questions: [...editingPack.questions, { text: '', category: 'Custom', options: [] }],
    });
  };

  const removeQuestion = (idx: number) => {
    if (!editingPack || editingPack.questions.length <= 1) return;
    const questions = editingPack.questions.filter((_, i) => i !== idx);
    setEditingPack({ ...editingPack, questions });
  };

  const savePack = async () => {
    if (!editingPack) return;
    if (!editingPack.title.trim()) { toast.error('Pack needs a title'); return; }
    const validQuestions = editingPack.questions.filter(q => q.text.trim());
    if (validQuestions.length < 1) { toast.error('Add at least 1 question'); return; }

    const payload = {
      user_id: userId,
      title: editingPack.title.trim(),
      description: editingPack.description.trim(),
      emoji: editingPack.emoji,
      questions: validQuestions as any,
      is_system: false,
    };

    try {
      if (isCreating) {
        await packsApi.create(payload);
        toast.success('Pack created!');
      } else {
        await packsApi.update(editingPack.id, payload);
        toast.success('Pack updated!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save pack');
      return;
    }
    setEditingPack(null);
    fetchPacks();
  };

  const deletePack = async (id: string) => {
    try {
      await packsApi.remove(id);
      toast.success('Pack deleted');
      fetchPacks();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete pack');
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold font-display flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Question Packs
        </h3>
        <Button size="sm" variant="outline" onClick={startCreate}>
          <Plus className="mr-1 h-3 w-3" /> New Pack
        </Button>
      </div>

      <AnimatePresence>
        {editingPack && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
          >
            <div className="flex gap-2 items-center">
              {/* Emoji picker */}
              <div className="flex gap-1 flex-wrap">
                {EMOJI_OPTIONS.slice(0, 6).map(e => (
                  <button
                    key={e}
                    onClick={() => setEditingPack({ ...editingPack, emoji: e })}
                    className={`text-lg p-1 rounded-md transition-all ${editingPack.emoji === e ? 'bg-primary/20 scale-110' : 'hover:bg-muted'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <Input
              value={editingPack.title}
              onChange={e => setEditingPack({ ...editingPack, title: e.target.value })}
              placeholder="Pack title"
              className="rounded-xl text-sm font-bold"
              maxLength={50}
            />
            <Input
              value={editingPack.description}
              onChange={e => setEditingPack({ ...editingPack, description: e.target.value })}
              placeholder="Short description"
              className="rounded-xl text-sm"
              maxLength={100}
            />

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Questions</label>
              {editingPack.questions.map((q, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                    <Input
                      value={q.text}
                      onChange={e => updateQuestion(idx, e.target.value)}
                      placeholder={`Question ${idx + 1}`}
                      className="rounded-lg text-xs flex-1"
                      maxLength={200}
                    />
                    {editingPack.questions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeQuestion(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="ml-7">
                    <Input
                      value={q.options.join(', ')}
                      onChange={e => updateOptions(idx, e.target.value)}
                      placeholder="Options (comma-separated, e.g. Red, Blue, Green)"
                      className="rounded-lg text-[11px] h-8"
                      maxLength={300}
                    />
                  </div>
                </div>
              ))}
              {editingPack.questions.length < 10 && (
                <Button variant="ghost" size="sm" onClick={addQuestion} className="text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Add Question
                </Button>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditingPack(null)}>
                <X className="mr-1 h-3 w-3" /> Cancel
              </Button>
              <Button size="sm" onClick={savePack} className="gradient-coral text-primary-foreground">
                <Save className="mr-1 h-3 w-3" /> {isCreating ? 'Create' : 'Save'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {packs.length === 0 && !editingPack ? (
        <p className="text-sm text-muted-foreground">No custom packs yet. Create one to quickly reuse questions!</p>
      ) : (
        <div className="space-y-2">
          {packs.map(pack => (
            <div key={pack.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">{pack.emoji}</span>
                <div className="min-w-0">
                  <span className="font-medium text-sm block truncate">{pack.title}</span>
                  <span className="text-xs text-muted-foreground">{pack.questions.length} questions</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(pack)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePack(pack.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
