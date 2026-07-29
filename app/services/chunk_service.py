import re

from langchain_core.documents import Document


def split_text(text: str):

    text = text.replace("\r", "")
    text = re.sub(r"\n{2,}", "\n", text)

    lines = [
        line.strip()
        for line in text.split("\n")
        if line.strip()
    ]

    documents = []

    current_section = None
    current_text = []

    # ----------------------------
    # Resume Section Headers
    # ----------------------------

    section_keywords = {
        "PROFILE SUMMARY": "PROFILE SUMMARY",
        "SUMMARY": "PROFILE SUMMARY",

        "TECHNICAL SKILLS": "TECHNICAL SKILLS",
        "TECHNICAL SKILLS/CERTIFICATIONS": "TECHNICAL SKILLS",
        "SKILLS": "TECHNICAL SKILLS",

        "EXPERIENCE": "EXPERIENCE",
        "WORK EXPERIENCE": "EXPERIENCE",

        "PROJECTS": "PROJECTS",

        "PUBLICATIONS": "PUBLICATIONS",

        "EDUCATION": "EDUCATION",
        "EDUCATION & COURSES": "EDUCATION",
        "COURSES": "EDUCATION",

        "CERTIFICATIONS": "CERTIFICATIONS",

        "ACHIEVEMENTS": "ACHIEVEMENTS",

        "CONTACT": "CONTACT"
    }

    # ----------------------------
    # Auto Experience Detection
    # ----------------------------

    experience_patterns = [

        "Technical Research Associate",
        "Research Associate",

        "AI Engineer",
        "Software Engineer",

        "Machine Learning Engineer",

        "Data Scientist",

        "Developer",

        "Intern",

        "Internship",

        "Web Development Intern"
    ]

    # ----------------------------
    # Start Parsing
    # ----------------------------

    for line in lines:

        normalized_line = (
            line.upper()
            .replace(" ", "")
            .replace("-", "")
            .replace("/", "")
            .replace("&", "")
        )

        found_section = False

        for keyword, section_name in section_keywords.items():

            normalized_keyword = (
                keyword.upper()
                .replace(" ", "")
                .replace("-", "")
                .replace("/", "")
                .replace("&", "")
            )

            if normalized_line == normalized_keyword:

                if current_section and current_text:

                    documents.append(
                        Document(
                            page_content="\n".join(current_text),
                            metadata={
                                "source": "Resume",
                                "section": current_section
                            }
                        )
                    )

                current_section = section_name
                current_text = []

                found_section = True
                break

        if found_section:
            continue

        # ----------------------------
        # Automatic Experience Detection
        # ----------------------------

        if any(
            pattern.lower() in line.lower()
            for pattern in experience_patterns
        ):

            if current_section != "EXPERIENCE":

                if current_section and current_text:

                    documents.append(
                        Document(
                            page_content="\n".join(current_text),
                            metadata={
                                "source": "Resume",
                                "section": current_section
                            }
                        )
                    )

                current_section = "EXPERIENCE"
                current_text = []

        if current_section is None:
            current_section = "CONTACT"

        current_text.append(line)

    # ----------------------------
    # Save Last Chunk
    # ----------------------------

    if current_text:

        documents.append(
            Document(
                page_content="\n".join(current_text),
                metadata={
                    "source": "Resume",
                    "section": current_section
                }
            )
        )

    # ----------------------------
    # Debug Output
    # ----------------------------

    print("\n" + "=" * 70)
    print("DOCUMENTS CREATED")
    print("=" * 70)

    for i, doc in enumerate(documents, 1):

        print(f"\nDocument {i}")
        print("Section:", doc.metadata["section"])
        print(doc.page_content[:300])

    print("=" * 70)

    return documents