import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI


load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    api_key=os.getenv("GRAFILAB_API_KEY"),
    base_url=os.getenv("GRAFILAB_BASE_URL"),
)


def clean_json_text(text: str) -> str:
    text = text.strip()

    if text.startswith("```json"):
        text = text.replace("```json", "", 1).strip()

    if text.startswith("```"):
        text = text.replace("```", "", 1).strip()

    if text.endswith("```"):
        text = text[:-3].strip()

    return text


def build_prompt(summary_data: dict) -> str:
    return f"""
You are an energy management analyst for a smart building dashboard.

Analyze the following anomaly detection summary JSON and create a cautious operational action plan.

Rules:
- Use only the information provided in the JSON.
- Do not invent occupancy, weather, building schedule, equipment faults, or maintenance details.
- Do not state specific mechanical faults as facts.
- Possible causes must be written as items to verify, not confirmed causes.
- Avoid strong causal claims.
- Use cautious language such as "may indicate", "could suggest", or "should be verified".
- If evidence is insufficient, clearly say so.
- Focus on what the building manager should do next.
- Return JSON only.
- The explanation should be understandable for a building manager.

Required output JSON format:
{{
  "overall_priority": "Low | Medium | High",
  "key_insight": "...",
  "risk_explanation": "...",
  "immediate_actions": [
    {{
      "priority": 1,
      "action": "...",
      "target_zone": "...",
      "when": "...",
      "why": "...",
      "expected_impact": "..."
    }}
  ],
  "short_term_actions": [
    {{
      "action": "...",
      "timeframe": "...",
      "why": "..."
    }}
  ],
  "data_to_collect_next": ["...", "..."],
  "follow_up_checks": ["...", "..."],
  "manager_explanation": "...",
  "limitations": "..."
}}

Anomaly detection summary JSON:
{json.dumps(summary_data, indent=2)}
"""


@app.get("/")
def root():
    return {
        "message": "AI insight backend is running"
    }


@app.post("/generate-ai-insight")
async def generate_ai_insight(payload: dict):
    try:
        api_key = os.getenv("GRAFILAB_API_KEY")
        base_url = os.getenv("GRAFILAB_BASE_URL")
        model = os.getenv("GRAFILAB_MODEL", "gpt-4o-mini")

        if not api_key:
            return {
                "status": "error",
                "error": "GRAFILAB_API_KEY is missing in .env",
            }

        if not base_url:
            return {
                "status": "error",
                "error": "GRAFILAB_BASE_URL is missing in .env",
            }

        prompt = build_prompt(payload)

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an energy management analyst. Return JSON only.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0.2,
        )

        text = response.choices[0].message.content
        cleaned_text = clean_json_text(text)
        insight = json.loads(cleaned_text)

        return {
            "status": "success",
            "insight": insight,
        }

    except json.JSONDecodeError:
        return {
            "status": "error",
            "error": "The model response was not valid JSON.",
        }

    except Exception as error:
        return {
            "status": "error",
            "error": str(error),
        }