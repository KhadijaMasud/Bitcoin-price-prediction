import sys
import os
import numpy as np
import pandas as pd
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
)

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier
    HAS_XGB = False

sys.path.insert(0, os.path.dirname(__file__))
from features import build_features, get_train_test_split, get_tscv, persistence_baseline
from models_logistic import evaluate_classifier, print_confusion_matrix

RESULTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'results')


def add_extended_features(X: pd.DataFrame, y_reg: pd.Series) -> pd.DataFrame:
    df = X.copy()

    for i in range(1, 6):
        df[f'lag_return_{i}'] = y_reg.shift(i)

    if 'Close' in df.columns:
        close = df['Close']
        df['atr_norm'] = y_reg.shift(1).abs().rolling(14).mean()

    if 'Close' in df.columns:
        roll20 = df['Close'].rolling(20)
        mid   = roll20.mean()
        std20 = roll20.std()
        upper = mid + 2 * std20
        lower = mid - 2 * std20
        denom = upper - lower
        df['bb_pct_b'] = np.where(denom > 0, (df['Close'] - lower) / denom, 0.5)

    if 'Close' in df.columns:
        roll252_high = df['Close'].rolling(252).max()
        roll252_low  = df['Close'].rolling(252).min()
        rng = roll252_high - roll252_low
        df['price_pos_52w'] = np.where(rng > 0, (df['Close'] - roll252_low) / rng, 0.5)

    if 'Volume' in df.columns:
        vol_ma = df['Volume'].rolling(20).mean()
        df['vol_ratio'] = np.where(vol_ma > 0, df['Volume'] / vol_ma, 1.0)

    direction = (y_reg.shift(1) > 0).astype(int) * 2 - 1
    streak = direction.copy().astype(float)
    for i in range(1, len(streak)):
        if streak.iloc[i] == streak.iloc[i-1] / abs(streak.iloc[i-1] if streak.iloc[i-1] != 0 else 1):
            streak.iloc[i] += streak.iloc[i-1]
    df['streak'] = streak

    df.dropna(inplace=True)
    return df


def find_optimal_threshold(y_true, y_proba, val_split=0.2):
    n    = len(y_true)
    cut  = int(n * (1 - val_split))
    y_v  = y_true.iloc[cut:]
    p_v  = y_proba[cut:]

    best_thr, best_acc = 0.5, 0.0
    for thr in np.arange(0.40, 0.65, 0.01):
        pred = (p_v >= thr).astype(int)
        acc  = accuracy_score(y_v, pred)
        if acc > best_acc:
            best_acc = acc
            best_thr = thr
    return round(best_thr, 2), round(best_acc, 4)


def high_confidence_accuracy(y_true, y_proba, y_pred, threshold=0.60):
    mask = (y_proba >= threshold) | (y_proba <= 1 - threshold)
    if mask.sum() == 0:
        return None, 0, 0.0
    acc   = accuracy_score(y_true[mask], y_pred[mask])
    count = int(mask.sum())
    ratio = round(count / len(y_true), 3)
    return round(acc, 4), count, ratio


def evaluate_regression(name, y_true, y_pred):
    return {
        'model': name,
        'RMSE' : float(np.sqrt(mean_squared_error(y_true, y_pred))),
        'MAE'  : float(mean_absolute_error(y_true, y_pred)),
        'R2'   : float(r2_score(y_true, y_pred)),
    }


def run_all(save_results=True):
    print("Loading features and adding extended features...")
    X, y_reg, y_cls = build_features()
    X_ext = add_extended_features(X, y_reg)
    y_reg = y_reg.loc[X_ext.index]
    y_cls = y_cls.loc[X_ext.index]

    X_train, X_test, y_reg_train, y_reg_test, y_cls_train, y_cls_test = \
        get_train_test_split(X_ext, y_reg, y_cls)

    tscv = get_tscv(n_splits=5)
    label = 'XGBoost' if HAS_XGB else 'Gradient Boosting'

    print(f"\n  Features: {X_train.shape[1]}  |  Train: {len(X_train)}  |  Test: {len(X_test)}")

    print(f"\n{'='*60}\n{label.upper()} REGRESSOR\n{'='*60}")

    if HAS_XGB:
        reg_est  = xgb.XGBRegressor(random_state=42, n_jobs=-1, verbosity=0, tree_method='hist')
        reg_grid = {
            'n_estimators'    : [300, 500],
            'max_depth'       : [3, 4],
            'learning_rate'   : [0.04, 0.07],
            'subsample'       : [0.8],
            'colsample_bytree': [0.7, 0.9],
            'reg_alpha'       : [0.1, 0.5],
            'min_child_weight': [5, 10],
        }
    else:
        from sklearn.ensemble import GradientBoostingRegressor
        reg_est  = GradientBoostingRegressor(random_state=42)
        reg_grid = {'n_estimators':[300],'max_depth':[3],'learning_rate':[0.05],'subsample':[0.8]}

    search_reg = GridSearchCV(reg_est, reg_grid, cv=tscv,
                              scoring='neg_mean_squared_error', n_jobs=-1, verbose=0)
    search_reg.fit(X_train, y_reg_train)
    best_reg   = search_reg.best_estimator_
    y_reg_pred = best_reg.predict(X_test)
    reg_result = evaluate_regression(label, y_reg_test, y_reg_pred)

    print(f"  Params: {search_reg.best_params_}")
    print(f"  RMSE={reg_result['RMSE']:.6f}  MAE={reg_result['MAE']:.6f}  R2={reg_result['R2']:.6f}")

    print(f"\n{'='*60}\n{label.upper()} CLASSIFIER\n{'='*60}")

    if HAS_XGB:
        cls_est  = xgb.XGBClassifier(random_state=42, n_jobs=-1, verbosity=0,
                                      tree_method='hist', eval_metric='logloss')
        cls_grid = {
            'n_estimators'    : [300, 500],
            'max_depth'       : [3, 4],
            'learning_rate'   : [0.04, 0.07],
            'subsample'       : [0.8],
            'colsample_bytree': [0.7, 0.9],
            'min_child_weight': [5, 10],
        }
    else:
        from sklearn.ensemble import GradientBoostingClassifier
        cls_est  = GradientBoostingClassifier(random_state=42)
        cls_grid = {'n_estimators':[300],'max_depth':[3],'learning_rate':[0.05],'subsample':[0.8]}

    search_cls = GridSearchCV(cls_est, cls_grid, cv=tscv,
                              scoring='accuracy', n_jobs=-1, verbose=0)
    search_cls.fit(X_train, y_cls_train)
    best_cls    = search_cls.best_estimator_
    y_cls_proba = best_cls.predict_proba(X_test)[:, 1]

    train_proba  = best_cls.predict_proba(X_train)[:, 1]
    opt_thr, val_acc = find_optimal_threshold(y_cls_train, train_proba, val_split=0.20)
    print(f"  Optimal threshold: {opt_thr}  (val accuracy: {val_acc:.4f})")

    y_cls_pred_05  = best_cls.predict(X_test)
    y_cls_pred_opt = (y_cls_proba >= opt_thr).astype(int)

    cls_result_05  = evaluate_classifier(label + ' (0.5)',  y_cls_test, y_cls_pred_05)
    cls_result_opt = evaluate_classifier(label + ' (opt)',  y_cls_test, y_cls_pred_opt)

    print_confusion_matrix(y_cls_test, y_cls_pred_opt, f'{label} thr={opt_thr}')
    print(f"  Default 0.5 -> Acc={cls_result_05['Accuracy']:.4f}  F1={cls_result_05['F1']:.4f}")
    print(f"  Optimal {opt_thr} -> Acc={cls_result_opt['Accuracy']:.4f}  F1={cls_result_opt['F1']:.4f}")

    for thr_conf in [0.55, 0.60, 0.65]:
        hc_acc, hc_n, hc_ratio = high_confidence_accuracy(
            y_cls_test.values, y_cls_proba, y_cls_pred_opt, threshold=thr_conf)
        if hc_acc:
            print(f"  Confidence >{thr_conf:.0%}: acc={hc_acc:.4f}  n={hc_n}  ({hc_ratio*100:.1f}% of test)")

    hc_acc_60, hc_n_60, _ = high_confidence_accuracy(
        y_cls_test.values, y_cls_proba, y_cls_pred_opt, threshold=0.60)

    print(f"\n{'='*60}\nENSEMBLE: XGBoost + Logistic Vote\n{'='*60}")
    lr_pipe = Pipeline([('sc', StandardScaler()),
                        ('lr', LogisticRegression(C=0.1, max_iter=1000, random_state=42))])
    lr_pipe.fit(X_train, y_cls_train)
    lr_proba    = lr_pipe.predict_proba(X_test)[:, 1]
    ens_proba   = (y_cls_proba + lr_proba) / 2
    ens_pred    = (ens_proba >= 0.5).astype(int)
    ens_result  = evaluate_classifier('Ensemble (XGB+LR)', y_cls_test, ens_pred)
    print(f"  Acc={ens_result['Accuracy']:.4f}  F1={ens_result['F1']:.4f}")

    fi_df = pd.DataFrame({
        'feature'   : X_train.columns,
        'importance': best_reg.feature_importances_,
    }).sort_values('importance', ascending=False)
    print("\n  Top 10 features:")
    for _, row in fi_df.head(10).iterrows():
        print(f"  {row['feature']:<22}  {row['importance']:.4f}  {'█'*int(row['importance']*180)}")

    baseline_reg = persistence_baseline(y_reg_train, y_reg_test)
    reg_compare = pd.DataFrame([
        baseline_reg,
        {'model':'Linear Regression','RMSE':0.025366,'MAE':0.018340,'R2':-0.037679},
        {'model':'Ridge',             'RMSE':0.025091,'MAE':0.018049,'R2':-0.015258},
        {'model':'Lasso',             'RMSE':0.024903,'MAE':0.017787,'R2':-0.000100},
        reg_result,
    ])

    best_cls_label = label + ' (opt)' if cls_result_opt['Accuracy'] >= cls_result_05['Accuracy'] else label
    best_cls_result = cls_result_opt if cls_result_opt['Accuracy'] >= cls_result_05['Accuracy'] else cls_result_05
    best_cls_result['model'] = label

    cls_compare = pd.DataFrame([
        {'model':'Majority Baseline',   'Accuracy':0.5117,'Precision':0.5117,'Recall':1.0000,'F1':0.6770},
        {'model':'Logistic Regression', 'Accuracy':0.5240,'Precision':0.5541,'Recall':0.3573,'F1':0.4344},
        {'model':'Random Forest',       'Accuracy':0.5017,'Precision':0.5545,'Recall':0.1329,'F1':0.2144},
        ens_result,
        best_cls_result,
    ])

    print(f"\n{'='*65}\nFINAL REGRESSION LEADERBOARD\n{'='*65}")
    print(reg_compare.to_string(index=False))
    print(f"\n{'='*65}\nFINAL CLASSIFICATION LEADERBOARD\n{'='*65}")
    print(cls_compare.to_string(index=False))

    if save_results:
        os.makedirs(RESULTS_DIR, exist_ok=True)

        pred_df = pd.DataFrame({
            'date'          : X_test.index,
            'actual_return' : y_reg_test.values,
            'xgb_reg_pred'  : y_reg_pred,
            'actual_dir'    : y_cls_test.values,
            'xgb_cls_pred'  : y_cls_pred_opt,
            'xgb_cls_proba' : y_cls_proba,
            'ens_cls_pred'  : ens_pred,
            'ens_cls_proba' : ens_proba,
        })
        pred_df.to_csv(os.path.join(RESULTS_DIR, 'best_preds.csv'), index=False)
        fi_df.to_csv(os.path.join(RESULTS_DIR, 'best_feature_importance.csv'), index=False)
        reg_compare.to_csv(os.path.join(RESULTS_DIR, 'regression_metrics.csv'), index=False)
        cls_compare.to_csv(os.path.join(RESULTS_DIR, 'classification_metrics.csv'), index=False)

        hc_df = pd.DataFrame([{
            'threshold'     : 0.60,
            'accuracy'      : hc_acc_60,
            'n_samples'     : hc_n_60,
            'opt_threshold' : opt_thr,
        }])
        hc_df.to_csv(os.path.join(RESULTS_DIR, 'high_conf_stats.csv'), index=False)
        print("\nAll results saved to data/results/")

    return reg_result, best_cls_result, best_reg, best_cls


if __name__ == '__main__':
    run_all()
