"""
FastAPI wrapper around the MainAI3 data pipeline.

Endpoints
- GET /api/health
- GET /api/zip-data?zips=10901,10952
- POST /api/ai-report   { "zips": [...], "temperature": 0.85 }
"""
import os
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import MainAI3 as core

# --- Config ---
ALLOWED_ZIPS = list(core.ROCKLAND_ZIPS_TOWNS.keys())
DEFAULT_TEMPERATURE = 0.85

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

# --- Helpers ---


def _validated_zip_list(zips: Optional[List[str]]) -> List[str]:
    """Return a cleaned list of ZIPs limited to Rockland set; default to all."""
    if not zips:
        return ALLOWED_ZIPS
    cleaned = []
    for z in zips:
        zc = z.strip()
        if not zc:
            continue
        if zc not in core.ROCKLAND_ZIPS_TOWNS:
            raise HTTPException(
                status_code=400,
                detail=f"ZIP {zc} is not allowed. Use one of {ALLOWED_ZIPS}.",
            )
        cleaned.append(zc)
    if not cleaned:
        return ALLOWED_ZIPS
    return cleaned


def _require_env(key: str) -> str:
    val = os.getenv(key)
    if not val or val == "YOUR_OPENAI_API_KEY_HERE":
        raise HTTPException(status_code=500, detail=f"Missing required env var: {key}")
    return val


def build_final_dataset(zip_codes: List[str]) -> pd.DataFrame:
    """Run the existing pipeline to produce the merged dataset."""
    population_income_df = core.get_population_income_data(zip_codes)
    occupation_df = core.get_occupation_data(zip_codes)
    merged_acs = pd.merge(
        population_income_df,
        occupation_df,
        on=["ZipCode", "TownName"],
        how="outer",
    )
    race_df = core.get_p8_race_data(zip_codes)
    final_df = pd.merge(
        merged_acs,
        race_df,
        on=["ZipCode", "TownName"],
        how="outer",
    )
    return final_df


def build_prompt(final_df: pd.DataFrame, user_prompt: Optional[str]) -> str:
    final_csv = final_df.to_csv(index=False)
    user_section = ""
    if user_prompt:
        trimmed = user_prompt.strip()
        if len(trimmed) > 1000:
            trimmed = trimmed[:1000]
        user_section = (
            "\n\nUser request:\n"
            f"{trimmed}\n\n"
            "Incorporate the user's request above while staying data-grounded."
        )
    return (
        "You are an analytical assistant. Below is a merged dataset that combines:\n"
        "- Income data (from 2021 ACS, B19001/B19013)\n"
        "- Occupational data (from 2021 ACS Subject Table S2401)\n"
        "- Race data (from 2020 Decennial Census DHC Table P8, including 63 race categories)\n\n"
        f"Here is the data in CSV format:\n\n{final_csv}\n"
        f"{user_section}"
        "Please provide a comprehensive semantic analysis exploring the relationship between income "
        "distribution, occupational profile, and racial composition in these Rockland County ZIP codes."
    )


def _ensure_openai_key():
    _require_env("OPENAI_API_KEY")


# --- FastAPI app ---
app = FastAPI(title="Rockland Census API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AiReportRequest(BaseModel):
    zips: Optional[List[str]] = None
    temperature: Optional[float] = DEFAULT_TEMPERATURE
    user_prompt: Optional[str] = None


@app.get("/api/health")
def health():
    openai_key_set = bool(os.getenv("OPENAI_API_KEY")) and os.getenv(
        "OPENAI_API_KEY"
    ) != "YOUR_OPENAI_API_KEY_HERE"
    census_key_set = bool(os.getenv("CENSUS_API_KEY"))
    return {
        "status": "ok",
        "openai_key": openai_key_set,
        "census_key": census_key_set,
        "allowed_origins": ALLOWED_ORIGINS,
    }


@app.get("/api/zip-data")
def get_zip_data(zips: Optional[str] = Query(None, description="Comma-separated ZIPs")):
    zip_list = _validated_zip_list(zips.split(",") if zips else None)
    try:
        final_df = build_final_dataset(zip_list)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"zips": zip_list, "data": final_df.to_dict(orient="records")}


@app.post("/api/ai-report")
def ai_report(payload: AiReportRequest):
    _ensure_openai_key()
    zip_list = _validated_zip_list(payload.zips)
    temperature = payload.temperature or DEFAULT_TEMPERATURE

    try:
        final_df = build_final_dataset(zip_list)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    prompt_text = build_prompt(final_df, payload.user_prompt)

    try:
        # Using legacy openai.ChatCompletion to match existing dependency
        response = core.openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt_text}],
            max_tokens=1000,
            temperature=temperature,
        )
        ai_text = response.choices[0].message.content.strip()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {exc}") from exc

    return {
        "zips": zip_list,
        "data": final_df.to_dict(orient="records"),
        "ai_summary": ai_text,
    }
