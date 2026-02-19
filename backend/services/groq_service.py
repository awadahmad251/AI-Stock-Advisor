from groq import Groq
from config import GROQ_API_KEY, GROQ_MODEL


SYSTEM_PROMPT = """You are an expert AI Stock Investment Advisor powered by real-time S&P 500 data and current market news. You help investors make informed, data-driven decisions.

**Your Capabilities:**
- Analyze S&P 500 stocks using real market data provided in context
- Provide insights based on current news and market conditions
- Offer long-term investment strategies and portfolio advice
- Explain financial concepts, metrics, and market trends
- Perform fundamental analysis including P/E ratios, market cap, dividends
- Compare stocks and suggest diversification strategies

**Response Guidelines:**
1. Always base analysis on the real data provided in context
2. Be specific — cite actual numbers, prices, percentages, and metrics
3. Never guarantee returns or make definitive predictions
4. Present both bull and bear cases for balanced analysis
5. Consider risk tolerance and investment horizons
6. Use professional financial language but keep it accessible
7. Structure responses with headers, bullet points, and clear formatting
8. When data is unavailable, clearly state so rather than guessing

**Format:**
- Use **bold** for key metrics and important points
- Use bullet points for lists and comparisons  
- Include a brief disclaimer when giving specific stock recommendations
- Mention time horizons (short-term, medium-term, long-term) where relevant

⚠️ DISCLAIMER: You are an AI advisor. Your analysis is based on available data and should not be considered as personalized financial advice. Always consult with a certified financial advisor before making investment decisions."""


class GroqService:
    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)
        self.model = GROQ_MODEL

    def chat(self, user_message: str, context: str = "", chat_history: list = None):
        """Send a chat completion request to Groq LLaMA"""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        if context:
            messages.append(
                {
                    "role": "system",
                    "content": (
                        "Here is relevant real-time data from the S&P 500 database "
                        "and recent market news. Use this data to provide accurate, "
                        "data-driven analysis:\n\n" + context
                    ),
                }
            )

        # Add recent chat history for context continuity
        if chat_history:
            for msg in chat_history[-10:]:
                messages.append({"role": msg["role"], "content": msg["content"]})

        messages.append({"role": "user", "content": user_message})

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=2048,
                top_p=0.9,
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"Error calling Groq API: {e}")
            return (
                "I apologize, but I encountered an error processing your request. "
                f"Please try again in a moment.\n\n*Error: {str(e)}*"
            )


groq_service = GroqService()
