import os
import pickle
import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller

RAW_PATH  = os.path.join(os.path.dirname(__file__), '..', 'data', 'btcusd_1-min_data.csv')
CACHE_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'daily.pkl')


def load_and_aggregate() -> pd.DataFrame:
    print("Loading raw 1-minute data (this takes ~15 seconds)...")
    df = pd.read_csv(RAW_PATH)

    df['Date'] = pd.to_datetime(df['Timestamp'], unit='s').dt.normalize()

    daily = (
        df.groupby('Date')
        .agg(
            Open=('Open', 'first'),
            High=('High', 'max'),
            Low=('Low', 'min'),
            Close=('Close', 'last'),
            Volume=('Volume', 'sum'),
        )
        .reset_index()
    )

    daily = daily[daily['Volume'] > 0].copy()

    daily.set_index('Date', inplace=True)
    daily.sort_index(inplace=True)

    daily = daily.iloc[-4500:]

    print(f"Daily records after aggregation: {len(daily)}")
    print(f"Date range: {daily.index[0].date()} to {daily.index[-1].date()}")
    return daily


def run_adf_test(series: pd.Series, name: str) -> dict:
    result = adfuller(series.dropna(), autolag='AIC')
    is_stationary = result[1] <= 0.05
    output = {
        'series': name,
        'adf_statistic': round(result[0], 4),
        'p_value': round(result[1], 6),
        'stationary': is_stationary,
        'conclusion': 'STATIONARY' if is_stationary else 'NON-STATIONARY (transform needed)',
    }
    print(f"  [{name}] ADF={result[0]:.4f}, p={result[1]:.6f} -> {output['conclusion']}")
    return output


def add_log_return(daily: pd.DataFrame) -> pd.DataFrame:
    daily['log_return'] = np.log(daily['Close']).diff()
    return daily


def get_daily_data(force_rebuild: bool = False) -> pd.DataFrame:
    if not force_rebuild and os.path.exists(CACHE_PATH):
        print("Loading cached daily data...")
        with open(CACHE_PATH, 'rb') as f:
            return pickle.load(f)

    daily = load_and_aggregate()

    print("\nRunning ADF stationarity tests...")
    adf_results = []
    adf_results.append(run_adf_test(daily['Close'], 'Close (raw price)'))

    log_close = np.log(daily['Close'])
    adf_results.append(run_adf_test(log_close, 'log(Close)'))

    log_return = log_close.diff()
    adf_results.append(run_adf_test(log_return.dropna(), 'log_return (1st difference)'))

    print("\nStationarity Summary:")
    print("-" * 60)
    for r in adf_results:
        print(f"  {r['series']:<35} p={r['p_value']:<10} {r['conclusion']}")

    daily = add_log_return(daily)

    daily.dropna(subset=['log_return'], inplace=True)

    with open(CACHE_PATH, 'wb') as f:
        pickle.dump(daily, f)
    print(f"\nCached to {CACHE_PATH}")

    return daily


if __name__ == '__main__':
    df = get_daily_data(force_rebuild=True)

    print("\n--- Final Dataset Preview ---")
    print(df.head(5).to_string())
    print(f"\nShape: {df.shape}")
    print(f"\nColumn types:\n{df.dtypes}")
    print(f"\nNull values:\n{df.isnull().sum()}")
    print(f"\nClose price stats:\n{df['Close'].describe()}")
    print(f"\nLog return stats:\n{df['log_return'].describe()}")
