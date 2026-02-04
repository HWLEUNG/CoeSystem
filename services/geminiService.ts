
import { GoogleGenAI, Type } from "@google/genai";

// Fix: Initializing GoogleGenAI using the exact pattern from guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    schoolName: { type: Type.STRING, description: '學校名稱' },
    applicantName: { type: Type.STRING, description: '申請人姓名' },
    phone: { type: Type.STRING, description: '手提電話' },
    firstChoiceDate: { type: Type.STRING, description: '首選日期, 格式 YYYY-MM-DD' },
    firstChoiceStart: { type: Type.STRING, description: '首選開始時間, 格式 HH:mm' },
    firstChoiceEnd: { type: Type.STRING, description: '首選結束時間, 格式 HH:mm' },
    secondChoiceDate: { type: Type.STRING, description: '次選日期, 格式 YYYY-MM-DD' },
    secondChoiceStart: { type: Type.STRING, description: '次選開始時間, 格式 HH:mm' },
    secondChoiceEnd: { type: Type.STRING, description: '次選結束時間, 格式 HH:mm' },
    participantCount: { type: Type.STRING, description: '參與人數' },
    difficulties: { type: Type.STRING, description: '推行電子學習遇到的困難' },
    expectations: { type: Type.STRING, description: '對是次支援期望' },
  },
  required: ['schoolName', 'applicantName']
};

export const analyzePdf = async (base64Data: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          { text: "請分析這份教育支援申請表 PDF，並提取資料。如果找不到某欄位，請回傳空字串。" },
          { inlineData: { mimeType: "application/pdf", data: base64Data } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA
    }
  });

  if (!response.text) {
    throw new Error("AI did not return any content");
  }

  return JSON.parse(response.text);
};