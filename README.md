# 🧪 LossLab: Interactive ML Pedagogical Engine

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer--Motion-12.0-0055FF?logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Supabase](https://img.shields.io/badge/Supabase-2.x-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)

**LossLab** is a high-fidelity, gamified simulation environment designed to teach the nuances of Machine Learning optimization. Instead of just reading about gradients, users step into a "lab" to diagnose and fix broken neural networks across a series of structured, pedagogical missions.

---

## 🌟 Key Highlights

- **🧠 Interactive Lab Environment**: Real-time simulation of CNN training with live-updating loss curves and accuracy metrics.
- **🎯 Mission-Based Progression**: 5+ core missions covering critical ML concepts:
    - **The Runaway**: Stabilizing exploding gradients through LR/Batch Size balancing.
    - **The Ghost Network**: Resolving vanishing gradients and weight initialization symmetry.
    - **The Imposter**: Identifying and correcting overfitting through regularization.
- **💬 Socratic Diagnostics**: A custom diagnostic engine that provides proactive, non-spoiler hints based on training signatures.
- **📊 Precision Visualization**: Custom Chart.js annotations for event markers like "Overfit Detected" or "Plateau Start."
- **🏆 High-Stakes Scoring**: A multi-factor system that rewards speed, stability, and depth of exploration.

---

## 🏗️ Deep-Dive: Technical Architecture

LossLab is built as a reactive, deterministic simulation engine that mimics real-world training dynamics without the overhead of a full GPU-bound backend.

### **1. The Simulation Engine (`simulate.js`)**
The heart of LossLab is a high-performance simulation loop that uses a **Phase-Based Progress Model**:
- **Warmup Phase**: Initial gradient stabilization.
- **Core Training**: The primary learning drive phase.
- **Fine-Tune Phase**: Late-stage convergence targeting the loss floor.
- **Deterministic Reproducibility**: Implemented via a `mulberry32` PRNG tied to a unique configuration hash, ensuring that the same hyperparameters always yield the same results for controlled experimentation.

### **2. Socratic Diagnostic Engine (`diagnostics.js`)**
The diagnostic system uses heuristic analysis of training history to provide context-aware feedback:
- **Signature Detection**: Automatically identifies `Divergence`, `Flatlining`, and `Vanishing Gradients` by monitoring loss velocity and variance.
- **Pedagogical Anchoring**: Instead of "auto-fixing," the engine provides **Socratic Prompts**—mission-specific questions that guide the user toward discovering the solution themselves.
- **Architecture Smells**: Detects suboptimal network designs like "Every-layer Pooling" or "Spatial Information Loss" in 1x1 filters.

### **3. Reward & Gamification Logic (`scoring.js`)**
Success in LossLab isn't just about high accuracy; it's about engineering discipline:
- **Stability Bonus**: Incentivizes avoiding divergent configurations.
- **Exploration Requirement**: Specific missions (like "Plateau Hunter") require trying at least 3 unique optimizers to qualify for a win.
- **Badge System**: 15+ dynamic rewards including **"Goldilocks"** (perfect LR), **"Deep Diver"** (successful 10+ layer stacks), and **"Eagle Eye"** (first-run success).

---

## 🎓 Pedagogical Philosophy

LossLab is designed around **Exploratory Learning**:
- **High-Frequency Iteration**: Users can run a "simulation" in seconds, allowing for hundreds of experiments in a single session.
- **Visual Feedback Loops**: Every parameter change is reflected in the "Run Delta" UI, showing the immediate impact on training dynamics.
- **Risk-Safe Environment**: By isolating specific failure modes in missions, learners can build an intuition for hyperparameters that usually takes months of GPU-time to develop.

---

## 🛠️ Full Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | React 19 (Hooks, Context, Concurrent Mode) |
| **Build & Tooling** | Vite 8.0, PostCSS, ESLint |
| **Styling** | Tailwind CSS (Complex Utility Composition) |
| **Motion** | Framer Motion (State-aware Layout Transitions) |
| **Data Viz** | Chart.js 4, react-chartjs-2 (Custom Plugin Annotations) |
| **State/Auth** | Supabase JS Core (Real-time DB, Auth) |
| **Icons** | Lucide-React (High-consistency SVG icons) |

---

## 🚀 Getting Started

### **Prerequisites**
- Node.js (v18+)
- npm or yarn

### **Installation**
1. Clone the repository:
   ```bash
   git clone https://github.com/chitranshuajmera0000/LossLab.git
   cd LossLab
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

---

## � Professional Summary for Interviewers

This project serves as a demonstration of:
- **State Management Complexity**: Handling high-frequency data streams (loss/accuracy history) across a deeply nested component tree using React Context and custom hooks.
- **Heuristic-Driven UI**: Building a reactive interface that changes its instructional tone based on real-time data analysis of a simulation engine.
- **Visualization Engineering**: Extending standard chart libraries with custom event markers and threshold arcs for specialized ML metrics.
- **Developer Experience (DX)**: Implementing a deterministic simulation model that allows for robust unit testing of pedagogical paths.

---

*Developed by [Chitranshu](https://github.com/chitranshuajmera0000) — Inspired by the challenges of real-world deep learning optimization.*
