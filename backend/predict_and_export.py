import pandas as pd
import numpy as np
from tensorflow import keras
import os

MODEL_PATH = "../models/motor_lstm_model.h5"
PROCESSED_DATA_PATH = "../data/processed/processed_motor_data.csv"
OUTPUT_PATH = "../dashboard/motor_failure_predictions.csv"

def load_model():
    return keras.models.load_model(MODEL_PATH)

def generate_predictions():
    model = load_model()
    data = pd.read_csv(PROCESSED_DATA_PATH)
    
    predictions = model.predict(data)
    
    results = pd.DataFrame({
        'timestamp': data['timestamp'],
        'motor_id': data['motor_id'],
        'failure_probability': predictions.flatten()
    })
    
    results.to_csv(OUTPUT_PATH, index=False)
    print(f"Predictions saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    generate_predictions()
