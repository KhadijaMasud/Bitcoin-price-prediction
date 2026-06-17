import sys
import os
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report
)

sys.path.insert(0, os.path.dirname(__file__))
from features import build_features, get_train_test_split, get_tscv


def evaluate_classifier(model_name: str,
                         y_true: pd.Series,
                         y_pred: np.ndarray) -> dict:
    return {
        'model'    : model_name,
        'Accuracy' : accuracy_score(y_true, y_pred),
        'Precision': precision_score(y_true, y_pred, zero_division=0),
        'Recall'   : recall_score(y_true, y_pred, zero_division=0),
        'F1'       : f1_score(y_true, y_pred, zero_division=0),
    }


def majority_class_baseline(y_cls_train: pd.Series,
                             y_cls_test: pd.Series) -> dict:
    majority = int(y_cls_train.mode()[0])
    y_pred   = np.full(len(y_cls_test), majority)
    result   = evaluate_classifier('Majority Baseline', y_cls_test, y_pred)
    print(f"\n  Majority class in training: {'UP' if majority == 1 else 'DOWN'}")
    return result


def print_confusion_matrix(y_true: pd.Series,
                            y_pred: np.ndarray,
                            model_name: str) -> None:
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    print(f"\n  Confusion Matrix — {model_name}")
    print(f"  {'':20}  Pred DOWN   Pred UP")
    print(f"  {'Actual DOWN':20}  {tn:<10}  {fp}")
    print(f"  {'Actual UP':20}  {fn:<10}  {tp}")
    print(f"\n  True Negatives (TN): {tn}   False Positives (FP): {fp}")
    print(f"  False Negatives (FN): {fn}  True Positives  (TP): {tp}")


def run_logistic_regression(X_train, y_cls_train,
                             X_test, y_cls_test,
                             tscv) -> tuple[dict, np.ndarray]:
    """
    Trains Logistic Regression with L2 regularisation, tuned via
    TimeSeriesSplit GridSearchCV.

    HOW C IS TUNED:
      C = 1 / lambda (scikit-learn convention — inverse of penalty strength)
      Large C -> weak regularisation -> model fits training data closely
                 (risk: overfits, poor generalisation to test set)
      Small C -> strong regularisation -> weights shrunk toward zero
                 (risk: underfits, misses real signal)
      We let cross-validation find the C that generalises best across
      different time periods in the training data.

    solver='lbfgs': Limited-memory BFGS optimiser — efficient quasi-Newton
      method that approximates the Hessian. Standard choice for logistic
      regression with L2 penalty on medium-sized datasets.

    max_iter=1000: Gradient descent steps. 1000 is enough for convergence
      on our 3,588-sample training set.

    Course link: Week 9-10 (Logistic Regression, regularised loss function).
    """
    pipe = Pipeline([
        ('scaler', StandardScaler()),
        ('model',  LogisticRegression(solver='lbfgs', max_iter=1000)),
    ])

    param_grid = {'model__C': [0.001, 0.01, 0.1, 1.0, 10.0, 100.0]}

    search = GridSearchCV(
        pipe,
        param_grid=param_grid,
        cv=tscv,
        scoring='accuracy',
        n_jobs=-1,
    )
    search.fit(X_train, y_cls_train)

    best_C    = search.best_params_['model__C']
    best_pipe = search.best_estimator_
    y_pred    = best_pipe.predict(X_test)

    print(f"\n  Best C: {best_C}  (lambda = {1/best_C:.4f})")

    # Show what the model learned — coefficient per feature
    coef = best_pipe.named_steps['model'].coef_[0]
    coef_df = pd.DataFrame({
        'feature': X_train.columns,
        'weight' : coef
    }).sort_values('weight', key=abs, ascending=False)

    print("\n  Learned weights for direction prediction:")
    for _, row in coef_df.iterrows():
        direction = "-> UP" if row['weight'] > 0 else "-> DOWN"
        print(f"    {row['feature']:<10}  {row['weight']:+.4f}  {direction}")

    return evaluate_classifier('Logistic Regression', y_cls_test, y_pred), y_pred, best_pipe


def run_all(save_results: bool = True) -> pd.DataFrame:
    """
    Runs full Phase 4 pipeline and returns classification metrics table.
    """
    print("Loading features...")
    X, y_reg, y_cls = build_features()
    X_train, X_test, _, _, y_cls_train, y_cls_test = \
        get_train_test_split(X, y_reg, y_cls)
    tscv = get_tscv(n_splits=5)

    results = []

    # Majority class baseline
    print("\n" + "=" * 50)
    print("MAJORITY CLASS BASELINE")
    print("=" * 50)
    baseline = majority_class_baseline(y_cls_train, y_cls_test)
    results.append(baseline)
    print(f"  Accuracy={baseline['Accuracy']:.4f}  Precision={baseline['Precision']:.4f}"
          f"  Recall={baseline['Recall']:.4f}  F1={baseline['F1']:.4f}")

    # Logistic Regression
    print("\n" + "=" * 50)
    print("LOGISTIC REGRESSION")
    print("=" * 50)
    print("  Tuning C across 5 TimeSeriesSplit folds...")
    lr_result, lr_pred, lr_pipe = run_logistic_regression(
        X_train, y_cls_train, X_test, y_cls_test, tscv
    )
    results.append(lr_result)
    print_confusion_matrix(y_cls_test, lr_pred, 'Logistic Regression')

    print(f"\n  Accuracy={lr_result['Accuracy']:.4f}  Precision={lr_result['Precision']:.4f}"
          f"  Recall={lr_result['Recall']:.4f}  F1={lr_result['F1']:.4f}")

    # Full sklearn report
    print("\n  Full classification report:")
    print(classification_report(y_cls_test, lr_pred,
                                 target_names=['DOWN', 'UP'], digits=4))

    # Summary
    df_results = pd.DataFrame(results)
    print("=" * 60)
    print("PHASE 4 SUMMARY — vs majority class baseline")
    print("=" * 60)
    print(df_results.to_string(index=False))

    if save_results:
        os.makedirs(os.path.join(os.path.dirname(__file__), '..', 'data', 'results'), exist_ok=True)
        pred_df = pd.DataFrame({
            'date'    : X_test.index,
            'actual'  : y_cls_test.values,
            'lr_pred' : lr_pred,
        })
        pred_df.to_csv(
            os.path.join(os.path.dirname(__file__), '..', 'data', 'results', 'logistic_preds.csv'),
            index=False
        )
        df_results.to_csv(
            os.path.join(os.path.dirname(__file__), '..', 'data', 'results', 'classification_metrics.csv'),
            index=False
        )
        print("\nResults saved to data/results/")

    return df_results


if __name__ == '__main__':
    run_all()
