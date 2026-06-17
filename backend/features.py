import numpy as np
import pandas as pd
from sklearn.model_selection import TimeSeriesSplit
from preprocess import get_daily_data


def compute_ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def compute_macd(close: pd.Series) -> tuple[pd.Series, pd.Series]:
    ema12  = compute_ema(close, 12)
    ema26  = compute_ema(close, 26)
    macd   = ema12 - ema26
    signal = compute_ema(macd, 9)
    return macd, signal


def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain  = delta.clip(lower=0)
    loss  = -delta.clip(upper=0)

    avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean()

    rs  = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def compute_momentum(close: pd.Series, period: int = 10) -> pd.Series:
    return close.diff(period)


def compute_proc(close: pd.Series, period: int = 10) -> pd.Series:
    return ((close - close.shift(period)) / close.shift(period)) * 100


def compute_stoch_k(high: pd.Series, low: pd.Series,
                    close: pd.Series, period: int = 14) -> pd.Series:
    lowest_low   = low.rolling(window=period).min()
    highest_high = high.rolling(window=period).max()
    denom = highest_high - lowest_low
    stoch_k = np.where(denom == 0, 50, (close - lowest_low) / denom * 100)
    return pd.Series(stoch_k, index=close.index)


def build_features() -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    df = get_daily_data()

    df['EMA9']    = compute_ema(df['Close'], 9)
    df['EMA21']   = compute_ema(df['Close'], 21)
    df['MACD'], df['Signal'] = compute_macd(df['Close'])
    df['RSI']     = compute_rsi(df['Close'], 14)
    df['MOM']     = compute_momentum(df['Close'], 10)
    df['PROC']    = compute_proc(df['Close'], 10)
    df['StochK']  = compute_stoch_k(df['High'], df['Low'], df['Close'], 14)

    df['y_reg'] = df['log_return'].shift(-1)
    df['y_cls'] = (df['y_reg'] > 0).astype(int)

    feature_cols = ['Close', 'Volume', 'EMA9', 'EMA21',
                    'MACD', 'Signal', 'RSI', 'MOM', 'PROC', 'StochK']

    df.dropna(subset=feature_cols + ['y_reg'], inplace=True)

    X     = df[feature_cols]
    y_reg = df['y_reg']
    y_cls = df['y_cls']

    return X, y_reg, y_cls


def get_train_test_split(X: pd.DataFrame,
                         y_reg: pd.Series,
                         y_cls: pd.Series,
                         test_ratio: float = 0.2):
    split_idx = int(len(X) * (1 - test_ratio))

    X_train, X_test     = X.iloc[:split_idx],     X.iloc[split_idx:]
    y_reg_train, y_reg_test = y_reg.iloc[:split_idx], y_reg.iloc[split_idx:]
    y_cls_train, y_cls_test = y_cls.iloc[:split_idx], y_cls.iloc[split_idx:]

    return X_train, X_test, y_reg_train, y_reg_test, y_cls_train, y_cls_test


def get_tscv(n_splits: int = 5) -> TimeSeriesSplit:
    return TimeSeriesSplit(n_splits=n_splits)


def persistence_baseline(y_reg_train: pd.Series,
                          y_reg_test: pd.Series) -> dict:
    y_pred_persist = y_reg_test.shift(1).dropna()
    y_true         = y_reg_test.iloc[1:]

    rmse = np.sqrt(np.mean((y_true - y_pred_persist) ** 2))
    mae  = np.mean(np.abs(y_true - y_pred_persist))

    return {'model': 'Persistence Baseline', 'RMSE': rmse, 'MAE': mae, 'R2': None}


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
