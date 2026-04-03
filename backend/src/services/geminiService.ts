import { PDFParse } from 'pdf-parse';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL_FROM_ENV = process.env.GEMINI_MODEL;

let resolvedModelName: string | null = GEMINI_MODEL_FROM_ENV || null;

interface GenerateQuizParams {
  content: string;
  title: string;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionTypes: string[];
}

interface GeneratedOption {
  optionNumber: number;
  optionText: string;
  isCorrect: boolean;
}

interface GeneratedQuestion {
  questionNumber: number;
  questionText: string;
  questionType: 'mcq' | 'short_answer' | 'long_answer' | 'true_false';
  correctAnswer: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  options?: GeneratedOption[];
}

const toContentLines = (content: string): string[] => {
  const cleaned = content.replace(/\s+/g, ' ').trim();
  const splitByPunctuation = cleaned
    .split(/[.!?]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);

  if (splitByPunctuation.length > 0) {
    return splitByPunctuation;
  }

  const byLine = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 10);

  return byLine.length > 0 ? byLine : ['General learning content from provided material'];
};

const buildFallbackQuiz = ({ content, numQuestions, difficulty, questionTypes }: GenerateQuizParams) => {
  const allowedTypes = (Array.isArray(questionTypes) && questionTypes.length > 0
    ? questionTypes
    : ['mcq']) as Array<'mcq' | 'short_answer' | 'long_answer' | 'true_false'>;

  const lines = toContentLines(content);
  const totalQuestions = Math.max(1, Number(numQuestions) || 10);

  const questions: GeneratedQuestion[] = Array.from({ length: totalQuestions }, (_, index) => {
    const questionType = allowedTypes[index % allowedTypes.length] || 'mcq';
    const base = lines[index % lines.length];
    const questionNumber = index + 1;

    if (questionType === 'true_false') {
      return {
        questionNumber,
        questionText: `${base}. True or False?`,
        questionType,
        correctAnswer: 'true',
        points: 1,
        difficulty
      };
    }

    if (questionType === 'short_answer' || questionType === 'long_answer') {
      return {
        questionNumber,
        questionText: `Explain this concept in your own words: ${base}`,
        questionType,
        correctAnswer: base,
        points: questionType === 'long_answer' ? 2 : 1,
        difficulty
      };
    }

    return {
      questionNumber,
      questionText: `Which option best matches this concept: ${base}?`,
      questionType: 'mcq',
      correctAnswer: '1',
      points: 1,
      difficulty,
      options: [
        { optionNumber: 1, optionText: base, isCorrect: true },
        { optionNumber: 2, optionText: `Not related to: ${base.slice(0, 40)}`, isCorrect: false },
        { optionNumber: 3, optionText: 'Only partially correct statement', isCorrect: false },
        { optionNumber: 4, optionText: 'None of the above', isCorrect: false }
      ]
    };
  });

  return {
    questions,
    meta: {
      source: 'fallback',
      reason: 'Gemini service unavailable or quota exhausted'
    }
  };
};

const resolveGeminiModel = async (): Promise<string> => {
  if (resolvedModelName) {
    return resolvedModelName;
  }

  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in .env');
  }

  try {
    const response = await fetch(`${GEMINI_API_BASE}/models?key=${GEMINI_API_KEY}`);
    const payload: any = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || 'Unable to list Gemini models');
    }

    const models = Array.isArray(payload?.models) ? payload.models : [];
    const generationModels = models.filter((model: any) =>
      Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent')
    );

    const preferredTokens = ['2.0-flash', '1.5-flash', 'flash', 'pro'];

    for (const token of preferredTokens) {
      const preferred = generationModels.find((model: any) => String(model?.name || '').toLowerCase().includes(token));
      if (preferred?.name) {
        resolvedModelName = preferred.name;
        return preferred.name;
      }
    }

    if (generationModels.length > 0 && generationModels[0]?.name) {
      resolvedModelName = generationModels[0].name;
      return generationModels[0].name;
    }
  } catch (error: any) {
    console.warn('Gemini model auto-discovery failed, using fallback model.', error?.message || error);
  }

  resolvedModelName = 'models/gemini-2.0-flash';
  return resolvedModelName;
};

export const generateQuizFromContent = async ({
  content,
  title,
  numQuestions,
  difficulty,
  questionTypes
}: GenerateQuizParams) => {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in .env');
    }

    const modelName = await resolveGeminiModel();

    const prompt = `You are an expert educational assessment creator. Generate a quiz based on the following content.

Title: ${title}
Number of Questions: ${numQuestions}
Difficulty: ${difficulty}
Question Types: ${questionTypes.join(', ')}

Source Content:
${content}

Instructions:
1. Generate exactly ${numQuestions} high-quality questions
2. Questions should be relevant to the content
3. Mix question types as requested
4. For MCQ, provide 4 options with one correct answer
5. For true/false, provide correct answer
6. For short answer, provide expected answer
7. Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "question text",
      "questionType": "mcq|short_answer|long_answer|true_false",
      "correctAnswer": "correct answer",
      "points": 1,
      "difficulty": "easy|medium|hard",
      "options": [
        {"optionNumber": 1, "optionText": "option text", "isCorrect": false},
        {"optionNumber": 2, "optionText": "option text", "isCorrect": true},
        {"optionNumber": 3, "optionText": "option text", "isCorrect": false},
        {"optionNumber": 4, "optionText": "option text", "isCorrect": false}
      ]
    }
  ]
}`;

    const response = await fetch(`${GEMINI_API_BASE}/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          topP: 0.95,
          topK: 40
        }
      })
    });

    const responseData: any = await response.json();
    if (!response.ok) {
      throw new Error(responseData?.error?.message || 'Gemini API request failed');
    }

    const generatedText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No content generated from Gemini API');
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = generatedText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const parsedQuiz = JSON.parse(jsonText);

    if (!parsedQuiz.questions || !Array.isArray(parsedQuiz.questions)) {
      throw new Error('Invalid quiz format generated');
    }

    return parsedQuiz;
  } catch (error: any) {
    const message = String(error?.message || 'Failed to generate quiz');
    console.error('Error generating quiz with Gemini:', message);

    const fallbackEligible =
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('permission') ||
      message.toLowerCase().includes('rate limit');

    if (fallbackEligible) {
      console.warn('Using local fallback quiz generator due to Gemini API limitation.');
      return buildFallbackQuiz({ content, title, numQuestions, difficulty, questionTypes });
    }

    throw new Error(message);
  }
};

export const extractTextFromPDF = async (pdfUrl: string): Promise<string> => {
  try {
    let pdfBuffer: Buffer;

    if (pdfUrl.startsWith('data:application/pdf;base64,')) {
      const base64Data = pdfUrl.split(',')[1];
      pdfBuffer = Buffer.from(base64Data, 'base64');
    } else if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error('Unable to fetch PDF from provided URL');
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error('Unsupported PDF source. Upload a PDF file or provide a direct PDF URL.');
    }

    const parser = new PDFParse({ data: pdfBuffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const extractedText = (parsed.text || '').replace(/\s+/g, ' ').trim();

    if (!extractedText) {
      throw new Error('No readable text was found in the uploaded PDF');
    }

    return extractedText.slice(0, 30000);
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};
