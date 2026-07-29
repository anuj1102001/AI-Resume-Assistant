import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

llm = ChatGroq(
    groq_api_key=os.getenv("GROQ_API_KEY"),
    model_name="llama-3.3-70b-versatile",
    temperature=0
)


def review_resume(summary):

    prompt = f"""
You are an expert ATS Resume Reviewer.

Review the following resume summary.

Resume

Name:
{summary.get("name","")}

Skills:
{", ".join(summary.get("skills", []))}

Experience:
{chr(10).join(summary.get("experience", []))}

Projects:
{chr(10).join(summary.get("projects", []))}

Education:
{chr(10).join(summary.get("education", []))}

Provide:

1. Overall Rating out of 10

2. Top Strengths (bullet points)

3. Weaknesses (bullet points)

4. Suggestions for Improvement (bullet points)

Keep the response concise and professional.
"""

    response = llm.invoke(prompt)

    return response.content