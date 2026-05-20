"""
models_rf.py
============
Phase 5: Random Forest for both regression (next-day log return)
         and classification (next-day direction up/down).

HOW RANDOM FOREST WORKS:
  1. Draw B bootstrap samples from training data (with replacement)
  2. For each sample, grow a decision tree:
       At every split, consider only sqrt(n_features) random features
       Choose the feature+threshold that minimises MSE (regression)
       or Gini impurity (classification)
       Grow until max_depth or min_samples_leaf is reached
  3. Regression prediction  = average of all B tree predictions
     Classification prediction = majority vote across B trees

  The two sources of randomness (bootstrap + feature subsets) decorrelate
  the trees so their errors don't all point in the same direction.
  Averaging decorrelated errors reduces variance without increasing bias.

  Course link: Week 21 (Bagging), Week 22 (Random Forest).
"""

import sys
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import GridSearchCV
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix
)

sys.path.insert(0, os.path.dirname(__file__))
from features import build_features, get_train_test_split, get_tscv, persistence_baseline
from models_logistic import evaluate_classifier, print_confusion_matrix


def evaluate_regression(model_name: str,
                         y_true: pd.Series,
                         y_pred: np.ndarray) -> dict:
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    mae  = mean_absolute_error(y_true, y_pred)
    r2   = r2_score(y_true, y_pred)
    return {'model': model_name, 'RMSE': rmse, 'MAE': mae, 'R2': r2}


def tune_random_forest(estimator_class,
                       param_grid: dict,
                       scoring: str,
                       X_train, y_train,
                       tscv,
                       label: str):
    """
    Wraps GridSearchCV for Random Forest — no scaler needed.

    WHY NO SCALER FOR RANDOM FOREST:
      Decision trees split on thresholds, not distances or dot products.
      Whether RSI is 65 or 0.65 (scaled), the split question
      "RSI > 63?" captures the same information. Scale is irrelevant.
      This is a key difference from Linear Regression and SVM.

    n_jobs=-1: use all CPU cores in parallel — each tree is independent
               so they can be built simultaneously.

    Course link: Week 22 (Random Forest hyperparameter tuning).
    """
    search = GridSearchCV(
        estimator_class(n_jobs=-1, random_state=42),
        param_grid=param_grid,
        cv=tscv,
        scoring=scoring,
        n_jobs=-1,
        verbose=0,
    )
    search.fit(X_train, y_train)

    print(f"\n  [{label}] Best params: {search.best_params_}")
    print(f"  [{label}] Best CV score: {search.best_score_:.6f}")
    return search.best_estimator_


def print_feature_importance(model, feature_names: list, top_n: int = 10) -> pd.DataFrame:
    """
    Displays feature importances from the fitted Random Forest.

    HOW FEATURE IMPORTANCE IS COMPUTED (Mean Decrease Impurity):
      For each feature f:
        For each tree t:
          For each node n in t that splits on f:
            importance += (samples_at_n / total_samples) * impurity_reduction_at_n
        Average across all trees
      Normalise so all importances sum to 1.

    High importance = this feature was used often, near the root, on large
    portions of the data. It explains a lot of the variance in the target.

    Low importance = rarely used, deep in trees, on small subsets.
    Could be a candidate to drop for a leaner model.

    Course link: Week 22 (Random Forest feature importance, Week 3 feature selection).
    """
    importance_df = pd.DataFrame({
        'feature'   : feature_names,
        'importance': model.feature_importances_,
    }).sort_values('importance', ascending=False).head(top_n)

    print("\n  Feature Importances (Mean Decrease Impurity):")
    print(f"  {'Feature':<12}  {'Importance':>10}  Bar")
    for _, row in importance_df.iterrows():
        bar = '#' * int(row['importance'] * 300)
        print(f"  {row['feature']:<12}  {row['importance']:>10.4f}  {bar}")

    return importance_df


def run_all(save_results: bool = True):
    """
    Runs Random Forest for both regression and classification,
    then produces a combined metrics summary.
    """
    print("Loading features...")
    X, y_reg, y_cls = build_features()
    X_train, X_test, y_reg_train, y_reg_test, y_cls_train, y_cls_test = \
        get_train_test_split(X, y_reg, y_cls)
    tscv = get_tscv(n_splits=5)

    # Hyperparameter grid
    # n_estimators : number of trees — more = better but slower
    # max_depth    : max depth per tree — None = fully grown (risk: overfit)
    # max_features : features at each split — sqrt is standard for classification
    param_grid = {
        'n_estimators': [100, 200],
        'max_depth'   : [5, 10, None],
        'max_features': ['sqrt', 'log2'],
    }

    reg_results = []
    cls_results = []

    # ── Regression ─────────────────────────────────────────────────────────────
    print("\n" + "=" * 55)
    print("RANDOM FOREST REGRESSOR")
    print("=" * 55)
    print("  Tuning across 5 TimeSeriesSplit folds...")
    print("  Grid: n_estimators x max_depth x max_features = 12 combinations")

    rf_reg = tune_random_forest(
        RandomForestRegressor,
        param_grid,
        scoring='neg_mean_squared_error',
        X_train=X_train, y_train=y_reg_train,
        tscv=tscv,
        label='Regressor',
    )
    y_reg_pred = rf_reg.predict(X_test)
    reg_result = evaluate_regression('Random Forest', y_reg_test, y_reg_pred)
    reg_results.append(reg_result)

    print(f"\n  RMSE={reg_result['RMSE']:.6f}  "
          f"MAE={reg_result['MAE']:.6f}  "
          f"R2={reg_result['R2']:.6f}")

    print_feature_importance(rf_reg, list(X_train.columns))

    # ── Classification ─────────────────────────────────────────────────────────
    print("\n" + "=" * 55)
    print("RANDOM FOREST CLASSIFIER")
    print("=" * 55)
    print("  Tuning across 5 TimeSeriesSplit folds...")

    rf_cls = tune_random_forest(
        RandomForestClassifier,
        param_grid,
        scoring='accuracy',
        X_train=X_train, y_train=y_cls_train,
        tscv=tscv,
        label='Classifier',
    )
    y_cls_pred = rf_cls.predict(X_test)
    cls_result = evaluate_classifier('Random Forest', y_cls_test, y_cls_pred)
    cls_results.append(cls_result)

    print_confusion_matrix(y_cls_test, y_cls_pred, 'Random Forest')
    print(f"\n  Accuracy={cls_result['Accuracy']:.4f}  "
          f"Precision={cls_result['Precision']:.4f}  "
          f"Recall={cls_result['Recall']:.4f}  "
          f"F1={cls_result['F1']:.4f}")

    # ── Comparison vs previous phases ─────────────────────────────────────────
    baseline_reg = persistence_baseline(y_reg_train, y_reg_test)

    print("\n" + "=" * 60)
    print("REGRESSION COMPARISON (lower RMSE = better)")
    print("=" * 60)
    reg_compare = pd.DataFrame([
        baseline_reg,
        {'model': 'Linear Regression', 'RMSE': 0.025366, 'MAE': 0.018340, 'R2': -0.037679},
        {'model': 'Ridge',             'RMSE': 0.025091, 'MAE': 0.018049, 'R2': -0.015258},
        {'model': 'Lasso',             'RMSE': 0.024903, 'MAE': 0.017787, 'R2': -0.000100},
        reg_result,
    ])
    print(reg_compare.to_string(index=False))

    print("\n" + "=" * 60)
    print("CLASSIFICATION COMPARISON (higher Accuracy = better)")
    print("=" * 60)
    cls_compare = pd.DataFrame([
        {'model': 'Majority Baseline',  'Accuracy': 0.5117, 'Precision': 0.5117,
         'Recall': 1.0000, 'F1': 0.6770},
        {'model': 'Logistic Regression','Accuracy': 0.5240, 'Precision': 0.5541,
         'Recall': 0.3573, 'F1': 0.4344},
        cls_result,
    ])
    print(cls_compare.to_string(index=False))

    # ── Save ───────────────────────────────────────────────────────────────────
    if save_results:
        results_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'results')
        os.makedirs(results_dir, exist_ok=True)

        pred_df = pd.DataFrame({
            'date'          : X_test.index,
            'actual_return' : y_reg_test.values,
            'rf_reg_pred'   : y_reg_pred,
            'actual_dir'    : y_cls_test.values,
            'rf_cls_pred'   : y_cls_pred,
        })
        pred_df.to_csv(os.path.join(results_dir, 'rf_preds.csv'), index=False)

        fi_df = pd.DataFrame({
            'feature'   : X_train.columns,
            'importance': rf_reg.feature_importances_,
        }).sort_values('importance', ascending=False)
        fi_df.to_csv(os.path.join(results_dir, 'feature_importance.csv'), index=False)

        reg_compare.to_csv(os.path.join(results_dir, 'regression_metrics.csv'), index=False)
        cls_compare.to_csv(os.path.join(results_dir, 'classification_metrics.csv'), index=False)

        print("\nAll results saved to data/results/")

    return reg_result, cls_result, rf_reg, rf_cls


if __name__ == '__main__':
    run_all()
