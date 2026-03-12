import React, { useState, useMemo, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Download, 
  Loader2, 
  Calendar as CalendarIcon, 
  Settings2, 
  FileText, 
  Upload, 
  Trash2, 
  ChevronRight,
  Info,
  AlertCircle,
  FileUp,
  CheckCircle2
} from 'lucide-react';
import { 
  Document, 
  Packer, 
  Paragraph, 
  Table, 
  TableCell, 
  TableRow, 
  WidthType, 
  AlignmentType, 
  TextRun
} from 'docx';
import { saveAs } from 'file-saver';
import { cn } from './utils';
import * as pdfjsLib from 'pdfjs-dist';

// 設定 PDF.js 的 Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function App() {
  const [ocrText, setOcrText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('2025-02-10');
  const [totalWeeks, setTotalWeeks] = useState(20);
  const [selectedWeekday, setSelectedWeekday] = useState(1); 
  const [selectedGrade, setSelectedGrade] = useState('高一');
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [manualEdits, setManualEdits] = useState<Record<number, { topic: string }>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setOcrText(fullText);
      } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setOcrText(`[已上傳圖片：${file.name}]\n(點擊「開始解析」AI 將自動辨識圖片內容)`);
          (window as any)._pendingImage = base64;
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('檔案讀取錯誤:', error);
      alert('檔案讀取失敗，請嘗試手動複製文字。');
    } finally {
      setIsUploading(false);
    }
  };

  const parseCalendar = async () => {
    if (!ocrText && !(window as any)._pendingImage) return;
    
    setIsParsing(true);
    try {
      const apiKey = userApiKey || "";
      if (!apiKey) {
        alert("請先在右上角設定您的 Gemini API Key");
        setIsParsing(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      let promptParts: any[] = [
        { text: `你是一個台灣學校的教務處助手。請解析提供的行事曆內容，提取與「${selectedGrade}」相關的日程。
        
        請特別注意：
        1. 國定假日、補假、彈性放假。
        2. 定期考查（段考）、模擬考、補考日期。
        3. 重要校園活動（校慶、運動會、畢業典禮）。

        輸出格式必須是純 JSON，結構如下：
        {
          "events": [
            {
              "date": "YYYY-MM-DD",
              "description": "活動名稱"
            }
          ]
        }
        內容如下：\n${ocrText}` }
      ];

      if ((window as any)._pendingImage) {
        const base64Data = (window as any)._pendingImage.split(',')[1];
        const mimeType = (window as any)._pendingImage.split(',')[0].split(':')[1].split(';')[0];
        promptParts.push({
          inlineData: { data: base64Data, mimeType: mimeType }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: promptParts }],
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text);
      setEvents(result.events || []);
      (window as any)._pendingImage = null;
    } catch (error) {
      console.error('解析錯誤:', error);
      alert("解析失敗。請確保 API Key 有效。");
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
      }).join('；');
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

  const exportToWord = async () => {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [new TextRun({ text: `${selectedGrade} 教學進度表`, bold: true, size: 32 })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["週次", "日期", "教學進度", "備註"].map(h => 
                  new TableCell({
                    shading: { fill: "F3F4F6" },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true })] })]
                  })
                )
              }),
              ...schedule.map(row => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: String(row.week), alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: row.date, alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: row.topic })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: row.note, size: 18 })] })] }),
                ]
              }))
            ]
          })
        ]
      }]
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `教學進度表_${selectedGrade}.docx`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
              <CalendarIcon size={22} />
            </div>
            <h1 className="text-lg font-bold">教學時程產生器</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
              <Settings2 size={16} className="text-slate-400" />
              <input 
                type="password" 
                placeholder="Gemini API Key" 
                className="bg-transparent border-none focus:ring-0 text-sm w-48 p-0"
                value={userApiKey}
                onChange={(e) => {
                  setUserApiKey(e.target.value);
                  localStorage.setItem('gemini_api_key', e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-sm font-bold mb-4 flex items-center gap-2"><FileUp size={18} /> 1. 匯入行事曆</h2>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center text-center",
                  ocrText ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30"
                )}
              >
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                {isUploading ? <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} /> : ocrText ? <CheckCircle2 className="text-emerald-500 mb-3" size={32} /> : <Upload className="text-slate-300 mb-3" size={32} />}
                <p className="text-sm font-semibold">{isUploading ? "讀取中..." : ocrText ? "檔案已就緒" : "上傳 PDF 或圖片"}</p>
              </div>
              <textarea 
                className="w-full h-32 p-4 mt-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs resize-none" 
                placeholder="或在此貼上文字..."
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
              />
              <button 
                onClick={parseCalendar}
                disabled={isParsing || (!ocrText && !(window as any)._pendingImage)}
                className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-100"
              >
                {isParsing ? <Loader2 className="animate-spin" size={20} /> : <ChevronRight size={20} />}
                {isParsing ? "正在分析..." : "開始 AI 智慧解析"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-2 flex flex-wrap gap-2">
              <div className="flex-1 min-w-[140px] px-4 py-2 bg-slate-50 rounded-2xl">
                <label className="block text-[9px] font-bold text-slate-400 uppercase">開學日期</label>
                <input type="date" className="bg-transparent border-none p-0 text-sm font-bold w-full focus:ring-0" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="flex-1 min-w-[100px] px-4 py-2 bg-slate-50 rounded-2xl">
                <label className="block text-[9px] font-bold text-slate-400 uppercase">上課星期</label>
                <select className="bg-transparent border-none p-0 text-sm font-bold w-full focus:ring-0" value={selectedWeekday} onChange={e => setSelectedWeekday(Number(e.target.value))}>
                  <option value={1}>週一</option><option value={2}>週二</option><option value={3}>週三</option><option value={4}>週四</option><option value={5}>週五</option>
                </select>
              </div>
              <div className="flex-1 min-w-[80px] px-4 py-2 bg-slate-50 rounded-2xl">
                <label className="block text-[9px] font-bold text-slate-400 uppercase">週數</label>
                <input type="number" className="bg-transparent border-none p-0 text-sm font-bold w-full focus:ring-0" value={totalWeeks} onChange={e => setTotalWeeks(Number(e.target.value))} />
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-center w-16">週次</th>
                    <th className="px-6 py-4 w-28">日期</th>
                    <th className="px-6 py-4">教學進度</th>
                    <th className="px-6 py-4 w-48">備註</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {schedule.map(row => (
                    <tr key={row.week} className="hover:bg-indigo-50/30 transition-all">
                      <td className="px-6 py-5 text-center"><span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs">{row.week}</span></td>
                      <td className="px-6 py-5 font-bold">{row.date}</td>
                      <td className="px-6 py-5">
                        <input 
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-slate-600"
                          placeholder="點擊輸入..."
                          value={row.topic}
                          onChange={(e) => setManualEdits({...manualEdits, [row.week]: {topic: e.target.value}})}
                        />
                      </td>
                      <td className="px-6 py-5 text-[11px] text-indigo-600">{row.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={exportToWord} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-bold shadow-xl shadow-emerald-100 flex items-center justify-center gap-3">
              <Download size={20} /> 匯出為標準教學進度表 (Word)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
