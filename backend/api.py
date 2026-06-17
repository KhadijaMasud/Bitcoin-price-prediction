import os, sys, pickle
import numpy as np
import pandas as pd
from flask import Flask, jsonify
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(__file__))
app = Flask(__name__)
CORS(app)

RESULTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'results')
DATA_DIR    = os.path.join(os.path.dirname(__file__), '..', 'data')

def _read(f):
    p = os.path.join(RESULTS_DIR, f)
    return pd.read_csv(p) if os.path.exists(p) else pd.DataFrame()

def _json(df):
    return jsonify(df.replace({np.nan: None}).to_dict(orient='records'))

def _ema(s, span): return s.ewm(span=span, adjust=False).mean()
def _rsi(close, p=14):
    d = close.diff(); g = d.clip(lower=0); l = -d.clip(upper=0)
    return 100 - 100/(1+g.ewm(com=p-1,adjust=False).mean()/l.ewm(com=p-1,adjust=False).mean())
def _macd(close):
    m = _ema(close,12)-_ema(close,26); return m, _ema(m,9)


@app.route('/api/summary')
def summary():
    reg = _read('regression_metrics.csv')
    cls = _read('classification_metrics.csv')
    hc  = _read('high_conf_stats.csv')

    result = {'best_regression':None,'best_classification':None,'model_count':0,
              'high_conf_accuracy':None,'high_conf_threshold':60}

    if not reg.empty:
        reg = reg.dropna(subset=['RMSE'])
        row = reg.loc[reg['RMSE'].idxmin()]
        result['best_regression'] = {
            'model': row['model'], 'rmse': round(float(row['RMSE']),6),
            'mae': round(float(row['MAE']),6),
            'r2': round(float(row['R2']),6) if pd.notna(row.get('R2')) else None,
        }
        result['model_count'] = len(reg)

    if not cls.empty:
        real = cls[~cls['model'].isin(['Majority Baseline'])]
        if not real.empty:
            row = real.loc[real['Accuracy'].idxmax()]
            result['best_classification'] = {
                'model': row['model'], 'accuracy': round(float(row['Accuracy']),4),
                'f1': round(float(row['F1']),4), 'precision': round(float(row['Precision']),4),
                'recall': round(float(row['Recall']),4),
            }

    if not hc.empty:
        result['high_conf_accuracy'] = round(float(hc['accuracy'].iloc[0])*100, 1)
        result['high_conf_threshold'] = int(hc['threshold'].iloc[0]*100)

    return jsonify(result)


@app.route('/api/price-history')
def price_history():
    cache = os.path.join(DATA_DIR,'daily.pkl')
    if not os.path.exists(cache): return jsonify([])
    with open(cache,'rb') as f: daily = pickle.load(f)
    daily = daily.iloc[-500:]
    return jsonify([{
        'date': d.strftime('%Y-%m-%d'),
        'open': round(float(r['Open']),2), 'high': round(float(r['High']),2),
        'low': round(float(r['Low']),2),   'close': round(float(r['Close']),2),
        'volume': round(float(r['Volume']),0),
    } for d,r in daily.iterrows()])


@app.route('/api/regression-metrics')
def regression_metrics():
    df = _read('regression_metrics.csv')
    if df.empty: return jsonify([])
    df['R2'] = pd.to_numeric(df['R2'], errors='coerce')
    return _json(df)

@app.route('/api/classification-metrics')
def classification_metrics(): return _json(_read('classification_metrics.csv'))

@app.route('/api/predictions')
def predictions():
    linear = _read('linear_preds.csv')
    rf     = _read('rf_preds.csv')
    best   = _read('best_preds.csv')
    if linear.empty: return jsonify([])
    df = linear[['date','actual','linear_pred','ridge_pred','lasso_pred']].copy()
    if not rf.empty and 'rf_reg_pred' in rf.columns:
        df = df.merge(rf[['date','rf_reg_pred']], on='date', how='left')
    if not best.empty:
        col = next((c for c in ['xgb_reg_pred','gb_reg_pred'] if c in best.columns), None)
        if col: df = df.merge(best[['date',col]].rename(columns={col:'gb_reg_pred'}), on='date', how='left')
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    return _json(df)

@app.route('/api/classification-preds')
def classification_preds():
    logistic = _read('logistic_preds.csv')
    best     = _read('best_preds.csv')
    if logistic.empty: return jsonify([])
    df = logistic[['date','actual','lr_pred']].copy()
    if not best.empty:
        pc = next((c for c in ['xgb_cls_proba','ens_cls_proba','gb_cls_proba'] if c in best.columns), None)
        pd_ = next((c for c in ['xgb_cls_pred','ens_cls_pred','gb_cls_pred'] if c in best.columns), None)
        if pc and pd_:
            df = df.merge(best[['date',pd_,pc]].rename(columns={pd_:'gb_cls_pred',pc:'gb_cls_proba'}), on='date', how='left')
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    return _json(df)

@app.route('/api/feature-importance')
def feature_importance():
    df = _read('best_feature_importance.csv')
    if df.empty: df = _read('feature_importance.csv')
    return _json(df)


@app.route('/api/advisor')
def advisor():
    cache = os.path.join(DATA_DIR,'daily.pkl')
    if not os.path.exists(cache):
        return jsonify({'error':'No cached data'}), 503
    with open(cache,'rb') as f: daily = pickle.load(f)

    daily['log_return'] = np.log(daily['Close']).diff()
    daily['EMA9']  = _ema(daily['Close'], 9)
    daily['EMA21'] = _ema(daily['Close'], 21)
    daily['RSI']   = _rsi(daily['Close'], 14)
    daily['MACD'], daily['MACD_sig'] = _macd(daily['Close'])
    daily.dropna(inplace=True)

    latest = daily.iloc[-1]
    signals, score = [], 0

    rsi = float(latest['RSI'])
    if   rsi < 30: signals.append({'name':'RSI (14)','value':f'{rsi:.1f}','signal':'Buy', 'note':'Oversold (<30)'}); score+=2
    elif rsi < 45: signals.append({'name':'RSI (14)','value':f'{rsi:.1f}','signal':'Buy', 'note':'Below midpoint'}); score+=1
    elif rsi > 70: signals.append({'name':'RSI (14)','value':f'{rsi:.1f}','signal':'Sell','note':'Overbought (>70)'}); score-=2
    elif rsi > 55: signals.append({'name':'RSI (14)','value':f'{rsi:.1f}','signal':'Sell','note':'Above midpoint'}); score-=1
    else:          signals.append({'name':'RSI (14)','value':f'{rsi:.1f}','signal':'Neutral','note':'Neutral (45–55)'})

    diff = float(latest['MACD']) - float(latest['MACD_sig'])
    if diff > 0: signals.append({'name':'MACD','value':f'{diff:+.1f}','signal':'Buy', 'note':'Above signal line'}); score+=1
    else:        signals.append({'name':'MACD','value':f'{diff:+.1f}','signal':'Sell','note':'Below signal line'}); score-=1

    close, ema21 = float(latest['Close']), float(latest['EMA21'])
    if close > ema21: signals.append({'name':'EMA21 Trend','value':f'${close:,.0f}','signal':'Buy', 'note':f'Above EMA (${ema21:,.0f})'}); score+=1
    else:             signals.append({'name':'EMA21 Trend','value':f'${close:,.0f}','signal':'Sell','note':f'Below EMA (${ema21:,.0f})'}); score-=1

    mom5 = float(daily['log_return'].iloc[-5:].mean())
    if   mom5 >  0.005: signals.append({'name':'5D Momentum','value':f'{mom5*100:+.3f}%','signal':'Buy',    'note':'Positive 5-day return'}); score+=1
    elif mom5 < -0.005: signals.append({'name':'5D Momentum','value':f'{mom5*100:+.3f}%','signal':'Sell',   'note':'Negative 5-day return'}); score-=1
    else:               signals.append({'name':'5D Momentum','value':f'{mom5*100:+.3f}%','signal':'Neutral','note':'Low momentum'})

    best_preds = _read('best_preds.csv')
    model_prob = 50.0
    prob_col = next((c for c in ['xgb_cls_proba','ens_cls_proba','gb_cls_proba'] if c in best_preds.columns), None)
    if prob_col and not best_preds.empty:
        model_prob = round(float(best_preds[prob_col].iloc[-20:].mean())*100, 1)

    if   model_prob > 55: signals.append({'name':'ML Model','value':f'{model_prob}%','signal':'Buy', 'note':f'{model_prob}% prob up move'}); score+=2
    elif model_prob > 52: signals.append({'name':'ML Model','value':f'{model_prob}%','signal':'Buy', 'note':'Slight upside lean'}); score+=1
    elif model_prob < 45: signals.append({'name':'ML Model','value':f'{model_prob}%','signal':'Sell','note':f'{100-model_prob:.1f}% prob down'}); score-=2
    elif model_prob < 48: signals.append({'name':'ML Model','value':f'{model_prob}%','signal':'Sell','note':'Slight downside lean'}); score-=1
    else:                 signals.append({'name':'ML Model','value':f'{model_prob}%','signal':'Neutral','note':'Inconclusive (~50%)'})

    composite = ('Strong Buy' if score>=4 else 'Buy' if score>=2 else 'Hold' if score>=-1 else 'Sell' if score>=-3 else 'Strong Sell')
    vol_ann = float(daily['log_return'].iloc[-30:].std()) * np.sqrt(252)
    risk    = 'Low' if vol_ann < 0.5 else 'Medium' if vol_ann < 0.8 else 'High'

    return jsonify({
        'signal': composite, 'score': int(score),
        'confidence': round(min(abs(score)/7,1.0)*100, 1),
        'signals': signals, 'risk_level': risk,
        'annualized_vol': round(vol_ann*100, 1),
        'latest_price': round(close, 2),
        'latest_date': daily.index[-1].strftime('%Y-%m-%d'),
        'model_prob': model_prob, 'rsi': round(rsi,1), 'macd_diff': round(diff,2),
    })


if __name__ == '__main__':
    print("BTC ML Dashboard API — http://localhost:5000")
    app.run(debug=True, port=5000, host='0.0.0.0')
