"""Sentiment analysis via Groq LLaMA — free, no extra model needed"""
from services.groq_service import groq_service


SENTIMENT_PROMPT = """Analyze the following news headlines and content about {topic} and provide a sentiment assessment.

Headlines/Content:
{content}

Respond in EXACTLY this JSON format (no other text):
{{
  "score": <number from -100 to 100, where -100=very bearish, 0=neutral, 100=very bullish>,
  "label": "<one of: Very Bearish, Bearish, Slightly Bearish, Neutral, Slightly Bullish, Bullish, Very Bullish>",
  "summary": "<one sentence summary of overall sentiment>",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}}"""


def analyze_sentiment(topic: str, headlines: list[str]) -> dict:
    """Analyze sentiment of news headlines using Groq LLaMA"""
    content = "\n".join(f"- {h}" for h in headlines[:10])
    prompt = SENTIMENT_PROMPT.format(topic=topic, content=content)

    try:
        response = groq_service.client.chat.completions.create(
            model=groq_service.model,
            messages=[
                {"role": "system", "content": "You are a financial sentiment analysis engine. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=300,
        )
        import json
        text = response.choices[0].message.content.strip()
        # Extract JSON if wrapped in markdown
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        return json.loads(text)
    except Exception as e:
        print(f"Sentiment analysis error: {e}")
        return {
            "score": 0,
            "label": "Neutral",
            "summary": "Unable to determine sentiment",
            "key_factors": [],
        }
