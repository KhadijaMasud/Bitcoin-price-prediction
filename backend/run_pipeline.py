"""
run_pipeline.py
===============
Runs the full ML pipeline end-to-end, then starts the Flask API.

Usage:
    cd backend
    python run_pipeline.py            # run everything + start API
    python run_pipeline.py --train    # re-train all models (takes ~5 min)
    python run_pipeline.py --api      # start API only (uses saved results)
"""

import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(__file__))


def run_training():
    print("\n" + "=" * 65)
    print("PHASE 3: Linear Models (Linear, Ridge, Lasso)")
    print("=" * 65)
    from models_linear import run_all as run_linear
    run_linear(save_results=True)

    print("\n" + "=" * 65)
    print("PHASE 4: Logistic Regression")
    print("=" * 65)
    from models_logistic import run_all as run_logistic
    run_logistic(save_results=True)

    print("\n" + "=" * 65)
    print("PHASE 5: Random Forest")
    print("=" * 65)
    from models_rf import run_all as run_rf
    run_rf(save_results=True)

    print("\n" + "=" * 65)
    print("PHASE 6: Gradient Boosting (Best Model)")
    print("=" * 65)
    from models_best import run_all as run_best
    run_best(save_results=True)

    print("\n✓ Training complete — all results saved to data/results/")


def start_api():
    print("\nStarting Flask API on http://localhost:5000 ...")
    print("  Open http://localhost:3000 in your browser after starting the React frontend.\n")
    from api import app
    app.run(debug=False, port=5000, host='0.0.0.0')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--train', action='store_true', help='Re-run all model training')
    parser.add_argument('--api',   action='store_true', help='Start API only')
    args = parser.parse_args()

    if args.api:
        start_api()
    elif args.train:
        run_training()
        start_api()
    else:
        # Default: train if no results exist, then start API
        results_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'results')
        has_results = os.path.exists(os.path.join(results_dir, 'regression_metrics.csv'))

        if not has_results:
            print("No cached results found — running full training pipeline...")
            run_training()
        else:
            print("Cached results found. Use --train to retrain. Starting API...")

        start_api()
