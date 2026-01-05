/// <reference types="vite/client" />
const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface GradingResult {
  score: number;
  feedback: string;
}

export async function gradeTextAnswer(
  question_text: string,
  rubric: string,
  student_response: string,
  max_points: number
): Promise<GradingResult> {
  if (!GEMINI_API_KEY) {
    console.error('Gemini API key is not configured.');
    return { score: 0, feedback: 'Unable to assess response automatically (API key missing).' };
  }

  const prompt = `You are an academic assessor. Grade this student response.
Question: ${question_text}
Grading Rubric: ${rubric}
Student Response: ${student_response}
Max Points: ${max_points}

Return ONLY a JSON object with exactly these fields:
{ "score": number, "feedback": string }
Score must be between 0 and max_points.
Feedback should be 1-2 sentences explaining the grade.`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('No valid response from Gemini API');
    }

    const result = JSON.parse(candidateText) as GradingResult;
    return {
      score: typeof result.score === 'number' ? result.score : 0,
      feedback: typeof result.feedback === 'string' ? result.feedback : 'Graded by AI.',
    };
  } catch (error) {
    console.error('Error grading text answer:', error);
    return { score: 0, feedback: 'Unable to assess response automatically.' };
  }
}
