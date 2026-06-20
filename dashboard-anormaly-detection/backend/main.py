from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import pandas as pd
from io import StringIO

from analysis import analyze_energy_csv

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Smart Building Energy Backend is running"
    }


@app.post("/analyze-multiple-csv")
async def analyze_multiple_csv(files: List[UploadFile] = File(...)):
    floor_results = []
    errors = []

    for file in files:
        try:
            content = await file.read()
            decoded = content.decode("utf-8")

            df = pd.read_csv(StringIO(decoded))

            result = analyze_energy_csv(
                df=df,
                file_name=file.filename,
            )

            floor_results.append(result)

        except Exception as error:
            errors.append(
                {
                    "file_name": file.filename,
                    "error": str(error),
                }
            )

    return {
        "status": "success" if len(errors) == 0 else "partial_success",
        "file_count": len(files),
        "floor_count": len(floor_results),
        "floors": floor_results,
        "errors": errors,
    }