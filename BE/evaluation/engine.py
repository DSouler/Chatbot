from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall, answer_similarity, answer_correctness
from ragas import evaluate
from datasets import load_from_disk
import os

os.environ["OPENAI_API_KEY"] = "sk-xxxxxx"

# Load your previously saved dataset
dataset = load_from_disk("ragas_input_dataset")

# Evaluate with RAGAS metrics
results = evaluate(
    dataset,
    metrics=[
        faithfulness,
        context_recall,
        context_precision,
        answer_relevancy,
        answer_similarity,
        answer_correctness,
    ],
)

# Print the results
print("📊 RAGAS Evaluation Results:")
print(results)