import logging
import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.services.chat_services import generate_answer
from app.services.chunk_service import split_text
from app.services.pdf_service import extract_text_from_pdf
from app.services.retriever_service import retrieve_chunks
from app.services.vector_store import create_vector_store
from app.services.conversation import clear_history
from app.services.ats_service import calculate_ats_score
from app.services.resume_review_service import review_resume

from app.services.resume_summary import (
    generate_resume_summary,
    get_resume_summary
)

from app.services.job_match_service import (
    calculate_match
)

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(message)s"
)

logger = logging.getLogger(__name__)

vector_store = None


app = FastAPI(
    title="AI Resume Assistant",
    description="RAG-powered Resume Question Answering API",
    version="1.0.0"
)


class QuestionRequest(BaseModel):
    question: str


class JobMatchRequest(BaseModel):
    job_description: str


@app.get("/")
def home():
    return {
        "message": "Welcome to AI Resume Assistant 🚀",
        "status": "Running"
    }


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global vector_store

    try:

        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are allowed."
            )

        os.makedirs("app/uploads", exist_ok=True)

        file_path = os.path.join(
            "app",
            "uploads",
            file.filename
        )

        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        logger.info("Extracting PDF text...")

        text = extract_text_from_pdf(file_path)

        logger.info("Splitting resume into sections...")

        documents = split_text(text)

        logger.info("Creating Vector Store...")

        vector_store = create_vector_store(documents)

        logger.info("Generating Resume Summary...")

        generate_resume_summary(documents)

        clear_history()

        logger.info("Conversation history cleared.")

        logger.info(
            "Resume indexed successfully (%d chunks)",
            len(documents)
        )

        os.remove(file_path)

        return {
            "filename": file.filename,
            "total_chunks": len(documents),
            "vector_store_created": True
        }

    except HTTPException:
        raise

    except Exception as e:

        logger.exception("Upload failed")

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.post("/ask")
async def ask_question(request: QuestionRequest):

    global vector_store

    if vector_store is None:
        raise HTTPException(
            status_code=400,
            detail="Please upload a resume first."
        )

    try:

        docs = retrieve_chunks(
            vector_store=vector_store,
            question=request.question
        )

        result = generate_answer(
            question=request.question,
            documents=docs
        )

        answer = result["answer"]
        sources = result["used_sections"]

        logger.info(
            "Question answered using %d retrieved chunks.",
            len(docs)
        )

        logger.info(
            "Sources used by LLM: %s",
            sources
        )

        return {
            "question": request.question,
            "answer": answer,
            "sources": sources
        }

    except Exception as e:

        logger.exception("Question answering failed")

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@app.get("/resume-summary")
async def resume_summary():

    summary = get_resume_summary()

    if summary is None:

        raise HTTPException(
            status_code=400,
            detail="Please upload a resume first."
        )

    return summary


@app.post("/job-match")
async def job_match(request: JobMatchRequest):

    summary = get_resume_summary()

    if summary is None:

        raise HTTPException(
            status_code=400,
            detail="Please upload a resume first."
        )

    result = calculate_match(
        summary,
        request.job_description
    )

    logger.info(
        "Recruiter Mode Match Score: %d%%",
        result["score"]
    )

    return result

@app.get("/ats-score")
async def ats_score():

    summary = get_resume_summary()

    if summary is None:

        raise HTTPException(
            status_code=400,
            detail="Please upload a resume first."
        )

    result = calculate_ats_score(summary)

    logger.info(
        "ATS Score Generated: %d%%",
        result["score"]
    )

    return result

@app.get("/resume-review")
async def resume_review():

    summary = get_resume_summary()

    if summary is None:

        raise HTTPException(
            status_code=400,
            detail="Please upload a resume first."
        )

    review = review_resume(summary)

    logger.info("AI Resume Review Generated")

    return {
        "review": review
    }


@app.post("/clear-chat")
async def clear_chat():

    clear_history()

    logger.info("Conversation history cleared manually.")

    return {
        "message": "Conversation cleared successfully."
    }