"""
features.py
===========
Computes all technical indicators and constructs the final feature matrix
and target vectors for both regression and classification tasks.

LOOK-AHEAD SAFETY:
  All indicators below use only past prices by definition (rolling windows
  look backward). The train/test split is always done AFTER indicator
  computation, and is strictly time-ordered (no shuffling ever).

FEATURE SET (10 features):
  Close, Volume, EMA9, EMA21, MACD, Signal, RSI14, MOM10, PROC10, StochK14

TARGETS:
  y_reg  = next-day log return  (regression)
  y_cls  = 1 if y_reg > 0 else 0  (classification: direction up/down)
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from preprocess import get_daily_data


# ── Indicator functions ────────────────────────────────────────────────────────

def compute_ema(series: pd.Series, span: int) -> pd.Series:
    """
    Exponential Moving Average.
    Gives more weight to recent prices (decay factor = 2/(span+1)).
    Captures trend direction — rising EMA = uptrend.

    Course link: feature engineering for regression (Week 4-5).
    """
    return series.ewm(span=span, adjust=False).mean()


def compute_macd(close: pd.Series) -> tuple[pd.Series, pd.Series]:
    """
    Moving Average Convergence Divergence.
    MACD line  = EMA(12) - EMA(26)  — short-term vs long-term momentum gap
    Signal line = EMA(9) of MACD   — smoothed trigger for crossover signals

    When MACD crosses above Signal -> bullish momentum
    When MACD crosses below Signal -> bearish momentum

    Course link: non-linear feature for regression/classification (Week 4-5).
    """
    ema12  = compute_ema(close, 12)
    ema26  = compute_ema(close, 26)
    macd   = ema12 - ema26
    signal = compute_ema(macd, 9)
    return macd, signal


def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """
    Relative Strength Index (0-100).
    RSI = 100 - 100 / (1 + avg_gain / avg_loss)

    RSI > 70 -> overbought (price may reverse downward)
    RSI < 30 -> oversold  (price may reverse upward)

    Captures mean-reversion signal — critical for volatile assets like BTC.
    Course link: feature for classification (Week 9-10 Logistic Regression).
    """
    delta = close.diff()
    gain  = delta.clip(lower=0)
    loss  = -delta.clip(upper=0)

    avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean()

    rs  = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def compute_momentum(close: pd.Series, period: int = 10) -> pd.Series:
    """
    Momentum = Close_t - Close_{t-n}
    Measures the absolute speed of price change over n days.
    Positive = price moved up, Negative = price moved down.

    Course link: a direct difference feature — maps to gradient intuition
    from Week 6 (Gradient Descent).
    """
    return close.diff(period)


def compute_proc(close: pd.Series, period: int = 10) -> pd.Series:
    """
    Price Rate of Change = (Close_t - Close_{t-n}) / Close_{t-n} * 100
    Normalised version of Momentum — percentage change, not absolute.
    Allows comparison across different price regimes (BTC at $800 vs $80,000).

    Course link: normalised feature, avoids scale sensitivity in KNN/SVM.
    """
    return ((close - close.shift(period)) / close.shift(period)) * 100


def compute_stoch_k(high: pd.Series, low: pd.Series,
                    close: pd.Series, period: int = 14) -> pd.Series:
    """
    Stochastic Oscillator %K (0-100).
    %K = (Close - Lowest_Low_n) / (Highest_High_n - Lowest_Low_n) * 100

    Measures where today's close sits within the recent high-low range.
    %K near 100 -> close near top of range (overbought)
    %K near 0   -> close near bottom of range (oversold)

    Course link: bounded oscillator feature for SVM and Random Forest.
    """
    lowest_low   = low.rolling(window=period).min()
    highest_high = high.rolling(window=period).max()
    denom = highest_high - lowest_low
    # Avoid division by zero on flat price days
    stoch_k = np.where(denom == 0, 50, (close - lowest_low) / denom * 100)
    return pd.Series(stoch_k, index=close.index)


# ── Main pipeline ──────────────────────────────────────────────────────────────

def build_features() -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    """
    Loads daily data, computes all indicators, constructs targets,
    and returns the clean feature matrix X and both target vectors.

    Returns:
        X      : DataFrame of shape (N, 10) — feature matrix
        y_reg  : Series — next-day log return (regression target)
        y_cls  : Series — 1 if next-day return > 0 else 0 (classification target)
    """
    df = get_daily_data()

    # ── Compute indicators ─────────────────────────────────────────────────────
    df['EMA9']    = compute_ema(df['Close'], 9)
    df['EMA21']   = compute_ema(df['Close'], 21)
    df['MACD'], df['Signal'] = compute_macd(df['Close'])
    df['RSI']     = compute_rsi(df['Close'], 14)
    df['MOM']     = compute_momentum(df['Close'], 10)
    df['PROC']    = compute_proc(df['Close'], 10)
    df['StochK']  = compute_stoch_k(df['High'], df['Low'], df['Close'], 14)

    # ── Targets ────────────────────────────────────────────────────────────────
    # Shift log_return by -1: at time t, we predict what log_return will be
    # at time t+1. This is the core supervised learning setup.
    df['y_reg'] = df['log_return'].shift(-1)
    df['y_cls'] = (df['y_reg'] > 0).astype(int)

    # ── Feature matrix ─────────────────────────────────────────────────────────
    feature_cols = ['Close', 'Volume', 'EMA9', 'EMA21',
                    'MACD', 'Signal', 'RSI', 'MOM', 'PROC', 'StochK']

    # Drop any rows with NaN (warm-up period for indicators + last row with no target)
    df.dropna(subset=feature_cols + ['y_reg'], inplace=True)

    X     = df[feature_cols]
    y_reg = df['y_reg']
    y_cls = df['y_cls']

    return X, y_reg, y_cls


def get_train_test_split(X: pd.DataFrame,
                         y_reg: pd.Series,
                         y_cls: pd.Series,
                         test_ratio: float = 0.2):
    """
    Time-ordered 80/20 split — NO shuffling, ever.

    WHY NO SHUFFLE:
      Shuffling mixes future data into the training set.
      If your model trains on day 3000 and validates on day 800,
      it has seen the future — this is data leakage.
      Reported metrics would be deceptively optimistic.

    Course link: Module 5 (Train/Test Split), Week 11 (Cross Validation).
    The correct time-series analogue of K-Fold is TimeSeriesSplit.
    """
    split_idx = int(len(X) * (1 - test_ratio))

    X_train, X_test     = X.iloc[:split_idx],     X.iloc[split_idx:]
    y_reg_train, y_reg_test = y_reg.iloc[:split_idx], y_reg.iloc[split_idx:]
    y_cls_train, y_cls_test = y_cls.iloc[:split_idx], y_cls.iloc[split_idx:]

    return X_train, X_test, y_reg_train, y_reg_test, y_cls_train, y_cls_test


def get_tscv(n_splits: int = 5) -> TimeSeriesSplit:
    """
    Returns a TimeSeriesSplit object for cross-validation.

    Each fold trains on the past and validates on the immediate future —
    standard K-Fold would randomly mix past and future, causing leakage.

    Course link: Week 11 (K-Fold CV), adapted for time series.
    """
    return TimeSeriesSplit(n_splits=n_splits)


# ── Persistence baseline ───────────────────────────────────────────────────────

def persistence_baseline(y_reg_train: pd.Series,
                          y_reg_test: pd.Series) -> dict:
    """
    Naive persistence model: predict tomorrow's return = today's return.
    ŷ_{t+1} = y_t

    This is the minimum bar every ML model must beat.
    If a model cannot beat this trivial baseline, it has learned nothing useful.

    Course link: establishes reference point for all regression metrics (Week 4-5).
    """
    # On the test set, the persistence prediction is the previous day's return
    y_pred_persist = y_reg_test.shift(1).dropna()
    y_true         = y_reg_test.iloc[1:]   # align lengths

    rmse = np.sqrt(np.mean((y_true - y_pred_persist) ** 2))
    mae  = np.mean(np.abs(y_true - y_pred_persist))

    return {'model': 'Persistence Baseline', 'RMSE': rmse, 'MAE': mae, 'R2': None}


# ── Summary printout ───────────────────────────────────────────────────────────

if __name__ == '__main__':
    X, y_reg, y_cls = build_features()

    print("=" * 55)
    print("FEATURE MATRIX")
    print("=" * 55)
    print(f"Shape          : {X.shape}  ({X.shape[0]} days x {X.shape[1]} features)")
    print(f"Date range     : {X.index[0].date()}  to  {X.index[-1].date()}")
    print(f"\nFeature columns: {list(X.columns)}")
    print(f"\nFirst 3 rows:\n{X.head(3).to_string()}")

    print("\n" + "=" * 55)
    print("TARGET VECTORS")
    print("=" * 55)
    print(f"y_reg (log return) — mean: {y_reg.mean():.5f}, std: {y_reg.std():.5f}")
    print(f"y_cls (direction)  — up days: {y_cls.sum()} / {len(y_cls)} "
          f"({y_cls.mean()*100:.1f}%)")

    print("\n" + "=" * 55)
    print("TRAIN / TEST SPLIT  (80 / 20, time-ordered)")
    print("=" * 55)
    X_train, X_test, y_reg_train, y_reg_test, y_cls_train, y_cls_test = \
        get_train_test_split(X, y_reg, y_cls)

    print(f"Train : {len(X_train)} days  ({X_train.index[0].date()} to {X_train.index[-1].date()})")
    print(f"Test  : {len(X_test)} days  ({X_test.index[0].date()} to {X_test.index[-1].date()})")

    print("\n" + "=" * 55)
    print("PERSISTENCE BASELINE")
    print("=" * 55)
    baseline = persistence_baseline(y_reg_train, y_reg_test)
    print(f"  RMSE : {baseline['RMSE']:.6f}")
    print(f"  MAE  : {baseline['MAE']:.6f}")
    print("  (Every model must beat these numbers to be useful)")

    print("\n" + "=" * 55)
    print("TIMESERIES CROSS-VALIDATION  (5 folds)")
    print("=" * 55)
    tscv = get_tscv(n_splits=5)
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X_train), 1):
        t0 = X_train.index[train_idx[0]].date()
        t1 = X_train.index[train_idx[-1]].date()
        v0 = X_train.index[val_idx[0]].date()
        v1 = X_train.index[val_idx[-1]].date()
        print(f"  Fold {fold}: train [{t0} -> {t1}]  |  val [{v0} -> {v1}]")
