
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Calendar, Upload, FileText, Save, Plus, Loader2, Phone, List, 
  ChevronDown, ChevronUp, RefreshCw, Trash2, Edit, CalendarDays,
  CheckCircle2, XCircle, User, Clock
} from 'lucide-react';
import { ApplicationRecord, AppView, Status, StatusOption } from './types';
import { formatDateForInput, formatTimeForInput, blobToBase64 } from './utils';
import { analyzePdf } from './services/geminiService';

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyPCFGSSceiBEsi7PJNC6v7JF8pHYrXA1YoyGHLqa_AL_-wnU4XDay_kRk_FmQH03w5Yw/exec"; 

const STATUS_OPTIONS: StatusOption[] = [
  { value: Status.Processing, label: '進行中', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: Status.Completed, label: '已完成', color: 'bg-green-100 text-green-700 border-green-200' }
];

const INITIAL_FORM_STATE: Omit<ApplicationRecord, 'id'> = {
  schoolName: '',
  applicantName: '',
  phone: '',
  confirmedDate: '', 
  startTime: '09:00',
  endTime: '12:00',
  firstChoiceDate: '',
  firstChoiceStart: '',
  firstChoiceEnd: '',
  secondChoiceDate: '',
  secondChoiceStart: '',
  secondChoiceEnd: '',
  dateOther: '',
  participantCount: '',
  difficulties: '',
  expectations: '',
  staff: [],
  status: Status.Processing
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('form'); 
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Omit<ApplicationRecord, 'id'>>(INITIAL_FORM_STATE);
  const [customStaff, setCustomStaff] = useState('');

  const fetchRecords = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?t=${new Date().getTime()}`);
      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      
      const sorted = (data as ApplicationRecord[]).sort((a, b) => {
        const dateA = a.confirmedDate ? formatDateForInput(a.confirmedDate) : '9999-99-99';
        const dateB = b.confirmedDate ? formatDateForInput(b.confirmedDate) : '9999-99-99';
        return dateA.localeCompare(dateB);
      });
      
      setRecords(sorted);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'list' && records.length === 0) {
      fetchRecords();
    }
  }, [view, records.length, fetchRecords]);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    try {
      const base64Data = await blobToBase64(file);
      const aiData = await analyzePdf(base64Data);
      
      setFormData(prev => ({ 
        ...prev, 
        ...aiData,
        confirmedDate: formatDateForInput(aiData.firstChoiceDate) || prev.confirmedDate,
        startTime: formatTimeForInput(aiData.firstChoiceStart) || prev.startTime,
        endTime: formatTimeForInput(aiData.firstChoiceEnd) || prev.endTime
      }));
    } catch (err: any) { 
      console.error("PDF 解析錯誤:", err);
      alert(`PDF 解析失敗: ${err.message}`); 
    } finally { 
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setIsEditing(false);
    setEditingId(null);
    setSaveStatus(null);
  };

  const handleSave = async () => {
    if (!formData.schoolName) return alert("請輸入學校名稱");
    setLoading(true);
    const action = isEditing ? 'update' : 'create';
    const id = isEditing ? editingId! : Date.now().toString();
    
    const payload = { 
      action, 
      id, 
      ...formData, 
      staff: formData.staff.join(', '),
      confirmedDate: formatDateForInput(formData.confirmedDate),
      startTime: formatTimeForInput(formData.startTime),
      endTime: formatTimeForInput(formData.endTime)
    };

    try {
      // Use POST to Google Script
      await fetch(GOOGLE_SCRIPT_URL, { 
        method: "POST", 
        mode: "no-cors", 
        body: JSON.stringify(payload) 
      });
      setSaveStatus('success');
      
      // Update local state for immediate feedback
      if (isEditing) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, ...formData, staff: formData.staff.join(', ') } : r));
        setTimeout(() => { setView('list'); resetForm(); }, 1000);
      } else {
        const newRecord: ApplicationRecord = { 
          id, 
          ...formData, 
          staff: formData.staff, // will be joined when displayed or sent
          createdAt: new Date().toISOString() 
        } as any;
        setRecords(prev => [newRecord, ...prev]);
        setTimeout(() => resetForm(), 1500);
      }
    } catch (err) { 
      setSaveStatus('error'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleEdit = (record: ApplicationRecord) => {
    const staffArr = typeof record.staff === 'string' 
      ? (record.staff as string).split(',').map(s => s.trim()).filter(Boolean) 
      : Array.isArray(record.staff) ? record.staff : [];
    
    setFormData({
      ...record,
      confirmedDate: formatDateForInput(record.confirmedDate),
      startTime: formatTimeForInput(record.startTime),
      endTime: formatTimeForInput(record.endTime),
      staff: staffArr
    });
    setEditingId(record.id);
    setIsEditing(true);
    setView('form');
  };

  const confirmDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
    setRecords(prev => prev.filter(r => r.id !== id));
    try {
      await fetch(GOOGLE_SCRIPT_URL, { 
        method: "POST", 
        mode: "no-cors", 
        body: JSON.stringify({ action: 'delete', id }) 
      });
    } catch (err) { 
      console.error("刪除失敗", err); 
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    try {
      await fetch(GOOGLE_SCRIPT_URL, { 
        method: "POST", 
        mode: "no-cors", 
        body: JSON.stringify({ action: 'update', id, status }) 
      });
    } catch (err) {
      console.error("Status update failed", err);
    }
  };

  const applyDateSelection = (type: 'first' | 'second' | 'other') => {
    if (type === 'first') {
      setFormData(prev => ({ 
        ...prev, 
        confirmedDate: prev.firstChoiceDate, 
        startTime: prev.firstChoiceStart, 
        endTime: prev.firstChoiceEnd 
      }));
    } else if (type === 'second') {
      setFormData(prev => ({ 
        ...prev, 
        confirmedDate: prev.secondChoiceDate, 
        startTime: prev.secondChoiceStart, 
        endTime: prev.secondChoiceEnd 
      }));
    } else if (type === 'other') {
      setFormData(prev => ({ ...prev, confirmedDate: '', startTime: '', endTime: '' }));
    }
  };

  const getCalendarUrl = (record: any) => {
    const staffList = Array.isArray(record.staff) ? record.staff.join('') : (record.staff || '未定');
    const title = encodeURIComponent(`Coe Onsite ${record.schoolName} (${staffList})`);
    const d = formatDateForInput(record.confirmedDate).replace(/-/g, '');
    const s = formatTimeForInput(record.startTime).replace(/:/g, '') + '00';
    const e = formatTimeForInput(record.endTime).replace(/:/g, '') + '00';
    
    let datesParam = '';
    if (d && s && e) datesParam = `&dates=${d}T${s}/${d}T${e}`;
    
    const details = encodeURIComponent(`出席人員: ${staffList}\n聯絡人: ${record.applicantName}\n電話: ${record.phone}\n參與人數: ${record.participantCount}\n困難: ${record.difficulties}\n期望: ${record.expectations}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}${datesParam}&details=${details}&sf=true&output=xml`;
  };

  const filteredRecords = records.filter(r => statusFilter === 'all' || (r.status || Status.Processing) === statusFilter);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Nav Bar */}
        <div className="bg-white rounded-3xl shadow-lg p-3 flex gap-2 sticky top-4 z-50 border border-slate-200">
          <button 
            onClick={() => { setView('form'); if(!isEditing) resetForm(); }} 
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black transition-all ${view === 'form' ? 'bg-indigo-600 text-white shadow-md scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            {isEditing ? <Edit size={18}/> : <Plus size={18}/>}
            {isEditing ? '修改紀錄' : '填寫申請'}
          </button>
          <button 
            onClick={() => setView('list')} 
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black transition-all ${view === 'list' ? 'bg-indigo-600 text-white shadow-md scale-[1.02]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            <List size={18}/> 查看紀錄
          </button>
        </div>

        {view === 'form' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* AI Card */}
            {!isEditing && (
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md"><Upload size={22}/></div>
                    <div>
                      <h2 className="text-lg font-bold">智能填表助理</h2>
                      <p className="text-indigo-100 text-xs">上載申請表 PDF，AI 將自動填充欄位</p>
                    </div>
                  </div>
                  <label className={`w-full flex items-center justify-center gap-2 bg-white text-indigo-700 p-4 rounded-2xl font-black cursor-pointer hover:bg-indigo-50 transition-all active:scale-95 shadow-md ${analyzing ? 'opacity-50 cursor-wait' : ''}`}>
                    {analyzing ? <Loader2 className="animate-spin" size={20}/> : <Plus size={20} />}
                    <span>{analyzing ? 'AI 正在解析中...' : '選取申請表檔案'}</span>
                    <input type="file" ref={fileInputRef} accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={analyzing} />
                  </label>
                </div>
              </div>
            )}

            {isEditing && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-amber-700 font-bold flex items-center gap-2"><Edit size={18}/> 編輯中：{formData.schoolName}</span>
                <button onClick={resetForm} className="bg-white text-amber-700 px-4 py-1.5 rounded-xl text-sm font-bold shadow-sm border border-amber-200 hover:bg-amber-50">取消</button>
              </div>
            )}

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-6 md:p-8 space-y-8">
              {/* Basic Info */}
              <section className="space-y-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-indigo-600 rounded-full"></span>
                  學校與聯絡人
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1">學校名稱</label>
                    <input 
                      value={formData.schoolName} 
                      onChange={(e)=>setFormData({...formData, schoolName: e.target.value})} 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" 
                      placeholder="請輸入校名" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 ml-1">申請人姓名</label>
                    <input 
                      value={formData.applicantName} 
                      onChange={(e)=>setFormData({...formData, applicantName: e.target.value})} 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" 
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-400 ml-1">聯絡電話</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-4 text-slate-400 w-5 h-5" />
                      <input 
                        value={formData.phone} 
                        onChange={(e)=>setFormData({...formData, phone: e.target.value})} 
                        className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" 
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Timing */}
              <section className="space-y-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-indigo-600 rounded-full"></span>
                  活動時間確認
                </h3>
                
                <div className="grid grid-cols-3 gap-2">
                   <button onClick={() => applyDateSelection('first')} disabled={!formData.firstChoiceDate} className={`text-left p-3 rounded-xl border transition-all ${formData.confirmedDate === formData.firstChoiceDate && formData.firstChoiceDate ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 bg-white text-slate-400'} ${!formData.firstChoiceDate ? 'opacity-50' : ''}`}>
                     <div className="text-[10px] font-bold uppercase mb-1">首選</div>
                     <div className="text-xs font-bold truncate">{formData.firstChoiceDate || '無'}</div>
                   </button>
                   <button onClick={() => applyDateSelection('second')} disabled={!formData.secondChoiceDate} className={`text-left p-3 rounded-xl border transition-all ${formData.confirmedDate === formData.secondChoiceDate && formData.secondChoiceDate ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 bg-white text-slate-400'} ${!formData.secondChoiceDate ? 'opacity-50' : ''}`}>
                     <div className="text-[10px] font-bold uppercase mb-1">次選</div>
                     <div className="text-xs font-bold truncate">{formData.secondChoiceDate || '無'}</div>
                   </button>
                   <button onClick={() => applyDateSelection('other')} className={`text-left p-3 rounded-xl border transition-all ${!formData.confirmedDate ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-400' : 'border-slate-200 bg-white text-slate-400'}`}>
                     <div className="text-[10px] font-bold uppercase mb-1">手動</div>
                     <div className="text-xs font-bold">自訂</div>
                   </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">日期</label>
                    <input type="date" value={formData.confirmedDate} onChange={(e)=>setFormData({...formData, confirmedDate: e.target.value})} className="w-full p-3 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">開始</label>
                    <input type="time" value={formData.startTime} onChange={(e)=>setFormData({...formData, startTime: e.target.value})} className="w-full p-3 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">結束</label>
                    <input type="time" value={formData.endTime} onChange={(e)=>setFormData({...formData, endTime: e.target.value})} className="w-full p-3 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">參與人數</label>
                  <input 
                    value={formData.participantCount} 
                    onChange={(e)=>setFormData({...formData, participantCount: e.target.value})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" 
                    placeholder="例：20"
                  />
                </div>
              </section>

              {/* Staff */}
              <section className="space-y-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-indigo-600 rounded-full"></span>
                  出席人員分配
                </h3>
                <div className="flex flex-wrap gap-2">
                  {['淑', '榮', '仁', '爾', '軒'].map(n => (
                    <button 
                      key={n} 
                      onClick={() => setFormData({...formData, staff: formData.staff.includes(n) ? formData.staff.filter(s=>s!==n) : [...formData.staff, n]})} 
                      className={`px-6 py-2.5 rounded-xl font-black border transition-all active:scale-95 ${formData.staff.includes(n) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-200'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    value={customStaff} 
                    onChange={(e) => setCustomStaff(e.target.value)} 
                    className="flex-1 p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="其他人員..." 
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && customStaff) {
                        setFormData({...formData, staff: [...formData.staff, customStaff]});
                        setCustomStaff('');
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      if(customStaff) {
                        setFormData({...formData, staff: [...formData.staff, customStaff]});
                        setCustomStaff('');
                      }
                    }} 
                    className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    <Plus size={20}/>
                  </button>
                </div>
              </section>
              
              {/* Details */}
              <section className="space-y-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-indigo-600 rounded-full"></span>
                  詳細內容
                </h3>
                <div className="space-y-3">
                  <textarea 
                    value={formData.difficulties} 
                    onChange={(e)=>setFormData({...formData, difficulties: e.target.value})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none min-h-[100px] text-sm" 
                    placeholder="推行電子學習遇到的困難..." 
                  />
                  <textarea 
                    value={formData.expectations} 
                    onChange={(e)=>setFormData({...formData, expectations: e.target.value})} 
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none min-h-[100px] text-sm" 
                    placeholder="對是次支援期望..." 
                  />
                </div>
              </section>

              {/* Submit */}
              <div className="pt-4 grid grid-cols-1 gap-3">
                <button 
                  onClick={() => window.open(getCalendarUrl(formData), '_blank')}
                  className="w-full bg-white border border-indigo-100 text-indigo-600 p-4 rounded-2xl font-black text-sm hover:bg-indigo-50 flex justify-center items-center gap-2 transition-all"
                >
                  <CalendarDays size={18} /> 預覽 Google 日曆
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={loading} 
                  className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black text-lg hover:bg-indigo-700 flex justify-center items-center gap-3 shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Save />}
                  {isEditing ? '更新紀錄' : '儲存紀錄'}
                </button>
                {saveStatus === 'success' && (
                  <div className="flex items-center justify-center gap-2 text-green-600 font-bold animate-bounce">
                    <CheckCircle2 size={18}/> 處理成功！資料已同步
                  </div>
                )}
                {saveStatus === 'error' && (
                  <div className="flex items-center justify-center gap-2 text-red-600 font-bold">
                    <XCircle size={18}/> 儲存失敗，請再試一次
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'list' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Filter */}
            <div className="flex justify-between items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex gap-1.5">
                {(['all', ...Object.values(Status)] as const).map(f => (
                  <button 
                    key={f} 
                    onClick={()=>setStatusFilter(f)} 
                    className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${statusFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {f === 'all' ? '全部' : f === Status.Processing ? '進行中' : '已完成'}
                  </button>
                ))}
              </div>
              <button 
                onClick={fetchRecords} 
                className="p-2 text-indigo-600 hover:rotate-180 transition-all duration-700 active:scale-90"
                title="重新整理"
              >
                <RefreshCw size={22} className={refreshing ? "animate-spin" : ""}/>
              </button>
            </div>

            {/* List */}
            {filteredRecords.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-300 text-slate-400">
                <FileText size={48} className="mx-auto mb-4 opacity-10"/>
                <p className="font-bold">{refreshing ? '讀取中...' : '目前沒有任何紀錄'}</p>
              </div>
            ) : (
              filteredRecords.map(record => (
                <div key={record.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                  <div 
                    className="p-5 flex justify-between items-start cursor-pointer" 
                    onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${STATUS_OPTIONS.find(s=>s.value===(record.status||Status.Processing))?.color}`}>
                          {STATUS_OPTIONS.find(s=>s.value===(record.status||Status.Processing))?.label}
                        </span>
                        <h3 className="font-black text-slate-800">{record.schoolName}</h3>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400">
                        <div className="flex items-center gap-1"><Calendar size={13}/> {formatDateForInput(record.confirmedDate) || '未定日期'}</div>
                        {/* Fix: Added Clock import to fix the compilation error */}
                        <div className="flex items-center gap-1"><Clock size={13}/> {formatTimeForInput(record.startTime)} - {formatTimeForInput(record.endTime)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                           人員: {typeof record.staff === 'string' ? record.staff : (record.staff as string[]).join(', ') || '未分配'}
                         </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-1 items-center">
                      {deleteConfirmId === record.id ? (
                        <div className="flex items-center gap-1 animate-in fade-in zoom-in-95">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold"
                          >取消</button>
                          <button 
                            onClick={(e) => confirmDelete(record.id, e)}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold shadow-sm"
                          >確定</button>
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(record.id); }} 
                          className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18}/>
                        </button>
                      )}
                      
                      <div className="p-2.5 text-slate-300">
                        {expandedRecord === record.id ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                      </div>
                    </div>
                  </div>

                  {expandedRecord === record.id && (
                    <div className="px-5 pb-5 pt-0 bg-slate-50/50 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-1">
                      <div className="flex flex-col gap-4 mt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           <div className="bg-white p-3 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">聯絡人</p>
                              <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                <User size={14} className="text-slate-300"/>
                                {record.applicantName} · {record.phone}
                              </div>
                           </div>
                           <div className="bg-white p-3 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">參與人數</p>
                              <p className="text-sm font-bold text-slate-700">{record.participantCount || '0'}</p>
                           </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                          <div>
                            <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">困難</p>
                            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{record.difficulties || '無'}</p>
                          </div>
                          <hr className="border-dashed border-slate-100"/>
                          <div>
                            <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">期望</p>
                            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{record.expectations || '無'}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={() => window.open(getCalendarUrl(record), '_blank')} 
                            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-50 shadow-sm"
                          >
                            <CalendarDays size={14}/> 加入日曆
                          </button>
                          <button 
                            onClick={()=>handleEdit(record)} 
                            className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-700"
                          >
                            <Edit size={14}/> 編輯詳情
                          </button>
                          <select 
                            value={record.status || Status.Processing} 
                            onChange={(e)=>updateStatus(record.id, e.target.value as Status)} 
                            className="flex-1 min-w-[120px] p-2.5 text-xs font-black border border-slate-200 rounded-xl bg-white outline-none cursor-pointer hover:border-indigo-300"
                          >
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;