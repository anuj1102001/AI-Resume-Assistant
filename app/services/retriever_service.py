from typing import List


def retrieve_chunks(vector_store, question: str, k: int = 4):

    faiss_store = vector_store["faiss"]
    bm25_store = vector_store["bm25"]

    # Semantic Search
    faiss_results = faiss_store.similarity_search(
        question,
        k=5
    )

    # Keyword Search
    bm25_results = bm25_store.retrieve(
        question,
        k=5
    )

    merged = []
    seen = set()

    # Merge results while removing duplicates
    for doc in faiss_results + bm25_results:

        text = doc.page_content

        if text in seen:
            continue

        seen.add(text)
        merged.append(doc)

    documents = []

    print("\n" + "=" * 60)
    print("HYBRID RETRIEVAL")
    print("=" * 60)

    for doc in merged:

        section = doc.metadata.get("section", "")

        if section == "CONTACT":
            continue

        print(f"\nSection : {section}")
        print("-" * 40)
        print(doc.page_content[:250])

        documents.append(doc)

        if len(documents) == k:
            break

    print("=" * 60)

    return documents