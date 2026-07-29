import streamlit as st
import requests

API_URL = "http://127.0.0.1:8000"

# ==========================================================
# Page Configuration
# ==========================================================

st.set_page_config(
    page_title="AI Resume Assistant",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ==========================================================
# Custom CSS
# ==========================================================

st.markdown("""
<style>

/* ---------- Main ---------- */

.block-container{
    padding-top:1.5rem;
    padding-bottom:2rem;
    max-width:1300px;
}

/* ---------- Sidebar ---------- */

[data-testid="stSidebar"]{
    background:#111827;
}

[data-testid="stSidebar"] h1,
[data-testid="stSidebar"] h2,
[data-testid="stSidebar"] h3{
    color:white;
}

/* ---------- Cards ---------- */

.card{
    background:#111827;
    padding:18px;
    border-radius:14px;
    border:1px solid #2c2c2c;
    margin-bottom:18px;
}

/* ---------- Chat ---------- */

[data-testid="stChatMessage"]{
    border-radius:16px;
    padding:15px;
    margin-bottom:14px;
    border:1px solid #303030;
}

[data-testid="stChatMessage"]:has([data-testid="chatAvatarIcon-user"]){
    background:#1b1b1b;
}

[data-testid="stChatMessage"]:has([data-testid="chatAvatarIcon-assistant"]){
    background:#0f172a;
}

/* ---------- Buttons ---------- */

.stButton>button{
    width:100%;
    border-radius:10px;
    height:48px;
    font-weight:600;
    font-size:15px;
}

/* ---------- Upload ---------- */

[data-testid="stFileUploader"]{
    border-radius:12px;
}

/* ---------- Metrics ---------- */

[data-testid="metric-container"]{
    background:#111827;
    border:1px solid #2f2f2f;
    border-radius:12px;
    padding:12px;
}

/* ---------- Text Area ---------- */

textarea{
    border-radius:12px !important;
}

</style>
""", unsafe_allow_html=True)

# ==========================================================
# Session State
# ==========================================================

if "messages" not in st.session_state:
    st.session_state.messages = []

if "resume_summary" not in st.session_state:
    st.session_state.resume_summary = None

# ==========================================================
# Sidebar
# ==========================================================

with st.sidebar:

    st.title("🤖 AI Resume Assistant")

    st.caption("Resume Intelligence Dashboard")

    st.divider()

    if st.session_state.resume_summary:

        summary = st.session_state.resume_summary

        st.subheader("👤 Candidate")

        st.write(f"**Name**  \n{summary.get('name','')}")
        st.write(f"**Email**  \n{summary.get('email','')}")
        st.write(f"**Phone**  \n{summary.get('phone','')}")

        st.divider()

        st.subheader("🛠 Skills")

        skills = summary.get("skills", [])

        if skills:
            for skill in skills:
                st.markdown(f"✅ {skill}")
        else:
            st.info("No skills found.")

        st.divider()

        st.subheader("💼 Experience")

        experience = summary.get("experience", [])

        if experience:
            for exp in experience:
                st.markdown(f"• {exp}")
        else:
            st.info("No experience found.")

        st.divider()

        st.subheader("🚀 Projects")

        projects = summary.get("projects", [])

        if projects:
            for project in projects:
                st.markdown(f"• {project}")
        else:
            st.info("No projects found.")

        st.divider()

        st.subheader("🎓 Education")

        education = summary.get("education", [])

        if education:
            for edu in education:
                st.markdown(f"• {edu}")
        else:
            st.info("No education found.")

    else:

        st.info(
            "📄 Upload a resume to unlock the dashboard."
        )

# ==========================================================
# Main Page
# ==========================================================

st.title("🤖 AI Resume Assistant")

st.caption(
    "Analyze resumes using Hybrid RAG, Llama 3, FAISS and AI-powered recruiter tools."
)

st.divider()

# ==========================================================
# Upload Section
# ==========================================================

st.subheader("📄 Upload Resume")

uploaded_file = st.file_uploader(
    "Upload your resume (PDF)",
    type=["pdf"]
)

if uploaded_file is not None:

    files = {
        "file": (
            uploaded_file.name,
            uploaded_file.getvalue(),
            "application/pdf"
        )
    }

    if st.button(
        "🚀 Upload Resume",
        type="primary",
        use_container_width=True
    ):

        with st.spinner("Uploading and indexing resume..."):

            response = requests.post(
                f"{API_URL}/upload",
                files=files
            )

        if response.status_code == 200:

            st.session_state.messages = []

            summary_response = requests.get(
                f"{API_URL}/resume-summary"
            )

            if summary_response.status_code == 200:
                st.session_state.resume_summary = (
                    summary_response.json()
                )

            st.success("✅ Resume uploaded successfully!")
            st.balloons()
            st.rerun()

        else:
            st.error(response.text)

st.divider()

# ==========================================================
# Recruiter Mode
# ==========================================================

st.subheader("🎯 Recruiter Mode")

st.caption(
    "Compare the uploaded resume against a Job Description."
)

job_description = st.text_area(
    "Job Description",
    placeholder="Paste the complete Job Description here...",
    height=220
)

if st.button(
    "🔍 Analyze Resume Match",
    use_container_width=True
):

    if not job_description.strip():

        st.warning("Please paste a Job Description.")

    else:

        with st.spinner("Analyzing resume..."):

            response = requests.post(
                f"{API_URL}/job-match",
                json={
                    "job_description": job_description
                }
            )

        if response.status_code == 200:

            result = response.json()

            score = result["score"]
            matched = result["matched"]
            missing = result["missing"]
            recommendation = result["recommendation"]

            st.metric(
                "🎯 Resume Match",
                f"{score}%"
            )

            progress_color = (
                "🟢"
                if score >= 80 else
                "🟡"
                if score >= 60 else
                "🔴"
            )

            st.progress(score / 100)

            st.caption(
                f"{progress_color} Match Score"
            )

            col1, col2 = st.columns(2)

            with col1:

                st.markdown("### ✅ Matching Skills")

                if matched:

                    for skill in matched:
                        st.success(skill)

                else:

                    st.info(
                        "No matching skills found."
                    )

            with col2:

                st.markdown("### ❌ Missing Skills")

                if missing:

                    for skill in missing:
                        st.error(skill)

                else:

                    st.success(
                        "No missing skills."
                    )

            st.markdown("### 💡 Recommendation")

            st.info(recommendation)

        else:

            st.error(response.text)

st.divider()

# ==========================================================
# ATS Resume Score
# ==========================================================

st.subheader("📊 ATS Resume Score")

st.caption(
    "Evaluate how ATS-friendly the uploaded resume is."
)

if st.button(
    "📈 Analyze ATS Score",
    use_container_width=True
):

    with st.spinner("Running ATS analysis..."):

        response = requests.get(
            f"{API_URL}/ats-score"
        )

    if response.status_code == 200:

        result = response.json()

        score = result["score"]
        strengths = result["strengths"]
        improvements = result["improvements"]
        verdict = result["verdict"]

        st.metric(
            label="ATS Score",
            value=f"{score}/100"
        )

        st.progress(score / 100)

        col1, col2 = st.columns(2)

        with col1:

            st.markdown("### ✅ Strengths")

            if strengths:

                for item in strengths:
                    st.success(item)

            else:

                st.info("No strengths detected.")

        with col2:

            st.markdown("### ⚠️ Improvements")

            if improvements:

                for item in improvements:
                    st.warning(item)

            else:

                st.success("No improvements needed.")

        st.markdown("### 🏁 Overall Verdict")

        st.info(verdict)

    else:

        st.error(response.text)

st.divider()

# ==========================================================
# AI Resume Review
# ==========================================================

st.subheader("📝 AI Resume Review")

st.caption(
    "Get AI-generated feedback on the uploaded resume."
)

if st.button(
    "✨ Generate AI Review",
    use_container_width=True
):

    with st.spinner("Analyzing resume with AI..."):

        response = requests.get(
            f"{API_URL}/resume-review"
        )

    if response.status_code == 200:

        review = response.json()["review"]

        st.markdown(
            f"""
<div style="
padding:18px;
border-radius:12px;
background:#111827;
border:1px solid #2f2f2f;
line-height:1.8;">
{review}
</div>
""",
            unsafe_allow_html=True
        )

    else:

        st.error(response.text)

st.divider()

# ==========================================================
# Chat Section
# ==========================================================

col1, col2 = st.columns([5,1])

with col1:

    st.subheader("💬 Resume Chat")

with col2:

    if st.button(
        "🗑 Clear Chat",
        use_container_width=True
    ):

        requests.post(f"{API_URL}/clear-chat")

        st.session_state.messages = []

        st.rerun()

# ==========================================================
# Chat History
# ==========================================================

for message in st.session_state.messages:

    avatar = (
        "👤"
        if message["role"] == "user"
        else "🤖"
    )

    with st.chat_message(
        message["role"],
        avatar=avatar
    ):

        st.markdown(message["content"])

        if (
            message["role"] == "assistant"
            and message.get("sources")
        ):

            with st.expander("📚 Sources Used"):

                for source in message["sources"]:

                    st.markdown(
                        f"• **{source}**"
                    )

# ==========================================================
# Chat Input
# ==========================================================

question = st.chat_input(
    "Ask anything about the uploaded resume..."
)

if question:

    st.session_state.messages.append(
        {
            "role": "user",
            "content": question
        }
    )

    with st.chat_message(
        "user",
        avatar="👤"
    ):

        st.markdown(question)

    with st.chat_message(
        "assistant",
        avatar="🤖"
    ):

        with st.spinner("Thinking..."):

            response = requests.post(
                f"{API_URL}/ask",
                json={
                    "question": question
                }
            )

        if response.status_code == 200:

            data = response.json()

            answer = data["answer"]

            sources = data.get(
                "sources",
                []
            )

        else:

            answer = response.text

            sources = []

        placeholder = st.empty()

        full_response = ""

        for word in answer.split():

            full_response += word + " "

            placeholder.markdown(
                full_response + "▌"
            )

        placeholder.markdown(
            full_response
        )

        if sources:

            with st.expander(
                "📚 Sources Used"
            ):

                for source in sources:

                    st.markdown(
                        f"• **{source}**"
                    )

    st.session_state.messages.append(
        {
            "role": "assistant",
            "content": answer,
            "sources": sources
        }
    )