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
  audienceContext?: string;
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

const dedupeQuestions = (questions: GeneratedQuestion[], maxCount: number): GeneratedQuestion[] => {
  const seen = new Set<string>();
  const deduped: GeneratedQuestion[] = [];

  for (const question of questions) {
    const normalized = String(question?.questionText || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(question);
    if (deduped.length >= maxCount) {
      break;
    }
  }

  return deduped.map((question, index) => ({
    ...question,
    questionNumber: index + 1
  }));
};

const ensureQuestionCount = (
  primaryQuestions: GeneratedQuestion[],
  requestedCount: number,
  params: GenerateQuizParams
): GeneratedQuestion[] => {
  const dedupedPrimary = dedupeQuestions(primaryQuestions, requestedCount);
  if (dedupedPrimary.length >= requestedCount) {
    return dedupedPrimary.slice(0, requestedCount);
  }

  const supplemental = buildFallbackQuiz(params).questions || [];
  const merged = dedupeQuestions([...dedupedPrimary, ...supplemental], requestedCount);
  return merged.slice(0, requestedCount);
};

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

const extractSeeds = (content: string): string[] => {
  const seeds = new Set<string>();

  const chapterMatch = content.match(/Target Chapter\/Unit:\s*(.+?)(?:\s*Syllabus Topic Context:|$)/is);
  if (chapterMatch?.[1]) {
    const chapter = chapterMatch[1].trim();
    if (chapter) {
      seeds.add(chapter.replace(/^[:\-\s]+|[:\-\s]+$/g, ''));
    }
  }

  const topicMatches = Array.from(content.matchAll(/Topic\s*\d+:\s*([^\[]+?)(?:\s*\[|$)/gi));
  topicMatches.forEach((match) => {
    const topic = match[1]?.trim();
    if (topic) {
      seeds.add(topic.replace(/^[:\-\s]+|[:\-\s]+$/g, ''));
    }
  });

  toContentLines(content).forEach((line) => {
    const cleanedLine = line
      .replace(/Target Chapter\/Unit:/gi, '')
      .replace(/Syllabus Topic Context:/gi, '')
      .replace(/\[covered\]/gi, '')
      .trim();

    if (cleanedLine.length > 8) {
      seeds.add(cleanedLine);
    }
  });

  return Array.from(seeds).filter((seed) => seed.length > 0).slice(0, 12);
};

const buildFallbackQuiz = ({ content, numQuestions, difficulty, questionTypes }: GenerateQuizParams) => {
  const allowedTypes = (Array.isArray(questionTypes) && questionTypes.length > 0
    ? questionTypes
    : ['mcq']) as Array<'mcq' | 'short_answer' | 'long_answer' | 'true_false'>;

  const lines = extractSeeds(content);
  const totalQuestions = Math.max(1, Number(numQuestions) || 10);

  const questions: GeneratedQuestion[] = Array.from({ length: totalQuestions }, (_, index) => {
    const questionType = allowedTypes[index % allowedTypes.length] || 'mcq';
    const base = lines[index % lines.length] || 'the provided learning material';
    const questionNumber = index + 1;
    const variant = Math.floor(index / Math.max(1, lines.length)) + 1;
    const suffix = variant > 1 ? ` (variation ${variant})` : '';

    if (questionType === 'true_false') {
      return {
        questionNumber,
        questionText: `True or false: ${base} is an important idea in this lesson${suffix}.`,
        questionType,
        correctAnswer: 'true',
        points: 1,
        difficulty
      };
    }

    if (questionType === 'short_answer' || questionType === 'long_answer') {
      return {
        questionNumber,
        questionText: `Explain ${base} in your own words${suffix}.`,
        questionType,
        correctAnswer: `A clear explanation of ${base}${suffix}.`,
        points: questionType === 'long_answer' ? 2 : 1,
        difficulty
      };
    }

    return {
      questionNumber,
      questionText: `Which option best describes ${base}${suffix}?`,
      questionType: 'mcq',
      correctAnswer: '1',
      points: 1,
      difficulty,
      options: [
        { optionNumber: 1, optionText: `It is a core idea connected to ${base}.`, isCorrect: true },
        { optionNumber: 2, optionText: `It is unrelated to ${base}.`, isCorrect: false },
        { optionNumber: 3, optionText: `It is only a minor detail about ${base}.`, isCorrect: false },
        { optionNumber: 4, optionText: 'None of the above', isCorrect: false }
      ]
    };
  });

  return {
    questions: dedupeQuestions(questions, totalQuestions),
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
  questionTypes,
  audienceContext
}: GenerateQuizParams) => {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in .env');
    }

    const modelName = await resolveGeminiModel();

    const prompt = `You are an expert educator and assessment creator. Generate high-quality, contextually-relevant quiz questions.

Quiz Title: ${title}
Number of Questions Required: ${numQuestions}
Difficulty Level: ${difficulty}
Question Types Needed: ${questionTypes.join(', ')}

${audienceContext ? `Context Information:\n${audienceContext}\n` : ''}Source Material:
${content}

Generation Rules (CRITICAL):
1. Generate EXACTLY ${numQuestions} questions - no more, no less
2. Each question MUST be directly derived from the source material or context
3. DO NOT repeat the same concept or phrasing across different questions
4. For Multiple Choice (MCQ):
   - Create 4 distinct, plausible options
   - Exactly ONE option must be correct
   - Incorrect options should be realistic distractors, not obviously wrong
5. For True/False:
   - Create statements that test understanding of key concepts
   - Answer must be clearly TRUE or FALSE
6. For Short Answer:
   - Questions should require 1-3 sentence answers
   - Provide a key phrase or concise expected answer
7. For Long Answer:
   - Questions should require 3-5 sentence explanations
   - Provide a detailed but concise expected answer
8. Match language complexity to the target grade level - keep it simple and clear
9. Avoid trivial or memorization-only questions; prioritize understanding and application
10. Return ONLY valid, well-formed JSON with absolutely no markdown formatting, code blocks, or extra text:
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

    const requestedCount = Math.max(1, Number(numQuestions) || 10);
    const dedupedQuestions = ensureQuestionCount(parsedQuiz.questions, requestedCount, {
      content,
      title,
      numQuestions: requestedCount,
      difficulty,
      questionTypes
    });

    if (dedupedQuestions.length === 0) {
      throw new Error('AI generated duplicate/invalid questions only. Please try again.');
    }

    return {
      ...parsedQuiz,
      questions: dedupedQuestions
    };
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
