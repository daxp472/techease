const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

interface GenerateQuizParams {
  content: string;
  title: string;
  numQuestions: number;
  difficulty: 'easy' | 'medium' | 'hard';
  questionTypes: string[];
}

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

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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
    console.error('Error generating quiz with Gemini:', error.message);
    throw new Error(
      error.message ||
      'Failed to generate quiz'
    );
  }
};

// Placeholder for PDF text extraction
// In production, integrate with pdf-parse or similar library
export const extractTextFromPDF = async (pdfUrl: string): Promise<string> => {
  try {
    // This is a placeholder. In real implementation:
    // 1. Download PDF from URL
    // 2. Parse PDF content using pdf-parse
    // 3. Return extracted text

    // For now, return mock content for development/testing
    return `This is sample extracted content from PDF at ${pdfUrl}. 
    In production, this should be replaced with actual PDF parsing logic using pdf-parse library.
    The content should include the full text from the uploaded notes or study material.`;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
};
