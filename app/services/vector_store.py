from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

from app.services.bm25_service import BM25Retriever

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)


def create_vector_store(documents):

    # Create FAISS index
    faiss_store = FAISS.from_documents(
        documents,
        embeddings
    )

    # Create BM25 index
    bm25_store = BM25Retriever(documents)

    return {
        "faiss": faiss_store,
        "bm25": bm25_store
    }