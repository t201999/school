import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Download, Loader2, Calendar as CalendarIcon, Settings2, FileText } from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

// 內建工具函式，不需要額外的 utils.ts
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-md">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="text-blue-600" /> 教學時程產生器
          </h1>
          <input 
            type="password" 
            placeholder="Gemini API Key" 
            className="border p-2 rounded-lg text-sm w-64"
            value={userApiKey}
            onChange={(e) => setUserApiKey(e.target.value)}
          />
        </div>
        
        <textarea 
          className="w-full h-40 border p-4 rounded-xl mb-4 bg-gray-50" 
          placeholder="在此貼上行事曆文字內容..."
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
        />
        
        <button 
          onClick={parseCalendar}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors mb-8"
          disabled={isParsing}
        >
          {isParsing ? "正在解析..." : "解析行事曆文字"}
        </button>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">週次</th>
                <th className="border p-2">日期</th>
                <th className="border p-2">課程進度</th>
                <th className="border p-2">備註</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map(row => (
                <tr key={row.week}>
                  <td className="border p-2 text-center">{row.week}</td>
                  <td className="border p-2 text-center">{row.date}</td>
                  <td className="border p-2">
                    <input 
                      className="w-full outline-none"
                      value={row.topic}
                      onChange={(e) => setManualEdits({...manualEdits, [row.week]: {topic: e.target.value}})}
                    />
                  </td>
                  <td className="border p-2 text-xs text-blue-600">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
