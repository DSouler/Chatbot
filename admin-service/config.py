# config.py
import os
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# LLM Provider Configuration
EMBEDDING_OPENAI_KEY = os.getenv("EMBEDDING_OPENAI_KEY")
OPENAI_MODEL_NAME = os.getenv("OPENAI_MODEL_NAME", "gpt-4o-mini")

# Anthropic Configuration
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL_NAME = os.getenv("ANTHROPIC_MODEL_NAME", "claude-3-sonnet-20240229")

# Google Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_MODEL_NAME = os.getenv("GOOGLE_MODEL_NAME", "gemini-pro")
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")

# Default LLM Provider
DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "openai")
DEFAULT_MODEL_NAME = os.getenv("DEFAULT_MODEL_NAME", OPENAI_MODEL_NAME)

# Qdrant Configuration
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "RAG_AI")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)

# Application Configuration
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "text-embedding-3-large")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "3072"))

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "2000"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "500"))

SYS_PROMPT = """
* Core Identity and Purpose
You are a smart, helpful, and accurate AI assistant. Your core task is to assist users in answering questions, solving problems, or providing information based on your general knowledge or tenant-specific knowledge if available.
Your model name is {model}.

* Knowledge Source and Adaptability
You are integrated with a Retrieval-Augmented Generation (RAG) system. When document snippets are provided, you should prioritize them as the most relevant knowledge and cite them when used. 
However, if no retrieved documents are available or they are irrelevant, rely on your own general knowledge to respond helpfully and informatively.

* RAG Process and Knowledge Citation
- If retrieved documents are provided and are relevant, incorporate their information and cite them clearly.
- Do not fabricate references or refer to documents not provided.
- If the retrieved documents are unrelated, you may choose to (a) ignore them and respond from your own knowledge or (b) ask the user for clarification if necessary.

* Behavior in Absence of RAG
If no documents are provided or the RAG system is inactive, respond as a general-purpose assistant using your trained knowledge. Never refuse to answer simply because no documents were retrieved, unless the user query truly cannot be addressed without external documents.
"""
QA_PROMPT = """
    You are smart, helpful, and accurate AI assistant. Use the following excerpts in documents to answer the question. You must give answer in {lang}.
    EXCERPTS:
    {context}
    QUESTION: {query}
    ANSWER:
"""
QA_COMPLEX_PROMPT = """
    Use the following pieces of context to answer the question at the end in detail with clear explanation. 
    If you don't know the answer, just say that you don't know, don't try to make up an answer. You must give answer in {lang}.\n\n
    "###Context: \n{context}\n\n"
    "###Question: \n{query}\n\n"
    "Helpful Answer:"""
DECOMPOSE_PROMPT = """
You are an expert at converting user complex questions into sub questions. Perform query decomposition. 
Given a USER QUESTION, break it down into the most specific SUB_QUESTION you can (at most 3) which will help you answer the original question. 
Each sub question should be about a single concept/fact/idea. If there are acronyms or words you are not familiar with, DO NOT rephrase them.
ONLY RETURN SUB_QUESTION, FOLLOW THE FORMAT STRICTLY.
        ###
        USER QUESTION: {query}
        ###
        EXAMPLE OUTPUT STRUCTURE OF SUB_QUESTION: 
        ["sub_question_1",
         "sub_question_2", 
         "sub_question_3"]
        ###
        SUB_QUESTION (less than {max_context_rewrite_length} characters):"""
REACT_PROMPT = """Answer the following questions as best you can. You must give answer in {lang}. You have access to the following tools:
{tool_description}
Use the following format, ##Thought field is require:

##Thought: you should always think about what to do

##Action: the action to take, should be one of [{tool_names}]

##Action Input: the input to the action, should be different from the action input of the same action in previous steps.

Observation: the result of the action

... (this Thought/Action/Action Input/Observation can repeat N times)

##Thought: I now know the final answer
##Final Answer: the final answer to the original input question

Begin! After each Action Input.

Question: {question}
Thought:{agent_scratchpad}
"""

DEFAULT_MAX_REACT_ITERATIONS = int(os.getenv("DEFAULT_MAX_REACT_ITERATIONS", "5"))



DEFAULT_SYSTEM_PROMPT = os.getenv("DEFAULT_SYSTEM_PROMPT", SYS_PROMPT)
DEFAULT_QA_PROMPT = os.getenv("DEFAULT_QA_PROMPT", QA_PROMPT)
DEFAULT_TEMPERATURE = float(os.getenv("DEFAULT_TEMPERATURE", "0.2"))
DEFAULT_TOP_K = int(os.getenv("DEFAULT_TOP_K", "8"))
DEFAULT_REQUEST_TIMEOUT = int(os.getenv("DEFAULT_REQUEST_TIMEOUT", "120"))
DEFAULT_N_LAST_INTERACTIONS = int(os.getenv("DEFAULT_N_LAST_INTERACTIONS", "5"))
DEFAULT_MAX_CONTENT_REWRITE_LENGTH = int(os.getenv("DEFAULT_MAX_CONTENT_REWRITE_LENGTH", "150"))
DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "English")
DEFAULT_DECOMPOSE_PROMPT = os.getenv("DEFAULT_DECOMPOSE_PROMPT", DECOMPOSE_PROMPT)
DEFAULT_QA_COMPLEX_PROMPT = os.getenv("DEFAULT_QA_COMPLEX_PROMPT", QA_COMPLEX_PROMPT)


ZERO_SHOT_PLANNER_PROMPT = """You are an AI agent who makes step-by-step plans to solve a problem under the help of external tools.
For each step, make one plan followed by one tool-call should be one of [{tool_names}], which will be executed later to retrieve evidence for that step.
You should store each evidence into a distinct variable #E1, #E2, #E3 ... that can be referred to in later tool-call inputs.

##Available Tools##
{tool_description}

##Output Format (Replace '<...>')##
#Plan1: <describe your plan here>
#E1: <toolname>[<input here>] (eg. Search[What is Python])
#Plan2: <describe next plan>
#E2: <toolname>[<input here, you can use #E1 to represent its expected output>]
And so on...

##Your Task##
{task}

##Now Begin##
"""

ONE_SHOT_PLANNER_PROMPT = """You are an AI agent who makes step-by-step plans to solve a problem under the help of external tools.
For each step, make one plan followed by one tool-call should be one of [{tool_names}], which will be executed later to retrieve evidence for that step.
You should store each evidence into a distinct variable #E1, #E2, #E3 ... that can be referred to in later tool-call inputs.

##Available Tools##
{tool_description}

##Output Format##
#Plan1: <describe your plan here>
#E1: <toolname>[<input here>]
#Plan2: <describe next plan>
#E2: <toolname>[<input here, you can use #E1 to represent its expected output>]
And so on...

##Example##
Task: What is the 4th root of 64 to the power of 3?
#Plan1: Find the 4th root of 64
#E1: Calculator[64^(1/4)]
#Plan2: Raise the result from #Plan1 to the power of 3
#E2: Calculator[#E1^3]

##Your Task##
{task}

##Now Begin##
"""


FEW_SHOT_PLANNER_PROMPT = """You are an AI agent who makes step-by-step plans to solve a problem under the help of external tools.
For each step, make one plan followed by one tool-call should be one of [{tool_names}], which will be executed later to retrieve evidence for that step.
You should store each evidence into a distinct variable #E1, #E2, #E3 ... that can be referred to in later tool-call inputs.

##Available Tools##
{tool_description}

##Output Format (Replace '<...>')##
#Plan1: <describe your plan here>
#E1: <toolname>[<input>]
#Plan2: <describe next plan>
#E2: <toolname>[<input, you can use #E1 to represent its expected output>]
And so on...

##Examples##
{fewshot}

##Your Task##
{task}

##Now Begin##
"""

ZERO_SHOT_SOLVER_PROMPT = """You are an AI agent who solves a problem with my assistance. I will provide step-by-step plans(#Plan) and evidences(#E) that could be helpful.
Your task is to briefly summarize each step, then make a final conclusion and final answer for your task. You must give answer in {lang}.

##My Plans and Evidences##
{plan_evidence}

##Example Output##
First, I <did something> , and I think <...>; Second, I <...>, and I think <...>; ....
So, <your conclusion>.

##Your Task##
{task}

##Now Begin##
"""

FEW_SHOT_SOLVER_PROMPT = """You are an AI agent who solves a problem with my assistance. I will provide step-by-step plans and evidences that could be helpful.
Your task is to briefly summarize each step, then make a final conclusion and final answer for your task. You must give answer in {lang}.

##My Plans and Evidences##
{plan_evidence}

##Example Output##
First, I <did something> , and I think <...>; Second, I <...>, and I think <...>; ....
So, <your conclusion and final answer>.

##Example##
{fewshot}

##Your Task##
{task}

##Now Begin##
"""
