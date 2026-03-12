import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Download, Loader2, Calendar as CalendarIcon, Settings2, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function App() {
  const [ocrText, setOcrText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [events, setEvents] = useState([]);
  const [startDate, setStartDate] = useState('2024-08-30');
  const [totalWeeks, setTotalWeeks] = useState(21);
  const [selectedWeekday, setSelectedWeekday] = useState(5);
  const [selectedGrade, setSelectedGrade] = useState('高一');
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [manualEdits, setManualEdits] = useState({});

  const parseCalendar = async () => {
    if (!ocrText) return;
    setIsParsing(true);
    try {
      if (!userApiKey) {
        alert("請先輸入您的 Gemini API Key");
        setIsParsing(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey: userApiKey });
      const prompt = `請解析以下行事曆，提取與「${selectedGrade}」相關的日程。輸出 JSON 格式：{"events": [{"date": "YYYY-MM-DD", "description": "..."}]}。文本：${ocrText}`;
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });
      const result = JSON.parse(response.response.text());
      setEvents(result.events || []);
    } catch (error) {
      alert("解析失敗，請檢查 API Key");
    } finally {
      setIsParsing(false);
    }
  };

  const schedule = useMemo(() => {
    const rows = [];
    let current = new Date(startDate);
    while (current.getDay() !== selectedWeekday) {
      current.setDate(current.getDate() + 1);
    }
    for (let i = 1; i <= totalWeeks; i++) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEvents = events.filter(e => {
        const d = new Date(e.date);
        return d >= weekStart && d <= weekEnd;
      });
      const note = weekEvents.map(e => {
        const d = new Date(e.date);
        return `${d.getMonth() + 1}/${d.getDate()} ${e.description}`;
      }).join(', ');
      rows.push({
        week: i,
        date: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        topic: manualEdits[i]?.topic || '',
        note,
      });
      current.setDate(current.getDate() + 7);
    }
    return rows;
  }, [startDate, selectedWeekday, totalWeeks, events, manualEdits]);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <CalendarIcon size={20} />
            </div>
            <span className="text-lg font-bold tracking-tight">教學時程產生器</span>
          </div>
          <div className="flex items-center gap-3 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <Settings2 size={14} className="text-slate-400" />
            <input 
              type="password" 
              placeholder="Gemini API Key" 
              className="bg-transparent border-none focus:ring-0 text-xs w-32 md:w-48 p-0"
              value={userApiKey}
              onChange={(e) => {
                setUserApiKey(e.target.value);
                localStorage.setItem('gemini_api_key', e.target.value);
              }}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Input */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText size={16} /> 1. 輸入行事曆
              </h2>
              <textarea 
                className="w-full h-64 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-none" 
                placeholder="在此貼上學校官網的行事曆文字內容..."
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
              />
              <button 
                onClick={parseCalendar}
                disabled={isParsing || !ocrText}
                className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                {isParsing ? <Loader2 className="animate-spin" size={18} /> : <ChevronRight size={18} />}
                {isParsing ? "正在解析中..." : "開始解析"}
              </button>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="text-blue-800 font-bold text-sm mb-2">使用小技巧</h3>
              <ul className="text-xs text-blue-700 space-y-2 list-disc list-inside">
                <li>貼上文字後點擊「開始解析」，AI 會自動抓取日期。</li>
                <li>在右側表格可以直接修改「課程進度」。</li>
                <li>完成後點擊最下方的按鈕匯出 Word。</li>
              </ul>
            </div>
          </div>

          {/* Right Panel: Schedule */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">開學日期</label>
                  <input type="date" className="bg-transparent border-none p-0 text-sm font-bold w-full focus:ring-0" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">上課星期</label>
                  <select className="bg-transparent border-none p-0 text-sm font-bold w-full focus:ring-0" value={selectedWeekday} onChange={e => setSelectedWeekday(Number(e.target.value))}>
                    <option value={1}>週一</option><option value={2}>週二</option><option value={3}>週三</option><option value={4}>週四</option><option value={5}>週五</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">學期週數</label>
                  <input type="number" className="bg-transparent border-none p-0 text-sm font-bold w-full focus:ring-0" value={totalWeeks} onChange={e => setTotalWeeks(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">適用年級</label>
                  <input type="text" className="bg-transparent border-none p-0 text-sm font-bold w-full focus:ring-0" value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-bold text-center w-16">週次</th>
                      <th className="px-6 py-3 font-bold w-24">日期</th>
                      <th className="px-6 py-3 font-bold">課程進度 (點擊編輯)</th>
                      <th className="px-6 py-3 font-bold">備註 (AI 自動填入)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedule.map(row => (
                      <tr key={row.week} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-center text-slate-400 font-mono">{row.week}</td>
                        <td className="px-6 py-4 font-bold text-slate-700">{row.date}</td>
                        <td className="px-6 py-4">
                          <input 
                            className="w-full bg-transparent border-none focus:ring-0 p-0 placeholder:text-slate-300 text-blue-600 font-medium"
                            placeholder="點擊輸入進度..."
                            value={row.topic}
                            onChange={(e) => setManualEdits({...manualEdits, [row.week]: {topic: e.target.value}})}
                          />
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 italic">{row.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button 
              onClick={() => alert("匯出功能準備中...")}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2"
            >
              <Download size={20} />
              匯出為標準教學進度表 (Word)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
