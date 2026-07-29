import re

resume_summary = None


def set_resume_summary(summary):

    global resume_summary
    resume_summary = summary


def get_resume_summary():

    return resume_summary


def generate_resume_summary(documents):

    summary = {
        "name": "",
        "email": "",
        "phone": "",
        "linkedin": "",
        "skills": [],
        "experience": [],
        "projects": [],
        "education": []
    }

    email_pattern = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"

    phone_pattern = (
        r"(?:\+91[\s-]?)?"
        r"(?:\d{10}|\d{5}[\s-]?\d{5})"
    )

    for doc in documents:

        section = doc.metadata.get("section", "").upper()
        text = doc.page_content

        if section == "CONTACT":

            lines = [
                line.strip(" #|•")
                for line in text.split("\n")
                if line.strip()
            ]

            if lines:
                summary["name"] = lines[0]

            for line in lines:

                email = re.search(email_pattern, line)
                if email:
                    summary["email"] = email.group()

                phone = re.search(phone_pattern, line)
                if phone:
                    summary["phone"] = phone.group()

                if "linkedin.com" in line.lower():
                    summary["linkedin"] = line

        elif section == "TECHNICAL SKILLS":

            for line in text.split("\n"):

                if ":" not in line:
                    continue

                _, values = line.split(":", 1)

                for skill in values.split(","):

                    skill = skill.strip()

                    if skill and skill not in summary["skills"]:
                        summary["skills"].append(skill)

        elif section == "EXPERIENCE":

            for line in text.split("\n"):

                line = line.strip()

                if (
                    line
                    and "•" not in line
                    and line not in summary["experience"]
                ):
                    summary["experience"].append(line)

        elif section == "PROJECTS":

            for line in text.split("\n"):

                line = (
                    line.replace("GitHub Link 2", "")
                        .strip()
                )

                if (
                    line
                    and "•" not in line
                    and "Roles" not in line
                    and line not in summary["projects"]
                ):
                    summary["projects"].append(line)

        elif section == "EDUCATION":

            for line in text.split("\n"):

                line = line.strip()

                if (
                    line
                    and line not in summary["education"]
                ):
                    summary["education"].append(line)

    set_resume_summary(summary)

    return summary