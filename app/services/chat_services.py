import json
import os
import traceback

from dotenv import load_dotenv
from langchain_groq import ChatGroq

from app.services.conversation import (
    get_history,
    add_message
)

load_dotenv()

llm = ChatGroq(
    groq_api_key=os.getenv("GROQ_API_KEY"),
    model_name="llama-3.3-70b-versatile",
    temperature=0
)


def generate_answer(question: str, documents):

    context = "\n\n".join(
        doc.page_content
        for doc in documents
    )

    history = get_history()

    history_text = ""

    for message in history:
        history_text += f"{message['role']}: {message['content']}\n"

    print("\n" + "=" * 70)
    print("CONTEXT SENT TO LLM")
    print("=" * 70)
    print(context)
    print("=" * 70)

    print("\n" + "=" * 70)
    print("CONVERSATION HISTORY")
    print("=" * 70)
    print(history_text if history_text else "No previous conversation.")
    print("=" * 70)

    available_sections = list(
        {
            doc.metadata.get("section")
            for doc in documents
            if doc.metadata.get("section")
        }
    )

    prompt = f"""
You are an intelligent AI Resume Assistant.

Answer ONLY from the resume context.

Never use outside knowledge.
Never guess.

Conversation History
--------------------
{history_text}

Resume Context
--------------
{context}

Available Resume Sections
-------------------------
{available_sections}

Question
--------
{question}

Return ONLY valid JSON.

Example:

{{
    "answer":"Your answer here.",
    "used_sections":["TECHNICAL SKILLS","PROJECTS"]
}}

Rules:

1. answer must contain ONLY the answer.

2. used_sections must contain ONLY the resume sections actually used.

3. Do NOT include unused sections.

4. If only TECHNICAL SKILLS was used:

{{
    "answer":"...",
    "used_sections":["TECHNICAL SKILLS"]
}}

5. If the answer doesn't exist:

{{
    "answer":"I couldn't find that information in the resume.",
    "used_sections":[]
}}

Return JSON only.
"""

    try:

        response = llm.invoke(prompt)

        raw = response.content.strip()

        print("\n" + "=" * 70)
        print("RAW LLM RESPONSE")
        print("=" * 70)
        print(raw)
        print("=" * 70)

        data = json.loads(raw)

        answer = data.get(
            "answer",
            "I couldn't find that information in the resume."
        )

        used_sections = data.get(
            "used_sections",
            []
        )

        add_message("User", question)
        add_message("Assistant", answer)

        print("\n" + "=" * 70)
        print("LLM ANSWER")
        print("=" * 70)
        print(answer)
        print("Used Sections:", used_sections)
        print("=" * 70)

        return {
            "answer": answer,
            "used_sections": used_sections
        }

    except Exception:

        print("\n" + "=" * 70)
        print("LLM ERROR")
        traceback.print_exc()
        print("=" * 70)

        return {
            "answer": "Unable to generate an answer at the moment.",
            "used_sections": []
        }