# CREATOR EVIDENCE — VERIFIED FACTS ONLY

Everything in Section 1 is confirmed from the creator's CV or their public GitHub.
Use these freely: they are the specifics that make a post credible.

Everything in Section 2 is external industry context, current as of August 2026.
Use it to frame the creator's work against what the field is doing — never present
it as the creator's own result.

**Anything not in this file does not exist.** Do not invent a benchmark, a client,
a percentage, or a timeframe to fill a slide. A slide with one real detail beats
four invented ones.

---

## 1. THE CREATOR'S OWN WORK (verified)

### Employment
- **Computer Vision Data Associate, Moksa** (Hyderabad, Sept 2025 – present).
  Curates and validates CCTV video datasets, **2–3 GB per training batch**, for
  people-counting and video management systems running across **hundreds of camera
  feeds**. Runs live testing against real store cameras, tracking model accuracy in
  the **80–96% range** and catching issues before production rollout. Maintains
  monitoring dashboards for model performance and theft-detection events.
- **Data Annotation Intern, Indusvision** (Bangalore, Mar–Aug 2025). Annotated
  **thousands of high-resolution images per day**; sustained **98%+ annotation
  accuracy**.
- B.Tech Mechatronics, Mahatma Gandhi Institute of Technology, 2022.

### Drone Detection — Edge Quantization
YOLOv8n trained on a custom Roboflow drone dataset for **100 epochs**.
- FP32 baseline: **0.6637 mAP50-95**
- ONNX FP16 quantized, CPU-only: **0.6642 mAP50-95**
- Accuracy held after quantization. Built a live OpenCV webcam pipeline with
  real-time FPS, preprocessing-latency and inference-latency overlays.
- Stated reasoning for FP16 over INT8: roughly halves model size, runs on CPU with
  no GPU, and needs **no calibration dataset** (unlike INT8).

**Do not quote model size or FPS for this project.** The README's size and FPS
cells are unfilled placeholders (`[e.g., 48]`), not measurements. Only the two mAP
numbers above are real.

### Multi-Agent AI Orchestration
LangGraph `StateGraph` orchestrating **Planner, Research and Coding agents** via
conditional routing driven by LLM-generated task plans. Research agent does real
tool-calling: live web search through the Tavily API, and automated GitHub repo
analysis (structure, README, language breakdown) via PyGithub. Exposed as a
FastAPI `/chat` service on a Groq-hosted **Llama 3.3 70B**, deployed to Render.

### MedoBot — RAG Medical Assistant
Retrieval-augmented pipeline grounding LLM answers strictly in uploaded documents.
FAISS vector store with MiniLM embeddings, **sub-second lookup**. Streamlit UI with
persistent session history. **90% factual accuracy in testing.**

### Potato Disease Detection
Custom CNN built from scratch, **92% validation accuracy** on potato leaf disease
classification.

### Other public repos (real, but undocumented — describe only at this level)
`ANPR_project` (licence-plate detection), `interview-assistant`,
`ad-spy-agent` (Facebook Ad Library research + Gemini ad cloning),
`Molecular_Property_Prediction_Datasets` (MoleculeNet benchmarks as canonical
RDKit SMILES — BACE 1,513 / BBBP 2,050 / ClinTox 1,484 / ESOL 1,128 /
FreeSolv 642 / HIV 41,127 / QM9 ~134k samples).

**Excluded on purpose:** `transcribe-rs` and `intelligent-speech` are derivative of
another developer's projects (cjpais). Never present them as the creator's work.

### Stack actually used
Python, PyTorch, TensorFlow, Keras, OpenCV, YOLOv8, ONNX, LangChain, LangGraph,
FAISS, MiniLM, Groq (Llama 3.3/3.1), Tavily, FastAPI, Streamlit, Docker, Render,
Roboflow. **Not** LangGraph-plus-anything-unlisted — if a tool is not on this list,
the creator has not used it publicly.

---

## 2. INDUSTRY CONTEXT (external, August 2026)

Attribute these as the field's numbers, never the creator's.

- **INT8 costs accuracy; FP16 largely does not.** Published benchmarks put INT8
  quantization at roughly a **1.5-point mAP drop**, in exchange for ~3x speed and
  ~38% lower power. This is the sharpest frame available for the creator's own
  result: the industry accepts a real accuracy tax for INT8, and their FP16 export
  held accuracy at 0.6637 → 0.6642.
- **YOLOv8 CPU latency by variant:** nano 21.58 ms, small 42.27 ms, medium
  90.01 ms, large 164.54 ms, x-large 236.37 ms. Cost rises far faster than accuracy
  at the top end — an argument for nano-class models at the edge.
- **YOLOv8 is no longer the newest.** YOLO26 has shipped, with a simplified
  architecture explicitly designed to tolerate low-bitwidth inference. A post that
  says "I used YOLOv8" in 2026 should acknowledge the landscape moved.
- FP16 typically halves memory and can double throughput on compatible hardware;
  INT8 gains more on CPUs and NPUs but needs careful calibration.

Sources: arxiv.org/abs/2509.25164 (YOLO26 benchmarking),
mdpi.com/2073-431X/15/2/74 (YOLOv8 variants on Jetson Orin NX),
tildalice.io/onnx-int8-vs-fp16-jetson-orin-nano-latency-benchmark/

---

## 3. AUDIENCE

Write for **engineers** — ML practitioners, technical leads, and the technical
hiring managers who screen for these roles. The specificity is the credibility;
removing it removes the proof.

One exception: the **cover slide and the opening line must be readable by anyone**.
That is what earns reach beyond the immediate technical circle. Lead with the
human stake ("I expected to lose accuracy. I didn't."), then go deep from slide two
onward.
