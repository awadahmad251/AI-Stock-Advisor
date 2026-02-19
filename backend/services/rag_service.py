import os
import json
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from config import FAISS_INDEX_PATH, DATA_PATH, EMBEDDING_MODEL, TOP_K_RESULTS
from services.stock_service import stock_service


class RAGService:
    def __init__(self):
        self.model = None
        self.index = None
        self.documents = []
        self.initialized = False

    async def initialize(self):
        """Initialize the RAG service — load model and build/load FAISS index"""
        print("=" * 60)
        print("  Initializing RAG Service")
        print("=" * 60)

        # Load embedding model
        print(f"  Loading embedding model: {EMBEDDING_MODEL}")
        self.model = SentenceTransformer(EMBEDDING_MODEL)
        print("  Embedding model loaded successfully")

        # Check for existing index
        index_file = os.path.join(FAISS_INDEX_PATH, "index.faiss")
        docs_file = os.path.join(FAISS_INDEX_PATH, "documents.json")

        if os.path.exists(index_file) and os.path.exists(docs_file):
            print("  Loading existing FAISS index...")
            self.index = faiss.read_index(index_file)
            with open(docs_file, "r", encoding="utf-8") as f:
                self.documents = json.load(f)
            self.initialized = True
            print(f"  Loaded {len(self.documents)} documents from cache")
        else:
            print("  Building new FAISS index from S&P 500 data...")
            await self.build_index()

        print("=" * 60)
        print("  RAG Service Ready!")
        print("=" * 60)

    async def build_index(self):
        """Build FAISS index from S&P 500 company data"""
        companies = stock_service.get_sp500_list()

        if not companies:
            print("  WARNING: Could not fetch S&P 500 list, using fallback")
            companies = stock_service._get_fallback_companies()

        print(f"  Processing {len(companies)} companies...")

        # Create document chunks
        self.documents = []
        for company in companies:
            # Company profile document
            profile_doc = (
                f"{company['name']} (Ticker: {company['symbol']}) is a company "
                f"listed in the S&P 500 index. It operates in the {company['sector']} "
                f"sector within the {company['sub_industry']} sub-industry. "
                f"Headquartered in {company.get('headquarters', 'N/A')}. "
                f"Added to S&P 500: {company.get('date_added', 'N/A')}. "
                f"Founded: {company.get('founded', 'N/A')}."
            )
            self.documents.append(
                {
                    "text": profile_doc,
                    "symbol": company["symbol"],
                    "name": company["name"],
                    "sector": company["sector"],
                    "type": "company_profile",
                }
            )

            # Sector/investment analysis document
            sector_doc = (
                f"For investors interested in the {company['sector']} sector: "
                f"{company['name']} ({company['symbol']}) operates in "
                f"{company['sub_industry']}. It is one of the S&P 500 constituents "
                f"headquartered in {company.get('headquarters', 'N/A')}. "
                f"Consider {company['symbol']} when looking at "
                f"{company['sector']} sector investments."
            )
            self.documents.append(
                {
                    "text": sector_doc,
                    "symbol": company["symbol"],
                    "name": company["name"],
                    "sector": company["sector"],
                    "type": "sector_analysis",
                }
            )

        # Generate embeddings
        texts = [doc["text"] for doc in self.documents]
        print(f"  Generating embeddings for {len(texts)} documents...")
        embeddings = self.model.encode(texts, show_progress_bar=True, batch_size=64)

        # Build FAISS index with cosine similarity
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dimension)

        # Normalize for cosine similarity
        embeddings = embeddings.astype("float32")
        faiss.normalize_L2(embeddings)
        self.index.add(embeddings)

        # Persist to disk
        os.makedirs(FAISS_INDEX_PATH, exist_ok=True)
        faiss.write_index(self.index, os.path.join(FAISS_INDEX_PATH, "index.faiss"))
        with open(
            os.path.join(FAISS_INDEX_PATH, "documents.json"), "w", encoding="utf-8"
        ) as f:
            json.dump(self.documents, f, indent=2)

        self.initialized = True
        print(f"  Built and saved FAISS index with {len(self.documents)} documents")

    def search(self, query: str, top_k: int = TOP_K_RESULTS):
        """Search the FAISS index for relevant documents"""
        if not self.initialized or self.index is None:
            return []

        query_embedding = self.model.encode([query]).astype("float32")
        faiss.normalize_L2(query_embedding)

        scores, indices = self.index.search(query_embedding, top_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if 0 <= idx < len(self.documents):
                doc = self.documents[idx].copy()
                doc["score"] = float(score)
                results.append(doc)

        return results

    def get_context(self, query: str, top_k: int = TOP_K_RESULTS):
        """Get formatted context string for the AI model"""
        results = self.search(query, top_k)

        if not results:
            return ""

        context_parts = [
            f"--- S&P 500 Knowledge Base Results ---"
        ]
        seen_symbols = set()
        for i, result in enumerate(results, 1):
            if result["symbol"] not in seen_symbols:
                context_parts.append(
                    f"[{i}] {result['text']}"
                )
                seen_symbols.add(result["symbol"])

        return "\n\n".join(context_parts)

    def get_status(self):
        """Get RAG service status"""
        return {
            "initialized": self.initialized,
            "total_documents": len(self.documents),
            "index_size": self.index.ntotal if self.index else 0,
        }


rag_service = RAGService()
