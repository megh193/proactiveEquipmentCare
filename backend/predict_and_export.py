import os
import pandas as pd
import numpy as np
from tensorflow import keras
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.getenv('MODEL_PATH', os.path.join(BASE_DIR, 'models', 'motor_lstm_model.h5'))
PROCESSED_DATA_PATH = os.getenv('PROCESSED_DATA_PATH', os.path.join(BASE_DIR, 'data', 'processed', 'processed_motor_data.csv'))
OUTPUT_PATH = os.getenv('OUTPUT_PATH', os.path.join(BASE_DIR, 'dashboard', 'motor_failure_predictions.csv'))

def load_model():
    return keras.models.load_model(MODEL_PATH)

def generate_predictions():
    model = load_model()
    data = pd.read_csv(PROCESSED_DATA_PATH)
    
    feature_cols = ['Air temperature [K]', 'Process temperature [K]', 'Rotational speed [rpm]', 
                    'Torque [Nm]', 'Tool wear [min]']
    X = data[feature_cols].values
    
    sequence_length = 30
    sequences = []
    indices = []
    
    for i in range(len(X) - sequence_length + 1):
        sequences.append(X[i:i + sequence_length])
        indices.append(i + sequence_length - 1)
    
    X_sequences = np.array(sequences)
    predictions = model.predict(X_sequences)
    
    results = pd.DataFrame({
        'timestamp': data['Timestamp'].iloc[indices],
        'motor_id': data['Product ID'].iloc[indices],
        'failure_probability': predictions.flatten()
    })
    
    results.to_csv(OUTPUT_PATH, index=False)
    print(f"Predictions saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    generate_predictions()
