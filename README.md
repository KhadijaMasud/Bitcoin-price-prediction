# Bitcoin Price Forecasting — CS373 Machine Learning

**Group 15 | Information Technology University**  
Esha Saeed (BSCS23015) · Khadija Masood (BSCS23144) · Muzammil Mahmood (BSCS23003)

---

## Overview

A machine learning pipeline that predicts next-day Bitcoin price direction and log return using historical OHLCV data and engineered technical indicators. Covers regression and classification tasks across five course-aligned ML models.

---

## Project Structure

```
├── backend/
│   ├── preprocess.py        # 1-min → daily aggregation, ADF stationarity test
│   ├── features.py          # Technical indicators, feature matrix, targets, splits
│   ├── models_linear.py     # Linear Regression, Ridge, Lasso
│   ├── models_logistic.py   # Logistic Regression (direction classification)
│   └── models_rf.py         # Random Forest (regression + classification)
│
├── data/
│   ├── daily.pkl            # Cached daily OHLCV (auto-generated)
│   └── results/             # Model predictions and metrics CSVs
│
├── frontend/                # React dashboard (in progress)
│
├── Mid_Eval_Slides.pptx     # Mid-evaluation presentation
├── Group15_Project_Proposal.pdf
├── requirements.txt
└── README.md
```

---

## Setup

```bash
pip install -r requirements.txt
```

Place the raw dataset at `data/btcusd_1-min_data.csv`.  
Download from: https://www.kaggle.com/datasets/mczielinski/bitcoin-historical-data

---

## Running the Pipeline

```bash
# Step 1 — Build daily dataset and run stationarity tests
python backend/preprocess.py

# Step 2 — Compute features, targets, and baseline
python backend/features.py

# Step 3 — Linear models (Linear Regression, Ridge, Lasso)
python backend/models_linear.py

# Step 4 — Logistic Regression (direction classification)
python backend/models_logistic.py

# Step 5 — Random Forest (regression + classification)
python backend/models_rf.py
```

---

## Models Implemented

| Model | Task | Course Week |
|---|---|---|
| Linear Regression | Regression | Week 4 |
| Ridge + Lasso | Regularised Regression | Week 5 |
| Logistic Regression | Classification | Week 9–10 |
| Random Forest | Both | Week 22 |
| SVM (RBF) | Both *(in progress)* | Week 25–27 |

---

## Results (Mid-Evaluation)

### Regression (next-day log return)

| Model | RMSE | MAE |
|---|---|---|
| Persistence Baseline | 0.0363 | 0.0266 |
| Linear Regression | 0.0254 | 0.0183 |
| Ridge (λ=10) | 0.0251 | 0.0180 |
| Lasso (λ=0.01) | 0.0249 | 0.0178 |
| Random Forest | 0.0270 | 0.0193 |

### Classification (direction: UP / DOWN)

| Model | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|
| Majority Baseline | 51.2% | 51.2% | 100% | 67.7% |
| Logistic Regression | 52.4% | 55.4% | 35.7% | 43.4% |
| Random Forest | 50.2% | 55.5% | 13.3% | 21.4% |

---

## Data

- **Source:** [Kaggle — Bitcoin Historical Data](https://www.kaggle.com/datasets/mczielinski/bitcoin-historical-data)
- **Raw:** 7.55 million 1-minute OHLCV records (2012–2026)
- **Used:** Most recent 4,500 daily records (Jan 2014 – May 2026)
- **Split:** 80% train (Jan 2014 – Nov 2023), 20% test (Nov 2023 – May 2026)
- **Validation:** 5-fold TimeSeriesSplit (no shuffling — time order preserved)

---

## Features

| Feature | Type | Signal |
|---|---|---|
| Close, Volume | Raw | Price and activity |
| EMA-9, EMA-21 | Trend | Short and long moving averages |
| MACD, Signal | Momentum | Trend convergence/divergence |
| RSI-14 | Oscillator | Overbought/oversold |
| Momentum, PROC | Rate of change | Price speed |
| Stochastic %K | Oscillator | Position in recent range |
