from rank_bm25 import BM25Okapi


class BM25Retriever:

    def __init__(self, documents):

        self.documents = documents

        tokenized_docs = [
            doc.page_content.lower().split()
            for doc in documents
        ]

        self.bm25 = BM25Okapi(tokenized_docs)

    def retrieve(self, query, k=5):

        tokens = query.lower().split()

        scores = self.bm25.get_scores(tokens)

        ranked = sorted(
            zip(self.documents, scores),
            key=lambda x: x[1],
            reverse=True
        )

        return [doc for doc, _ in ranked[:k]]