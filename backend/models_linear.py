"""
models_linear.py
================
Phase 3: Linear Regression, Ridge, and Lasso on next-day BTC log return.

HOW THE PIPELINE WORKS:
  1. StandardScaler  — centres each feature to mean=0, std=1
                       Required because Close (~$40k) and PROC (~2.0) live on
                       completely different scales. Without scaling, the solver
                       assigns tiny weights to large-scale features regardless
                       of their actual importance.

  2. Model           — fits weights on scaled training data

  3. GridSearchCV    — wraps the pipeline, tests each lambda across
                       TimeSeriesSplit folds, picks the best one

  All of this is inside a sklearn Pipeline so the scaler is NEVER fit on
  test data — it sees only training statistics. This prevents a subtle form
  of data leakage where test-set scale information bleeds into the scaler.
"""

import sys
import os
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.model_selection import GridSearchCV
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

sys.path.insert(0, os.path.dirname(__file__))
from features import build_features, get_train_test_split, get_tscv, persistence_baseline


def evaluate(model_name: str, y_true: pd.Series, y_pred: np.ndarray) -> dict:
    """
    Computes RMSE, MAE, R² for a regression model.

    RMSE: penalises large errors more than small ones (squared).
          Same unit as the target (log return). Lower is better.
    MAE:  average absolute error. More robust to outliers than RMSE.
    R²:   proportion of variance explained. 1.0 = perfect, 0.0 = predicts mean.
          Negative R² means the model is worse than always predicting the mean.

    Course link: Module 7 evaluation metrics (Week 4-5 regression).
    """
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae  = mean_absolute_error(y_true, y_pred)
    r2   = r2_score(y_true, y_pred)
    return {'model': model_name, 'RMSE': rmse, 'MAE': mae, 'R2': r2}


def train_linear_regression(X_train, y_train, X_test, y_test) -> tuple[dict, np.ndarray]:
    """
    Ordinary Least Squares Linear Regression.

    HOW:
      Minimises ||Xw - y||² analytically via the Normal Equation.
      No hyperparameters — just fit and predict.
      Serves as the interpretable baseline: if Ridge/Lasso don't beat it,
      regularisation is hurting more than it helps.

    Course link: Week 4 (Linear Regression, Least Squares loss).
    """
    pipe = Pipeline([
        ('scaler', StandardScaler()),
        ('model',  LinearRegression()),
    ])
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)

    # Extract and display coefficients (what the model actually learned)
    coef = pipe.named_steps['model'].coef_
    coef_df = pd.DataFrame({
        'feature': X_train.columns,
        'weight' : coef
    }).sort_values('weight', key=abs, ascending=False)

    print("\n  Learned weights (sorted by magnitude):")
    for _, row in coef_df.iterrows():
        bar = '#' * int(abs(row['weight']) * 300)
        print(f"    {row['feature']:<10} {row['weight']:+.6f}  {bar}")

    return evaluate('Linear Regression', y_test, y_pred), y_pred


def tune_and_train(model_name: str, model_class, param_grid: dict,
                   X_train, y_train, X_test, y_test,
                   tscv) -> tuple[dict, np.ndarray, object]:
    """
    Builds a scaled pipeline, runs GridSearchCV over lambda values
    using TimeSeriesSplit, refits on full training set with best lambda,
    then evaluates on the held-out test set.

    HOW GridSearchCV works:
      For each lambda in param_grid:
        For each fold in TimeSeriesSplit:
          Fit pipeline on fold's train portion
          Score on fold's val portion  (negative MSE → higher = better)
      Average scores across folds → pick lambda with highest average
      Refit on entire X_train with that lambda
      We then manually evaluate on X_test (GridSearchCV never sees test data)

    Course link: Week 11 (Cross Validation, K-fold CV) applied correctly
                 for time series via TimeSeriesSplit.
    """
    pipe = Pipeline([
        ('scaler', StandardScaler()),
        ('model',  model_class()),
    ])

    # Prefix param names with 'model__' to target the model step inside the pipeline
    prefixed = {f'model__{k}': v for k, v in param_grid.items()}

    search = GridSearchCV(
        pipe,
        param_grid=prefixed,
        cv=tscv,
        scoring='neg_mean_squared_error',
        n_jobs=-1,
        verbose=0,
    )
    search.fit(X_train, y_train)

    best_lambda = search.best_params_
    best_pipe   = search.best_estimator_
    y_pred      = best_pipe.predict(X_test)

    print(f"\n  Best params: {best_lambda}")

    return evaluate(model_name, y_test, y_pred), y_pred, best_pipe


def print_lasso_selection(pipe, feature_names):
    """
    Shows which features Lasso kept (non-zero weight) vs eliminated (zero weight).

    HOW LASSO FEATURE SELECTION WORKS:
      The L1 penalty creates a diamond-shaped constraint region in weight space.
      The optimal solution often lies at a corner of this diamond where some
      weights are exactly 0. Features with zero weights are deemed non-predictive.
      This is automatic feature selection — no manual threshold needed.

    Course link: Week 5 (Lasso, L1 regularisation).
    """
    coef = pipe.named_steps['model'].coef_
    kept     = [(f, c) for f, c in zip(feature_names, coef) if c != 0]
    dropped  = [(f, c) for f, c in zip(feature_names, coef) if c == 0]

    print(f"\n  Lasso feature selection:")
    print(f"  Kept    ({len(kept)})  : {[f for f, _ in kept]}")
    print(f"  Zeroed  ({len(dropped)}): {[f for f, _ in dropped]}")
    for name, w in sorted(kept, key=lambda x: abs(x[1]), reverse=True):
        print(f"    {name:<10} weight = {w:+.6f}")


def run_all(save_results: bool = True) -> pd.DataFrame:
    """
    Runs the full linear models phase end to end.
    Returns a DataFrame of metrics for all models + baseline.
    """
    print("Loading features...")
    X, y_reg, y_cls = build_features()
    X_train, X_test, y_reg_train, y_reg_test, _, _ = get_train_test_split(X, y_reg, y_cls)
    tscv = get_tscv(n_splits=5)

    lambda_grid = {'alpha': [0.0001, 0.001, 0.01, 0.1, 1.0, 10.0]}

    results = []

    # Persistence baseline
    baseline = persistence_baseline(y_reg_train, y_reg_test)
    results.append(baseline)
    print(f"\nPersistence Baseline -> RMSE={baseline['RMSE']:.6f}  MAE={baseline['MAE']:.6f}")

    # Linear Regression
    print("\n" + "=" * 50)
    print("LINEAR REGRESSION")
    print("=" * 50)
    lr_result, lr_pred = train_linear_regression(X_train, y_reg_train, X_test, y_reg_test)
    results.append(lr_result)
    print(f"\n  RMSE={lr_result['RMSE']:.6f}  MAE={lr_result['MAE']:.6f}  R2={lr_result['R2']:.6f}")

    # Ridge
    print("\n" + "=" * 50)
    print("RIDGE REGRESSION  (L2 regularisation)")
    print("=" * 50)
    print("  Searching lambda grid across 5 TimeSeriesSplit folds...")
    ridge_result, ridge_pred, ridge_pipe = tune_and_train(
        'Ridge', Ridge, lambda_grid, X_train, y_reg_train, X_test, y_reg_test, tscv
    )
    results.append(ridge_result)
    print(f"\n  RMSE={ridge_result['RMSE']:.6f}  MAE={ridge_result['MAE']:.6f}  R2={ridge_result['R2']:.6f}")

    # Lasso
    print("\n" + "=" * 50)
    print("LASSO REGRESSION  (L1 regularisation + feature selection)")
    print("=" * 50)
    print("  Searching lambda grid across 5 TimeSeriesSplit folds...")
    lasso_result, lasso_pred, lasso_pipe = tune_and_train(
        'Lasso', Lasso, lambda_grid, X_train, y_reg_train, X_test, y_reg_test, tscv
    )
    results.append(lasso_result)
    print_lasso_selection(lasso_pipe, X_train.columns)
    print(f"\n  RMSE={lasso_result['RMSE']:.6f}  MAE={lasso_result['MAE']:.6f}  R2={lasso_result['R2']:.6f}")

    # Summary table
    df_results = pd.DataFrame(results)
    print("\n" + "=" * 60)
    print("PHASE 3 SUMMARY — all models vs persistence baseline")
    print("=" * 60)
    print(df_results.to_string(index=False))

    # Save predictions for dashboard use
    if save_results:
        os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'data', 'results'), exist_ok=True)
        pred_df = pd.DataFrame({
            'date'            : X_test.index,
            'actual'          : y_reg_test.values,
            'linear_pred'     : lr_pred,
            'ridge_pred'      : ridge_pred,
            'lasso_pred'      : lasso_pred,
        })
        pred_df.to_csv(
            os.path.join(os.path.dirname(__file__), '..', 'data', 'results', 'linear_preds.csv'),
            index=False
        )
        df_results.to_csv(
            os.path.join(os.path.dirname(__file__), '..', 'data', 'results', 'linear_metrics.csv'),
            index=False
        )
        print("\nPredictions and metrics saved to data/results/")

    return df_results


if __name__ == '__main__':
    run_all()
