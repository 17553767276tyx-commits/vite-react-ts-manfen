import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  Upload, 
  BookOpen, 
  AlertTriangle, 
  CheckCircle, 
  Menu,
  Star,
  Activity,
  Zap,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Trash2,
  Folder,
  Plus,
  X,
  Eraser,
  Layers,
  RefreshCcw,
  ListFilter,
  CheckSquare,
  HelpCircle,
  Info,
  FolderInput,
  FolderOpen,
  FolderPlus,
  AlertOctagon,
  Settings,
  Moon,
  Sun,
  Image as ImageIcon,
  Type,
  PenTool,
  Mic,
  Highlighter,
  Save,
  MoreVertical,
  Edit3,
  Layout,
  Search,
  Download,
  RotateCw,
  Flag,
  BarChart3,
  Clock,
  Calendar
} from 'lucide-react';

// --- 类型定义 ---

type QuestionType = 'single' | 'multiple' | 'judgment' | 'fill' | 'essay';
type ThemeMode = 'light' | 'dark';
type FontSize = 'small' | 'normal' | 'large' | 'xlarge';

interface Question {
  id: string;
  content: string;
  options?: string[];
  answer: string; 
  type: QuestionType;
  categoryId: string;
  explanation?: string;
}

interface Category {
  id: string;
  name: string;
}

interface BookmarkFolder {
  id: string;
  name: string;
  questionIds: string[];
}

interface NoteFolder {
  id: string;
  name: string;
}

interface Note {
  id: string;
  title: string;
  content: string; // HTML string
  folderId: string;
  updatedAt: number;
}

interface UserState {
  bookmarkFolders: BookmarkFolder[]; 
  wrongList: { [questionId: string]: number }; 
  highlights: { [questionId: string]: number }; 
  examHistory: ExamResult[];
  randomProgress: { [categoryId: string]: string[] };
  notes: Note[];
  noteFolders: NoteFolder[];
  theme: ThemeMode;
  bgImage?: string;
  fontSize: FontSize;
}

interface ExamResult {
  id: string;
  date: number;
  score: number;
  total: number;
  mode: 'random' | 'sequential';
}

interface ModeData {
  list: Question[];
  index: number;
  showAnswer: boolean;
  answers: { [id: string]: string }; 
  isExam: boolean;
  examType: 'study' | 'random' | 'sequential'; 
  examSubmitted: boolean;
  title: string;
  categoryId?: string; 
}

// --- 辅助函数 ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const parseTextToQuestions = (text: string, categoryId: string): Question[] => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
  const questions: Question[] = [];
  let currentQ: Partial<Question> | null = null;
  let currentOptions: string[] = [];

  const saveCurrentQuestion = () => {
    if (currentQ && currentQ.content) {
      currentQ.options = currentOptions;
      if (!currentQ.type) {
        if (currentOptions.length > 0) {
            const rawAns = currentQ.answer || '';
            const match = rawAns.match(/^([A-Z\s,]+)/i); 
            const cleanAns = match ? match[0].replace(/[^A-Z]/gi, '').toUpperCase() : '';
            const isMulti = cleanAns.length > 1;
            currentQ.type = isMulti ? 'multiple' : 'single';
        } else {
            currentQ.type = 'essay';
        }
      }
      if (!currentQ.answer) currentQ.answer = '未设置';
      questions.push(currentQ as Question);
    }
  };

  lines.forEach((line) => {
    if (/^(\d+[\.、\)\s\uff0e\u3001]|^\(\d+\))/.test(line)) {
      saveCurrentQuestion();
      currentQ = {
        id: generateId(),
        content: line.replace(/^(\d+[\.、\)\s\uff0e\u3001]|\(\d+\))\s*/, ''),
        categoryId,
        type: undefined 
      };
      currentOptions = [];
    } else if (currentQ) {
      const multiOptionLineMatch = line.match(/([A-Z][\.、\)\s\uff0e\u3001]|\([A-Z]\))/g);
      if (multiOptionLineMatch && multiOptionLineMatch.length > 1 && /^([A-Z][\.、\)\s\uff0e\u3001]|\([A-Z]\))/.test(line)) {
          const parts = line.split(/\s+(?=[A-Z][\.、\)\s\uff0e\u3001]|\([A-Z]\))/);
          parts.forEach(p => {
              if (/^([A-Z][\.、\)\s\uff0e\u3001]|\([A-Z]\))/.test(p)) currentOptions.push(p);
          });
      } 
      else if (/^([A-Z][\.、\)\s\uff0e\u3001]|\([A-Z]\))/.test(line)) {
        currentOptions.push(line);
      } 
      else if (/^(答案|Answer|Ans|参考答案|【答案】)[:：]?/.test(line)) {
        const ans = line.replace(/^(答案|Answer|Ans|参考答案|【答案】)[:：]?\s*/, '').trim();
        currentQ.answer = ans;
        if (['对', '错', '正确', '错误', 'T', 'F', '√', '×'].includes(ans) || ans.toUpperCase() === 'TRUE' || ans.toUpperCase() === 'FALSE') {
            currentQ.type = 'judgment';
        }
      } 
      else if (/^\[(判断|选择|单选|多选|填空|问答|简答).{0,2}\]/.test(line)) {
        if (line.includes('判断')) currentQ.type = 'judgment';
        else if (line.includes('填空')) currentQ.type = 'fill';
        else if (line.includes('问答') || line.includes('简答')) currentQ.type = 'essay';
        else if (line.includes('多选')) currentQ.type = 'multiple';
        else if (line.includes('单选')) currentQ.type = 'single';
      } 
      else {
        if (currentOptions.length === 0 && !currentQ.answer) {
             currentQ.content += "\n" + line;
        }
      }
    }
  });
  saveCurrentQuestion();
  return questions;
};

const isJudgmentCorrect = (userAns: string, realAns: string) => {
    const trueSet = ['对', '正确', 'T', 'TRUE', '√', 'A']; 
    const falseSet = ['错', '错误', 'F', 'FALSE', '×', 'B']; 
    const u = userAns.trim().toUpperCase();
    const r = realAns.trim().toUpperCase();
    if (trueSet.includes(u) && trueSet.includes(r)) return true;
    if (falseSet.includes(u) && falseSet.includes(r)) return true;
    return u === r;
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '凌晨好，注意休息';
    if (hour < 12) return '早上好，开始学习吧';
    if (hour < 14) return '中午好，记得午休';
    if (hour < 18) return '下午好，继续加油';
    return '晚上好，复习一下';
};

// --- 子组件 ---

const HighlightIndicator = ({ level }: { level: number }) => {
  if (!level) return null;
  const colors = ['', 'bg-[#F4D03F]', 'bg-[#EB984E]', 'bg-[#E74C3C]', 'bg-[#AF7AC5]', 'bg-[#5DADE2]'];
  return <div className={`w-2.5 h-2.5 rounded-full ${colors[level]} mr-2 inline-block shadow-sm ring-2 ring-white dark:ring-slate-700`}></div>;
};

const AutoSaveTextArea = ({ 
    value, 
    onChange, 
    disabled, 
    placeholder,
    fontSizeClass
}: { 
    value: string; 
    onChange: (val: string) => void; 
    disabled: boolean;
    placeholder: string;
    fontSizeClass: string;
}) => {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => setLocalValue(value), [value]);
    const handleBlur = () => { if (localValue !== value) onChange(localValue); };

    return (
        <div className="relative group">
            <textarea 
                placeholder={placeholder}
                className={`w-full h-48 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-200 p-5 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/50 focus:bg-white dark:focus:bg-slate-800 transition-all resize-none leading-relaxed ${fontSizeClass} shadow-inner`}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                disabled={disabled}
            />
             <div className="absolute bottom-4 right-4 text-xs text-slate-400 dark:text-slate-600 pointer-events-none transition-opacity group-focus-within:opacity-50">
                点击空白处自动保存
            </div>
        </div>
    );
};

const NoteEditor = ({ 
    initialContent, 
    folders,
    onSave, 
    onCancel 
}: { 
    initialContent?: Note, 
    folders: NoteFolder[],
    onSave: (title: string, content: string, folderId: string) => void,
    onCancel: () => void
}) => {
    const [isEditing, setIsEditing] = useState(!initialContent);
    const [title, setTitle] = useState(initialContent?.title || '');
    const [selectedFolderId, setSelectedFolderId] = useState(initialContent?.folderId || (folders[0]?.id || 'default'));
    const contentRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (contentRef.current && initialContent?.content) {
            contentRef.current.innerHTML = initialContent.content;
        }
    }, []);

    const execCmd = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        contentRef.current?.focus();
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const imgHtml = `<img src="${ev.target?.result}" class="max-w-full rounded-xl my-3 border border-slate-100 dark:border-slate-700 shadow-sm" />`;
                execCmd('insertHTML', imgHtml);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const audioHtml = `<div class="my-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><audio controls src="${ev.target?.result}" class="w-full"></audio></div>`;
                execCmd('insertHTML', audioHtml);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleHighlight = (color: string) => {
        execCmd('backColor', color);
    };

    const handleBack = () => {
        if (isEditing && initialContent) {
            setIsEditing(false);
            if (contentRef.current) contentRef.current.innerHTML = initialContent.content;
            setTitle(initialContent.title);
            setSelectedFolderId(initialContent.folderId);
        } else {
            onCancel();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative z-20">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <button onClick={handleBack} className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
                    {isEditing ? <X size={20}/> : <ChevronLeft size={20}/>}
                </button>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {isEditing ? (initialContent ? '编辑笔记' : '新建笔记') : '阅读笔记'}
                </span>
                {isEditing ? (
                    <button 
                        onClick={() => onSave(title, contentRef.current?.innerHTML || '', selectedFolderId)} 
                        className="text-indigo-600 dark:text-indigo-400 font-medium text-sm px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                    >
                        保存
                    </button>
                ) : (
                    <button 
                        onClick={() => setIsEditing(true)} 
                        className="text-slate-600 dark:text-slate-300 p-2 -mr-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <Edit3 size={18} />
                    </button>
                )}
            </div>
            
            <div className="px-5 py-4 space-y-3">
                <input 
                    type="text" 
                    placeholder="无标题" 
                    className="w-full text-2xl font-bold bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-300 disabled:opacity-100"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    disabled={!isEditing}
                />
                {isEditing && (
                    <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 self-start px-3 py-1.5 rounded-lg">
                        <Folder size={14}/>
                        <select 
                            value={selectedFolderId}
                            onChange={e => setSelectedFolderId(e.target.value)}
                            className="bg-transparent border-none outline-none appearance-none pr-4"
                        >
                            {folders.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {isEditing && (
                <div className="flex items-center gap-3 px-5 py-2 border-y border-slate-50 dark:border-slate-800/50 overflow-x-auto">
                    <button onClick={() => execCmd('bold')} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><span className="font-bold">B</span></button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                    <button onClick={() => handleHighlight('#fef08a')} className="w-5 h-5 rounded-full bg-yellow-200 ring-1 ring-black/5"></button>
                    <button onClick={() => handleHighlight('#bbf7d0')} className="w-5 h-5 rounded-full bg-green-200 ring-1 ring-black/5"></button>
                    <button onClick={() => handleHighlight('#fbcfe8')} className="w-5 h-5 rounded-full bg-pink-200 ring-1 ring-black/5"></button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><ImageIcon size={18}/></button>
                    <button onClick={() => audioInputRef.current?.click()} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><Mic size={18}/></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={handleAudioUpload} />
                </div>
            )}

            <div 
                className={`flex-1 px-5 py-4 overflow-y-auto outline-none text-slate-700 dark:text-slate-300 text-lg leading-relaxed editor-content ${!isEditing ? 'read-only' : ''}`}
                contentEditable={isEditing}
                ref={contentRef}
                suppressContentEditableWarning
                data-placeholder="开始记录..."
            />
            <style>{`
                .editor-content:empty:before { content: attr(data-placeholder); color: #cbd5e1; }
                .editor-content img { max-width: 100%; border-radius: 12px; display: block; margin: 12px 0; }
                .read-only a { pointer-events: auto; text-decoration: underline; color: #6366f1; }
            `}</style>
        </div>
    );
};

interface QuestionCardProps {
  data: ModeData;
  question: Question;
  userState: UserState;
  categoryName?: string;
  onAnswerChange: (qId: string, val: string, type: QuestionType) => void;
  onNext: (delay?: number) => void;
  onPrev: () => void;
  onSubmitExam: () => void;
  onToggleBookmark: (qId: string) => void;
  onHighlight: (qId: string) => void;
  onRemoveWrong: (qId: string) => void;
  onExit: () => void;
  onSetShowAnswer: (show: boolean) => void;
}

const QuestionCard = memo(({
  data,
  question: q,
  userState,
  categoryName,
  onAnswerChange,
  onNext,
  onPrev,
  onSubmitExam,
  onToggleBookmark,
  onHighlight,
  onRemoveWrong,
  onExit,
  onSetShowAnswer
}: QuestionCardProps) => {
  const highlightLevel = userState.highlights[q.id] || 0;
  const isBookmarked = userState.bookmarkFolders.some(f => f.questionIds.includes(q.id));
  const isWrong = !!userState.wrongList[q.id];
  const wrongCount = userState.wrongList[q.id] || 0;
  const isLastQuestion = data.index === data.list.length - 1;

  const cardBgClass = "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-white/20 dark:border-white/10";

  const getFontSizeClass = (type: 'content' | 'option') => {
      const size = userState.fontSize || 'normal';
      const map = {
          small: { content: 'text-base', option: 'text-sm' },
          normal: { content: 'text-lg md:text-xl', option: 'text-base' },
          large: { content: 'text-xl md:text-2xl', option: 'text-lg' },
          xlarge: { content: 'text-2xl md:text-3xl', option: 'text-xl' },
      };
      return map[size][type];
  };

  const contentSize = getFontSizeClass('content');
  const optionSize = getFontSizeClass('option');

  const getQuestionTypeStyle = (type: QuestionType) => {
      switch (type) {
          case 'multiple': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
          case 'single': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
          case 'judgment': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
          case 'fill': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300';
          case 'essay': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
          default: return 'bg-slate-100 text-slate-500';
      }
  };

  const getQuestionTypeLabel = (type: QuestionType) => {
      switch (type) {
          case 'multiple': return '多选题';
          case 'single': return '单选题';
          case 'judgment': return '判断题';
          case 'fill': return '填空题';
          case 'essay': return '简答题';
          default: return '未知';
      }
  };

  const renderOption = (opt: string, idx: number) => {
      const optKey = String.fromCharCode(65 + idx); 
      const userVal = data.answers[q.id] || '';
      const isSelected = q.type === 'multiple' ? userVal.includes(optKey) : userVal === optKey;
      
      let btnClass = "border-slate-100 bg-slate-50/50 text-slate-600 hover:bg-slate-100 dark:border-slate-700/50 dark:bg-slate-800/30 dark:text-slate-300 dark:hover:bg-slate-800/50";
      let iconClass = "bg-slate-200/80 text-slate-500 dark:bg-slate-700 dark:text-slate-400";
      
      if (isSelected) {
          btnClass = "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700 dark:ring-indigo-800";
          iconClass = "bg-indigo-500 text-white dark:bg-indigo-600";
      }

      if ((!data.isExam && data.showAnswer) || data.examSubmitted) {
          const cleanRealAns = q.answer.replace(/[^A-F]/gi, '');
          const isCorrect = cleanRealAns.includes(optKey); 
          
          if (isCorrect) {
              btnClass = "border-emerald-200 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700 dark:ring-emerald-800";
              iconClass = "bg-emerald-500 text-white dark:bg-emerald-600";
          } else if (isSelected) {
              btnClass = "border-rose-200 bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-700 dark:ring-rose-800";
              iconClass = "bg-rose-500 text-white dark:bg-rose-600";
          }
      }

      return (
          <button 
              key={idx}
              onClick={() => {
                  if (data.examSubmitted) return;
                  onAnswerChange(q.id, optKey, q.type);
              }}
              className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start ${btnClass} ${optionSize}`}
          >
              <span className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold mt-0.5 mr-3 transition-colors ${iconClass}`}>{optKey}</span>
              <span className="leading-snug">{opt.replace(/^[A-Z][\.,、\)\s\uff0e\u3001]|^\([A-Z]\)/, '').trim()}</span>
          </button>
      )
  };

  return (
    <div className="flex flex-col h-full relative z-10 p-4 pb-24 max-w-2xl mx-auto w-full">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onExit} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center bg-white/80 dark:bg-black/40 backdrop-blur-sm p-2.5 pr-4 rounded-full shadow-sm transition-all active:scale-95">
           <ChevronLeft size={20}/> <span className="text-sm font-bold ml-1">退出</span>
        </button>
        
        {/* 顶部进度条 */}
        <div className="flex-1 mx-4 h-1.5 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden backdrop-blur-sm">
            <div 
                className="h-full bg-indigo-500 transition-all duration-300 ease-out" 
                style={{ width: `${((data.index + 1) / data.list.length) * 100}%` }}
            ></div>
        </div>
        
        <div className={`text-slate-500 dark:text-slate-400 font-mono font-bold text-xs px-2`}>
          {data.index + 1}/{data.list.length}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-6 md:p-8 rounded-[2rem] shadow-xl dark:shadow-black/20 transition-all duration-300 ${cardBgClass}`}>
          <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2.5 py-1 rounded-lg font-bold tracking-wider uppercase shadow-sm ${getQuestionTypeStyle(q.type)}`}>
                    {getQuestionTypeLabel(q.type)}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[120px] bg-slate-100/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
                     {categoryName}
                  </span>
              </div>
              <div className="flex items-center gap-2">
                  {isWrong && (
                     <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-lg flex items-center">
                         <AlertTriangle size={10} className="mr-1"/> 错 {wrongCount} 次
                     </span>
                  )}
                  <div className="flex bg-slate-100/50 dark:bg-slate-800/50 rounded-full p-1">
                       <button 
                          onClick={() => onHighlight(q.id)} 
                          className={`p-1.5 rounded-full transition-all ${highlightLevel > 0 ? 'bg-white dark:bg-slate-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-400'}`}
                       >
                         <div className={`w-2.5 h-2.5 rounded-full ${highlightLevel > 0 ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                       </button>
                       <button onClick={() => onToggleBookmark(q.id)} className={`p-1.5 rounded-full transition-all ${isBookmarked ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-400' : 'hover:bg-white/50 dark:hover:bg-slate-700/50 text-slate-300 dark:text-slate-600'}`}>
                         <Star size={16} className={isBookmarked ? "fill-amber-400" : "currentColor"} />
                       </button>
                  </div>
              </div>
          </div>
          
          <div className={`text-slate-800 dark:text-slate-100 font-bold mb-8 leading-loose tracking-wide whitespace-pre-wrap ${contentSize}`} style={{ textShadow: '0 1px 1px rgba(0,0,0,0.02)' }}>
             <HighlightIndicator level={highlightLevel} />
             {q.content}
          </div>

          {['single', 'multiple'].includes(q.type) && q.options && (
              <div className="space-y-3">
                  {q.options.map((opt, idx) => renderOption(opt, idx))}
              </div>
          )}

          {q.type === 'judgment' && (
               <div className="flex gap-4 h-24 md:h-32">
                   {['√', '×'].map((opt, idx) => {
                       const val = opt === '√' ? '正确' : '错误';
                       const isSelected = data.answers[q.id] === val;
                       let btnClass = "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-800";
                       
                       if (isSelected) {
                           btnClass = opt === '√' ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-400 shadow-sm" : "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-400 shadow-sm";
                       }

                       if ((!data.isExam && data.showAnswer) || data.examSubmitted) {
                           const correctAnswerIsThis = isJudgmentCorrect(opt === '√' ? '正确' : '错误', q.answer);
                           if (correctAnswerIsThis) {
                               btnClass = "bg-emerald-100 border-emerald-300 text-emerald-700 ring-2 ring-emerald-200 dark:bg-emerald-900/60 dark:border-emerald-700 dark:text-emerald-300 dark:ring-emerald-800";
                           } else if (isSelected) {
                               btnClass = "bg-rose-100 border-rose-300 text-rose-700 ring-2 ring-rose-200 dark:bg-rose-900/60 dark:border-rose-700 dark:text-rose-300 dark:ring-rose-800 opacity-60";
                           }
                       }

                       return (
                           <button
                              key={idx}
                              onClick={() => {
                                  if (data.examSubmitted) return;
                                  onAnswerChange(q.id, val, q.type);
                              }}
                              className={`flex-1 rounded-2xl border-2 text-4xl font-bold transition-all active:scale-95 flex items-center justify-center ${btnClass}`}
                           >
                               {opt}
                           </button>
                       )
                   })}
               </div>
          )}

          {(q.type === 'fill' || q.type === 'essay') && (
              <AutoSaveTextArea 
                  value={data.answers[q.id] || ''}
                  onChange={(val) => onAnswerChange(q.id, val, q.type)}
                  disabled={data.examSubmitted}
                  placeholder={q.type === 'fill' ? "在此输入填空答案..." : "在此输入简答内容..."}
                  fontSizeClass={optionSize}
              />
          )}

          {/* 答案解析区域 */}
          {(data.showAnswer || data.examSubmitted) && (
              <div className="mt-8 p-6 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
                      <CheckCircle size={16} className="mr-1.5"/> 参考答案
                  </div>
                  <div className={`text-slate-800 dark:text-slate-200 font-bold whitespace-pre-wrap ${optionSize}`}>{q.answer}</div>
                  
                  {data.examSubmitted && q.type !== 'essay' && (
                     <div className="mt-4 pt-4 border-t border-emerald-100 dark:border-emerald-800/50">
                         <div className="text-xs text-slate-400 mb-1">你的答案</div>
                         <div className={`text-sm font-medium ${ (data.answers[q.id]||'').replace(/\s/g,'').toUpperCase() === (q.answer||'').replace(/\s/g,'').toUpperCase() ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            {data.answers[q.id] || '未作答'}
                         </div>
                     </div>
                  )}
              </div>
          )}
      </div>

      {/* 底部控制栏 - 悬浮式 */}
      <div className="fixed bottom-6 left-6 right-6 z-30 safe-area-bottom">
           <div className={`flex justify-between items-center p-2 rounded-full shadow-xl border border-white/20 dark:border-white/10 ${cardBgClass}`}>
               <button 
                  disabled={data.index === 0}
                  onClick={onPrev}
                  className="w-12 h-12 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
               >
                  <ChevronLeft size={24} />
               </button>

               <div className="flex-1 flex justify-center px-4">
                   {/* 考试模式的交卷按钮 - 当到底部时显示大按钮 */}
                   {data.isExam && !data.examSubmitted ? (
                       isLastQuestion ? (
                           <button 
                              onClick={onSubmitExam}
                              className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 w-full justify-center"
                           >
                              <CheckCircle size={18} className="mr-2" /> 确认并交卷
                           </button>
                       ) : (
                           <button 
                              onClick={() => onNext(0)}
                              className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 w-full justify-center"
                           >
                              确认并下一题 <ChevronRight size={18} className="ml-1" />
                           </button>
                       )
                   ) : (
                       /* 刷题模式的操作 */
                       !data.showAnswer ? (
                           <button 
                              onClick={() => onSetShowAnswer(true)}
                              className="flex items-center px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-full font-bold shadow-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-all active:scale-95"
                          >
                              <Eye size={18} className="mr-2" /> 查看解析
                          </button>
                       ) : (
                           <button 
                              onClick={() => onNext(0)}
                              className="flex items-center px-8 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95"
                          >
                              下一题 <ChevronRight size={18} className="ml-1" />
                          </button>
                       )
                   )}
               </div>

               <button 
                  disabled={data.index === data.list.length - 1}
                  onClick={() => onNext(0)}
                  className="w-12 h-12 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
               >
                  <ChevronRight size={24} />
               </button>
           </div>
      </div>
    </div>
  );
});

// --- 主应用组件 ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'study' | 'exam' | 'upload' | 'bookmarks' | 'notes'>('home');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([
    { id: 'default', name: '演示题库' }
  ]);
  const [userState, setUserState] = useState<UserState>({
    bookmarkFolders: [{ id: 'fav_default', name: '默认收藏', questionIds: [] }],
    wrongList: {},
    highlights: {},
    examHistory: [],
    randomProgress: {},
    notes: [],
    noteFolders: [{ id: 'default', name: '默认笔记本' }],
    theme: 'light',
    fontSize: 'normal'
  });

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [pendingQuestionIdForFolder, setPendingQuestionIdForFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Modals
  const [showWrongGroupingModal, setShowWrongGroupingModal] = useState(false);
  const [showGroupingModal, setShowGroupingModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false); 
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'category' | 'note' | 'noteFolder' | 'bookmarkFolder' | 'bookmarkItem' | 'wrongItem' | 'wrongCategory' | 'wrongCategoryType' | 'examExit', id: string, name?: string, extra?: any } | null>(null);
  const [showNoteFolderModal, setShowNoteFolderModal] = useState(false);
  const [showBookmarkFolderModal, setShowBookmarkFolderModal] = useState(false);
  const [showRandomSetupModal, setShowRandomSetupModal] = useState<{ categoryId: string, categoryName: string } | null>(null);
  
  // Note State
  const [editingNote, setEditingNote] = useState<Note | null | 'new'>(null);
  const [activeNoteFolderId, setActiveNoteFolderId] = useState<string>('all');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [groupingSelection, setGroupingSelection] = useState<{
      type: 'study' | 'sequential';
      list: Question[];
      titleBase: string;
  } | null>(null);

  // 删除确认弹窗状态
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string, name: string } | null>(null);

  const [uploadText, setUploadText] = useState('');
  const [uploadCatName, setUploadCatName] = useState('');
  const [importType, setImportType] = useState<'new' | 'existing'>('new');
  const [targetCatId, setTargetCatId] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const importDataInputRef = useRef<HTMLInputElement>(null); // For Restore
  const timerRef = useRef<any>(null); // Changed to any for compatibility

  const [currentModeData, setCurrentModeData] = useState<ModeData | null>(null);

  useEffect(() => {
    const loadedData = localStorage.getItem('simple-quiz-data');
    if (loadedData) {
        try {
            const parsed = JSON.parse(loadedData);
            let newState = parsed.userState || {};
            if (Array.isArray(newState.bookmarks)) {
                newState.bookmarkFolders = [{ id: 'fav_default', name: '默认收藏', questionIds: newState.bookmarks }];
                delete newState.bookmarks;
            }
            if (!newState.bookmarkFolders || newState.bookmarkFolders.length === 0) {
                newState.bookmarkFolders = [{ id: 'fav_default', name: '默认收藏', questionIds: [] }];
            }
            if (!newState.randomProgress) newState.randomProgress = {};
            if (!newState.notes) newState.notes = [];
            if (!newState.noteFolders) newState.noteFolders = [{ id: 'default', name: '默认笔记本' }];
            if (!newState.theme) newState.theme = 'light';
            if (!newState.fontSize) newState.fontSize = 'normal';
            
            if (parsed.questions) setQuestions(parsed.questions);
            if (parsed.categories) setCategories(parsed.categories);
            setUserState(newState);
        } catch (e) { console.error("Data load failed", e); }
    } else {
        setQuestions([
            { id: '1', content: '《红楼梦》的作者是谁？', options: ['A. 曹雪芹', 'B. 罗贯中', 'C. 施耐庵', 'D. 吴承恩'], answer: 'A', type: 'single', categoryId: 'default' },
            { id: '2', content: '光年是时间单位。', answer: '错误', type: 'judgment', categoryId: 'default' },
            { id: '3', content: '以下属于四大发明的有：', options: ['A. 造纸术', 'B. 指南针', 'C. 蒸汽机', 'D. 火药'], answer: 'ABD', type: 'multiple', categoryId: 'default' },
            { id: '4', content: 'One apple a day, keeps the doctor ____.', answer: 'away', type: 'fill', categoryId: 'default' },
        ]);
    }
  }, []);

  useEffect(() => {
    const dataToSave = { questions, categories, userState };
    localStorage.setItem('simple-quiz-data', JSON.stringify(dataToSave));
  }, [questions, categories, userState]);

  useEffect(() => {
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // --- Handlers ---

  const handleExportData = () => {
      const data = JSON.stringify({ questions, categories, userState });
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `full_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const parsed = JSON.parse(ev.target?.result as string);
              if (parsed.questions && parsed.categories && parsed.userState) {
                  if(confirm('确定恢复备份？当前所有数据将被覆盖！')) {
                      setQuestions(parsed.questions);
                      setCategories(parsed.categories);
                      setUserState(parsed.userState);
                      alert('恢复成功！');
                  }
              } else {
                  alert('无效的备份文件');
              }
          } catch(e) {
              alert('解析失败');
          }
      };
      reader.readAsText(file);
  };

  const confirmDelete = () => {
      if (!showDeleteConfirm) return;
      
      if (showDeleteConfirm.type === 'category') {
          const catId = showDeleteConfirm.id;
          setQuestions(p => p.filter(q => q.categoryId !== catId));
          setCategories(p => p.filter(c => c.id !== catId));
          setUserState(prev => {
              const newRandomProgress = { ...prev.randomProgress };
              delete newRandomProgress[catId];
              return { ...prev, randomProgress: newRandomProgress };
          });
          if (targetCatId === catId) setTargetCatId('');
      } else if (showDeleteConfirm.type === 'note') {
          const noteId = showDeleteConfirm.id;
          setUserState(prev => ({ ...prev, notes: prev.notes.filter(n => n.id !== noteId) }));
          if (editingNote && editingNote !== 'new' && editingNote.id === noteId) {
              setEditingNote(null);
          }
      } else if (showDeleteConfirm.type === 'noteFolder') {
           const folderId = showDeleteConfirm.id;
           setUserState(prev => ({
               ...prev,
               noteFolders: prev.noteFolders.filter(f => f.id !== folderId),
               notes: prev.notes.filter(n => n.folderId !== folderId) // Delete notes in folder
           }));
           if (activeNoteFolderId === folderId) setActiveNoteFolderId('all');
      } else if (showDeleteConfirm.type === 'bookmarkFolder') {
           const folderId = showDeleteConfirm.id;
           setUserState(prev => ({
               ...prev,
               bookmarkFolders: prev.bookmarkFolders.filter(f => f.id !== folderId)
           }));
      } else if (showDeleteConfirm.type === 'bookmarkItem') {
           const qId = showDeleteConfirm.id;
           setUserState(prev => ({
               ...prev,
               bookmarkFolders: prev.bookmarkFolders.map(f => ({
                   ...f,
                   questionIds: f.questionIds.filter(id => id !== qId)
               }))
           }));
      } else if (showDeleteConfirm.type === 'wrongItem') {
          const qId = showDeleteConfirm.id;
          setUserState(prev => {
              const newWrongList = { ...prev.wrongList };
              delete newWrongList[qId];
              return { ...prev, wrongList: newWrongList };
          });
      } else if (showDeleteConfirm.type === 'wrongCategory') {
          const catId = showDeleteConfirm.id;
          setUserState(prev => {
              const newWrongList = { ...prev.wrongList };
              const catQuestions = questions.filter(q => q.categoryId === catId);
              catQuestions.forEach(q => {
                  if (newWrongList[q.id]) delete newWrongList[q.id];
              });
              return { ...prev, wrongList: newWrongList };
          });
      } else if (showDeleteConfirm.type === 'wrongCategoryType') {
          const catId = showDeleteConfirm.id;
          const type = showDeleteConfirm.extra;
          setUserState(prev => {
              const newWrongList = { ...prev.wrongList };
              const catQuestions = questions.filter(q => q.categoryId === catId && q.type === type);
              catQuestions.forEach(q => {
                  if (newWrongList[q.id]) delete newWrongList[q.id];
              });
              return { ...prev, wrongList: newWrongList };
          });
      } else if (showDeleteConfirm.type === 'examExit') {
          setCurrentModeData(null);
      }
      setShowDeleteConfirm(null);
  };

  const initiateDeleteNoteFolder = (id: string, name: string) => {
      setShowDeleteConfirm({ type: 'noteFolder', id, name });
  };

  const initiateDeleteBookmarkFolder = (id: string, name: string) => {
      setShowDeleteConfirm({ type: 'bookmarkFolder', id, name });
  };

  const handleImport = () => {
    if (!uploadText) return alert('请输入题库内容');
    
    let finalCatId = targetCatId;
    let finalCatName = '';

    if (importType === 'new') {
        if (!uploadCatName) return alert('请输入新分类名称');
        
        const existingCat = categories.find(c => c.name === uploadCatName);
        if (existingCat) {
            if(!confirm(`分类 "${uploadCatName}" 已存在，是否合并到该分类？`)) {
                return;
            }
            finalCatId = existingCat.id;
            finalCatName = existingCat.name;
        } else {
            finalCatId = generateId();
            finalCatName = uploadCatName;
            const newCat = { id: finalCatId, name: uploadCatName };
            setCategories([...categories, newCat]);
        }
    } else {
        if (!finalCatId) return alert('请选择现有分类');
        finalCatName = categories.find(c => c.id === finalCatId)?.name || '未知分类';
    }

    const newQuestions = parseTextToQuestions(uploadText, finalCatId);
    if (newQuestions.length === 0) return alert('无法识别内容，请检查格式');
    
    setQuestions([...questions, ...newQuestions]);
    setUploadText('');
    setUploadCatName('');
    alert(`成功导入 ${newQuestions.length} 题到 "${finalCatName}"`);
    setActiveTab('home');
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          setUserState(prev => ({ ...prev, bgImage: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
  };

  const clearBg = () => {
      setUserState(prev => ({ ...prev, bgImage: undefined }));
  };

  const startSession = (list: Question[], title: string, examType: 'study' | 'random' | 'sequential', categoryId?: string) => {
    if (list.length === 0) return alert('没有题目');
    if (examType === 'random') list = list.sort(() => Math.random() - 0.5); 
    setCurrentModeData({
      list,
      index: 0,
      showAnswer: false,
      answers: {},
      isExam: examType !== 'study',
      examType,
      examSubmitted: false,
      title,
      categoryId
    });
  };

  const getWrongStats = () => {
      const allWrong = questions.filter(q => userState.wrongList[q.id]);
      const byCategory = categories.map(cat => ({
          ...cat,
          count: allWrong.filter(q => q.categoryId === cat.id).length
      })).filter(c => c.count > 0);
      return { allWrong, byCategory };
  };

  const prepareGrouping = (list: Question[], titleBase: string, type: 'study' | 'sequential') => {
      setGroupingSelection({ list, titleBase, type });
      setShowGroupingModal(true);
  };

  const resetRandomProgress = (categoryId: string) => {
      setUserState(prev => ({
          ...prev,
          randomProgress: { ...prev.randomProgress, [categoryId]: [] }
      }));
      alert('进度已重置');
  };

  const startRandomWithFilter = (categoryId: string, categoryName: string, typeFilter: QuestionType | 'all') => {
      const allCatQuestions = questions.filter(q => q.categoryId === categoryId);
      let filteredQuestions = typeFilter === 'all' 
          ? allCatQuestions 
          : allCatQuestions.filter(q => q.type === typeFilter);
      
      if (filteredQuestions.length === 0) return alert('该分类下没有此类型的题目');

      const doneIds = userState.randomProgress[categoryId] || [];
      const available = filteredQuestions.filter(q => !doneIds.includes(q.id));

      if (available.length === 0) {
          if (window.confirm(`该类型题目已全部做完！\n是否重置进度重新开始？`)) {
              resetRandomProgress(categoryId);
              const nextBatch = filteredQuestions.sort(() => Math.random() - 0.5).slice(0, 30);
              startSession(nextBatch, `${categoryName} - 随机模考`, 'random', categoryId);
          }
          return;
      }

      const count = Math.min(30, available.length);
      const nextBatch = available.sort(() => Math.random() - 0.5).slice(0, count);
      startSession(nextBatch, `${categoryName} - 随机模考 (剩余${available.length}题)`, 'random', categoryId);
      setShowRandomSetupModal(null);
  };

  const handleRandomExamStart = (categoryId: string, categoryName: string) => {
      setShowRandomSetupModal({ categoryId, categoryName });
  };

  const nextQuestion = useCallback((delay = 0) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
          setCurrentModeData(prev => {
              if (!prev || prev.index >= prev.list.length - 1) return prev;
              return { ...prev, index: prev.index + 1, showAnswer: false };
          });
      }, delay);
  }, []);

  const handleAnswerChange = useCallback((qId: string, value: string, type: QuestionType) => {
      setCurrentModeData(prev => {
          if (!prev) return null;
          let newAnswers = { ...prev.answers };
          if (type === 'multiple') {
            const currentVal = newAnswers[qId] || '';
            let newVal = currentVal.includes(value) ? currentVal.replace(value, '') : currentVal + value;
            newVal = newVal.split('').sort().join('');
            newAnswers[qId] = newVal;
          } else {
            newAnswers[qId] = value;
          }
          
          let newShowAnswer = prev.showAnswer;
          if (!prev.isExam && type !== 'multiple') {
              newShowAnswer = true;
          }

          return { ...prev, answers: newAnswers, showAnswer: newShowAnswer };
      });
  }, []);

  const prevQuestion = useCallback(() => {
      setCurrentModeData(prev => {
          if (!prev || prev.index === 0) return prev;
          return { ...prev, index: prev.index - 1, showAnswer: false };
      });
  }, []);

  const submitExam = useCallback(() => {
    setCurrentModeData(prev => {
        if (!prev) return null;
        
        let currentWrongIds: string[] = [];
        let answeredIds: string[] = [];
        let score = 0;

        prev.list.forEach(q => {
            const userAns = prev.answers[q.id] || '';
            let isCorrect = false;
            if (q.type === 'judgment') {
                isCorrect = isJudgmentCorrect(userAns, q.answer);
            } else {
                // 移除非法字符后比对
                const cleanUser = userAns.replace(/[^A-Z\u4e00-\u9fa5]/g, '').toUpperCase();
                const cleanReal = q.answer.replace(/[^A-Z\u4e00-\u9fa5]/g, '').toUpperCase();
                isCorrect = cleanUser === cleanReal;
            }
            
            if (isCorrect) score++;
            else currentWrongIds.push(q.id);

            answeredIds.push(q.id);
        });

        setTimeout(() => {
            setUserState(s => {
                const newWrongList = { ...s.wrongList };
                currentWrongIds.forEach(id => {
                    newWrongList[id] = (newWrongList[id] || 0) + 1;
                });

                let newRandomProgress = { ...s.randomProgress };
                if (prev.examType === 'random' && prev.categoryId) {
                    const oldDone = newRandomProgress[prev.categoryId] || [];
                    newRandomProgress[prev.categoryId] = Array.from(new Set([...oldDone, ...answeredIds]));
                }

                return {
                    ...s,
                    wrongList: newWrongList,
                    randomProgress: newRandomProgress,
                    examHistory: [...s.examHistory, { id: generateId(), date: Date.now(), score, total: prev.list.length, mode: prev.examType === 'random' ? 'random' : 'sequential' }]
                };
            });
        }, 0);

        return { ...prev, examSubmitted: true };
    });
  }, []);
  
  const toggleBookmark = (qId: string) => {
      const isBookmarked = userState.bookmarkFolders.some(f => f.questionIds.includes(qId));
      if (isBookmarked) {
          setShowDeleteConfirm({ type: 'bookmarkItem', id: qId });
      } else {
          setPendingQuestionIdForFolder(qId);
          setShowFolderModal(true);
      }
  };

  const handleHighlight = (qId: string) => {
      const nextLevel = ((userState.highlights[qId] || 0) + 1) % 6;
      setUserState(prev => ({ ...prev, highlights: { ...prev.highlights, [qId]: nextLevel } }));
      if (nextLevel > 0) {
           const isBookmarked = userState.bookmarkFolders.some(f => f.questionIds.includes(qId));
           if (!isBookmarked) {
               setPendingQuestionIdForFolder(qId);
               setShowFolderModal(true);
           }
      }
  };

  const addToFolder = (folderId: string) => {
      if (!pendingQuestionIdForFolder) return;
      setUserState(prev => ({
          ...prev,
          bookmarkFolders: prev.bookmarkFolders.map(f => 
              f.id === folderId 
                ? { ...f, questionIds: [...new Set([...f.questionIds, pendingQuestionIdForFolder])] } 
                : f
          )
      }));
      setShowFolderModal(false);
      setPendingQuestionIdForFolder(null);
  };

  const removeFromWrongList = (qId: string) => {
      setShowDeleteConfirm({ type: 'wrongItem', id: qId });
  };

  // Note Handlers
  const saveNote = (title: string, content: string, folderId: string) => {
      if (!title.trim()) return alert('请输入笔记标题');
      const now = Date.now();
      
      setUserState(prev => {
          let newNotes = [...prev.notes];
          if (editingNote === 'new') {
              newNotes.unshift({ id: generateId(), title, content, folderId, updatedAt: now });
          } else if (editingNote) {
              newNotes = newNotes.map(n => n.id === editingNote.id ? { ...n, title, content, folderId, updatedAt: now } : n);
          }
          return { ...prev, notes: newNotes };
      });
      setEditingNote(null);
  };

  const createNoteFolder = () => {
      if(!newFolderName.trim()) return alert('请输入名称');
      const newFolder = { id: generateId(), name: newFolderName };
      setUserState(prev => ({ ...prev, noteFolders: [...prev.noteFolders, newFolder] }));
      setNewFolderName('');
      setShowNoteFolderModal(false);
  };

  // Bookmark Handlers
  const createBookmarkFolder = () => {
      if(!newFolderName.trim()) return alert('请输入名称');
      const newFolder = { id: generateId(), name: newFolderName, questionIds: [] };
      setUserState(prev => ({ ...prev, bookmarkFolders: [...prev.bookmarkFolders, newFolder] }));
      setNewFolderName('');
      setShowBookmarkFolderModal(false);
  };

  const initiateDeleteCategory = (catId: string, catName: string) => {
      setDeleteConfirmTarget({ id: catId, name: catName });
  };

  const confirmDeleteCategory = () => {
      if (!deleteConfirmTarget) return;
      const { id: catId } = deleteConfirmTarget;
      
      setQuestions(prevQuestions => prevQuestions.filter(q => q.categoryId !== catId));
      setCategories(prevCategories => prevCategories.filter(c => c.id !== catId));
      setUserState(prev => {
          const newRandomProgress = { ...prev.randomProgress };
          delete newRandomProgress[catId];
          return { ...prev, randomProgress: newRandomProgress };
      });
      if (targetCatId === catId) setTargetCatId('');
      
      setDeleteConfirmTarget(null);
  };

  // --- Modals ---

  const NoteFolderModal = () => {
      if (!showNoteFolderModal) return null;
      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">新建笔记本</h3>
                  <input 
                    type="text" 
                    placeholder="输入笔记本名称" 
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-4 text-sm focus:outline-none focus:border-indigo-400 dark:text-slate-200" 
                    value={newFolderName} 
                    onChange={e => setNewFolderName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-3">
                      <button 
                        onClick={() => {
                            setShowNoteFolderModal(false);
                            setNewFolderName('');
                        }} 
                        className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                      >
                        取消
                      </button>
                      <button 
                        onClick={createNoteFolder} 
                        className="flex-1 py-2 bg-emerald-500 text-white rounded-lg font-bold"
                      >
                        创建
                      </button>
                  </div>
              </div>
          </div>
      )
  }

  const BookmarkFolderModal = () => {
      if (!showBookmarkFolderModal) return null;
      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">新建收藏夹</h3>
                  <input 
                    type="text" 
                    placeholder="输入收藏夹名称" 
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-4 text-sm focus:outline-none focus:border-indigo-400 dark:text-slate-200" 
                    value={newFolderName} 
                    onChange={e => setNewFolderName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-3">
                      <button 
                        onClick={() => {
                            setShowBookmarkFolderModal(false);
                            setNewFolderName('');
                        }} 
                        className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
                      >
                        取消
                      </button>
                      <button 
                        onClick={createBookmarkFolder} 
                        className="flex-1 py-2 bg-pink-500 text-white rounded-lg font-bold"
                      >
                        创建
                      </button>
                  </div>
              </div>
          </div>
      )
  }

  const RandomSetupModal = () => {
      if (!showRandomSetupModal) return null;
      const { categoryId, categoryName } = showRandomSetupModal;
      
      const doneCount = userState.randomProgress[categoryId]?.length || 0;
      // Filter questions for this category first to avoid repeated filters
      const catQuestions = questions.filter(q => q.categoryId === categoryId);
      const totalCount = catQuestions.length;
      const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      // Calculate counts for each type
      const typeCounts: Record<string, number> = {
          single: 0, multiple: 0, judgment: 0, fill: 0, essay: 0
      };
      catQuestions.forEach(q => {
          if (typeCounts[q.type] !== undefined) typeCounts[q.type]++;
      });

      const typeConfig: { type: QuestionType, label: string }[] = [
          { type: 'single', label: '单选题' },
          { type: 'multiple', label: '多选题' },
          { type: 'judgment', label: '判断题' },
          { type: 'fill', label: '填空题' },
          { type: 'essay', label: '简答题' },
      ];

      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                   <div className="flex justify-between items-center mb-6">
                      <div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{categoryName}</h3>
                          <p className="text-xs text-slate-400">智能随机配置</p>
                      </div>
                      <button onClick={() => setShowRandomSetupModal(null)}><X size={20} className="text-slate-400"/></button>
                  </div>

                  <div className="mb-6">
                      <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-600 dark:text-slate-400">已做进度</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{doneCount} / {totalCount}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${progress}%` }}></div>
                      </div>
                      <button 
                          onClick={() => resetRandomProgress(categoryId)}
                          className="text-xs text-rose-500 hover:underline mt-2 flex items-center"
                      >
                          <RefreshCcw size={10} className="mr-1"/> 重置进度
                      </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto">
                      <button 
                          onClick={() => startRandomWithFilter(categoryId, categoryName, 'all')}
                          className="p-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-xl text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors col-span-2 flex justify-between items-center"
                      >
                          <span>混合随机</span>
                          <span className="text-xs font-normal opacity-70 bg-indigo-200 dark:bg-indigo-800 px-2 py-0.5 rounded-full">所有题型</span>
                      </button>
                      
                      {typeConfig.map(config => {
                          const count = typeCounts[config.type];
                          return (
                              <button 
                                  key={config.type}
                                  onClick={() => count > 0 && startRandomWithFilter(categoryId, categoryName, config.type)}
                                  disabled={count === 0}
                                  className={`p-4 border rounded-xl flex flex-col items-center justify-center transition-all ${
                                      count > 0 
                                      ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer' 
                                      : 'border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed bg-slate-50 dark:bg-slate-900/50'
                                  }`}
                              >
                                  <span className="font-bold">{config.label}</span>
                                  <span className="text-xs opacity-70 mt-1">{count} 题</span>
                              </button>
                          );
                      })}
                  </div>
              </div>
          </div>
      )
  }

  const GroupingModal = () => {
      if (!showGroupingModal || !groupingSelection) return null;
      const { list, titleBase, type } = groupingSelection;
      
      const typeLabels: Record<QuestionType, string> = {
          'single': '单选题',
          'multiple': '多选题',
          'judgment': '判断题',
          'fill': '填空题',
          'essay': '简答题'
      };
      
      const availableTypes = (['single', 'multiple', 'judgment', 'fill', 'essay'] as QuestionType[]).filter(t => list.some(q => q.type === t));

      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{titleBase} - 选择题型</h3>
                      <button onClick={() => setShowGroupingModal(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  <div className="overflow-y-auto grid grid-cols-2 gap-3 p-2">
                      {availableTypes.map(t => {
                          const typeCount = list.filter(q => q.type === t).length;
                          return (
                              <button 
                                  key={t}
                                  onClick={() => {
                                      const filteredList = list.filter(q => q.type === t);
                                      startSession(filteredList, `${titleBase} - ${typeLabels[t]}`, type);
                                      setShowGroupingModal(false);
                                  }}
                                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 transition-all flex flex-col items-center justify-center text-center group"
                              >
                                  <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">{typeLabels[t]}</span>
                                  <span className="text-slate-400 dark:text-slate-500 text-xs mt-1">{typeCount} 题</span>
                              </button>
                          )
                      })}
                  </div>
                  {availableTypes.length === 0 && <div className="text-center text-slate-400 py-4">暂无题目</div>}
              </div>
          </div>
      );
  };

  const WrongGroupingModal = () => {
      if (!showWrongGroupingModal) return null;
      const { allWrong, byCategory } = getWrongStats();

      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                          <AlertTriangle className="mr-2 text-rose-500" size={20}/>
                          错题本分类
                      </h3>
                      <button onClick={() => setShowWrongGroupingModal(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  
                  <div className="overflow-y-auto p-1 space-y-3">
                      <button 
                          onClick={() => {
                              startSession(allWrong, '错题本 (全部)', 'study');
                              setShowWrongGroupingModal(false);
                          }}
                          className="w-full p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all flex justify-between items-center group"
                      >
                          <span className="font-bold text-rose-700 dark:text-rose-400">全部错题</span>
                          <span className="bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200 text-xs px-2 py-1 rounded-full">{allWrong.length} 题</span>
                      </button>

                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-4 mb-2 flex items-center">
                          <ListFilter size={12} className="mr-1"/> 按分类查看
                      </div>
                      
                      {byCategory.length === 0 ? (
                          <div className="text-center text-slate-400 py-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">暂无分类错题数据</div>
                      ) : (
                          <div className="flex flex-col gap-2">
                              {byCategory.map(cat => (
                                  <div key={cat.id} className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                                      <div 
                                          onClick={() => {
                                              const list = allWrong.filter(q => q.categoryId === cat.id);
                                              startSession(list, `错题本 - ${cat.name}`, 'study');
                                              setShowWrongGroupingModal(false);
                                          }}
                                          className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center cursor-pointer transition-colors"
                                      >
                                          <div className="flex items-center">
                                              <span className="text-slate-600 dark:text-slate-300 font-medium">{cat.name}</span>
                                          </div>
                                          <div className="flex items-center">
                                              <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400 px-2 py-1 rounded mr-2">{cat.count} 题</span>
                                              <button 
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      setShowDeleteConfirm({ type: 'wrongCategory', id: cat.id, name: cat.name });
                                                  }}
                                                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
                                              >
                                                  <Trash2 size={14}/>
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  };

  const DeleteConfirmModal = () => {
      if (!showDeleteConfirm && !deleteConfirmTarget) return null;
      
      const isCatDelete = !!deleteConfirmTarget;
      
      let title = "确认删除";
      let message: React.ReactNode = null;
      let confirmText = "确认删除";
      
      if (isCatDelete) {
          title = "确认删除题库";
          message = <>即将删除题库 <span className="font-bold text-slate-700 dark:text-slate-200">"{deleteConfirmTarget?.name}"</span><br/>此操作将永久清空该分类下的所有题目及错题记录。</>;
      } else if (showDeleteConfirm?.type === 'noteFolder') {
          title = "确认删除笔记本";
          message = <>即将删除笔记本 <span className="font-bold text-slate-700 dark:text-slate-200">"{showDeleteConfirm.name}"</span><br/>该笔记本内的所有笔记也将被一并删除！</>;
      } else if (showDeleteConfirm?.type === 'bookmarkFolder') {
          title = "确认删除收藏夹";
          message = <>即将删除收藏夹 <span className="font-bold text-slate-700 dark:text-slate-200">"{showDeleteConfirm.name}"</span><br/>该操作将移除该收藏夹及其内所有收藏！</>;
      } else if (showDeleteConfirm?.type === 'bookmarkItem') {
          title = "取消收藏";
          message = <>确定要取消收藏此题目吗？<br/>它将从所有收藏夹中移除。</>;
          confirmText = "确认取消";
      } else if (showDeleteConfirm?.type === 'wrongItem') {
          title = "移除错题";
          message = <>确定要移除此错题吗？<br/>这表示你已经掌握了它。</>;
          confirmText = "确认移除";
      } else if (showDeleteConfirm?.type === 'wrongCategory') {
          title = "清空错题";
          message = <>确定要清空 <span className="font-bold text-slate-700 dark:text-slate-200">"{showDeleteConfirm.name}"</span> 下的所有错题吗？</>;
          confirmText = "确认清空";
      } else if (showDeleteConfirm?.type === 'wrongCategoryType') {
          title = "清空错题";
          message = <>确定要清空 <span className="font-bold text-slate-700 dark:text-slate-200">"{showDeleteConfirm.name}"</span> 的所有错题吗？</>;
          confirmText = "确认清空";
      } else if (showDeleteConfirm?.type === 'examExit') {
          title = "退出考试";
          message = <>确定要退出当前考试吗？<br/>未提交的进度将会丢失。</>;
          confirmText = "确认退出";
      } else {
          message = <>确定要删除此笔记吗？删除后无法恢复。</>;
      }
      
      const onConfirm = () => {
          if (isCatDelete) confirmDeleteCategory();
          else confirmDelete();
      };

      const onCancel = () => {
          if (isCatDelete) setDeleteConfirmTarget(null);
          else setShowDeleteConfirm(null);
      }

      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/50 text-rose-500 rounded-full flex items-center justify-center mb-3">
                          <AlertOctagon size={24} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                          {message}
                      </p>
                  </div>
                  <div className="flex gap-3">
                      <button 
                          onClick={onCancel}
                          className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                          取消
                      </button>
                      <button 
                          onClick={onConfirm}
                          className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 shadow-lg shadow-rose-200 dark:shadow-none transition-colors"
                      >
                          {confirmText}
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  const SettingsModal = () => {
      if (!showSettingsModal) return null;
      return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                          <Settings className="mr-2 text-indigo-500" size={20}/>
                          设置
                      </h3>
                      <button onClick={() => setShowSettingsModal(false)}><X size={20} className="text-slate-400"/></button>
                  </div>
                  
                  <div className="space-y-6">
                      {/* Theme Toggle */}
                      <div>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">界面主题</div>
                          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                              <button 
                                  onClick={() => setUserState(p => ({ ...p, theme: 'light' }))}
                                  className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm transition-all ${userState.theme === 'light' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                              >
                                  <Sun size={16} className="mr-2"/> 浅色
                              </button>
                              <button 
                                  onClick={() => setUserState(p => ({ ...p, theme: 'dark' }))}
                                  className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm transition-all ${userState.theme === 'dark' ? 'bg-white dark:bg-slate-600 text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                              >
                                  <Moon size={16} className="mr-2"/> 深色
                              </button>
                          </div>
                      </div>

                      {/* Font Size Toggle */}
                      <div>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">字体大小</div>
                          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                              {(['small', 'normal', 'large', 'xlarge'] as FontSize[]).map(size => (
                                  <button
                                      key={size}
                                      onClick={() => setUserState(p => ({ ...p, fontSize: size }))}
                                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${userState.fontSize === size ? 'bg-white dark:bg-slate-600 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                                  >
                                      {size === 'small' ? '小' : size === 'normal' ? '中' : size === 'large' ? '大' : '特大'}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Custom Background */}
                      <div>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">自定义背景</div>
                          {userState.bgImage ? (
                              <div className="relative rounded-xl overflow-hidden h-32 border border-slate-200 dark:border-slate-700 group">
                                  <img src={userState.bgImage} alt="Custom Bg" className="w-full h-full object-cover"/>
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={clearBg} className="bg-rose-500 text-white px-3 py-1 rounded text-xs flex items-center">
                                          <Trash2 size={12} className="mr-1"/> 移除
                                      </button>
                                  </div>
                              </div>
                          ) : (
                              <div 
                                  onClick={() => bgInputRef.current?.click()}
                                  className="h-32 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 cursor-pointer transition-colors bg-slate-50 dark:bg-slate-800"
                              >
                                  <ImageIcon size={24} className="mb-2"/>
                                  <span className="text-xs">点击上传图片</span>
                              </div>
                          )}
                          <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                      </div>

                      {/* Data Management */}
                      <div>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">数据管理</div>
                          <div className="flex gap-2">
                              <button 
                                  onClick={handleExportData}
                                  className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm flex items-center justify-center font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                              >
                                  <Download size={16} className="mr-2"/> 导出备份
                              </button>
                              <button 
                                  onClick={() => importDataInputRef.current?.click()}
                                  className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm flex items-center justify-center font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                              >
                                  <RotateCw size={16} className="mr-2"/> 恢复备份
                              </button>
                              <input ref={importDataInputRef} type="file" accept=".json" className="hidden" onChange={handleImportData} />
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className={`${userState.theme} min-h-screen font-sans text-slate-600 dark:text-slate-300`}>
        <div 
            className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-500"
            style={{ 
                backgroundImage: userState.bgImage ? `url(${userState.bgImage})` : undefined,
                backgroundColor: userState.theme === 'dark' ? '#0f172a' : '#fdfbf7' 
            }}
        />
        {userState.bgImage && (
            <div className={`fixed inset-0 z-0 ${userState.theme === 'dark' ? 'bg-black/60' : 'bg-white/40'} backdrop-blur-sm pointer-events-none`}/>
        )}

        <div className="relative z-10 flex flex-col h-screen max-w-md mx-auto overflow-hidden shadow-2xl">
            <GroupingModal />
            <WrongGroupingModal />
            <DeleteConfirmModal />
            <SettingsModal />
            <NoteFolderModal />
            <BookmarkFolderModal />
            <RandomSetupModal />

            {/* Note Editor Overlay */}
            {editingNote && (
                <div className="absolute inset-0 z-50">
                    <NoteEditor 
                        initialContent={editingNote === 'new' ? undefined : editingNote}
                        folders={userState.noteFolders}
                        onSave={saveNote}
                        onCancel={() => setEditingNote(null)}
                    />
                </div>
            )}

            {showFolderModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">加入收藏夹</h3>
                            <button onClick={() => setShowFolderModal(false)}><X size={20} className="text-slate-400"/></button>
                        </div>
                        <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                            {userState.bookmarkFolders.map(folder => (
                                <button key={folder.id} onClick={() => addToFolder(folder.id)} className="w-full p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-200 text-left flex items-center transition-all">
                                    <Folder size={20} className="text-indigo-400 mr-3"/>
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{folder.name}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <input type="text" placeholder="新建收藏夹" className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none dark:text-slate-200" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} />
                            <button onClick={() => {
                                if(!newFolderName.trim()) return;
                                const newFolder = { id: generateId(), name: newFolderName, questionIds: [] };
                                setUserState(p => ({ ...p, bookmarkFolders: [...p.bookmarkFolders, newFolder] }));
                                setNewFolderName('');
                            }} className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700"><Plus/></button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto relative z-10 scrollbar-hide">
                {currentModeData ? (
                <QuestionCard 
                    key={currentModeData.list[currentModeData.index].id} 
                    data={currentModeData}
                    question={currentModeData.list[currentModeData.index]}
                    userState={userState}
                    categoryName={categories.find(c => c.id === currentModeData.list[currentModeData.index].categoryId)?.name}
                    onAnswerChange={handleAnswerChange}
                    onNext={nextQuestion}
                    onPrev={prevQuestion}
                    onSubmitExam={submitExam}
                    onToggleBookmark={toggleBookmark}
                    onHighlight={handleHighlight}
                    onRemoveWrong={removeFromWrongList} 
                    onExit={() => {
                        if (currentModeData.isExam && !currentModeData.examSubmitted) {
                            setShowDeleteConfirm({ type: 'examExit', id: '' });
                        } else {
                            setCurrentModeData(null);
                        }
                    }}
                    onSetShowAnswer={(show) => setCurrentModeData(p => p ? ({ ...p, showAnswer: show }) : null)}
                />
                ) : (
                <>
                    {activeTab === 'home' && (
                        <div className="p-6 space-y-8 relative z-10">
                            {/* Header Search & Settings */}
                            <div className="flex gap-3 mb-2">
                                <div className="flex-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full px-4 py-2.5 flex items-center border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <Search size={16} className="text-slate-400 mr-2"/>
                                    <input 
                                        type="text" 
                                        placeholder="搜索题库..." 
                                        className="bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 w-full"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        onFocus={() => setShowSearch(true)}
                                    />
                                    {searchQuery && (
                                        <button onClick={() => { setSearchQuery(''); setShowSearch(false); }} className="text-slate-400">
                                            <X size={14}/>
                                        </button>
                                    )}
                                </div>
                                <button onClick={() => setShowSettingsModal(true)} className="p-2.5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-100 dark:border-slate-800 shadow-sm text-slate-600 dark:text-slate-300">
                                    <Settings size={20}/>
                                </button>
                            </div>

                            {/* Search Results Overlay */}
                            {showSearch && searchQuery && (
                                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-100 dark:border-slate-800 shadow-lg p-4 absolute top-20 left-6 right-6 z-50 max-h-[60vh] overflow-y-auto">
                                    <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">搜索结果</div>
                                    {questions.filter(q => q.content.includes(searchQuery)).length === 0 ? (
                                        <div className="text-center text-slate-400 py-4 text-sm">未找到相关题目</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {questions.filter(q => q.content.includes(searchQuery)).slice(0, 10).map(q => (
                                                <div 
                                                    key={q.id} 
                                                    onClick={() => startSession([q], '搜索结果', 'study')}
                                                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0"
                                                >
                                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 line-clamp-1">{q.content}</div>
                                                    <div className="text-xs text-slate-400 mt-1">{categories.find(c => c.id === q.categoryId)?.name} · {q.type}</div>
                                                </div>
                                            ))}
                                            {questions.filter(q => q.content.includes(searchQuery)).length > 10 && (
                                                <div className="text-center text-xs text-indigo-500 pt-2 cursor-pointer" onClick={() => startSession(questions.filter(q => q.content.includes(searchQuery)), '搜索结果', 'study')}>
                                                    查看全部 {questions.filter(q => q.content.includes(searchQuery)).length} 条结果
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="text-center py-4">
                                <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight mb-2 drop-shadow-sm">满分上岸</h1>
                                <p className="text-slate-500 dark:text-slate-400 text-sm tracking-widest uppercase">Ace Your Exam</p>
                            </div>
                            
                            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
                                <div className="flex items-center mb-4 text-indigo-600 dark:text-indigo-400 font-bold">
                                    <BookOpen className="mr-2"/> 题库刷题 (按题型)
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    <div onClick={() => prepareGrouping(questions, '全库', 'study')} className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-center cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                                        <span className="font-bold text-indigo-700 dark:text-indigo-300">全库练习</span>
                                        <span className="text-xs text-indigo-400 dark:text-indigo-300 ml-2">{questions.length}题</span>
                                    </div>
                                    {categories.map(cat => {
                                        const count = questions.filter(q => q.categoryId === cat.id).length;
                                        return (
                                            <div key={cat.id} onClick={() => prepareGrouping(questions.filter(q => q.categoryId === cat.id), cat.name, 'study')} className="p-4 border border-slate-100 dark:border-slate-700 rounded-xl flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900">
                                                <span className="text-slate-700 dark:text-slate-200 font-medium">{cat.name}</span>
                                                <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{count}题</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div onClick={() => setActiveTab('exam')} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-amber-200 dark:hover:border-amber-700 cursor-pointer flex flex-col items-center justify-center text-center h-28">
                                    <Zap size={24} className="text-amber-500 mb-2" />
                                    <div className="text-slate-700 dark:text-slate-200 font-bold text-xs">模拟考试</div>
                                </div>
                                <div onClick={() => setActiveTab('bookmarks')} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-pink-200 dark:hover:border-pink-700 cursor-pointer flex flex-col items-center justify-center text-center h-28">
                                    <Star size={24} className="text-pink-500 mb-2" />
                                    <div className="text-slate-700 dark:text-slate-200 font-bold text-xs">收藏夹</div>
                                </div>
                                <div onClick={() => setShowWrongGroupingModal(true)} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-rose-200 dark:hover:border-rose-700 cursor-pointer flex flex-col items-center justify-center text-center h-28">
                                    <AlertTriangle size={24} className="text-rose-500 mb-2" />
                                    <div className="text-slate-700 dark:text-slate-200 font-bold text-xs">错题本</div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'upload' && (
                        <div className="p-6 h-full flex flex-col relative z-10">
                            <h2 className="text-slate-800 dark:text-slate-100 font-bold text-xl mb-6 flex items-center"><Upload className="mr-3 text-blue-500"/> 导入新题库</h2>
                            
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
                                <button 
                                    onClick={() => setImportType('new')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${importType === 'new' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    <FolderPlus size={16} className="inline mr-1"/> 新建分类
                                </button>
                                <button 
                                    onClick={() => setImportType('existing')}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${importType === 'existing' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    <FolderOpen size={16} className="inline mr-1"/> 现有分类
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300">内容输入</div>
                                    <div className="flex gap-3">
                                        {uploadText && <button onClick={() => setUploadText('')} className="text-xs text-rose-500 flex items-center"><Eraser size={12} className="mr-1"/>清空</button>}
                                    </div>
                                </div>
                                
                                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg mb-4 text-xs text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                                    <div className="font-bold mb-1 flex items-center"><Info size={14} className="mr-1"/> 格式排版指南</div>
                                    <div className="grid grid-cols-2 gap-2 opacity-80">
                                        <div>
                                            <span className="font-bold">选择题：</span><br/>
                                            1. 题目...<br/>
                                            A. xx B. xx<br/>
                                            答案：A
                                        </div>
                                        <div>
                                            <span className="font-bold">判断题：</span><br/>
                                            2. 题目...<br/>
                                            答案：对
                                        </div>
                                        <div>
                                            <span className="font-bold">多选题：</span><br/>
                                            3. [多选]...<br/>
                                            A.. B..<br/>
                                            答案：AB
                                        </div>
                                        <div>
                                            <span className="font-bold">填空题：</span><br/>
                                            4. [填空]...<br/>
                                            答案：内容
                                        </div>
                                    </div>
                                </div>

                                {importType === 'new' ? (
                                    <input 
                                        type="text" 
                                        placeholder="输入新分类名称 (例如: 近代史)" 
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-3 text-sm focus:outline-none focus:border-indigo-400 dark:text-slate-200" 
                                        value={uploadCatName} 
                                        onChange={e => setUploadCatName(e.target.value)} 
                                    />
                                ) : (
                                    <select 
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-3 text-sm focus:outline-none focus:border-indigo-400 appearance-none dark:text-slate-200"
                                        value={targetCatId}
                                        onChange={e => setTargetCatId(e.target.value)}
                                    >
                                        <option value="">-- 请选择目标分类 --</option>
                                        {categories.filter(c => c.id !== 'default').map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                )}

                                <textarea 
                                    className="flex-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 min-h-[200px] dark:text-slate-200" 
                                    placeholder="在此粘贴题目内容..." 
                                    value={uploadText} 
                                    onChange={e => setUploadText(e.target.value)} 
                                />
                                
                                <div className="mt-3 flex justify-between items-center">
                                    <div className="text-xs text-slate-400">或导入文件:</div>
                                    <input ref={fileInputRef} type="file" accept=".txt,.json,.doc,.docx" className="hidden" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if(!file) return;
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                            setUploadText(ev.target?.result as string);
                                            if(importType === 'new' && !uploadCatName) setUploadCatName(file.name.replace(/\.(txt|json)$/, ''));
                                        };
                                        reader.readAsText(file);
                                    }} />
                                    <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1 rounded text-slate-600 dark:text-slate-300 flex items-center transition-colors">
                                        <FileText size={12} className="mr-1"/> 选择文件 (.txt)
                                    </button>
                                </div>
                            </div>
                            
                            <button onClick={handleImport} className="w-full py-4 bg-slate-800 dark:bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-slate-700 dark:hover:bg-indigo-700 active:scale-95 transition-all">
                                {importType === 'new' ? '创建并导入' : '追加导入'}
                            </button>
                            
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 pb-20">
                                <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">管理分类</div>
                                <div className="space-y-2">
                                    {categories.map(cat => (
                                        <div key={cat.id} className="flex justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg items-center group">
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">{cat.name}</span>
                                            <div className="flex items-center">
                                                <span className="text-xs text-slate-300 dark:text-slate-600 mr-3">{questions.filter(q => q.categoryId === cat.id).length} 题</span>
                                                {cat.id !== 'default' && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            initiateDeleteCategory(cat.id, cat.name);
                                                        }} 
                                                        className="text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-full transition-all"
                                                    >
                                                        <Trash2 size={18}/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'exam' && (
                        <div className="p-6 relative z-10 w-full">
                            <h2 className="text-slate-800 dark:text-slate-100 font-bold text-xl mb-6 flex items-center"><Zap className="mr-3 text-amber-500"/> 考试配置</h2>
                            <div className="space-y-4 pb-20">
                                {categories.map(cat => {
                                    const doneCount = (userState.randomProgress[cat.id] || []).length;
                                    const totalCount = questions.filter(q => q.categoryId === cat.id).length;
                                    
                                    return (
                                        <div key={cat.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="font-bold text-slate-700 dark:text-slate-200">{cat.name}</span>
                                                <span className="text-xs text-slate-400 dark:text-slate-500">{totalCount}题</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleRandomExamStart(cat.id, cat.name)}
                                                    className="flex-1 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 flex flex-col items-center justify-center transition-colors"
                                                >
                                                    <div className="flex items-center"><RefreshCcw size={14} className="mr-1"/> 智能随机</div>
                                                    <div className="text-[10px] mt-0.5 opacity-70">进度: {doneCount}/{totalCount}</div>
                                                </button>
                                                <button 
                                                    onClick={() => prepareGrouping(questions.filter(q => q.categoryId === cat.id), cat.name, 'sequential')}
                                                    className="flex-1 py-2 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                                                >
                                                    <Layers size={14} className="mr-1"/> 顺序(分组)
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                                <button onClick={() => startSession(questions, '全真模拟', 'random')} className="w-full p-5 mt-4 rounded-xl bg-indigo-600 text-white font-bold shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">全库随机大考 (30题)</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'bookmarks' && (
                        <div className="p-6 h-full relative z-10 w-full flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-slate-800 dark:text-slate-100 font-bold text-xl flex items-center"><Star className="mr-3 text-pink-500"/> 我的收藏</h2>
                                <button 
                                    onClick={() => setShowBookmarkFolderModal(true)}
                                    className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 flex items-center text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <Plus size={14} className="mr-1"/> 新建收藏夹
                                </button>
                            </div>
                            <div className="grid gap-3 pb-20 flex-1 overflow-y-auto content-start">
                                {userState.bookmarkFolders.map(folder => (
                                    <div key={folder.id} onClick={() => startSession(questions.filter(q => folder.questionIds.includes(q.id)), folder.name, 'study')} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer flex justify-between items-center group transition-all">
                                        <div className="flex items-center">
                                            <Folder className="text-pink-400 mr-3" size={24}/>
                                            <div><div className="text-slate-700 dark:text-slate-200 font-bold">{folder.name}</div><div className="text-xs text-slate-400">{folder.questionIds.length} 题</div></div>
                                        </div>
                                        {folder.id !== 'fav_default' && <button onClick={(e) => { 
                                            e.stopPropagation(); 
                                            initiateDeleteBookmarkFolder(folder.id, folder.name);
                                        }} className="p-2 text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400"><Trash2 size={16}/></button>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="p-6 h-full relative z-10 w-full flex flex-col">
                            <h2 className="text-slate-800 dark:text-slate-100 font-bold text-xl mb-6 flex items-center"><PenTool className="mr-3 text-emerald-500"/> 学习笔记</h2>
                            
                            {/* Note Folders Tabs */}
                            <div className="flex gap-2 overflow-x-auto pb-4 mb-2 hide-scrollbar">
                                <button 
                                    onClick={() => setActiveNoteFolderId('all')}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeNoteFolderId === 'all' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                                >
                                    全部
                                </button>
                                {userState.noteFolders.map(folder => (
                                    <div key={folder.id} className="relative group flex-shrink-0">
                                        <button 
                                            onClick={() => setActiveNoteFolderId(folder.id)}
                                            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center ${activeNoteFolderId === folder.id ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                                        >
                                            {folder.name}
                                            {folder.id !== 'default' && (
                                                <span 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        initiateDeleteNoteFolder(folder.id, folder.name);
                                                    }}
                                                    className={`ml-2 p-0.5 rounded-full hover:bg-red-500/20 ${activeNoteFolderId === folder.id ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}
                                                >
                                                    <X size={12} />
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => setShowNoteFolderModal(true)}
                                    className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 flex items-center whitespace-nowrap hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <Plus size={14} className="mr-1"/> 新建本子
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pb-20 grid gap-3 content-start">
                                {userState.notes.filter(n => activeNoteFolderId === 'all' || n.folderId === activeNoteFolderId).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center text-slate-400 h-64">
                                        <FileText size={48} className="mb-2 opacity-50"/>
                                        <p>暂无笔记</p>
                                        <button onClick={() => setEditingNote('new')} className="mt-4 text-emerald-500 font-medium">创建第一条笔记</button>
                                    </div>
                                ) : (
                                    userState.notes
                                        .filter(n => activeNoteFolderId === 'all' || n.folderId === activeNoteFolderId)
                                        .map(note => (
                                            <div key={note.id} onClick={() => setEditingNote(note)} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col group cursor-pointer hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-bold text-slate-700 dark:text-slate-200 line-clamp-1">{note.title}</h3>
                                                        <span className="text-[10px] text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded mt-1 inline-block">
                                                            {userState.noteFolders.find(f => f.id === note.folderId)?.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="text-[10px] text-slate-400 mr-3">{new Date(note.updatedAt).toLocaleDateString()}</span>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowDeleteConfirm({ type: 'note', id: note.id });
                                                            }} 
                                                            className="text-slate-300 hover:text-rose-500 p-1 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                                                        >
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div 
                                                    className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2"
                                                    dangerouslySetInnerHTML={{ __html: note.content.replace(/<[^>]+>/g, '') || '无内容' }} 
                                                />
                                            </div>
                                    ))
                                )}
                            </div>
                            <button 
                                onClick={() => setEditingNote('new')}
                                className="absolute bottom-24 right-6 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95"
                            >
                                <Plus size={28}/>
                            </button>
                        </div>
                    )}
                </>
                )}
            </div>

            {!currentModeData && (
                <div className="h-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 relative z-20 flex justify-around items-center max-w-2xl mx-auto w-full pb-2 transition-colors">
                    <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'home' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}><Menu size={24} /><span className="text-[10px] mt-1 font-medium">首页</span></button>
                    <button onClick={() => setActiveTab('upload')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'upload' ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}><Upload size={24} /><span className="text-[10px] mt-1 font-medium">导入</span></button>
                    <button onClick={() => setActiveTab('notes')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'notes' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}><PenTool size={24} /><span className="text-[10px] mt-1 font-medium">笔记</span></button>
                    <button onClick={() => setActiveTab('bookmarks')} className={`flex flex-col items-center p-2 rounded-xl transition-all ${activeTab === 'bookmarks' ? 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}><Star size={24} /><span className="text-[10px] mt-1 font-medium">收藏</span></button>
                </div>
            )}
            
            <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; } .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; } .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); } .hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
        </div>
    </div>
  );
}