import requests
from datasets import Dataset

API_URL = "http://localhost:8000/query_full"

# Test questions
with open('C://Users//tai.nguyentuan//Documents//clone_rag//atmalab-rag//ragas_input_dataset//questions.txt', 'r', encoding="utf-8") as question_file:
    questions = [question.strip() for question in question_file]

with open('C://Users//tai.nguyentuan//Documents//clone_rag//atmalab-rag//ragas_input_dataset//groundtruth.txt', 'r', encoding="utf-8") as groundtruth_file:
    groundtruths = [groundtruth.strip() for groundtruth in groundtruth_file]

collection_id = ""
tenant_id = ""
user_group_id = ""

# Containers
answers = []
contexts = []

count = 1
# Iterate over the questions and collect answers and sources
for question in questions:
    if (count > 0 and count <= 50):
        collection_id = "2abe8574-c295-46aa-97c8-a121ff0c1898"
        tenant_id = "b295efbe-687b-41f1-91d7-69c16619651f"
        user_group_id = ""
    elif (count > 50 and count <= 100):
        collection_id = "8aeb9077-1a58-4b74-b524-2b56e949b1f8"
        tenant_id = "b295efbe-687b-41f1-91d7-69c16619651f"
        user_group_id = ""
    elif (count > 100 and count <= 150):
        collection_id = "aae9d2a5-5198-45d9-bb82-236853380ab4"
        tenant_id = "b295efbe-687b-41f1-91d7-69c16619651f"
        user_group_id = ""
    elif (count > 150 and count <= 200):
        collection_id = "41e159ec-5b42-4b26-acb0-2042051f68ed"
        tenant_id = "b295efbe-687b-41f1-91d7-69c16619651f"
        user_group_id = ""
    
    payload_template = {
        "system_prompt": "You are a helpful AI",
        "mode": "RAG",
        "collection_id": collection_id,
        "tenant_id": tenant_id,
        "user_group_id": user_group_id,
        "chat_history": [
            {"role": "assistant", "content": ""}
        ],
        "language": "english"
    }
      
    payload = payload_template.copy()
    payload["question"] = question

    try:
        response = requests.post(API_URL, json=payload)
        response.raise_for_status()
        data = response.json()

        # Extract the answer
        answer = data.get("answer", "NO ANSWER")

        # Extract the list of source contents
        sources = data.get("sources", [])
        context_list = [src.get("content", "") for src in sources]

        answers.append(answer)
        contexts.append(context_list)

        print(f"✅ {question}")
        print(f"→ Answer: {answer[:100]}...")
        print(f"→ Context count: {len(context_list)}\n")
    
    except Exception as e:
        print(f"❌ Error for '{question}': {e}")
        answers.append("ERROR")
        contexts.append([])
    
    count = count + 1

# Prepare RAGAS dataset
dataset = Dataset.from_dict({
    "question": questions,
    "answer": answers,
    "contexts": contexts,
    "reference": groundtruths
})

# Save the dataset
dataset.save_to_disk("ragas_input_dataset")
print("📦 Dataset saved to 'ragas_input_dataset'")
