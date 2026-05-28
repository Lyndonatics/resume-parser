export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let resume;
  try {
    const body = await req.json();
    resume = body.resume;
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Invalid JSON body' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!resume || typeof resume !== 'string' || !resume.trim()) {
    return new Response(JSON.stringify({ error: { message: 'Missing or empty resume field' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: { message: 'API key not configured' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const today = new Date();
  const todayStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const systemPrompt = `You are a resume parser. Your ONLY job is to extract employment data and output it in one strict, locked format. No commentary, no markdown, no extra text — output ONLY the formatted entries.

TODAY'S DATE: ${todayStr}

═══ LOCKED RULES ═══
ORDER: Most recent company first, oldest last.
GROUPING: If a person held multiple positions at the same company, group them into ONE entry.
TENURE FORMAT: "Month YYYY – Month YYYY = X years and Y months"
- If less than 1 year: write only months — NEVER write "0 years"
- If still employed: use "Present", calculate up to today
GAP RULE: Gap = unemployment period between leaving one job and starting the next.
- Format: "Month YYYY – Month YYYY (X months)"
- If gap < 1 month: write exactly "None"
- For MOST RECENT entry: calculate gap from end date to TODAY. If still employed or < 1 month: "None"
OVERLAP RULE: Overlap = started new job before leaving previous one.
- Format: "X months with [Company Name]"
- If overlap < 1 month: write exactly "None"
BLANK FIELDS — always leave empty: Work schedule and shift / Company overview / Tools / Tasks / Reason for leaving

═══ OUTPUT FORMAT ═══
[N]. Company: [Name]
Position: [Position(s)]
Tenure: [Month YYYY – Month YYYY = X years and Y months]
Work schedule and shift:
Company overview:
Tools:
Tasks:
Reason for leaving:
Gap: [result]
Overlap: [result]

Output ONLY the entries. Nothing else.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: resume }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.error || { message: 'Upstream API error' } }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return Response.json(data);
  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
