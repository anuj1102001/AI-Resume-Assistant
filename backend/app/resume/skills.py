"""Skill vocabulary and word-boundary matching.

Used for the instant (no-AI) keyword view and as the baseline in evals. v1 matched 37 hard-coded keywords as raw
substrings, so "ai" matched inside "maintain" and "email"; here every alias is matched on token boundaries and maps
to one canonical skill.
"""

import re
from functools import lru_cache

# canonical: aliases (lowercase). The canonical name is always an alias of itself.
SKILLS: dict[str, list[str]] = {
    # languages
    "Python": ["python"],
    "Java": ["java"],
    "JavaScript": ["javascript", "js", "es6"],
    "TypeScript": ["typescript", "ts"],
    "Go": ["golang", "go lang"],
    "Rust": ["rust"],
    "C": ["c programming", "ansi c"],
    "C++": ["c++", "cpp"],
    "C#": ["c#", "csharp"],
    "Kotlin": ["kotlin"],
    "Swift": ["swift"],
    "Ruby": ["ruby"],
    "PHP": ["php"],
    "Scala": ["scala"],
    "R": ["r programming", "rstudio"],
    "SQL": ["sql"],
    "Bash": ["bash", "shell scripting"],
    "HTML": ["html", "html5"],
    "CSS": ["css", "css3"],
    "Dart": ["dart"],
    # web and app frameworks
    "React": ["react", "react.js", "reactjs"],
    "Next.js": ["next.js", "nextjs"],
    "Vue": ["vue", "vue.js", "vuejs"],
    "Angular": ["angular"],
    "Svelte": ["svelte"],
    "Node.js": ["node", "node.js", "nodejs"],
    "Express": ["express", "express.js"],
    "Django": ["django"],
    "Flask": ["flask"],
    "FastAPI": ["fastapi"],
    "Spring Boot": ["spring boot", "spring"],
    "Ruby on Rails": ["rails", "ruby on rails"],
    ".NET": [".net", "dotnet", "asp.net"],
    "Tailwind CSS": ["tailwind", "tailwindcss", "tailwind css"],
    "Redux": ["redux"],
    "GraphQL": ["graphql"],
    "REST APIs": ["rest", "restful", "rest api", "rest apis"],
    "gRPC": ["grpc"],
    "Flutter": ["flutter"],
    "React Native": ["react native"],
    "Android": ["android"],
    "iOS": ["ios"],
    "Streamlit": ["streamlit"],
    # data and ML
    "Machine learning": ["machine learning", "ml"],
    "Deep learning": ["deep learning"],
    "NLP": ["nlp", "natural language processing"],
    "Computer vision": ["computer vision", "cv"],
    "PyTorch": ["pytorch", "torch"],
    "TensorFlow": ["tensorflow", "tf"],
    "Keras": ["keras"],
    "scikit-learn": ["scikit-learn", "sklearn", "scikit learn"],
    "Pandas": ["pandas"],
    "NumPy": ["numpy"],
    "OpenCV": ["opencv"],
    "Hugging Face": ["hugging face", "huggingface", "transformers"],
    "LLMs": ["llm", "llms", "large language models", "large language model"],
    "Generative AI": ["generative ai", "genai", "gen ai"],
    "RAG": ["rag", "retrieval-augmented generation", "retrieval augmented generation"],
    "LangChain": ["langchain"],
    "LlamaIndex": ["llamaindex", "llama index"],
    "Prompt engineering": ["prompt engineering", "prompting"],
    "Embeddings": ["embeddings", "embedding models", "vector embeddings"],
    "Vector databases": [
        "vector database",
        "vector databases",
        "vector db",
        "pinecone",
        "weaviate",
        "qdrant",
        "chroma",
        "faiss",
        "pgvector",
    ],
    "LLM evaluation": ["llm evaluation", "evals", "ragas", "llm evals"],
    "Fine-tuning": ["fine-tuning", "fine tuning", "lora", "peft"],
    "MLOps": ["mlops"],
    "Statistics": ["statistics", "statistical analysis"],
    "A/B testing": ["a/b testing", "ab testing", "experimentation"],
    "Data analysis": ["data analysis", "data analytics"],
    "Data visualization": ["data visualization", "data visualisation"],
    "Tableau": ["tableau"],
    "Power BI": ["power bi", "powerbi"],
    "Excel": ["excel", "advanced excel"],
    "Spark": ["spark", "pyspark", "apache spark"],
    "Airflow": ["airflow"],
    "dbt": ["dbt"],
    "ETL": ["etl", "elt", "data pipelines", "data pipeline"],
    "Kafka": ["kafka"],
    # databases
    "PostgreSQL": ["postgresql", "postgres"],
    "MySQL": ["mysql"],
    "MongoDB": ["mongodb", "mongo"],
    "Redis": ["redis"],
    "SQLite": ["sqlite"],
    "Elasticsearch": ["elasticsearch", "opensearch"],
    "DynamoDB": ["dynamodb"],
    "BigQuery": ["bigquery"],
    "Snowflake": ["snowflake"],
    "Firebase": ["firebase"],
    "Supabase": ["supabase"],
    # cloud and infra
    "AWS": ["aws", "amazon web services"],
    "Azure": ["azure"],
    "GCP": ["gcp", "google cloud"],
    "Docker": ["docker", "containers"],
    "Kubernetes": ["kubernetes", "k8s"],
    "Terraform": ["terraform"],
    "CI/CD": ["ci/cd", "ci cd", "continuous integration", "github actions", "jenkins", "gitlab ci"],
    "Linux": ["linux"],
    "Git": ["git", "github", "gitlab"],
    "Serverless": ["serverless", "lambda", "aws lambda"],
    "Vercel": ["vercel"],
    "Microservices": ["microservices", "microservice"],
    "System design": ["system design", "distributed systems"],
    "Observability": ["observability", "monitoring", "prometheus", "grafana", "datadog", "opentelemetry"],
    "Security": ["application security", "owasp", "security"],
    "Testing": ["unit testing", "integration testing", "pytest", "jest", "test automation", "tdd"],
    # product and design
    "Figma": ["figma"],
    "Sketch": ["sketch"],
    "Adobe XD": ["adobe xd", "xd"],
    "Photoshop": ["photoshop"],
    "Illustrator": ["illustrator"],
    "Framer": ["framer"],
    "Prototyping": ["prototyping", "prototypes", "prototype"],
    "Wireframing": ["wireframing", "wireframes"],
    "User research": ["user research", "ux research", "user interviews", "interviews"],
    "Usability testing": ["usability testing", "usability tests", "user testing"],
    "Interaction design": ["interaction design", "ixd"],
    "Visual design": ["visual design", "ui design"],
    "UX design": ["ux design", "user experience", "ux"],
    "Information architecture": ["information architecture"],
    "Design systems": ["design system", "design systems", "component library"],
    "Accessibility": ["accessibility", "wcag", "a11y"],
    "Product design": ["product design"],
    "Design thinking": ["design thinking"],
    "Journey mapping": ["journey mapping", "user journeys", "customer journey"],
    "Motion design": ["motion design", "animation"],
    "Product management": ["product management", "product manager"],
    "Roadmapping": ["roadmap", "roadmapping"],
    "Analytics": ["product analytics", "mixpanel", "amplitude", "google analytics"],
    "Agile": ["agile", "scrum", "kanban"],
    "Jira": ["jira"],
    # ways of working
    "Stakeholder management": ["stakeholder management", "stakeholders"],
    "Communication": ["communication", "communication skills"],
    "Leadership": ["leadership", "team lead", "led a team"],
    "Mentoring": ["mentoring", "mentored", "mentorship"],
}

_SEP = r"[a-z0-9+#]"
# A skill may not start right after a dot either, so the "js" in "React.js" is not read as JavaScript.
_BEFORE = r"[a-z0-9+#.]"


@lru_cache(maxsize=1)
def _patterns() -> list[tuple[str, re.Pattern[str]]]:
    out = []
    for canon, aliases in SKILLS.items():
        alts = sorted({a.lower() for a in [canon.lower(), *aliases]}, key=len, reverse=True)
        # Skip ambiguous one/two-letter aliases unless they're written in a skill-like way elsewhere (handled by callers).
        alts = [a for a in alts if len(a) > 2 or a in ("go", "ml", "ts", "js", "c#", "ux", "xd", "cv", "tf")]
        body = "|".join(re.escape(a) for a in alts)
        out.append((canon, re.compile(rf"(?<!{_BEFORE})(?:{body})(?!{_SEP})", re.I)))
    return out


# Two-letter aliases are only trusted in contexts that look like skill lists or tech prose.
_AMBIGUOUS = {"go", "cv", "tf", "ts", "ux", "xd", "ml"}


def find_skills(text: str) -> dict[str, list[tuple[int, int]]]:
    """Canonical skill -> character spans where it appears."""
    found: dict[str, list[tuple[int, int]]] = {}
    for canon, pat in _patterns():
        for m in pat.finditer(text):
            alias = m.group(0).lower()
            if alias in _AMBIGUOUS and not _techy_context(text, m.start(), m.end()):
                continue
            if alias == "go" and text[m.start() : m.end()] != "Go":
                continue  # "go" as a verb
            found.setdefault(canon, []).append((m.start(), m.end()))
    return found


def _techy_context(text: str, a: int, b: int) -> bool:
    window = text[max(0, a - 40) : b + 40]
    return bool(re.search(r"[,|/•:]", window)) or text[a:b].isupper()


YEARS = re.compile(r"(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)", re.I)


def required_years(text: str) -> int | None:
    """Smallest "N+ years" figure in a job description, if any."""
    vals = [int(m.group(1)) for m in YEARS.finditer(text) if 0 < int(m.group(1)) <= 25]
    return min(vals) if vals else None
