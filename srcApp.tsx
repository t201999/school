import React, { useState, useMemo, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  FileText, 
  Download, 
  Settings2, 
  Calendar as CalendarIcon,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle
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
  HeadingLevel
} from 'docx';
import { saveAs } from 'file-saver';
import { cn } from './utils'; // 輔助函式

interface CalendarEvent {
  date: string;
  type: 'holiday' | 'exam' | 'other';
  description: string;
}

interface ScheduleRow {
  week: number;
  date: string;
  topic: string;
  description: string;
  note: string;
  isHoliday: boolean;
  isExam: boolean;
}

export default function App() {
  // --- 狀態管理 ---
  const [ocrText, setOcrText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [startDate, setStartDate] = useState('2024-08-30');
  const [totalWeeks, setTotalWeeks] = useState(21);
  const [selectedWeekday, setSelectedWeekday] = useState(5); // 預設週五
  const [selectedGrade, setSelectedGrade] = useState('高一');
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [manualEdits, setManualEdits] = useState<Record<number, { topic?: string, description?: string }>>({});

  // --- AI 解析邏輯 ---
  const parseCalendar = async () => {
    if (!ocrText) return;
    setIsParsing(true);
    try {
      const apiKey = userApiKey || '';
      if (!apiKey) {
        alert("請先在右上角輸入您的 Gemini API Key");
        setIsParsing(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        請解析以下校園行事曆文本，並提取出與「${selectedGrade}」學生相關的所有重要日程。
        包含：
        1. 國定假日、校定放假日。
        2. 考試日期：期中考、期末考、學測、模擬考等。
        3. 重要活動：開學日、休業式、畢業典禮、校外教學。
        
        請輸出為 JSON 格式，包含一個 events 陣列，每個物件有 date (YYYY-MM-DD), type ('holiday' | 'exam' | 'other'), description。
        description 欄位請務必包含具體的活動名稱。
        
        文本內容：
        ${ocrText}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.response.text());
      setEvents(result.events || []);
    } catch (error) {
      console.error("AI 解析失敗", error);
      alert("解析失敗，請檢查 API Key 是否正確");
    } finally {
      setIsParsing(false);
    }
  };

  // --- 生成表格資料 ---
  const schedule = useMemo(() => {
    const rows: ScheduleRow[] = [];
    let current = new Date(startDate);
    
    // 調整至第一個上課日
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
        const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
        return (e.description.includes('考') || e.type === 'exam') 
          ? `${dateLabel} ${e.description}` 
          : e.description;
      }).join(', ');

      const edits = manualEdits[i] || {};
      const isHoliday = weekEvents.some(e => e.type === 'holiday');
      const isExam = weekEvents.some(e => e.type === 'exam');

      rows.push({
        week: i,
        date: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        topic: edits.topic ?? (isHoliday ? '放假' : (isExam ? '考試週' : '')),
        description: edits.description || '',
        note,
        isHoliday,
        isExam
      });
      current.setDate(current.getDate() + 7);
    }
    return rows;
  }, [startDate, selectedWeekday, totalWeeks, events, manualEdits]);

  // --- 匯出 Word ---
  const exportToWord = async () => {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: `${selectedGrade} 教學進度表`, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["週次", "日期", "課程進度", "說明", "備註"].map(h => 
                  new TableCell({ children: [new Paragraph({ text: h, alignment: AlignmentType.CENTER })], shading: { fill: "F2F2F2" } })
                )
              }),
              ...schedule.map(row => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: row.week.toString(), alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: row.date, alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ text: row.topic })] }),
                  new TableCell({ children: [new Paragraph({ text: row.description })] }),
                  new TableCell({ children: [new Paragraph({ text: row.note })] }),
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
    <div className="min-h-screen bg-[#F5F5F0] text-[#2D2926] p-8">
      {/* UI 介面代碼... (包含 API Key 輸入框、文字貼上區、預覽表格) */}
      {/* 這裡省略詳細的 Tailwind HTML 結構，請參考之前的 UI 設計 */}
    </div>
  );
}